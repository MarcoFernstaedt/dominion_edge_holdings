import crypto from 'crypto';
import { DEFAULT_AI_MODEL, VALID_MODEL_PATTERN } from '../config/constants.js';

/** Generate a random UUID. */
export function uid() {
  return crypto.randomUUID();
}

/** Current time as ISO string. */
export function nowIso() {
  return new Date().toISOString();
}

/** Find an item by id in a collection, or return null. */
export function findById(collection, id) {
  return collection.find((item) => item.id === id) ?? null;
}

/**
 * Returns the seat type from a candidate record, tolerating both camelCase
 * and legacy snake_case field names.
 */
export function candidateSeatType(candidate) {
  return candidate.seatType ?? candidate.seat_type ?? '';
}

/**
 * Stamps lastInteractionAt, updatedAt, pipelinePressureLevel, and
 * daysSinceLastInteraction on an entity in a store collection.
 */
export function touchEntity(collection, id, now) {
  const idx = collection.findIndex((e) => e.id === id);
  if (idx === -1) return;
  collection[idx] = {
    ...collection[idx],
    updatedAt:                now,
    lastInteractionAt:        now,
    pipelinePressureLevel:    'active',
    daysSinceLastInteraction: 0,
  };
}

/**
 * Returns a safe, whitelisted Anthropic model ID from a settings object.
 * Falls back to the default model if the stored value is invalid.
 */
export function getSafeModel(settings = {}) {
  const model = settings.primaryModel || DEFAULT_AI_MODEL;
  return VALID_MODEL_PATTERN.test(model) ? model : DEFAULT_AI_MODEL;
}
