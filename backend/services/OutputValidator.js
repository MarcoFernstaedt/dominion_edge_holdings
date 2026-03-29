/**
 * OutputValidator — lightweight structured output schema validator.
 *
 * Validates AI-generated JSON against expected output shapes.
 * Used by ModelGateway after every parse to catch malformed outputs
 * before they propagate into business logic.
 *
 * Rules:
 * - Required fields must be present and non-null
 * - Type checks are lenient (warn, not block)
 * - Missing optional fields are fine
 * - Extra fields are ignored
 * - Validation failure = warning + confidence downgrade, not hard throw
 */

/**
 * @typedef {object} FieldSpec
 * @property {'string'|'number'|'boolean'|'array'|'object'} type
 * @property {boolean} [required]
 * @property {string[]} [allowedValues]
 */

/**
 * Validate a parsed AI output object against a schema spec.
 *
 * Schema format:
 *   { fieldName: { type, required, allowedValues? } }
 *   or shorthand: { fieldName: 'string' }
 *
 * @param {object} output
 * @param {object} schema
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validate(output, schema) {
  const errors   = [];
  const warnings = [];

  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    errors.push('Output is not a plain object');
    return { valid: false, errors, warnings };
  }

  for (const [field, spec] of Object.entries(schema)) {
    const rule     = typeof spec === 'string' ? { type: spec, required: false } : spec;
    const value    = output[field];
    const missing  = value === undefined || value === null;

    if (missing) {
      if (rule.required) errors.push(`Required field missing: ${field}`);
      continue;
    }

    // Type check
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (rule.type && actualType !== rule.type) {
      warnings.push(`Field ${field}: expected ${rule.type}, got ${actualType}`);
    }

    // Allowed values
    if (rule.allowedValues && !rule.allowedValues.includes(value)) {
      warnings.push(`Field ${field}: value "${value}" not in [${rule.allowedValues.join(', ')}]`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── Pre-built schemas for common agent outputs ───────────────────────────────

export const SCHEMAS = {
  base_agent_output: {
    agent_name:          { type: 'string',  required: true },
    summary:             { type: 'string',  required: true },
    recommended_actions: { type: 'array',   required: false },
    risks:               { type: 'array',   required: false },
    missing_information: { type: 'array',   required: false },
    confidence:          { type: 'string',  required: true, allowedValues: ['low', 'medium', 'high'] },
    approval_required:   { type: 'boolean', required: true },
    fallback_used:       { type: 'boolean', required: false },
  },

  classification: {
    classification:      { type: 'string',  required: true },
    confidence:          { type: 'string',  required: true, allowedValues: ['low', 'medium', 'high'] },
    reasoning:           { type: 'string',  required: false },
    recommended_action:  { type: 'string',  required: false },
  },

  short_summary: {
    summary:             { type: 'string',  required: true },
    key_facts:           { type: 'array',   required: false },
    missing_data:        { type: 'array',   required: false },
    confidence:          { type: 'string',  required: true },
  },

  outreach_draft: {
    message_variants:    { type: 'array',   required: true },
    recommended_variant: { type: 'number',  required: false },
    subject_line:        { type: 'string',  required: false },
    cta:                 { type: 'string',  required: false },
    tone_note:           { type: 'string',  required: false },
    approval_required:   { type: 'boolean', required: true },
  },

  meeting_prep: {
    prep_brief:          { type: 'string',  required: true },
    agenda:              { type: 'array',   required: false },
    likely_objections:   { type: 'array',   required: false },
    talking_points:      { type: 'array',   required: false },
    follow_up_paths:     { type: 'array',   required: false },
    confidence:          { type: 'string',  required: true },
  },

  deal_snapshot: {
    summary:             { type: 'string',  required: true },
    key_risks:           { type: 'array',   required: false },
    recommended_next_step: { type: 'string', required: false },
    confidence:          { type: 'string',  required: true },
    missing_information: { type: 'array',   required: false },
  },
};

export default { validate, SCHEMAS };
