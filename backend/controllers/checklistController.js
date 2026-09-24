const pool = require('../config/database');
const { notifyBranch } = require('../utils/whatsapp');

// تاريخ اليوم بتوقيت العراق (UTC+3)
const iraqToday = () => new Date(Date.now() + 3 * 3600e3).toISOString().split('T')[0];

const isValidDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));

// ─── بنود الفحص (إدارة — أدمن فقط) ──────────────────────────────

exports.getItems = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM checklist_items ORDER BY sort_order, id'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createItem = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'إدارة البنود للأدمن فقط' });
    }
    const { title, period } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'عنوان البند مطلوب' });
    const itemPeriod = ['morning', 'evening', 'both'].includes(period) ? period : 'both';
    const max = await pool.query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM checklist_items');
    const result = await pool.query(
      `INSERT INTO checklist_items (title, period, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [title.trim(), itemPeriod, parseInt(max.rows[0].m) + 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'إدارة البنود للأدمن فقط' });
    }
    const { title, period, is_active } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'عنوان البند مطلوب' });
    const itemPeriod = ['morning', 'evening', 'both'].includes(period) ? period : 'both';
    const result = await pool.query(
      `UPDATE checklist_items
       SET title = $1, period = $2, is_active = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
      [title.trim(), itemPeriod, typeof is_active === 'boolean' ? is_active : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'البند غير موجود' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'إدارة البنود للأدمن فقط' });
    }
    const result = await pool.query(
      'DELETE FROM checklist_items WHERE id = $1 RETURNING id, title',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'البند غير موجود' });
    res.json({ message: `تم حذف البند "${result.rows[0].title}"` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.reorderItems = async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'إدارة البنود للأدمن فقط' });
    }
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(parseInt).filter(Boolean) : [];
    if (ids.length === 0) return res.status(400).json({ message: 'قائمة البنود فارغة' });
    await client.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await client.query('UPDATE checklist_items SET sort_order = $1 WHERE id = $2', [i + 1, ids[i]]);
    }
    await client.query('COMMIT');
    res.json({ message: 'تم حفظ الترتيب' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

// ─── التعليم اليومي (الفروع) ────────────────────────────────────

exports.getChecks = async (req, res) => {
  try {
    const { date, period } = req.query;
    const checkPeriod = ['morning', 'evening'].includes(period) ? period : 'morning';
    const checkDate = isValidDate(date) ? date : iraqToday();

    let branchId;
    if (req.user.role === 'admin') {
      branchId = parseInt(req.query.branch_id);
      if (!branchId) return res.status(400).json({ message: 'حدد الفرع' });
    } else {
      branchId = req.user.branch_id;
      if (!branchId) return res.status(403).json({ message: 'حسابك غير مرتبط بفرع' });
      if (req.query.branch_id && parseInt(req.query.branch_id) !== branchId) {
        return res.status(403).json({ message: 'ما عندك صلاحية لهذا الفرع' });
      }
    }

    const items = await pool.query(
      `SELECT * FROM checklist_items
       WHERE is_active = TRUE AND (period = 'both' OR period = $1)
       ORDER BY sort_order, id`,
      [checkPeriod]
    );
    const checks = await pool.query(
      `SELECT c.item_id, c.checked_by, c.checked_at, c.note, u.name AS checked_by_name
       FROM checklist_checks c
       LEFT JOIN users u ON u.id = c.checked_by
       WHERE c.branch_id = $1 AND c.check_date = $2 AND c.period = $3`,
      [branchId, checkDate, checkPeriod]
    );
    const byItem = {};
    checks.rows.forEach(c => { byItem[c.item_id] = c; });

    let done = 0;
    const merged = items.rows.map(i => {
      const c = byItem[i.id];
      if (c) done++;
      return {
        id: i.id,
        title: i.title,
        period: i.period,
        checked: !!c,
        checked_by_name: c?.checked_by_name || null,
        checked_at: c?.checked_at || null,
        note: c?.note || null
      };
    });

    res.json({ items: merged, progress: { done, total: items.rows.length } });

    // تنبيه نهاية اليوم — بدون ما نعطل الرد
    ensureChecklistAlerts(checkDate).catch(err => console.error('ensureChecklistAlerts error:', err));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveCheck = async (req, res) => {
  try {
    const { item_id, date, period, checked, note, branch_id } = req.body;
    const checkPeriod = ['morning', 'evening'].includes(period) ? period : null;
    if (!checkPeriod) return res.status(400).json({ message: 'الفترة غير صحيحة' });
    if (!isValidDate(date)) return res.status(400).json({ message: 'التاريخ غير صحيح' });

    let branchId;
    if (req.user.role === 'admin') {
      branchId = parseInt(branch_id);
      if (!branchId) return res.status(400).json({ message: 'حدد الفرع' });
    } else {
      branchId = req.user.branch_id;
      if (!branchId) return res.status(403).json({ message: 'حسابك غير مرتبط بفرع' });
    }

    const item = await pool.query('SELECT id FROM checklist_items WHERE id = $1 AND is_active = TRUE', [item_id]);
    if (item.rows.length === 0) return res.status(404).json({ message: 'البند غير موجود أو موقوف' });

    const isChecked = checked === true;
    if (!isChecked && date < iraqToday()) {
      return res.status(400).json({ message: 'ما تكدر تلغي تعليم أيام سابقة' });
    }

    const result = await pool.query(
      `INSERT INTO checklist_checks (branch_id, item_id, check_date, period, checked_by, checked_at, note)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $5::int IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END, $6)
       ON CONFLICT (branch_id, item_id, check_date, period)
       DO UPDATE SET checked_by = EXCLUDED.checked_by,
                     checked_at = EXCLUDED.checked_at,
                     note = EXCLUDED.note
       RETURNING *`,
      [branchId, item_id, date, checkPeriod, isChecked ? req.user.id : null, note || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── نظرة على الفروع (أدمن ومدراء) ──────────────────────────────

exports.getOverview = async (req, res) => {
  try {
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'هذه الصفحة للأدمن والمدراء فقط' });
    }
    const date = isValidDate(req.query.date) ? req.query.date : iraqToday();

    const params = [];
    let branchWhere = '';
    if (req.user.role !== 'admin') {
      branchWhere = 'WHERE id = $1';
      params.push(req.user.branch_id || -1);
    }
    const branches = await pool.query(`SELECT id, name FROM branches ${branchWhere} ORDER BY name`, params);

    const items = await pool.query(
      "SELECT id, title, period FROM checklist_items WHERE is_active = TRUE ORDER BY sort_order, id"
    );
    const morningItems = items.rows.filter(i => i.period === 'both' || i.period === 'morning');
    const eveningItems = items.rows.filter(i => i.period === 'both' || i.period === 'evening');

    const checks = await pool.query(
      'SELECT branch_id, period, item_id FROM checklist_checks WHERE check_date = $1',
      [date]
    );
    const byBranchPeriod = {};
    checks.rows.forEach(c => {
      const key = `${c.branch_id}:${c.period}`;
      (byBranchPeriod[key] = byBranchPeriod[key] || new Set()).add(c.item_id);
    });

    const overview = branches.rows.map(b => {
      const mSet = byBranchPeriod[`${b.id}:morning`] || new Set();
      const eSet = byBranchPeriod[`${b.id}:evening`] || new Set();
      const missingTitles = [
        ...morningItems.filter(i => !mSet.has(i.id)).map(i => i.title),
        ...eveningItems.filter(i => !eSet.has(i.id)).map(i => i.title)
      ];
      return {
        branch_id: b.id,
        branch_name: b.name,
        morning: { done: morningItems.filter(i => mSet.has(i.id)).length, total: morningItems.length },
        evening: { done: eveningItems.filter(i => eSet.has(i.id)).length, total: eveningItems.length },
        missing_titles: missingTitles
      };
    });

    res.json(overview);

    // تنبيه نهاية اليوم — بدون ما نعطل الرد
    ensureChecklistAlerts(date).catch(err => console.error('ensureChecklistAlerts error:', err));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── تنبيه نهاية اليوم التلقائي ─────────────────────────────────
// بعد الساعة 8 مساءً بتوقيت العراق: إذا بقيت بنود غير معلّمة لأي فرع
// أنشئ تنبيهاً واحداً (dedupe باليوم) + واتساب لمستخدمي الفرع
const ensureChecklistAlerts = async (dateStr) => {
  try {
    const iraqHour = new Date(Date.now() + 3 * 3600e3).getUTCHours();
    if (iraqHour < 20) return;

    const items = await pool.query(
      'SELECT id, title, period FROM checklist_items WHERE is_active = TRUE ORDER BY sort_order, id'
    );
    if (items.rows.length === 0) return;
    const morningItems = items.rows.filter(i => i.period === 'both' || i.period === 'morning');
    const eveningItems = items.rows.filter(i => i.period === 'both' || i.period === 'evening');

    const branches = await pool.query('SELECT id, name FROM branches');
    for (const branch of branches.rows) {
      const checks = await pool.query(
        'SELECT item_id, period FROM checklist_checks WHERE branch_id = $1 AND check_date = $2',
        [branch.id, dateStr]
      );
      const mSet = new Set(checks.rows.filter(c => c.period === 'morning').map(c => c.item_id));
      const eSet = new Set(checks.rows.filter(c => c.period === 'evening').map(c => c.item_id));
      const missingMorning = morningItems.filter(i => !mSet.has(i.id));
      const missingEvening = eveningItems.filter(i => !eSet.has(i.id));
      if (missingMorning.length === 0 && missingEvening.length === 0) continue;

      // تنبيه واحد فقط لكل فرع باليوم
      const existing = await pool.query(
        `SELECT id FROM alerts
         WHERE branch_id = $1 AND title LIKE '%قائمة الفحص%'
           AND is_resolved = FALSE AND created_at::date = CURRENT_DATE`,
        [branch.id]
      );
      if (existing.rows.length > 0) continue;

      const allMissing = [...missingMorning, ...missingEvening];
      const message = [
        `بنود صباحية ناقصة: ${missingMorning.length} | مسائية ناقصة: ${missingEvening.length}`,
        ...allMissing.slice(0, 5).map(i => `• ${i.title}`),
        allMissing.length > 5 ? `... و ${allMissing.length - 5} بند إضافي` : null
      ].filter(Boolean).join('\n');

      await pool.query(
        `INSERT INTO alerts (branch_id, alert_type, title, message)
         VALUES ($1, 'warning', $2, $3)`,
        [branch.id, `📋 قائمة الفحص ناقصة — ${branch.name}`, message]
      );
      await notifyBranch(
        branch.id,
        `⚠️ *قائمة الفحص ناقصة — ${branch.name}*\n\n${message}\n\nراجع قائمة الفحص وأكمل البنود الناقصة.`,
        `checklist:${branch.id}:${dateStr}`
      );
    }
  } catch (err) {
    console.error('ensureChecklistAlerts error:', err);
  }
};
