const pool = require('../config/database');

const isUniqueViolation = (err) => err.code === '23505';

// ─── المجموعات ──────────────────────────────────────────────────

exports.getGroups = async (req, res) => {
  try {
    const groups = await pool.query('SELECT * FROM item_groups ORDER BY name');
    const deps = await pool.query('SELECT * FROM item_departments ORDER BY name');
    const byGroup = {};
    deps.rows.forEach(d => {
      (byGroup[d.group_id] = byGroup[d.group_id] || []).push(d);
    });
    res.json(groups.rows.map(g => ({ ...g, departments: byGroup[g.id] || [] })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'اسم المجموعة مطلوب' });
    const result = await pool.query(
      'INSERT INTO item_groups (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ message: 'المجموعة موجودة مسبقاً' });
    res.status(500).json({ message: err.message });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'اسم المجموعة مطلوب' });
    const result = await pool.query(
      'UPDATE item_groups SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'المجموعة غير موجودة' });
    res.json(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ message: 'المجموعة موجودة مسبقاً' });
    res.status(500).json({ message: err.message });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM item_groups WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'المجموعة غير موجودة' });
    res.json({ message: `تم حذف المجموعة "${result.rows[0].name}" وأقسامها` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── الأقسام ────────────────────────────────────────────────────

exports.getDepartments = async (req, res) => {
  try {
    const params = [];
    let where = '';
    if (req.query.group_id) {
      where = 'WHERE d.group_id = $1';
      params.push(req.query.group_id);
    }
    const result = await pool.query(
      `SELECT d.*, g.name AS group_name
       FROM item_departments d
       JOIN item_groups g ON g.id = d.group_id
       ${where}
       ORDER BY g.name, d.name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { group_id, name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'اسم القسم مطلوب' });
    const group = await pool.query('SELECT id FROM item_groups WHERE id = $1', [group_id]);
    if (group.rows.length === 0) return res.status(400).json({ message: 'المجموعة غير موجودة' });
    const result = await pool.query(
      'INSERT INTO item_departments (group_id, name) VALUES ($1, $2) RETURNING *',
      [group_id, name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ message: 'القسم موجود مسبقاً بهذه المجموعة' });
    res.status(500).json({ message: err.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const { name, group_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'اسم القسم مطلوب' });
    const result = await pool.query(
      'UPDATE item_departments SET name = $1, group_id = COALESCE($2, group_id) WHERE id = $3 RETURNING *',
      [name.trim(), group_id ? parseInt(group_id) : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'القسم غير موجود' });
    res.json(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ message: 'القسم موجود مسبقاً بهذه المجموعة' });
    res.status(500).json({ message: err.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const used = await pool.query(
      'SELECT COUNT(*) FROM inventory_items WHERE department_id = $1',
      [req.params.id]
    );
    if (parseInt(used.rows[0].count) > 0) {
      return res.status(400).json({ message: 'ما يكدر يُحذف — فيه مواد مرتبطة بهذا القسم' });
    }
    const result = await pool.query(
      'DELETE FROM item_departments WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'القسم غير موجود' });
    res.json({ message: 'تم حذف القسم' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── الوحدات ────────────────────────────────────────────────────

exports.getUnits = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM units ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createUnit = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'اسم الوحدة مطلوب' });
    const result = await pool.query(
      'INSERT INTO units (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ message: 'الوحدة موجودة مسبقاً' });
    res.status(500).json({ message: err.message });
  }
};

exports.updateUnit = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'اسم الوحدة مطلوب' });
    const result = await pool.query(
      'UPDATE units SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'الوحدة غير موجودة' });
    res.json(result.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ message: 'الوحدة موجودة مسبقاً' });
    res.status(500).json({ message: err.message });
  }
};

exports.deleteUnit = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM units WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'الوحدة غير موجودة' });
    res.json({ message: `تم حذف الوحدة "${result.rows[0].name}"` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── الموردون ───────────────────────────────────────────────────

exports.getSuppliers = async (req, res) => {
  try {
    const params = [];
    let where = '';
    if (req.query.active === '1') {
      where = 'WHERE is_active = TRUE';
    }
    const result = await pool.query(
      `SELECT * FROM suppliers ${where} ORDER BY is_active DESC, name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const { name, phone, whatsapp, email, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'اسم المورّد مطلوب' });
    const result = await pool.query(
      `INSERT INTO suppliers (name, phone, whatsapp, email, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), phone || null, whatsapp || null, email || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const { name, phone, whatsapp, email, notes, is_active } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'اسم المورّد مطلوب' });
    const result = await pool.query(
      `UPDATE suppliers
       SET name = $1, phone = $2, whatsapp = $3, email = $4, notes = $5,
           is_active = COALESCE($6, is_active)
       WHERE id = $7 RETURNING *`,
      [name.trim(), phone || null, whatsapp || null, email || null, notes || null,
       typeof is_active === 'boolean' ? is_active : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'المورّد غير موجود' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM suppliers WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'المورّد غير موجود' });
    res.json({ message: `تم حذف المورّد "${result.rows[0].name}"` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── خيارات نموذج المادة (مجموعات + أقسام + وحدات بنداء واحد) ────

exports.getOptions = async (req, res) => {
  try {
    const groups = await pool.query('SELECT id, name FROM item_groups ORDER BY name');
    const deps = await pool.query(
      'SELECT id, group_id, name FROM item_departments ORDER BY name'
    );
    const units = await pool.query('SELECT name FROM units ORDER BY name');
    const byGroup = {};
    deps.rows.forEach(d => {
      (byGroup[d.group_id] = byGroup[d.group_id] || []).push({ id: d.id, name: d.name });
    });
    res.json({
      groups: groups.rows.map(g => ({ id: g.id, name: g.name, departments: byGroup[g.id] || [] })),
      units: units.rows.map(u => u.name)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
