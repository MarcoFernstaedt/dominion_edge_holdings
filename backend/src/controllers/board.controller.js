import { z }               from 'zod';
import store               from '../store.js';
import ModelGateway        from '../../services/ModelGateway.js';
import BoardSeatEngine     from '../../services/BoardSeatEngine.js';
import BoardCandidateScoring from '../../services/BoardCandidateScoring.js';
import { errorResponse }   from '../middleware/errorResponse.js';
import { uid, nowIso, candidateSeatType } from '../lib/helpers.js';

export function listSeats(_req, res) {
  res.json(store.boardSeats);
}

export function listCandidates(req, res) {
  try {
    const { seatId, status } = req.query;
    let results = [...store.boardCandidates];
    if (seatId)  results = results.filter((c) => c.seatId  === seatId);
    if (status)  results = results.filter((c) => c.status  === status);
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve candidates');
  }
}

export function createCandidate(req, res) {
  try {
    const candidate = { id: uid(), createdAt: nowIso(), updatedAt: nowIso(), status: 'identified', ...req.validated };
    store.boardCandidates.push(candidate);
    res.status(201).json(candidate);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create candidate');
  }
}

export function updateCandidate(req, res) {
  try {
    const idx = store.boardCandidates.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Candidate not found');
    store.boardCandidates[idx] = { ...store.boardCandidates[idx], ...req.validated, updatedAt: nowIso() };
    res.json(store.boardCandidates[idx]);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update candidate');
  }
}

export function listCapTable(_req, res) {
  res.json(store.capTable);
}

export function createCapTableEntry(req, res) {
  try {
    const entry = { id: uid(), createdAt: nowIso(), ...req.body };
    store.capTable.push(entry);
    res.status(201).json(entry);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to add cap table entry');
  }
}

export function deleteCapTableEntry(req, res) {
  try {
    store.capTable = store.capTable.filter((e) => e.id !== req.params.id);
    res.status(204).end();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to remove cap table entry');
  }
}

export function getSeatsHealth(req, res) {
  try {
    const result = BoardSeatEngine.calcBoardReadinessScore(store.boardSeats, store.boardCandidates);
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute board seat health');
  }
}

export function listCandidatesBySeatType(req, res) {
  try {
    const { seatType } = req.params;
    let candidates = store.boardCandidates.filter((c) => candidateSeatType(c) === seatType);
    if (req.query.includeScores !== 'false') {
      candidates = BoardCandidateScoring.rankCandidates(candidates, seatType);
    }
    res.json({ seat_type: seatType, ranked_candidates: candidates, total: candidates.length });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to rank candidates');
  }
}

export function getCandidateFit(req, res) {
  try {
    const candidate = store.boardCandidates.find((c) => c.id === req.params.id);
    if (!candidate) return errorResponse(res, 404, 'NOT_FOUND', 'Candidate not found');
    const seatType = candidateSeatType(candidate) || String(req.query.seatType ?? '');
    const scored   = BoardCandidateScoring.scoreCandidateFull(candidate, seatType);
    res.json(scored);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute fit score');
  }
}

export async function getCandidateRankCommentary(req, res) {
  try {
    const candidate = store.boardCandidates.find((c) => c.id === req.params.id);
    if (!candidate) return errorResponse(res, 404, 'NOT_FOUND', 'Candidate not found');
    const seatType = candidateSeatType(candidate) || String(req.body.seatType ?? '');
    const scored   = BoardCandidateScoring.scoreCandidateFull(candidate, seatType);
    const prompt   = `You are evaluating a board candidate for a ${seatType} seat.\n\nCandidate: ${candidate.name}\nFit Score: ${scored.fit_score} (${scored.fit_label})\nCommitment Probability: ${scored.commitment_probability}%\nFit Components: ${JSON.stringify(scored.fit_components)}\nBio: ${candidate.bio ?? 'Not provided'}\nNotes: ${candidate.notes ?? ''}\n\nProvide a concise (2-3 sentence) ranking commentary explaining why this candidate ranks where they do, what would improve their score, and the one best next step to advance them. Be direct and specific.`;
    const commentary = await ModelGateway.callAnthropic({ prompt, maxTokens: 300, model: 'LOW' });
    res.json({ candidate_id: candidate.id, fit_score: scored.fit_score, fit_label: scored.fit_label, commentary: commentary?.content ?? '' });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to generate commentary');
  }
}
