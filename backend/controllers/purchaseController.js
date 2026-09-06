const pool = require('../config/database');

const canManageBranch = (user, branchId) => {
  if (user.role === 'admin') return true;
  return ['manager', 'staff'].includes(user.role) && user.branch_id === parseInt(branchId);
};

exports.getRequests = async (req, res) => {
  try {
    const params = [];
    let where = '';
    if (req.user.role !== 'admin') {
      where = 'WHERE pr.branch_id = $1';
      params.push(req.user.branch_id || -1);
    }
    const result = await pool.query(
      `SELECT pr.*, b.name AS branch_name, u.name AS created_by_name, cu.name AS confirmed_by_name
       FROM purchase_requests pr
       JOIN branches b ON b.id = pr.branch_id
       LEFT JOIN users u ON u.id = pr.created_by
       LEFT JOIN users cu ON cu.id = pr.confirmed_by
       ${where}
       ORDER BY pr.created_at DESC
       LIMIT 200`,
      params
    );

    if (result.rows.length > 0) {
      const ids = result.rows.map(r => r.id);
      const items = await pool.query(
        `SELECT pri.request_id, pri.id, pri.inventory_item_id, pri.quantity,
                ii.name AS item_name, ii.unit
         FROM purchase_request_items pri
         JOIN inventory_items ii ON ii.id = pri.inventory_item_id
         WHERE pri.request_id = ANY($1)
         ORDER BY ii.name`,
        [ids]
      );
      const byReq = {};
      items.rows.forEach(i => {
        (byReq[i.request_id] = byReq[i.request_id] || []).push(i);
      });
      result.rows.forEach(r => { r.items = byReq[r.id] || []; });
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    const { branch_id, items, notes } = req.body;
    if (!canManageBranch(req.user, branch_id)) {
      return res.status(403).json({ message: 'ما عندك صلاحية لهذا الفرع' });
    }
    const clean = (Array.isArray(items) ? items : [])
      .map(i => ({ inventory_item_id: parseInt(i.inventory_item_id), quantity: parseFloat(i.quantity) }))
      .filter(i => i.inventory_item_id && i.quantity > 0);
    if (clean.length === 0) {
      return res.status(400).json({ message: 'أضف مادة واحدة على الأقل بكمية أكبر من صفر' });
    }

    await client.query('BEGIN');
    const reqResult = await client.query(
      `INSERT INTO purchase_requests (branch_id, notes, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [branch_id, notes || null, req.user.id]
    );
    const request = reqResult.rows[0];

    const names = [];
    for (const item of clean) {
      const itemInfo = await client.query(
        'SELECT name FROM inventory_items WHERE id = $1', [item.inventory_item_id]
      );
      await client.query(
        `INSERT INTO purchase_request_items (request_id, inventory_item_id, quantity)
         VALUES ($1, $2, $3)`,
        [request.id, item.inventory_item_id, item.quantity]
      );
      names.push(`${itemInfo.rows[0]?.name || item.inventory_item_id} (${item.quantity})`);
    }

    // تنبيه لأصحاب الصلاحية بالفرع
    await client.query(
      `INSERT INTO alerts (branch_id, item_id, alert_type, title, message)
       VALUES ($1, NULL, 'info', $2, $3)`,
      [branch_id, `طلب شراء جديد #${request.id}`, names.join('، ')]
    );

    await client.query('COMMIT');
    res.status(201).json({ request: { ...request, items: clean } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

exports.confirmRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM purchase_requests WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'الطلب غير موجود' });
    const request = result.rows[0];
    if (request.status !== 'pending') return res.status(400).json({ message: 'الطلب مؤكد أو ملغي مسبقاً' });
    if (!canManageBranch(req.user, request.branch_id)) {
      return res.status(403).json({ message: 'ما عندك صلاحية لهذا الفرع' });
    }

    await client.query('BEGIN');

    const items = await client.query(
      `SELECT pri.*, ii.name AS item_name
       FROM purchase_request_items pri
       JOIN inventory_items ii ON ii.id = pri.inventory_item_id
       WHERE pri.request_id = $1`,
      [request.id]
    );

    for (const item of items.rows) {
      const bal = await client.query(
        'SELECT current_quantity FROM inventory_items WHERE id = $1 FOR UPDATE',
        [item.inventory_item_id]
      );
      if (bal.rows.length === 0) continue;
      const before = parseFloat(bal.rows[0].current_quantity);
      const after = before + parseFloat(item.quantity);
      await client.query(
        'UPDATE inventory_items SET current_quantity = $1 WHERE id = $2',
        [after, item.inventory_item_id]
      );
      await client.query(
        `INSERT INTO inventory_movements (branch_id, item_id, movement_type, quantity, balance_before, balance_after, reference, created_by)
         VALUES ($1, $2, 'purchase', $3, $4, $5, $6, $7)`,
        [request.branch_id, item.inventory_item_id, item.quantity, before, after,
         `استلام طلب شراء #${request.id}`, req.user.id]
      );
    }

    await client.query(
      `UPDATE purchase_requests SET status = 'received', confirmed_by = $1, confirmed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [req.user.id, request.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'تم تأكيد الاستلام وإضافة الكميات للجرد' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

exports.cancelRequest = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM purchase_requests WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'الطلب غير موجود' });
    const request = result.rows[0];
    if (request.status !== 'pending') return res.status(400).json({ message: 'ما تكدر تلغي طلب مؤكد' });
    if (!canManageBranch(req.user, request.branch_id) && request.created_by !== req.user.id) {
      return res.status(403).json({ message: 'ما عندك صلاحية لهذا الطلب' });
    }
    await pool.query('UPDATE purchase_requests SET status = $1 WHERE id = $2', ['cancelled', request.id]);
    res.json({ message: 'تم إلغاء الطلب' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
