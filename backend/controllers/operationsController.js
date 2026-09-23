const pool = require('../config/database');
const { checkAndCreateAlerts, createInfoAlert } = require('../utils/alerts');

const canManageBranch = (user, branchId) => {
  if (user.role === 'admin') return true;
  return ['manager', 'staff'].includes(user.role) && user.branch_id === parseInt(branchId);
};

// ─── المشتريات: استلام شراء مباشر ───────────────────────────────

exports.getReceiving = async (req, res) => {
  try {
    const params = [];
    let where = '';
    if (req.user.role !== 'admin') {
      where = 'WHERE pr.branch_id = $1';
      params.push(req.user.branch_id || -1);
    }
    const result = await pool.query(
      `SELECT pr.*, b.name AS branch_name, u.name AS created_by_name,
              ii.name AS item_name, ii.unit
       FROM purchase_receipts pr
       JOIN branches b ON b.id = pr.branch_id
       JOIN inventory_items ii ON ii.id = pr.inventory_item_id
       LEFT JOIN users u ON u.id = pr.created_by
       ${where}
       ORDER BY pr.created_at DESC
       LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createReceiving = async (req, res) => {
  const client = await pool.connect();
  try {
    const { branch_id, inventory_item_id, quantity, unit_price, supplier, notes } = req.body;
    if (!canManageBranch(req.user, branch_id)) {
      return res.status(403).json({ message: 'ما عندك صلاحية لهذا الفرع' });
    }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      return res.status(400).json({ message: 'أدخل كمية أكبر من صفر' });
    }
    const itemRes = await client.query('SELECT * FROM inventory_items WHERE id = $1', [inventory_item_id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ message: 'المادة غير موجودة' });
    const item = itemRes.rows[0];
    if (item.branch_id !== parseInt(branch_id)) {
      return res.status(400).json({ message: 'هذه المادة تتبع لفرع آخر' });
    }

    await client.query('BEGIN');
    const recResult = await client.query(
      `INSERT INTO purchase_receipts (branch_id, inventory_item_id, quantity, unit_price, supplier, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [branch_id, inventory_item_id, qty, parseFloat(unit_price) || 0, supplier || null, notes || null, req.user.id]
    );
    const receipt = recResult.rows[0];

    const bal = await client.query(
      'SELECT current_quantity FROM inventory_items WHERE id = $1 FOR UPDATE',
      [inventory_item_id]
    );
    const before = parseFloat(bal.rows[0].current_quantity);
    const after = before + qty;
    await client.query(
      'UPDATE inventory_items SET current_quantity = $1 WHERE id = $2',
      [after, inventory_item_id]
    );
    await client.query(
      `INSERT INTO inventory_movements (branch_id, item_id, movement_type, quantity, balance_before, balance_after, reference, created_by)
       VALUES ($1, $2, 'purchase', $3, $4, $5, $6, $7)`,
      [branch_id, inventory_item_id, qty, before, after,
       `استلام شراء مباشر #${receipt.id}`, req.user.id]
    );

    // إضافة الكمية لعمود الوارد بسجل جرد اليوم تلقائياً
    // إذا الجرد مُرسل يدوياً لا تلمس النهاية — الفرق يظهر كفروقات حقيقية
    const today = new Date().toISOString().split('T')[0];
    await client.query(
      `INSERT INTO daily_inventory (branch_id, item_id, record_date, opening_qty, received_qty, consumed_qty, closing_qty, created_by)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
       ON CONFLICT (branch_id, item_id, record_date)
       DO UPDATE SET received_qty = daily_inventory.received_qty + $5,
                     closing_qty = CASE WHEN daily_inventory.is_submitted THEN daily_inventory.closing_qty ELSE $6 END`,
      [branch_id, inventory_item_id, today, before, qty, after, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ receipt });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

// حذف نهائي مع عكس أثر الكمية — للأدمن فقط
exports.deleteReceiving = async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'هذا الإجراء للأدمن فقط' });
    }
    const result = await client.query('SELECT * FROM purchase_receipts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'سجل الاستلام غير موجود' });
    const receipt = result.rows[0];
    const qty = parseFloat(receipt.quantity);

    await client.query('BEGIN');
    const bal = await client.query(
      'SELECT current_quantity FROM inventory_items WHERE id = $1 FOR UPDATE',
      [receipt.inventory_item_id]
    );
    if (bal.rows.length > 0) {
      const before = parseFloat(bal.rows[0].current_quantity);
      if (before - qty < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'ما يكدر يلغى الاستلام — الكمية الحالية بالمخزون أقل من كمية الاستلام' });
      }
      const after = before - qty;
      await client.query(
        'UPDATE inventory_items SET current_quantity = $1 WHERE id = $2',
        [after, receipt.inventory_item_id]
      );
      await client.query(
        `INSERT INTO inventory_movements (branch_id, item_id, movement_type, quantity, balance_before, balance_after, reference, created_by)
         VALUES ($1, $2, 'purchase', $3, $4, $5, $6, $7)`,
        [receipt.branch_id, receipt.inventory_item_id, qty, before, after,
         `إلغاء استلام شراء مباشر #${receipt.id}`, req.user.id]
      );
      const today = new Date().toISOString().split('T')[0];
      await client.query(
        `INSERT INTO daily_inventory (branch_id, item_id, record_date, opening_qty, received_qty, consumed_qty, closing_qty, created_by)
         VALUES ($1, $2, $3, $4, 0, 0, $5, $6)
         ON CONFLICT (branch_id, item_id, record_date)
         DO UPDATE SET received_qty = GREATEST(daily_inventory.received_qty - $7, 0),
                       closing_qty = CASE WHEN daily_inventory.is_submitted THEN daily_inventory.closing_qty ELSE $5 END`,
        [receipt.branch_id, receipt.inventory_item_id, today, before, after, req.user.id, qty]
      );
    }

    await client.query('DELETE FROM purchase_receipts WHERE id = $1', [receipt.id]);
    await client.query('COMMIT');
    res.json({ message: `تم حذف استلام #${receipt.id} وعكس الكمية من المخزون` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

// ─── الهدر ──────────────────────────────────────────────────────

exports.getWaste = async (req, res) => {
  try {
    const params = [];
    let where = '';
    if (req.user.role !== 'admin') {
      where = 'WHERE wr.branch_id = $1';
      params.push(req.user.branch_id || -1);
    }
    const result = await pool.query(
      `SELECT wr.*, b.name AS branch_name, u.name AS created_by_name,
              ii.name AS item_name, ii.unit
       FROM waste_records wr
       JOIN branches b ON b.id = wr.branch_id
       JOIN inventory_items ii ON ii.id = wr.inventory_item_id
       LEFT JOIN users u ON u.id = wr.created_by
       ${where}
       ORDER BY wr.created_at DESC
       LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createWaste = async (req, res) => {
  const client = await pool.connect();
  try {
    const { branch_id, inventory_item_id, quantity, reason, notes } = req.body;
    if (!canManageBranch(req.user, branch_id)) {
      return res.status(403).json({ message: 'ما عندك صلاحية لهذا الفرع' });
    }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      return res.status(400).json({ message: 'أدخل كمية أكبر من صفر' });
    }
    const itemRes = await client.query('SELECT * FROM inventory_items WHERE id = $1', [inventory_item_id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ message: 'المادة غير موجودة' });
    const item = itemRes.rows[0];
    if (item.branch_id !== parseInt(branch_id)) {
      return res.status(400).json({ message: 'هذه المادة تتبع لفرع آخر' });
    }
    const before = parseFloat(item.current_quantity);
    if (qty > before) {
      return res.status(400).json({ message: 'الكمية المهدوَرة أكبر من الموجود بالمخزون' });
    }

    await client.query('BEGIN');
    const wasteResult = await client.query(
      `INSERT INTO waste_records (branch_id, inventory_item_id, quantity, reason, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [branch_id, inventory_item_id, qty, reason || null, notes || null, req.user.id]
    );
    const waste = wasteResult.rows[0];

    const bal = await client.query(
      'SELECT current_quantity FROM inventory_items WHERE id = $1 FOR UPDATE',
      [inventory_item_id]
    );
    const lockedBefore = parseFloat(bal.rows[0].current_quantity);
    const after = lockedBefore - qty;
    await client.query(
      'UPDATE inventory_items SET current_quantity = $1 WHERE id = $2',
      [after, inventory_item_id]
    );
    await client.query(
      `INSERT INTO inventory_movements (branch_id, item_id, movement_type, quantity, balance_before, balance_after, reference, created_by)
       VALUES ($1, $2, 'waste', $3, $4, $5, $6, $7)`,
      [branch_id, inventory_item_id, qty, lockedBefore, after,
       `هدر #${waste.id}`, req.user.id]
    );

    // إضافة الكمية لعمود المستهلك بسجل جرد اليوم تلقائياً
    // إذا الجرد مُرسل يدوياً لا تلمس النهاية — الفرق يظهر كفروقات حقيقية
    const today = new Date().toISOString().split('T')[0];
    await client.query(
      `INSERT INTO daily_inventory (branch_id, item_id, record_date, opening_qty, received_qty, consumed_qty, closing_qty, created_by)
       VALUES ($1, $2, $3, $4, 0, $5, $6, $7)
       ON CONFLICT (branch_id, item_id, record_date)
       DO UPDATE SET consumed_qty = daily_inventory.consumed_qty + $5,
                     closing_qty = CASE WHEN daily_inventory.is_submitted THEN daily_inventory.closing_qty ELSE $6 END`,
      [branch_id, inventory_item_id, today, lockedBefore, qty, after, req.user.id]
    );

    await client.query('COMMIT');

    // تنبيهات المخزون + تنبيه معلوماتي بعد أي نقص بالمخزون
    await checkAndCreateAlerts(branch_id, inventory_item_id, after, parseFloat(item.min_quantity), item.name);
    const b = await pool.query('SELECT name FROM branches WHERE id = $1', [branch_id]);
    await createInfoAlert(
      branch_id,
      `🗑️ هدر مسجّل — ${item.name}`,
      `${qty} ${item.unit || ''} | الفرع: ${b.rows[0]?.name || ''} | السبب: ${reason || '—'}`
    );

    res.status(201).json({ waste });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

// حذف نهائي مع إرجاع الكمية للمخزون — للأدمن فقط
exports.deleteWaste = async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'هذا الإجراء للأدمن فقط' });
    }
    const result = await client.query('SELECT * FROM waste_records WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'سجل الهدر غير موجود' });
    const waste = result.rows[0];
    const qty = parseFloat(waste.quantity);

    await client.query('BEGIN');
    const bal = await client.query(
      'SELECT current_quantity FROM inventory_items WHERE id = $1 FOR UPDATE',
      [waste.inventory_item_id]
    );
    if (bal.rows.length > 0) {
      const before = parseFloat(bal.rows[0].current_quantity);
      const after = before + qty;
      await client.query(
        'UPDATE inventory_items SET current_quantity = $1 WHERE id = $2',
        [after, waste.inventory_item_id]
      );
      await client.query(
        `INSERT INTO inventory_movements (branch_id, item_id, movement_type, quantity, balance_before, balance_after, reference, created_by)
         VALUES ($1, $2, 'waste', $3, $4, $5, $6, $7)`,
        [waste.branch_id, waste.inventory_item_id, qty, before, after,
         `إلغاء هدر #${waste.id}`, req.user.id]
      );
      const today = new Date().toISOString().split('T')[0];
      await client.query(
        `INSERT INTO daily_inventory (branch_id, item_id, record_date, opening_qty, received_qty, consumed_qty, closing_qty, created_by)
         VALUES ($1, $2, $3, $4, 0, 0, $5, $6)
         ON CONFLICT (branch_id, item_id, record_date)
         DO UPDATE SET consumed_qty = GREATEST(daily_inventory.consumed_qty - $7, 0),
                       closing_qty = CASE WHEN daily_inventory.is_submitted THEN daily_inventory.closing_qty ELSE $5 END`,
        [waste.branch_id, waste.inventory_item_id, today, before, after, req.user.id, qty]
      );
    }

    await client.query('DELETE FROM waste_records WHERE id = $1', [waste.id]);
    await client.query('COMMIT');
    res.json({ message: `تم حذف هدر #${waste.id} وإرجاع الكمية للمخزون` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};
