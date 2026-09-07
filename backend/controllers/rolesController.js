const pool = require('../config/database');
const { PERMISSIONS } = require('../utils/permissions');

exports.listRoles = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, COUNT(u.id) AS users_count
      FROM custom_roles cr
      LEFT JOIN users u ON u.custom_role_id = cr.id
      GROUP BY cr.id
      ORDER BY cr.created_at
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPermissionsCatalog = (req, res) => {
  res.json(PERMISSIONS);
};

const validatePayload = (name, permissions) => {
  const cleanName = String(name || '').trim();
  if (!cleanName) return { error: 'اسم الدور مطلوب' };
  if (cleanName.length > 50) return { error: 'اسم الدور طويل' };
  const validKeys = new Set(PERMISSIONS.map(p => p.key));
  const clean = (Array.isArray(permissions) ? permissions : []).filter(p => validKeys.has(p));
  return { cleanName, clean };
};

exports.createRole = async (req, res) => {
  try {
    const { cleanName, clean, error } = validatePayload(req.body.name, req.body.permissions);
    if (error) return res.status(400).json({ message: error });
    const result = await pool.query(
      'INSERT INTO custom_roles (name, permissions) VALUES ($1, $2) RETURNING *',
      [cleanName, JSON.stringify(clean)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'الاسم مستخدم مسبقاً' });
    res.status(500).json({ message: err.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { cleanName, clean, error } = validatePayload(req.body.name, req.body.permissions);
    if (error) return res.status(400).json({ message: error });
    const result = await pool.query(
      'UPDATE custom_roles SET name = $1, permissions = $2 WHERE id = $3 RETURNING *',
      [cleanName, JSON.stringify(clean), req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'الدور غير موجود' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'الاسم مستخدم مسبقاً' });
    res.status(500).json({ message: err.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    // ON DELETE SET NULL يرجع المستخدمين لدورهم المدمج تلقائياً
    const result = await pool.query('DELETE FROM custom_roles WHERE id = $1 RETURNING id, name', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'الدور غير موجود' });
    res.json({ message: 'تم حذف الدور — المستخدمون رجعوا لأدوارهم المدمجة' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
