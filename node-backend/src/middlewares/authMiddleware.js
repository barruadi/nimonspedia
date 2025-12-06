const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Hybrid Authentication Middleware
 * 
 * Implements multi-strategy authentication with priority order:
 * 1. JWT Token (Admin via React Dashboard) - Primary
 * 2. PHP Session Cookie (Buyer/Seller via Legacy) - Fallback
 * 3. Reject Request (401 Unauthorized)
 * 
 * Architecture:
 * - Frontend (Legacy PHP): Session-based (PHPSESSID cookie)
 * - Admin Dashboard (React): JWT-based (Bearer token)
 * - Database: PostgreSQL (shared across PHP and Node.js)
 * 
 * Usage: router.use(verifyUser)
 */
const verifyUser = async (req, res, next) => {
  try {
    // 1. Check JWT Token (Primary)
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7); // Remove "Bearer " prefix
        const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
        const decoded = jwt.verify(token, secret);

        // Query database for complete user details
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
        
        const userResult = await pool.query(userQuery, [decoded.user_id || decoded.id]);
        
        if (userResult.rows.length === 0) {
          return res.status(401).json({
            ok: false,
            error: 'User not found in database'
          });
        }

        const user = userResult.rows[0];

        // Attach user info to request object
        req.userId = user.user_id;
        req.userRole = user.role;
        req.user = user;
        req.authMethod = 'jwt'; // Track auth method

        console.log(`[Auth/JWT] Authenticated user: ${req.userId} (${user.email}) role: ${req.userRole}`);
        return next();

      } catch (jwtError) {
        // JWT verification failed, continue to Session Cookie check
        if (jwtError.name === 'TokenExpiredError') {
          console.warn('[Auth/JWT] Token expired');
        } else if (jwtError.name === 'JsonWebTokenError') {
          console.warn('[Auth/JWT] Invalid token');
        } else {
          console.warn('[Auth/JWT] Token error:', jwtError.message);
        }
        // Fall through to Step 2 (Session Cookie)
      }
    }

    // 2. Check Session Cookie (Fallback)
    
    // Option A: Check x-user-id header (Development Mode)
    // TODO: Replace this with proper Redis/File Session Store verification in production
    const xUserId = req.headers['x-user-id'];
    
    if (xUserId) {
      try {
        const userId = parseInt(xUserId, 10);

        if (isNaN(userId)) {
          console.warn('[Auth/Header] Invalid user ID format in x-user-id header');
          throw new Error('Invalid user ID');
        }

        // Query database for user details
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
          console.warn(`[Auth/Header] User ${userId} not found in database`);
          throw new Error('User not found');
        }

        const user = userResult.rows[0];

        // Attach user info to request object
        req.userId = user.user_id;
        req.userRole = user.role;
        req.user = user;
        req.authMethod = 'session'; // Track auth method

        console.log(`[Auth/Session] Authenticated user: ${req.userId} (${user.email}) role: ${req.userRole}`);
        return next();

      } catch (sessionError) {
        console.warn('[Auth/Session] Session validation failed:', sessionError.message);
        // Fall through to Option B (PHPSESSID)
      }
    }

    // Option B: Check PHPSESSID cookie
    // TODO: In production, integrate with Redis/File Session Store to validate PHP sessions
    // Currently: Assume valid session if PHPSESSID exists (placeholder for dev)
    const cookieHeader = req.headers.cookie;
    
    if (cookieHeader) {
      try {
        // Parse cookies manually
        const cookies = parseCookies(cookieHeader);
        const phpSessionId = cookies['PHPSESSID'];

        if (phpSessionId) {
          // TODO: For production, validate phpSessionId against actual PHP session store
          // Example pseudo-code:
          // const sessionData = await redisClient.get(`PHPSESSID:${phpSessionId}`);
          // if (!sessionData) throw new Error('Invalid PHP session');
          // const userData = JSON.parse(sessionData);
          
          // For now (development), extract user_id from the request body or query
          // or use a mock verification system
          
          console.warn('[Auth/Session] PHPSESSID detected but session store not yet integrated');
          console.warn('[Auth/Session] TODO: Implement Redis/File Session Store verification for production');
          
          // Attempt to get user_id from request body or fallback headers
          let userId = null;
          
          if (req.body && req.body.user_id) {
            userId = req.body.user_id;
          } else if (req.query && req.query.user_id) {
            userId = req.query.user_id;
          }

          if (userId) {
            try {
              // Query database for user details
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
                throw new Error('User not found');
              }

              const user = userResult.rows[0];

              // Attach user info to request object
              req.userId = user.user_id;
              req.userRole = user.role;
              req.user = user;
              req.authMethod = 'phpsession'; // Track auth method

              console.log(`[Auth/PHPSession] Authenticated user: ${req.userId} (${user.email}) role: ${req.userRole}`);
              return next();

            } catch (dbError) {
              console.warn('[Auth/PHPSession] Database query failed:', dbError.message);
              // Fall through to unauthorized
            }
          }
        }
      } catch (cookieError) {
        console.warn('[Auth/Cookie] Cookie parsing failed:', cookieError.message);
        // Fall through to unauthorized
      }
    }

    // 3: Unauthorized - All methods failed
    console.warn('[Auth] All authentication methods failed');
    return res.status(401).json({
      ok: false,
      error: 'Akses ditolak. Silakan login.'
    });

  } catch (error) {
    console.error('[Auth] Unexpected middleware error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Internal server error during authentication'
    });
  }
};

/**
 * Helper function to parse cookies from header string
 * 
 * @param {string} cookieHeader - Cookie header value from request
 * @returns {Object} Parsed cookies as key-value pairs
 * 
 * Example:
 *   parseCookies('PHPSESSID=abc123; path=/; Domain=example.com')
 *   // Returns: { PHPSESSID: 'abc123' }
 */
function parseCookies(cookieHeader) {
  const cookies = {};
  
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return cookies;
  }

  // Split by semicolon and process each cookie
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.split('=').map(s => s.trim());
    
    if (name && value) {
      // Decode cookie value (handle URL-encoded values)
      try {
        cookies[name] = decodeURIComponent(value);
      } catch (e) {
        // If decoding fails, use raw value
        cookies[name] = value;
      }
    }
  });

  return cookies;
}

module.exports = verifyUser;
