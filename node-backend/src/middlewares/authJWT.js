const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Hono-style middleware untuk JWT authentication
const authJWT = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    
    // Verify with explicit algorithm to prevent algorithm confusion attacks
    const decoded = jwt.verify(token, JWT_SECRET, { 
      algorithms: ['HS256'] // Whitelist allowed algorithms
    });
    
    c.set('user', decoded);
    
    await next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return c.json({ ok: false, error: 'Token expired' }, 401);
    }
    return c.json({ ok: false, error: 'Invalid token' }, 401);
  }
};

// Hono-style middleware untuk admin-only access
const adminOnly = async (c, next) => {
  const user = c.get('user');
  
  if (!user || user.role !== 'admin') {
    return c.json({ ok: false, error: 'Admin access required' }, 403);
  }
  
  await next();
};

module.exports = { authJWT, adminOnly, JWT_SECRET };
