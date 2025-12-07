const { Hono } = require('hono');
const { cors } = require('hono/cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const database = require('../config/db');
const { authJWT, adminOnly, JWT_SECRET } = require('../middlewares/authJWT');

const app = new Hono();
const pool = database.getInstance();

// Setup CORS untuk Hono
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost', 'http://localhost:80'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 600,
}));

app.post('/login', async (c) => {
  try {
    console.log('Admin login attempt');
    const { email, password } = await c.req.json();
    console.log("pass:" ,password);

    if (!email || !password) {
      return c.json({ 
        ok: false, 
        error: { message: 'Email and password are required' }
      }, 400);
    }

    const query = `
      SELECT user_id, email, password_hash, full_name, role
      FROM users
      WHERE email = $1 AND role = 'admin'
    `;
    

    const result = await pool.query(query, [email]);
    console.log(result.rows);

    if (result.rows.length === 0) {
      return c.json({ 
        ok: false, 
        error: { message: 'Invalid credentials' }
      }, 401);
    }

    const user = result.rows[0];
    
    // Convert PHP bcrypt format ($2y$) to Node.js format ($2b$) if needed
    let passwordHash = user.password_hash;
    if (passwordHash.startsWith('$2y$')) {
      passwordHash = passwordHash.replace('$2y$', '$2b$');
    }
    
    const isValidPassword = await bcrypt.compare(password, passwordHash);
    console.log("isValidPassword:", isValidPassword);

    if (!isValidPassword) {
      return c.json({ 
        ok: false, 
        error: { message: 'Invalid credentials' }
      }, 401);
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return c.json({
      ok: true,
      token,
      user: {
        id: user.user_id,
        email: user.email,
        name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return c.json({ 
      ok: false, 
      error: { message: 'Internal server error' }
    }, 500);
  }
});

app.get('/me', authJWT, adminOnly, async (c) => {
  try {
    const user = c.get('user');
    
    const query = `
      SELECT user_id, email, full_name, role
      FROM users
      WHERE user_id = $1 AND role = 'admin'
    `;
    
    const result = await pool.query(query, [user.userId]);

    if (result.rows.length === 0) {
      return c.json({ 
        ok: false, 
        error: { message: 'User not found' }
      }, 404);
    }

    const userData = result.rows[0];

    return c.json({
      ok: true,
      user: {
        id: userData.user_id,
        email: userData.email,
        name: userData.full_name,
        role: userData.role
      }
    });
  } catch (error) {
    console.error('Get admin user error:', error);
    return c.json({ 
      ok: false, 
      error: { message: 'Internal server error' }
    }, 500);
  }
});

app.get('/users', authJWT, adminOnly, async (c) => {
  try {
    const search = c.req.query('search') || '';
    const page = parseInt(c.req.query('page')) || 1;
    const perPage = parseInt(c.req.query('per_page')) || 12;
    const offset = (page - 1) * perPage;

    let countQuery = 'SELECT COUNT(*) FROM users WHERE role != $1';
    let dataQuery = `
      SELECT user_id, full_name, email, role, balance, created_at
      FROM users
      WHERE role != $1
    `;
    const params = ['admin'];

    if (search) {
      countQuery += ' AND (full_name ILIKE $2 OR email ILIKE $2)';
      dataQuery += ' AND (full_name ILIKE $2 OR email ILIKE $2)';
      params.push(`%${search}%`);
    }

    dataQuery += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(perPage, offset);

    const countResult = await pool.query(countQuery, search ? ['admin', `%${search}%`] : ['admin']);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / perPage);

    const dataResult = await pool.query(dataQuery, params);

    return c.json({
      ok: true,
      users: dataResult.rows.map(u => ({
        id: u.user_id,
        name: u.full_name,
        email: u.email,
        role: u.role,
        balance: parseFloat(u.balance),
        createdAt: u.created_at
      })),
      pagination: {
        page,
        perPage,
        totalPages,
        totalItems,
        hasPrev: page > 1,
        hasNext: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ 
      ok: false, 
      error: { message: 'Internal server error' }
    }, 500);
  }
});

app.get('/users/:userId/flags', authJWT, adminOnly, async (c) => {
  try {
    const userId = c.req.param('userId');

    const query = `
      SELECT feature_name, is_enabled, reason, updated_at
      FROM user_feature_access
      WHERE user_id = $1
    `;
    
    const result = await pool.query(query, [userId]);

    const flags = {
      checkout_enabled: true,
      chat_enabled: true,
      auction_enabled: true
    };

    result.rows.forEach(row => {
      flags[row.feature_name] = row.is_enabled;
    });

    return c.json({
      ok: true,
      flags,
      details: result.rows.map(r => ({
        featureName: r.feature_name,
        isEnabled: r.is_enabled,
        reason: r.reason,
        updatedAt: r.updated_at
      }))
    });
  } catch (error) {
    console.error('Get user flags error:', error);
    return c.json({ 
      ok: false, 
      error: { message: 'Internal server error' }
    }, 500);
  }
});

app.put('/users/:userId/flags', authJWT, adminOnly, async (c) => {
  try {
    const userId = c.req.param('userId');
    const { flags } = await c.req.json();

    for (const [featureName, data] of Object.entries(flags)) {
      if (!data.isEnabled && (!data.reason || data.reason.length < 10)) {
        return c.json({
          ok: false,
          error: { message: `Alasan untuk ${featureName} minimal 10 karakter` }
        }, 400);
      }

      const upsertQuery = `
        INSERT INTO user_feature_access (user_id, feature_name, is_enabled, reason, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id, feature_name)
        DO UPDATE SET is_enabled = $3, reason = $4, updated_at = NOW()
      `;

      await pool.query(upsertQuery, [
        userId,
        featureName,
        data.isEnabled,
        data.isEnabled ? null : data.reason
      ]);
    }

    return c.json({
      ok: true,
      message: 'Feature flags updated successfully'
    });
  } catch (error) {
    console.error('Update user flags error:', error);
    return c.json({ 
      ok: false, 
      error: { message: 'Internal server error' }
    }, 500);
  }
});

app.get('/global-flags', authJWT, adminOnly, async (c) => {
  try {
    const query = `
      SELECT feature_name, is_enabled, reason, updated_at
      FROM user_feature_access
      WHERE user_id IS NULL
    `;
    
    const result = await pool.query(query);

    const flags = {
      checkout_enabled: true,
      chat_enabled: true,
      auction_enabled: true
    };

    result.rows.forEach(row => {
      flags[row.feature_name] = row.is_enabled;
    });

    return c.json({
      ok: true,
      flags,
      details: result.rows.map(r => ({
        featureName: r.feature_name,
        isEnabled: r.is_enabled,
        reason: r.reason,
        updatedAt: r.updated_at
      }))
    });
  } catch (error) {
    console.error('Get global flags error:', error);
    return c.json({ 
      ok: false, 
      error: { message: 'Internal server error' }
    }, 500);
  }
});

app.put('/global-flags', authJWT, adminOnly, async (c) => {
  try {
    const { flags } = await c.req.json();

    for (const [featureName, data] of Object.entries(flags)) {
      if (!data.isEnabled && (!data.reason || data.reason.length < 20)) {
        return c.json({
          ok: false,
          error: { message: `Alasan untuk ${featureName} minimal 20 karakter` }
        }, 400);
      }

      const upsertQuery = `
        INSERT INTO user_feature_access (user_id, feature_name, is_enabled, reason, updated_at)
        VALUES (NULL, $1, $2, $3, NOW())
        ON CONFLICT (user_id, feature_name) WHERE user_id IS NULL
        DO UPDATE SET is_enabled = $2, reason = $3, updated_at = NOW()
      `;

      await pool.query(upsertQuery, [
        featureName,
        data.isEnabled,
        data.isEnabled ? null : data.reason
      ]);
    }

    return c.json({
      ok: true,
      message: 'Global flags updated successfully'
    });
  } catch (error) {
    console.error('Update global flags error:', error);
    return c.json({ 
      ok: false, 
      error: { message: 'Internal server error' }
    }, 500);
  }
});

module.exports = app;
