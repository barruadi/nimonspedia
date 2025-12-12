const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const database = require('../config/db');
const { authJWT, adminOnly, JWT_SECRET } = require('../middlewares/authJWT');

const router = express.Router();
const pool = database.getInstance();

// CORS is handled globally in server.js, no need to set it here

router.post('/login', async (req, res) => {
  try {
    console.log('Admin login attempt');
    const { email, password } = req.body;
    console.log("pass:" ,password);

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: { message: 'Email and password are required' }
      });
    }

    // First check if user exists at all
    const userCheckQuery = `
      SELECT user_id, email, password_hash, full_name, role
      FROM users
      WHERE email = $1
    `;

    const userCheckResult = await pool.query(userCheckQuery, [email]);
    
    if (userCheckResult.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        error: { message: 'Email tidak terdaftar' }
      });
    }

    const user = userCheckResult.rows[0];

    // Block buyer/seller from logging in via admin dashboard
    if (user.role !== 'admin') {
      return res.status(403).json({
        ok: false,
        error: { message: 'Akun Anda bukan admin. Halaman ini khusus untuk administrator.' }
      });
    }

    // Convert PHP bcrypt format ($2y$) to Node.js format ($2b$) if needed
    let passwordHash = user.password_hash;
    if (passwordHash.startsWith('$2y$')) {
      passwordHash = passwordHash.replace('$2y$', '$2b$');
    }

    const isValidPassword = await bcrypt.compare(password, passwordHash);
    console.log("isValidPassword:", isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({
        ok: false,
        error: { message: 'Password salah' }
      });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      {
        expiresIn: '8h', // Best practice: shorter expiry for admin tokens
        algorithm: 'HS256' // Explicitly specify algorithm to prevent algorithm confusion attacks
      }
    );

    return res.json({
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
    return res.status(500).json({
      ok: false,
      error: { message: 'Internal server error' }
    });
  }
});

router.get('/me', authJWT, adminOnly, async (req, res) => {
  try {
    const user = req.user;

    const query = `
      SELECT user_id, email, full_name, role
      FROM users
      WHERE user_id = $1 AND role = 'admin'
    `;

    const result = await pool.query(query, [user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: { message: 'User not found' }
      });
    }

    const userData = result.rows[0];

    return res.json({
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
    return res.status(500).json({
      ok: false,
      error: { message: 'Internal server error' }
    });
  }
});

router.get('/users', authJWT, adminOnly, async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 12;
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

    return res.json({
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
    return res.status(500).json({
      ok: false,
      error: { message: 'Internal server error' }
    });
  }
});

router.get('/users/:userId/flags', authJWT, adminOnly, async (req, res) => {
  try {
    const userId = req.params.userId;

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

    return res.json({
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
    return res.status(500).json({
      ok: false,
      error: { message: 'Internal server error' }
    });
  }
});

router.put('/users/:userId/flags', authJWT, adminOnly, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { flags } = req.body;

    for (const [featureName, data] of Object.entries(flags)) {
      if (!data.isEnabled && (!data.reason || data.reason.length < 10)) {
        return res.status(400).json({
          ok: false,
          error: { message: `Alasan untuk ${featureName} minimal 10 karakter` }
        });
      }

      // Check if entry exists
      const checkQuery = `
        SELECT access_id FROM user_feature_access
        WHERE user_id = $1 AND feature_name = $2
      `;
      const checkResult = await pool.query(checkQuery, [userId, featureName]);

      if (checkResult.rows.length > 0) {
        // Update existing
        const updateQuery = `
          UPDATE user_feature_access
          SET is_enabled = $1, reason = $2, updated_at = NOW()
          WHERE access_id = $3
        `;
        await pool.query(updateQuery, [
          data.isEnabled,
          data.isEnabled ? null : data.reason,
          checkResult.rows[0].access_id
        ]);
      } else {
        // Insert new
        const insertQuery = `
          INSERT INTO user_feature_access (user_id, feature_name, is_enabled, reason, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
        `;
        await pool.query(insertQuery, [
          userId,
          featureName,
          data.isEnabled,
          data.isEnabled ? null : data.reason
        ]);
      }
    }

    return res.json({
      ok: true,
      message: 'Feature flags updated successfully'
    });
  } catch (error) {
    console.error('Update user flags error:', error);
    return res.status(500).json({
      ok: false,
      error: { message: 'Internal server error' }
    });
  }
});

router.get('/global-flags', authJWT, adminOnly, async (req, res) => {
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

    return res.json({
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
    return res.status(500).json({
      ok: false,
      error: { message: 'Internal server error' }
    });
  }
});

router.put('/global-flags', authJWT, adminOnly, async (req, res) => {
  try {
    const { flag, isEnabled, reason } = req.body;

    // Validate input
    if (!flag) {
      return res.status(400).json({
        ok: false,
        error: { message: 'Flag name is required' }
      });
    }

    if (!isEnabled && (!reason || reason.length < 20)) {
      return res.status(400).json({
        ok: false,
        error: { message: `Alasan minimal 20 karakter` }
      });
    }

    // Check if global entry exists
    const checkQuery = `
      SELECT access_id FROM user_feature_access
      WHERE user_id IS NULL AND feature_name = $1
    `;
    const checkResult = await pool.query(checkQuery, [flag]);

    if (checkResult.rows.length > 0) {
      // Update existing
      const updateQuery = `
        UPDATE user_feature_access
        SET is_enabled = $1, reason = $2, updated_at = NOW()
        WHERE access_id = $3
      `;
      await pool.query(updateQuery, [
        isEnabled,
        isEnabled ? null : reason,
        checkResult.rows[0].access_id
      ]);
    } else {
      // Insert new
      const insertQuery = `
        INSERT INTO user_feature_access (user_id, feature_name, is_enabled, reason, updated_at)
        VALUES (NULL, $1, $2, $3, NOW())
      `;
      await pool.query(insertQuery, [
        flag,
        isEnabled,
        isEnabled ? null : reason
      ]);
    }

    return res.json({
      ok: true,
      message: 'Global flag updated successfully'
    });
  } catch (error) {
    console.error('Update global flags error:', error);
    return res.status(500).json({
      ok: false,
      error: { message: 'Internal server error' }
    });
  }
});

module.exports = router;
