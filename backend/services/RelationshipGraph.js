/**
 * RelationshipGraph
 *
 * Deterministic relationship graph engine.
 *
 * Contacts are nodes. Edges represent relationship types.
 * Supports warm intro path scoring, centrality, and leverage lookup.
 *
 * All graph math is deterministic. AI may annotate paths, not compute them.
 */

// ─── Edge types ──────────────────────────────────────────────────────────────

export const EDGE_TYPES = [
  'knows',
  'worked_with',
  'introduced',
  'advises',
  'invested_in',
  'referred',
  'met_with',
  'board_relationship',
  'banking_relationship',
  'legal_relationship',
  'operator_relationship',
];

export const EDGE_STRENGTH_LEVELS = ['weak', 'moderate', 'strong', 'trusted'];

// ─── Edge strength numeric map ────────────────────────────────────────────────

const STRENGTH_SCORE = {
  trusted:  100,
  strong:    80,
  moderate:  55,
  weak:      25,
};

const TYPE_BASE_STRENGTH = {
  works_with:           75,
  introduced:           80,
  advises:              85,
  invested_in:          70,
  referred:             85,
  board_relationship:   80,
  banking_relationship: 65,
  legal_relationship:   65,
  operator_relationship:65,
  met_with:             50,
  knows:                40,
};

// ─── Graph store (in-memory adjacency map) ────────────────────────────────────

/**
 * Build an adjacency map from a flat edge list.
 * @param {object[]} edges - relationship edge records
 * @returns {Map<string, object[]>} nodeId → outbound edges
 */
export function buildAdjacencyMap(edges) {
  const map = new Map();
  for (const edge of edges) {
    const { from_contact_id, to_contact_id } = edge;
    if (!from_contact_id || !to_contact_id) continue;
    if (!map.has(from_contact_id)) map.set(from_contact_id, []);
    map.get(from_contact_id).push(edge);
    // undirected — add reverse edge if not already present
    if (!map.has(to_contact_id)) map.set(to_contact_id, []);
    map.get(to_contact_id).push({ ...edge, from_contact_id: to_contact_id, to_contact_id: from_contact_id, _reversed: true });
  }
  return map;
}

// ─── Warm intro path scoring ─────────────────────────────────────────────────
//
// Path score weights (sum to 100):
//   path_length_inverse    35  — 1-hop beats 2-hop beats 3-hop
//   edge_strength          20
//   recency                15
//   relationship_trust     15
//   intermediary_influence 10
//   reliability            5

const PATH_WEIGHTS = {
  path_length_inverse:    35,
  edge_strength:          20,
  recency:                15,
  relationship_trust:     15,
  intermediary_influence: 10,
  reliability:             5,
};

/**
 * Score a single warm intro path (array of edges from source to target).
 * @param {object[]} pathEdges - ordered edges in the path
 * @param {Map<string,object>} contactMap - contactId → contact record
 * @returns {{ path_score: number, path_explanation: string }}
 */
export function scoreIntroPath(pathEdges, contactMap) {
  if (!pathEdges.length) return { path_score: 0, path_explanation: 'no path' };

  const hops = pathEdges.length;

  // path_length_inverse: direct(1)=100, 1-hop=70, 2-hop=45, 3+=20
  const lengthScores = { 1: 100, 2: 70, 3: 45 };
  const lengthScore  = lengthScores[hops] ?? 20;

  // edge_strength: average across all edges in path
  const avgEdgeStrength = pathEdges.reduce((sum, e) => {
    const s = STRENGTH_SCORE[e.strength] ?? TYPE_BASE_STRENGTH[e.edge_type] ?? 40;
    return sum + s;
  }, 0) / hops;

  // recency: most recent edge last_verified_at or created_at
  const recencyScore = _recencyScore(pathEdges);

  // relationship_trust: average of edge confidence fields (0-100)
  const avgTrust = pathEdges.reduce((sum, e) => sum + (e.confidence ?? 50), 0) / hops;

  // intermediary_influence: influence of middle nodes
  let influenceScore = 100;
  if (hops > 1) {
    const intermediaryIds = pathEdges.slice(0, -1).map((e) => e.to_contact_id);
    const influences = intermediaryIds.map((id) => {
      const c = contactMap?.get(id);
      return c?.influenceScore ? c.influenceScore * 10 : 50;
    });
    influenceScore = influences.reduce((s, v) => s + v, 0) / influences.length;
  }

  // reliability: edge source confidence
  const avgReliability = pathEdges.reduce((sum, e) => {
    const srcScore = e.source === 'verified' ? 100 : e.source === 'logged' ? 70 : 50;
    return sum + srcScore;
  }, 0) / hops;

  const path_score = Math.round(
    lengthScore       * (PATH_WEIGHTS.path_length_inverse    / 100) +
    avgEdgeStrength   * (PATH_WEIGHTS.edge_strength          / 100) +
    recencyScore      * (PATH_WEIGHTS.recency                / 100) +
    avgTrust          * (PATH_WEIGHTS.relationship_trust     / 100) +
    influenceScore    * (PATH_WEIGHTS.intermediary_influence / 100) +
    avgReliability    * (PATH_WEIGHTS.reliability            / 100)
  );

  const path_explanation = hops === 1
    ? `Direct connection via ${pathEdges[0].edge_type}`
    : `${hops}-hop path through ${pathEdges.slice(0, -1).map((e) => e.to_contact_id).join(' → ')}`;

  return { path_score: Math.min(100, path_score), path_explanation, hops };
}

/**
 * Find best warm intro paths from a source contact to a target contact.
 * Uses BFS up to 2 hops (3-hop paths treated as cold).
 *
 * @param {string}              sourceId   - ID of the firm/user's strongest advocate or self
 * @param {string}              targetId   - ID of the target (candidate, investor, etc.)
 * @param {Map<string,object[]>}adjacency  - from buildAdjacencyMap
 * @param {Map<string,object>}  contactMap - contactId → contact record
 * @param {number}              maxHops    - default 2
 * @returns {{ best_path: object|null, all_paths: object[], best_path_score: number }}
 */
export function findIntroPaths(sourceId, targetId, adjacency, contactMap, maxHops = 2) {
  if (!sourceId || !targetId || sourceId === targetId) {
    return { best_path: null, all_paths: [], best_path_score: 0 };
  }

  const foundPaths = [];

  // BFS
  const queue = [{ nodeId: sourceId, edges: [] }];
  const visited = new Set([sourceId]);

  while (queue.length > 0) {
    const { nodeId, edges } = queue.shift();
    if (edges.length > maxHops) continue;

    const outEdges = adjacency.get(nodeId) ?? [];
    for (const edge of outEdges) {
      const nextId = edge.to_contact_id;
      if (visited.has(nextId)) continue;

      const newPath = [...edges, edge];
      if (nextId === targetId) {
        const scored = scoreIntroPath(newPath, contactMap);
        foundPaths.push({ edges: newPath, ...scored });
        continue; // don't go deeper once we find target
      }

      if (newPath.length < maxHops) {
        visited.add(nextId);
        queue.push({ nodeId: nextId, edges: newPath });
      }
    }
  }

  foundPaths.sort((a, b) => b.path_score - a.path_score);

  return {
    best_path:       foundPaths[0] ?? null,
    all_paths:       foundPaths,
    best_path_score: foundPaths[0]?.path_score ?? 0,
    path_count:      foundPaths.length,
  };
}

// ─── Network centrality ───────────────────────────────────────────────────────

const HIGH_VALUE_CONTACT_TYPES = new Set([
  'banker', 'attorney', 'cpa', 'capital_partner',
  'board_candidate', 'operator', 'networking_contact',
]);

const BOARD_OR_INVESTOR_EDGE_TYPES = new Set([
  'board_relationship', 'banking_relationship', 'legal_relationship',
  'invested_in', 'advises', 'introduced', 'referred',
]);

/**
 * Compute simple deterministic centrality for a contact.
 * Components:
 *   high_value_connections        — count of edges to high-value contacts
 *   active_edges                  — edges updated/verified recently
 *   board_investor_deal_edges     — edges of relevant types
 *   successful_intro_paths        — edges of type 'introduced' or 'referred'
 *   weighted_trust_of_neighbors   — avg strength of edges
 *
 * @param {string}               contactId
 * @param {Map<string,object[]>} adjacency
 * @param {Map<string,object>}   contactMap
 * @returns {{ centrality_score: number, components: object }}
 */
export function calcCentrality(contactId, adjacency, contactMap) {
  const edges = adjacency.get(contactId) ?? [];

  const highValueConns = edges.filter((e) => {
    const neighbor = contactMap?.get(e.to_contact_id);
    return neighbor && HIGH_VALUE_CONTACT_TYPES.has(neighbor.contactType ?? neighbor.contact_type);
  }).length;

  const cutoff = Date.now() - 180 * 86_400_000; // 6 months
  const activeEdges = edges.filter((e) => {
    const t = e.last_verified_at ?? e.created_at;
    return t && new Date(t).getTime() > cutoff;
  }).length;

  const boardInvestorEdges = edges.filter((e) =>
    BOARD_OR_INVESTOR_EDGE_TYPES.has(e.edge_type)
  ).length;

  const successfulIntros = edges.filter((e) =>
    e.edge_type === 'introduced' || e.edge_type === 'referred'
  ).length;

  const avgTrust = edges.length
    ? edges.reduce((s, e) => s + (STRENGTH_SCORE[e.strength] ?? 40), 0) / edges.length
    : 0;

  // Normalize and weight
  const score = Math.round(
    Math.min(1, highValueConns  / 10) * 30 +
    Math.min(1, activeEdges     / 5)  * 20 +
    Math.min(1, boardInvestorEdges/5) * 25 +
    Math.min(1, successfulIntros/ 3)  * 15 +
    (avgTrust / 100)                  * 10
  );

  return {
    centrality_score: Math.min(100, score),
    components: {
      high_value_connections:      highValueConns,
      active_edges:                activeEdges,
      board_investor_deal_edges:   boardInvestorEdges,
      successful_intro_paths:      successfulIntros,
      weighted_trust_of_neighbors: Math.round(avgTrust),
    },
  };
}

// ─── Graph summary / high-value nodes ─────────────────────────────────────────

/**
 * Return the highest-leverage contacts — those who unlock the most targets.
 * "Unlock" = has a direct edge to multiple board candidates, investors, or deal targets.
 */
export function getHighValueNodes(contacts, edges, { limit = 20, minCentrality = 30 } = {}) {
  const adjacency  = buildAdjacencyMap(edges);
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return contacts
    .map((c) => {
      const { centrality_score, components } = calcCentrality(c.id, adjacency, contactMap);
      return { ...c, centrality_score, centrality_components: components };
    })
    .filter((c) => c.centrality_score >= minCentrality)
    .sort((a, b) => b.centrality_score - a.centrality_score)
    .slice(0, limit);
}

/**
 * Return contacts who can unlock multiple targets (board candidates, investors).
 * These are potential "capital connectors" or key introducers.
 */
export function getKeyIntroducers(contacts, edges, targetIds) {
  const targetSet  = new Set(targetIds);
  const adjacency  = buildAdjacencyMap(edges);

  return contacts
    .map((c) => {
      const outEdges = adjacency.get(c.id) ?? [];
      const unlocks  = outEdges.filter((e) => targetSet.has(e.to_contact_id));
      return { ...c, unlocks_count: unlocks.length, unlocks_targets: unlocks.map((e) => e.to_contact_id) };
    })
    .filter((c) => c.unlocks_count > 0)
    .sort((a, b) => b.unlocks_count - a.unlocks_count);
}

/**
 * Full network context for a given contact:
 * - Their centrality
 * - Clusters they belong to (board, investor, deal)
 * - Who they can introduce
 * - Their leverage rating
 */
export function getNetworkContext(contactId, contacts, edges) {
  const adjacency  = buildAdjacencyMap(edges);
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const { centrality_score, components } = calcCentrality(contactId, adjacency, contactMap);
  const outEdges = adjacency.get(contactId) ?? [];

  const neighbors = outEdges.map((e) => ({
    contact_id: e.to_contact_id,
    contact:    contactMap.get(e.to_contact_id) ?? null,
    edge_type:  e.edge_type,
    strength:   e.strength,
  }));

  const canIntroduce = outEdges
    .filter((e) => ['board_relationship', 'banking_relationship', 'invested_in', 'advises', 'referred'].includes(e.edge_type))
    .map((e) => e.to_contact_id);

  return {
    contact_id:          contactId,
    centrality_score,
    centrality_components: components,
    neighbor_count:      outEdges.length,
    neighbors,
    can_introduce_to:    canIntroduce,
    leverage_label:      centrality_score >= 70 ? 'high_leverage' : centrality_score >= 40 ? 'moderate_leverage' : 'low_leverage',
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _recencyScore(edges) {
  const now = Date.now();
  const latestMs = Math.max(...edges.map((e) => {
    const t = e.last_verified_at ?? e.updated_at ?? e.created_at;
    return t ? new Date(t).getTime() : 0;
  }));
  if (latestMs === 0) return 25;
  const daysSince = (now - latestMs) / 86_400_000;
  if (daysSince < 30)  return 100;
  if (daysSince < 90)  return 80;
  if (daysSince < 180) return 55;
  if (daysSince < 365) return 35;
  return 15;
}

export default {
  EDGE_TYPES,
  EDGE_STRENGTH_LEVELS,
  buildAdjacencyMap,
  scoreIntroPath,
  findIntroPaths,
  calcCentrality,
  getHighValueNodes,
  getKeyIntroducers,
  getNetworkContext,
};
