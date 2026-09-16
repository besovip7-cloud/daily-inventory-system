const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const { getEffectivePermissions } = require('../utils/permissions');
const { sendMail, isConfigured: mailConfigured } = require('../utils/mailer');

// قفل المحاولات الفاشلة بالذاكرة: 5 محاولات = إيقاف 5 دقائق
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

const issueToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role, branch_id: user.branch_id },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRE }
);

const buildUserPayload = async (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  branch_id: user.branch_id,
  avatar: user.avatar,
  phone: user.phone,
  custom_role_id: user.custom_role_id,
  has_quick_pin: !!user.quick_pin_hash,
  permissions: await getEffectivePermissions(user)
});

// البحث عن المستخدم بالإيميل أو رقم الواتساب
const findUserByIdentifier = async (raw) => {
  const id = String(raw || '').trim();
  if (!id) return null;
  let result;
  if (id.includes('@')) {
    result = await pool.query('SELECT * FROM users WHERE email = $1', [id.toLowerCase()]);
  } else {
    const digits = id.replace(/[^\d]/g, '');
    if (!digits) return null;
    result = await pool.query('SELECT * FROM users WHERE phone = $1', [digits]);
  }
  return result.rows[0] || null;
};

exports.login = async (req, res) => {
  try {
    const rawId = (req.body.identifier || req.body.email || '').trim();
    const key = `${rawId.toLowerCase()}|${req.ip || ''}`;
    const rec = loginAttempts.get(key);
    if (rec?.lockedUntil && rec.lockedUntil > Date.now()) {
      const mins = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ message: `محاولات فاشلة كثيرة — تم إيقاف الدخول مؤقتاً. جرب بعد ${mins} دقيقة` });
    }

    const user = await findUserByIdentifier(rawId);
    if (!user) {
      return res.status(401).json({ message: 'هذا الحساب غير مسجل بالنظام — تأكد من الإيميل/الرقم أو تواصل مع الإدارة' });
    }
    if (!user.is_active) {
      return res.status(401).json({ message: 'هذا الحساب معطل — تواصل مع مدير النظام لتفعيله' });
    }

    const isMatch = await bcrypt.compare(String(req.body.password || ''), user.password);
    if (!isMatch) {
      const r = rec && !rec.lockedUntil ? rec : { count: 0 };
      r.count += 1;
      if (r.count >= MAX_ATTEMPTS) {
        loginAttempts.set(key, { count: 0, lockedUntil: Date.now() + LOCK_MS });
        return res.status(429).json({ message: '5 محاولات فاشلة — تم إيقاف الدخول لمدة 5 دقائق' });
      }
      loginAttempts.set(key, r);
      return res.status(401).json({ message: `كلمة المرور غير صحيحة — باقي ${MAX_ATTEMPTS - r.count} محاولات` });
    }

    loginAttempts.delete(key);
    res.json({ token: issueToken(user), user: await buildUserPayload(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===== الدخول السريع برقم PIN =====
exports.setQuickPin = async (req, res) => {
  try {
    const pin = String(req.body.pin || '');
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ message: 'الرقم السري 4 إلى 6 أرقام' });
    }
    const hashed = await bcrypt.hash(pin, 10);
    await pool.query('UPDATE users SET quick_pin_hash = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'تم تفعيل الدخول السريع' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.removeQuickPin = async (req, res) => {
  try {
    await pool.query('UPDATE users SET quick_pin_hash = NULL WHERE id = $1', [req.user.id]);
    res.json({ message: 'تم إيقاف الدخول السريع' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.quickLogin = async (req, res) => {
  try {
    const rawId = (req.body.identifier || '').trim();
    const key = `pin|${rawId.toLowerCase()}|${req.ip || ''}`;
    const rec = loginAttempts.get(key);
    if (rec?.lockedUntil && rec.lockedUntil > Date.now()) {
      const mins = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ message: `محاولات فاشلة كثيرة — جرب بعد ${mins} دقيقة` });
    }

    const user = await findUserByIdentifier(rawId);
    if (!user || !user.quick_pin_hash) {
      return res.status(401).json({ message: 'الدخول السريع غير مفعّل لهذا الحساب' });
    }
    if (!user.is_active) {
      return res.status(401).json({ message: 'هذا الحساب معطل — تواصل مع مدير النظام' });
    }

    const isMatch = await bcrypt.compare(String(req.body.pin || ''), user.quick_pin_hash);
    if (!isMatch) {
      const r = rec && !rec.lockedUntil ? rec : { count: 0 };
      r.count += 1;
      if (r.count >= MAX_ATTEMPTS) {
        loginAttempts.set(key, { count: 0, lockedUntil: Date.now() + LOCK_MS });
        return res.status(429).json({ message: '5 محاولات فاشلة — تم إيقاف الدخول لمدة 5 دقائق' });
      }
      loginAttempts.set(key, r);
      return res.status(401).json({ message: `الرقم السري غير صحيح — باقي ${MAX_ATTEMPTS - r.count} محاولات` });
    }

    loginAttempts.delete(key);
    res.json({ token: issueToken(user), user: await buildUserPayload(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, branch_id, custom_role_id, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, branch_id, custom_role_id, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, role, branch_id, custom_role_id, phone, is_active, created_at`,
      [name, email, hashedPassword, role || 'staff', branch_id || null, custom_role_id || null, phone || null]
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
      `SELECT u.id, u.name, u.email, u.role, u.branch_id, u.is_active, u.created_at, u.custom_role_id, u.phone,
              b.name AS branch_name, cr.name AS custom_role_name
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       LEFT JOIN custom_roles cr ON cr.id = u.custom_role_id
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

    const { name, email, role, branch_id, custom_role_id, phone } = req.body;

    const result = await pool.query(
      `UPDATE users SET name = $1, email = $2, role = $3, branch_id = $4, custom_role_id = $5, phone = $6
       WHERE id = $7
       RETURNING id, name, email, role, branch_id, custom_role_id, phone, is_active`,
      [name, email, role, role === 'admin' ? null : (branch_id || null), custom_role_id || null, phone || null, userId]
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
  const { id, name, email, role, branch_id, is_active, avatar, created_at, custom_role_id, phone, quick_pin_hash } = req.user;
  const branch = branch_id
    ? await pool.query('SELECT name FROM branches WHERE id = $1', [branch_id])
    : { rows: [] };
  const customRole = custom_role_id
    ? await pool.query('SELECT name FROM custom_roles WHERE id = $1', [custom_role_id])
    : { rows: [] };
  const permissions = await getEffectivePermissions(req.user);
  res.json({
    user: {
      id, name, email, role, branch_id, is_active, avatar, created_at, custom_role_id, permissions, phone,
      has_quick_pin: !!quick_pin_hash,
      branch_name: branch.rows[0]?.name || null,
      custom_role_name: customRole.rows[0]?.name || null
    }
  });
};

// تعديل البروفايل الشخصي: الاسم والصورة فقط
exports.updateProfile = async (req, res) => {
  try {
    const { name, avatar, phone } = req.body;

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

    if (phone !== undefined) {
      const value = String(phone || '').replace(/[^\d+]/g, '').slice(0, 20);
      await pool.query('UPDATE users SET phone = $1 WHERE id = $2', [value || null, req.user.id]);
    }

    const result = await pool.query(
      'SELECT id, name, email, role, branch_id, avatar, phone, created_at FROM users WHERE id = $1',
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

// طلب كود استعادة كلمة المرور — يُرسل بالإيميل الرسمي
exports.forgotPassword = async (req, res) => {
  try {
    if (!mailConfigured()) {
      return res.status(503).json({ message: 'خدمة الإيميل غير مفعّلة حالياً — تواصل مع مدير النظام لإعادة تعيين كلمة المرور' });
    }

    const user = await findUserByIdentifier(req.body.identifier);
    // نفس الرسالة سواءً الحساب موجود أو لا حتى ما ينكشف تسجيل الحسابات
    const okMsg = 'إذا الحساب مسجل، راح يوصلك كود الاستعادة على الإيميل خلال دقائق';

    if (!user || !user.email || !user.is_active) {
      return res.json({ message: okMsg });
    }

    // منع طلبات متكررة: آخر كود أقل من دقيقتين
    const recent = await pool.query(
      `SELECT created_at FROM password_resets
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '2 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    if (recent.rows.length) {
      return res.status(429).json({ message: 'طلبت كود قبل شوية — انتظر دقيقتين وحاول مرة أخرى' });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // صالح 10 دقائق

    await pool.query(
      `UPDATE password_resets SET used = TRUE WHERE user_id = $1 AND used = FALSE`,
      [user.id]
    );
    await pool.query(
      `INSERT INTO password_resets (user_id, code, expires_at) VALUES ($1, $2, $3)`,
      [user.id, code, expires]
    );

    const sent = await sendMail(
      user.email,
      'كود استعادة كلمة المرور — نظام الجرد اليومي',
      `مرحباً ${user.name},\n\nكود الاستعادة: ${code}\nالكود صالح لمدة 10 دقائق.\n\nإذا ما طلبت الاستعادة، تجاهل هذا الإيميل.`,
      `<div dir="rtl" style="font-family:Arial,sans-serif;padding:20px;background:#faf7f2;border-radius:12px">
        <h2 style="color:#8b5e34">نظام الجرد اليومي</h2>
        <p>مرحباً <b>${user.name}</b>,</p>
        <p>استخدم الكود التالي لاستعادة كلمة المرور:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#8b5e34;padding:16px;background:#fff;border-radius:8px;text-align:center">${code}</div>
        <p style="color:#888">الكود صالح لمدة 10 دقائق فقط.</p>
        <p style="color:#888">إذا ما طلبت الاستعادة، تجاهل هذا الإيميل.</p>
      </div>`
    );

    if (!sent) {
      return res.status(500).json({ message: 'تعذر إرسال الإيميل — جرب بعد قليل أو تواصل مع الإدارة' });
    }
    res.json({ message: okMsg, email_hint: user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// إعادة تعيين كلمة المرور بالكود المُرسل
exports.resetPasswordWithCode = async (req, res) => {
  try {
    const user = await findUserByIdentifier(req.body.identifier);
    if (!user) {
      return res.status(400).json({ message: 'الكود غير صحيح أو منتهي' });
    }

    const result = await pool.query(
      `SELECT id FROM password_resets
       WHERE user_id = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id, String(req.body.code || '').trim()]
    );
    if (!result.rows.length) {
      return res.status(400).json({ message: 'الكود غير صحيح أو منتهي — اطلب كود جديد' });
    }

    const hashed = await bcrypt.hash(String(req.body.new_password), 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user.id]);
    await pool.query('UPDATE password_resets SET used = TRUE WHERE user_id = $1', [user.id]);
    // الأمان: الكود يمسح أي PIN دخول سريع قديم
    await pool.query('UPDATE users SET quick_pin_hash = NULL WHERE id = $1', [user.id]);
    loginAttempts.delete(`${(req.body.identifier || '').toLowerCase()}|${req.ip || ''}`);

    res.json({ message: 'تم تغيير كلمة المرور بنجاح — سجل دخول بالكلمة الجديدة' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
