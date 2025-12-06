/**
 * Error Handling Middleware
 * Catches all errors and returns consistent JSON response
 * 
 * Usage: router.use(errorMiddleware)
 * Must be the LAST middleware in the chain
 */
const errorMiddleware = (err, req, res, next) => {
  console.error('[Error] Middleware caught error:', {
    message: err.message,
    status: err.status || 500,
    stack: err.stack
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      ok: false,
      error: 'Validation error',
      details: err.message
    });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      ok: false,
      error: 'Resource not found'
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized'
    });
  }

  if (err.name === 'ForbiddenError') {
    return res.status(403).json({
      ok: false,
      error: 'Forbidden'
    });
  }

  // Default error response
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return res.status(statusCode).json({
    ok: false,
    error: message
  });
};

module.exports = errorMiddleware;
