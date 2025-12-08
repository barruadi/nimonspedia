const jwt = require('jsonwebtoken');
const db = require('../config/db');

const verifyUser = async (req, res, next) => {
  try {
    let userId = null;

    // Strategy 1: Check JWT Token (Primary - for React Admin Dashboard)
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7); // Remove "Bearer " prefix
        const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const decoded = jwt.verify(token, secret);

        userId = decoded.user_id || decoded.id;
        
        if (userId) {
          console.log(`[Auth/JWT] Using JWT authentication for user: ${userId}`);
        }
      } catch (jwtError) {
        console.warn('[Auth/JWT] JWT verification failed:', jwtError.message);
        // Fall through to body user_id check
      }
    }

    // Strategy 2: Check user_id from request body (PHP frontend for POST)
    if (!userId && req.body && req.body.user_id) {
      userId = req.body.user_id;
      console.log(`[Auth/Body] Using user_id from request body: ${userId}`);
    }

    // Strategy 3: Check user_id from query params (PHP frontend for GET)
    if (!userId && req.query && req.query.user_id) {
      userId = parseInt(req.query.user_id);
      console.log(`[Auth/Query] Using user_id from query param: ${userId}`);
    }

    // If we have a user_id, verify it exists in database
    if (userId) {
      try {
        const pool = db.getInstance();
        const userQuery = `
          SELECT 
            user_id, 
            email, 
            full_name, 
            role, 
            balance,
            address,
            created_at
          FROM users 
          WHERE user_id = $1
        `;
        
        const userResult = await pool.query(userQuery, [userId]);
        
        if (userResult.rows.length === 0) {
          console.warn(`[Auth] User ${userId} not found in database`);
          return res.status(401).json({
            ok: false,
            error: 'Akses ditolak. User tidak ditemukan.'
          });
        }

        const user = userResult.rows[0];

        // Attach user info to request object
        req.userId = user.user_id;
        req.userRole = user.role;
        req.user = user;

        console.log(`[Auth] Authenticated user: ${req.userId} (${user.email}) role: ${req.userRole}`);
        return next();

      } catch (dbError) {
        console.error('[Auth] Database query failed:', dbError);
        return res.status(500).json({
          ok: false,
          error: 'Internal server error'
        });
      }
    }

    // No authentication method succeeded
    console.warn('[Auth] No valid authentication method found');
    return res.status(401).json({
      ok: false,
      error: 'Akses ditolak. Silakan login.'
    });

  } catch (error) {
    console.error('[Auth] Unexpected middleware error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
};

module.exports = verifyUser;
