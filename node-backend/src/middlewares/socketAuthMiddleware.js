/**
 * Socket.IO Authentication Middleware
 * Validates session ID against Redis and attaches user data to socket
 */

const { getSessionData } = require('../config/redis');
const pool = require('../config/db');

/**
 * Create session-based authentication middleware for Socket.IO
 * Supports both session-based auth (new) and legacy userId/userRole auth (fallback)
 */
const createSocketAuthMiddleware = (socketName = 'Socket') => {
  return async (socket, next) => {
    console.log(`[${socketName} Auth] New connection attempt: ${socket.id}`);
    console.log(`[${socketName} Auth] Handshake auth:`, socket.handshake.auth);

    try {
      const { sessionId, userId, userRole } = socket.handshake.auth;

      // OPTION 1: Session-based authentication (preferred)
      if (sessionId) {
        console.log(`[${socketName} Auth] Attempting session-based auth with sessionId: ${sessionId}`);

        const sessionData = await getSessionData(sessionId);

        if (!sessionData) {
          console.warn(`[${socketName} Auth] Session not found or expired: ${sessionId}`);
          return next(new Error('Session not found or expired'));
        }

        console.log(`[${socketName} Auth] Session data retrieved:`, sessionData);

        // Extract user data from session
        const userData = sessionData.user;

        if (!userData || !userData.user_id) {
          console.warn(`[${socketName} Auth] No user data in session: ${sessionId}`);
          return next(new Error('Invalid session: no user data'));
        }

        // Verify user still exists in database
        const userQuery = `
          SELECT user_id, role, full_name, email
          FROM users
          WHERE user_id = $1
        `;
        const pgPool = pool.getInstance();
        const userResult = await pgPool.query(userQuery, [userData.user_id]);

        if (userResult.rows.length === 0) {
          console.warn(`[${socketName} Auth] User ${userData.user_id} not found in database`);
          return next(new Error('User not found'));
        }

        const dbUser = userResult.rows[0];

        // Attach authenticated user data to socket
        socket.userId = dbUser.user_id;
        socket.userRole = dbUser.role;
        socket.userName = dbUser.full_name;
        socket.userEmail = dbUser.email;
        socket.sessionId = sessionId;

        console.log(`[${socketName} Auth] Session authenticated - socket: ${socket.id}, userId: ${dbUser.user_id}, role: ${dbUser.role}`);
        return next();
      }

      // OPTION 2: Legacy userId/userRole authentication (fallback for backward compatibility)
      if (userId && userRole) {
        console.log(`[${socketName} Auth] Attempting legacy auth with userId: ${userId}, userRole: ${userRole}`);

        const parsedUserId = parseInt(userId);

        if (isNaN(parsedUserId)) {
          console.warn(`[${socketName} Auth] Invalid userId format: "${userId}"`);
          return next(new Error('Invalid userId format'));
        }

        // Verify user exists in database
        const userQuery = `
          SELECT user_id, role, full_name, email
          FROM users
          WHERE user_id = $1
        `;
        const pgPool = pool.getInstance();
        const userResult = await pgPool.query(userQuery, [parsedUserId]);

        if (userResult.rows.length === 0) {
          console.warn(`[${socketName} Auth] User ${parsedUserId} not found in database`);
          return next(new Error('User not found'));
        }

        const dbUser = userResult.rows[0];

        // Verify role matches (prevent role spoofing)
        if (dbUser.role !== userRole) {
          console.warn(`[${socketName} Auth] Role mismatch - DB: "${dbUser.role}", provided: "${userRole}"`);
          return next(new Error('Role mismatch'));
        }

        // Attach authenticated user data to socket
        socket.userId = parsedUserId;
        socket.userRole = userRole;
        socket.userName = dbUser.full_name;
        socket.userEmail = dbUser.email;

        console.log(`[${socketName} Auth] Legacy auth successful - socket: ${socket.id}, userId: ${parsedUserId}, role: ${userRole}`);
        return next();
      }

      // No valid authentication method provided
      console.warn(`[${socketName} Auth] Authentication failed: missing sessionId or userId/userRole`);
      return next(new Error('Authentication required: provide sessionId or userId/userRole'));

    } catch (error) {
      console.error(`[${socketName} Auth] Authentication error:`, error.message);
      console.error(`[${socketName} Auth] Error stack:`, error.stack);
      next(new Error('Authentication failed: ' + error.message));
    }
  };
};

module.exports = {
  createSocketAuthMiddleware
};
