import { errorResponse } from './errorResponse.js';

export function notFound(req, res) {
  errorResponse(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
}
