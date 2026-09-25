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
      `SELECT c.item_id, c.checked, c.status, c.checked_by, c.checked_at, c.note, c.photo, u.name AS checked_by_name
       FROM checklist_checks c
       LEFT JOIN users u ON u.id = c.checked_by
       WHERE c.branch_id = $1 AND c.check_date = $2 AND c.period = $3`,
      [branchId, checkDate, checkPeriod]
    );
    const byItem = {};
    checks.rows.forEach(c => { byItem[c.item_id] = c; });

    const approval = await pool.query(
      `SELECT a.approved_at, a.note, u.name AS approved_by_name
       FROM checklist_day_approvals a
       LEFT JOIN users u ON u.id = a.approved_by
       WHERE a.branch_id = $1 AND a.check_date = $2`,
      [branchId, checkDate]
    );

    let done = 0;
    const merged = items.rows.map(i => {
      const c = byItem[i.id];
      const isDone = c?.checked === true;
      if (isDone) done++;
      return {
        id: i.id,
        title: i.title,
        period: i.period,
        checked: isDone,
        status: isDone ? (c?.status || 'pass') : null,
        checked_by_name: c?.checked_by_name || null,
        checked_at: c?.checked_at || null,
        note: c?.note || null,
        photo: c?.photo || null
      };
    });

    res.json({
      items: merged,
      progress: { done, total: items.rows.length },
      approved: approval.rows.length > 0,
      approved_by_name: approval.rows[0]?.approved_by_name || null,
      approved_at: approval.rows[0]?.approved_at || null,
      approval_note: approval.rows[0]?.note || null
    });

    // تنبيه نهاية اليوم — بدون ما نعطل الرد
    ensureChecklistAlerts(checkDate).catch(err => console.error('ensureChecklistAlerts error:', err));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveCheck = async (req, res) => {
  try {
    const { item_id, date, period, status, checked, note, photo, branch_id } = req.body;
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

    // تحديد العملية: تقييم (pass/fail) أو مسح (null) أو تعديل ملاحظة/صورة فقط
    let statusParam; // 'pass' | 'fail' | null (مسح) | undefined (حافظ)
    if (status === 'pass' || status === 'fail') statusParam = status;
    else if (status === null || status === 'none' || checked === false) statusParam = null;
    else if (checked === true) statusParam = 'pass'; // توافق رجعي
    else statusParam = undefined;

    // المسح: حذف السجل — للأدمن فقط، مع حماية الأيام السابقة
    if (statusParam === null) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'مسح التعليم متاح للأدمن فقط' });
      }
      if (date < iraqToday()) {
        return res.status(400).json({ message: 'ما تكدر تلغي تعليم أيام سابقة' });
      }
      await pool.query(
        `DELETE FROM checklist_checks
         WHERE branch_id = $1 AND item_id = $2 AND check_date = $3 AND period = $4`,
        [branchId, item_id, date, checkPeriod]
      );
      return res.json({ cleared: true, item_id, date, period: checkPeriod });
    }

    // تعديل ملاحظة/صورة فقط — لازم يكون فيه تعليم موجود
    if (statusParam === undefined) {
      const existing = await pool.query(
        `SELECT id FROM checklist_checks
         WHERE branch_id = $1 AND item_id = $2 AND check_date = $3 AND period = $4 AND checked = TRUE`,
        [branchId, item_id, date, checkPeriod]
      );
      if (existing.rows.length === 0) {
        return res.status(400).json({ message: 'لا يوجد تعليم لتعديله' });
      }
    }

    // خطأ بدون سبب مرفوض
    if (statusParam === 'fail' && (!note || !String(note).trim())) {
      return res.status(400).json({ message: 'لازم تكتب سبب عند اختيار خطأ' });
    }

    // الملاحظة: ما تنعبى بالطلب = حافظ على الموجودة، تعيين صراحةً (حتى الفارغة) = حدّثها
    const noteProvided = note !== undefined;
    const noteParam = noteProvided ? (note || null) : null;

    // الصورة: data URL بصيغة image/* وحجم أقصى ~700 ألف محرف
    let photoParam = null;
    if (typeof photo === 'string' && photo.length > 0) {
      if (!photo.startsWith('data:image/')) return res.status(400).json({ message: 'الصورة غير صالحة' });
      if (photo.length > 700000) return res.status(400).json({ message: 'الصورة كبيرة جداً — أعد تصويرها' });
      photoParam = photo;
    }

    const result = await pool.query(
      `INSERT INTO checklist_checks (branch_id, item_id, check_date, period, checked, status, checked_by, checked_at, note, photo)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, CURRENT_TIMESTAMP,
               CASE WHEN $7 THEN $8 ELSE NULL END, $9)
       ON CONFLICT (branch_id, item_id, check_date, period)
       DO UPDATE SET checked = TRUE,
                     status = CASE WHEN $5::text IS NULL THEN checklist_checks.status ELSE EXCLUDED.status END,
                     checked_by = CASE WHEN $5::text IS NULL THEN checklist_checks.checked_by ELSE EXCLUDED.checked_by END,
                     checked_at = CASE WHEN $5::text IS NULL THEN checklist_checks.checked_at ELSE CURRENT_TIMESTAMP END,
                     note = CASE WHEN $7 THEN EXCLUDED.note ELSE checklist_checks.note END,
                     photo = CASE
                       WHEN $9::text IS NULL THEN checklist_checks.photo
                       ELSE EXCLUDED.photo
                     END
       RETURNING *`,
      [branchId, item_id, date, checkPeriod, statusParam || null, req.user.id,
       noteProvided, noteParam, photoParam]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── اعتماد مسؤول الجودة ────────────────────────────────────────

exports.approveDay = async (req, res) => {
  try {
    const { branch_id, date, note } = req.body;
    if (!isValidDate(date)) return res.status(400).json({ message: 'التاريخ غير صحيح' });

    let branchId;
    if (req.user.role === 'admin') {
      branchId = parseInt(branch_id);
      if (!branchId) return res.status(400).json({ message: 'حدد الفرع' });
    } else {
      branchId = req.user.branch_id;
      if (!branchId) return res.status(403).json({ message: 'حسابك غير مرتبط بفرع' });
    }

    const count = await pool.query(
      'SELECT COUNT(*) FROM checklist_checks WHERE branch_id = $1 AND check_date = $2',
      [branchId, date]
    );
    if (parseInt(count.rows[0].count) === 0) {
      return res.status(400).json({ message: 'ما تكدر تعتمد يوم بدون أي تعليم' });
    }

    const result = await pool.query(
      `INSERT INTO checklist_day_approvals (branch_id, check_date, approved_by, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (branch_id, check_date)
       DO UPDATE SET approved_by = EXCLUDED.approved_by,
                     approved_at = CURRENT_TIMESTAMP,
                     note = EXCLUDED.note
       RETURNING *`,
      [branchId, date, req.user.id, note || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.unapproveDay = async (req, res) => {
  try {
    const { branch_id, date } = req.body;
    if (!isValidDate(date)) return res.status(400).json({ message: 'التاريخ غير صحيح' });

    let branchId;
    if (req.user.role === 'admin') {
      branchId = parseInt(branch_id);
      if (!branchId) return res.status(400).json({ message: 'حدد الفرع' });
    } else {
      branchId = req.user.branch_id;
      if (!branchId) return res.status(403).json({ message: 'حسابك غير مرتبط بفرع' });
    }

    const result = await pool.query(
      'DELETE FROM checklist_day_approvals WHERE branch_id = $1 AND check_date = $2 RETURNING id',
      [branchId, date]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'الاعتماد غير موجود' });
    res.json({ message: 'تم إلغاء الاعتماد' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── الشهرية (شبكة الشهر) ───────────────────────────────────────

exports.getMonth = async (req, res) => {
  try {
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

    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : iraqToday().slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const todayStr = iraqToday();
    const todayNum = month === todayStr.slice(0, 7) ? parseInt(todayStr.slice(8, 10)) : null;

    const items = await pool.query(
      'SELECT id, title, period FROM checklist_items WHERE is_active = TRUE ORDER BY sort_order, id'
    );
    const morningItems = items.rows.filter(i => i.period === 'both' || i.period === 'morning');
    const eveningItems = items.rows.filter(i => i.period === 'both' || i.period === 'evening');

    const checks = await pool.query(
      `SELECT item_id, check_date, period, status, note
       FROM checklist_checks
       WHERE branch_id = $1 AND check_date >= $2::date AND check_date < ($2::date + INTERVAL '1 month')`,
      [branchId, `${month}-01`]
    );
    const approvals = await pool.query(
      `SELECT check_date FROM checklist_day_approvals
       WHERE branch_id = $1 AND check_date >= $2::date AND check_date < ($2::date + INTERVAL '1 month')`,
      [branchId, `${month}-01`]
    );
    const approvedDays = new Set(approvals.rows.map(a => parseInt(String(a.check_date).slice(8, 10))));

    // خريطة كل يوم: الفترة → (item_id → {status, note})
    const byDay = {};
    checks.rows.forEach(c => {
      const day = parseInt(String(c.check_date).slice(8, 10));
      const bucket = (byDay[day] = byDay[day] || { m: new Map(), e: new Map() });
      bucket[c.period === 'morning' ? 'm' : 'e'].set(c.item_id, { status: c.status || 'pass', note: c.note });
    });

    let commitmentDone = 0;
    let commitmentTotal = 0;
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const activity = byDay[day];
      if (!activity && (todayNum === null || day > todayNum)) continue; // أيام المستقبل بدون نشاط
      const mDone = morningItems.filter(i => activity?.m.has(i.id)).length;
      const eDone = eveningItems.filter(i => activity?.e.has(i.id)).length;
      if (activity) {
        commitmentDone += mDone + eDone;
        commitmentTotal += morningItems.length + eveningItems.length;
      }
      // خريطة حالة كل بند: m/e = 'pass'|'fail'|null و mn/en = سبب الخطأ إن وجد
      const checksMap = {};
      if (activity) {
        items.rows.forEach(i => {
          const m = activity.m.get(i.id);
          const e = activity.e.get(i.id);
          if (m || e) {
            checksMap[i.id] = {
              m: m ? m.status : null,
              e: e ? e.status : null,
              mn: m && m.status === 'fail' && m.note ? m.note : null,
              en: e && e.status === 'fail' && e.note ? e.note : null
            };
          }
        });
      }
      const missing = activity ? [
        ...morningItems.filter(i => !activity.m.has(i.id)).map(i => i.title),
        ...eveningItems.filter(i => !activity.e.has(i.id)).map(i => i.title)
      ] : [];
      days.push({
        day,
        morning: { done: mDone, total: morningItems.length },
        evening: { done: eDone, total: eveningItems.length },
        missing_titles: missing,
        approved: approvedDays.has(day),
        checks: checksMap
      });
    }

    res.json({
      month,
      items: items.rows,
      days,
      commitment: { done: commitmentDone, total: commitmentTotal },
      approved_days: approvedDays.size
    });
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
