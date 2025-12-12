const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Express middleware for JWT authentication
const authJWT = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);

    // Verify with explicit algorithm to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'] // Whitelist allowed algorithms
    });

    req.user = decoded;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ ok: false, error: 'Token expired' });
    }
    return res.status(401).json({ ok: false, error: 'Invalid token' });
  }
};

// Express middleware for admin-only access
const adminOnly = (req, res, next) => {
  const user = req.user;

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Admin access required' });
  }

  next();
};

module.exports = { authJWT, adminOnly, JWT_SECRET };
