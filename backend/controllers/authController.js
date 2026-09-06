const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, branch_id: user.branch_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id,
        avatar: user.avatar
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, branch_id } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, branch_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, branch_id, is_active, created_at`,
      [name, email, hashedPassword, role || 'staff', branch_id || null]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email already registered' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ message: 'Invalid role or data' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.branch_id, u.is_active, u.created_at,
              b.name AS branch_name
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       ORDER BY u.created_at`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'لا تقدر تعدل حسابك بنفسك' });
    }

    const { name, email, role, branch_id } = req.body;

    const result = await pool.query(
      `UPDATE users SET name = $1, email = $2, role = $3, branch_id = $4
       WHERE id = $5
       RETURNING id, name, email, role, branch_id, is_active`,
      [name, email, role, role === 'admin' ? null : (branch_id || null), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email already registered' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ message: 'Invalid role or data' });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.setUserActive = async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    const result = await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, name, email, role, branch_id, is_active',
      [!!req.body.is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.me = async (req, res) => {
  const { id, name, email, role, branch_id, is_active, avatar, created_at } = req.user;
  const branch = branch_id
    ? await pool.query('SELECT name FROM branches WHERE id = $1', [branch_id])
    : { rows: [] };
  res.json({
    user: {
      id, name, email, role, branch_id, is_active, avatar, created_at,
      branch_name: branch.rows[0]?.name || null
    }
  });
};

// تعديل البروفايل الشخصي: الاسم والصورة فقط
exports.updateProfile = async (req, res) => {
  try {
    const { name, avatar } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ message: 'الاسم مطلوب' });
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [trimmed.slice(0, 100), req.user.id]);
    }

    if (avatar !== undefined) {
      const value = String(avatar || '');
      if (value && !/^data:image\/(png|jpe?g|webp);base64,/.test(value)) {
        return res.status(400).json({ message: 'صيغة الصورة غير مدعومة (PNG أو JPG)' });
      }
      if (value.length > 1500000) {
        return res.status(400).json({ message: 'حجم الصورة كبير جداً (الحد الأقصى ~1MB)' });
      }
      await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [value || null, req.user.id]);
    }

    const result = await pool.query(
      'SELECT id, name, email, role, branch_id, avatar, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// تغيير الباسورد الشخصي — يتطلب الباسورد الحالي
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    const isMatch = await bcrypt.compare(String(current_password || ''), req.user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, name, email',
      [hashedPassword, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Password updated', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    // Detach the user from historical records so the row can be removed
    await pool.query('UPDATE daily_inventory SET created_by = NULL WHERE created_by = $1', [userId]);
    await pool.query('UPDATE daily_sales SET created_by = NULL WHERE created_by = $1', [userId]);
    await pool.query('UPDATE alerts SET resolved_by = NULL WHERE resolved_by = $1', [userId]);
    await pool.query('UPDATE activity_logs SET user_id = NULL WHERE user_id = $1', [userId]);

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, name, email',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
