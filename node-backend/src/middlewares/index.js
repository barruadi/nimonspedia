/**
 * Middleware Index
 * Central export point for all middleware
 */

const authMiddleware = require('./authMiddleware');
const roleMiddleware = require('./roleMiddleware');
const errorMiddleware = require('./errorMiddleware');

module.exports = {
  authMiddleware,
  roleMiddleware,
  errorMiddleware
};
