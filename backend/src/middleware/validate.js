import { errorResponse } from './errorResponse.js';

/**
 * Zod validation middleware factory.
 * Validates req.body against schema; attaches result to req.validated.
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid request body', result.error.flatten());
    }
    req.validated = result.data;
    next();
  };
}

/**
 * Wraps an async route handler so unhandled promise rejections are forwarded
 * to Express error handler instead of crashing the process.
 */
export function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
