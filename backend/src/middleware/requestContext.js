import crypto from 'crypto';

/**
 * Attaches a unique request ID and a child logger to every request.
 * Logs response status + latency on finish.
 */
export function requestContext(logger) {
  return (req, res, next) => {
    req.id  = crypto.randomUUID();
    req.log = logger.child({ reqId: req.id });
    const start = Date.now();
    res.on('finish', () => {
      const ms    = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      req.log[level]({ method: req.method, url: req.url, status: res.statusCode, ms });
    });
    next();
  };
}
