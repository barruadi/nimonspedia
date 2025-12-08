const { Pool } = require('pg');

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Get or create pool instance
   */
  getInstance() {
    if (!this.pool) {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'db',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || process.env.POSTGRES_DB,
        user: process.env.DB_USER || process.env.POSTGRES_USER,
        password: process.env.DB_PASS || process.env.POSTGRES_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Handle pool errors
      this.pool.on('error', (err) => {
        console.error('[Database] Unexpected error on idle client:', err.message);
        this.isConnected = false;
      });

      this.pool.on('connect', () => {
        console.log('[Database] New client connected');
      });

      console.log(`[Database] Pool created for ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME || process.env.POSTGRES_DB}`);
    }

    return this.pool;
  }

  /**
   * Test database connection with retry logic
   */
  async testConnection(retries = 5, delayMs = 3000) {
    const pool = this.getInstance();

    return new Promise((resolve) => {
      const attempt = (retriesLeft) => {
        pool.query('SELECT NOW()', (err, res) => {
          if (err) {
            if (retriesLeft > 0) {
              console.warn(`[Database] Connection failed: ${err.message}`);
              console.warn(`[Database] Retrying in ${delayMs}ms... (${retriesLeft} retries left)`);
              setTimeout(() => attempt(retriesLeft - 1), delayMs);
            } else {
              console.error('[Database] Failed to connect after multiple retries');
              console.error('[Database] Please check:');
              console.error('[Database]   - PostgreSQL container is running');
              console.error('[Database]   - .env variables are correct');
              console.error('[Database]   - Network connectivity');
              this.isConnected = false;
              resolve(false);
            }
          } else {
            console.log('[Database] Connected successfully');
            console.log(`[Database] Server time: ${res.rows[0].now}`);
            this.isConnected = true;
            resolve(true);
          }
        });
      };

      attempt(retries);
    });
  }

  /**
   * Check if connected
   */
  isReady() {
    return this.isConnected;
  }

  /**
   * Close pool connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('[Database] Pool closed');
      this.isConnected = false;
    }
  }
}

// Export singleton instance
module.exports = new Database();