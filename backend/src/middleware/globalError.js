import env from '../config/env.js';

export function globalError(err, req, res, _next) {
  const status  = err.status ?? err.statusCode ?? 500;
  const code    = err.code ?? 'INTERNAL_ERROR';
  const message = env.isProd ? 'An unexpected error occurred' : (err.message ?? 'Unknown error');

  (req.log ?? console)[status >= 500 ? 'error' : 'warn']({ err, reqId: req.id }, 'Request error');

  res.status(status).json({
    error: {
      code,
      message,
      requestId: req.id,
      ...((!env.isProd && err.stack) ? { stack: err.stack } : {}),
    },
  });
}
