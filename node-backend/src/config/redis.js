const Redis = require('ioredis');
require('dotenv').config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
};

// Create Redis client for general use
const redisClient = new Redis(redisConfig);

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

// Helper function to get session data from Redis
async function getSessionData(sessionId) {
  try {
    // PHP stores sessions with prefix 'PHPREDIS_SESSION:'
    const sessionKey = `PHPREDIS_SESSION:${sessionId}`;
    const sessionData = await redisClient.get(sessionKey);

    if (!sessionData) {
      return null;
    }

    // Parse PHP session data
    return parsePhpSession(sessionData);
  } catch (error) {
    console.error('Error getting session data:', error);
    return null;
  }
}

// Helper function to parse PHP session format
function parsePhpSession(sessionString) {
  try {
    const result = {};

    // PHP session format: key|serialized_value
    const regex = /([a-zA-Z_][a-zA-Z0-9_]*)\|([^}]*})/g;
    let match;

    while ((match = regex.exec(sessionString)) !== null) {
      const key = match[1];
      const value = match[2];

      // Try to parse the serialized PHP data
      // This is a simplified parser - you may need php-serialize package for complex data
      try {
        result[key] = unserializePhp(value);
      } catch (e) {
        result[key] = value;
      }
    }

    return result;
  } catch (error) {
    console.error('Error parsing PHP session:', error);
    return null;
  }
}

// Simplified PHP unserialize for common data types
function unserializePhp(str) {
  // Handle array format: a:N:{...}
  if (str.startsWith('a:')) {
    const arrayMatch = str.match(/a:(\d+):\{(.*)\}/s);
    if (arrayMatch) {
      const result = {};
      const content = arrayMatch[2];

      // Parse key-value pairs
      const kvRegex = /s:(\d+):"([^"]*)";(?:s:(\d+):"([^"]*)"|i:(\d+)|d:([\d.]+))/g;
      let kvMatch;

      while ((kvMatch = kvRegex.exec(content)) !== null) {
        const key = kvMatch[2];
        let value;

        if (kvMatch[4] !== undefined) {
          // String value
          value = kvMatch[4];
        } else if (kvMatch[5] !== undefined) {
          // Integer value
          value = parseInt(kvMatch[5]);
        } else if (kvMatch[6] !== undefined) {
          // Float value
          value = parseFloat(kvMatch[6]);
        }

        result[key] = value;
      }

      return result;
    }
  }

  // Handle string format: s:N:"value"
  if (str.startsWith('s:')) {
    const stringMatch = str.match(/s:\d+:"([^"]*)"/);
    if (stringMatch) {
      return stringMatch[1];
    }
  }

  // Handle integer format: i:value
  if (str.startsWith('i:')) {
    const intMatch = str.match(/i:(-?\d+)/);
    if (intMatch) {
      return parseInt(intMatch[1]);
    }
  }

  // Handle boolean format
  if (str === 'b:0') return false;
  if (str === 'b:1') return true;

  return str;
}

module.exports = {
  redisClient,
  getSessionData,
  redisConfig
};
