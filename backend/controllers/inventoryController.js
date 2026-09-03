const pool = require('../config/database');
const { checkAndCreateAlerts } = require('../utils/alerts');

exports.getItems = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { category } = req.query;

    let query = 'SELECT * FROM inventory_items WHERE branch_id = $1 AND is_active = TRUE';
    let params = [branchId];

    if (category) {
      query += ' AND category = $2';
      params.push(category);
    }

    query += ' ORDER BY category, name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createItem = async (req, res) => {
  try {
    let { branch_id, name, category, unit, min_quantity, current_quantity, cost_per_unit, barcode } = req.body;

    // Managers can only add items to their own branch
    if (req.user.role !== 'admin') {
      if (!req.user.branch_id) {
        return res.status(403).json({ message: 'No branch assigned to your account' });
      }
      branch_id = req.user.branch_id;
    }

    const result = await pool.query(
      `INSERT INTO inventory_items (branch_id, name, category, unit, min_quantity, current_quantity, cost_per_unit, barcode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [branch_id, name, category, unit, min_quantity, current_quantity, cost_per_unit, barcode]
    );

    // Check alerts
    await checkAndCreateAlerts(branch_id, result.rows[0].id, current_quantity, min_quantity, name);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const canManageItem = async (req, res) => {
  const itemResult = await pool.query('SELECT branch_id FROM inventory_items WHERE id = $1', [req.params.id]);
  if (itemResult.rows.length === 0) {
    res.status(404).json({ message: 'Item not found' });
    return false;
  }
  if (req.user.role !== 'admin' && itemResult.rows[0].branch_id !== req.user.branch_id) {
    res.status(403).json({ message: 'Access denied for this branch' });
    return false;
  }
  return true;
};

exports.updateItem = async (req, res) => {
  try {
    if (!(await canManageItem(req, res))) return;

    const { id } = req.params;
    const { name, category, unit, min_quantity, current_quantity, cost_per_unit, barcode } = req.body;

    const result = await pool.query(
      `UPDATE inventory_items 
       SET name = $1, category = $2, unit = $3, min_quantity = $4, 
           current_quantity = $5, cost_per_unit = $6, barcode = $7
       WHERE id = $8 RETURNING *`,
      [name, category, unit, min_quantity, current_quantity, cost_per_unit, barcode, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const item = result.rows[0];
    await checkAndCreateAlerts(item.branch_id, item.id, item.current_quantity, item.min_quantity, item.name);

    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    if (!(await canManageItem(req, res))) return;

    const { id } = req.params;
    await pool.query('UPDATE inventory_items SET is_active = FALSE WHERE id = $1', [id]);
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Daily Inventory Record
exports.getDailyInventory = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { date } = req.query;
    // ✅ إذا العميل يرسل تاريخ، نستخدمه. ولا نستخدم تاريخ السيرفر
    const targetDate = date || new Date().toISOString().split('T')[0];
    // ... باقي الكود نفسه

    const result = await pool.query(
      `SELECT di.*, ii.name as item_name, ii.unit, ii.min_quantity, ii.category
       FROM daily_inventory di
       JOIN inventory_items ii ON di.item_id = ii.id
       WHERE di.branch_id = $1 AND di.record_date = $2
       ORDER BY ii.category, ii.name`,
      [branchId, targetDate]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveDailyInventory = async (req, res) => {
  try {
    const { branch_id, records } = req.body;
    // ✅ نستخدم تاريخ السيرفر فقط (UTC)
    const today = new Date().toISOString().split('T')[0];
    const created_by = req.user.id;
    // ... باقي الكود نفسه

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const record of records) {
        // Upsert daily inventory
        await client.query(
          `INSERT INTO daily_inventory (branch_id, item_id, record_date, opening_qty, received_qty, consumed_qty, closing_qty, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (branch_id, item_id, record_date)
           DO UPDATE SET opening_qty = $4, received_qty = $5, consumed_qty = $6, 
                         closing_qty = $7, notes = $8, created_by = $9`,
          [branch_id, record.item_id, today, record.opening_qty, record.received_qty, 
           record.consumed_qty, record.closing_qty, record.notes, created_by]
        );

        // Update current quantity
        await client.query(
          `UPDATE inventory_items SET current_quantity = $1 WHERE id = $2`,
          [record.closing_qty, record.item_id]
        );

        // Get item details for alert
        const itemResult = await client.query(
          'SELECT name, min_quantity FROM inventory_items WHERE id = $1',
          [record.item_id]
        );

        if (itemResult.rows.length > 0) {
          const item = itemResult.rows[0];
          await checkAndCreateAlerts(branch_id, record.item_id, record.closing_qty, item.min_quantity, item.name);
        }
      }

      await client.query('COMMIT');
      res.json({ message: 'Daily inventory saved successfully', date: today });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateDailyInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { opening_qty, received_qty, consumed_qty, closing_qty, notes } = req.body;

    const result = await pool.query(
      `UPDATE daily_inventory
       SET opening_qty = $1, received_qty = $2, consumed_qty = $3, closing_qty = $4, notes = $5
       WHERE id = $6
       RETURNING *`,
      [opening_qty, received_qty, consumed_qty, closing_qty, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const record = result.rows[0];

    // Keep the item's current quantity in sync
    await pool.query(
      'UPDATE inventory_items SET current_quantity = $1 WHERE id = $2',
      [closing_qty, record.item_id]
    );

    const itemResult = await pool.query(
      'SELECT name, min_quantity FROM inventory_items WHERE id = $1',
      [record.item_id]
    );
    if (itemResult.rows.length > 0) {
      const item = itemResult.rows[0];
      await checkAndCreateAlerts(record.branch_id, record.item_id, closing_qty, item.min_quantity, item.name);
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteDailyInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const record = await pool.query('SELECT * FROM daily_inventory WHERE id = $1', [id]);
    if (record.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const { item_id } = record.rows[0];
    await pool.query('DELETE FROM daily_inventory WHERE id = $1', [id]);

    // Resync item quantity from the latest remaining record
    await pool.query(
      `UPDATE inventory_items
       SET current_quantity = COALESCE(
         (SELECT closing_qty FROM daily_inventory
          WHERE item_id = $1 ORDER BY record_date DESC LIMIT 1), 0)
       WHERE id = $1`,
      [item_id]
    );

    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getInventoryHistory = async (req, res) => {
  try {
    const { branchId, itemId } = req.params;
    const { from, to } = req.query;

    const result = await pool.query(
      `SELECT di.*, ii.name as item_name, u.name as created_by_name
       FROM daily_inventory di
       JOIN inventory_items ii ON di.item_id = ii.id
       LEFT JOIN users u ON di.created_by = u.id
       WHERE di.branch_id = $1 AND di.item_id = $2
       AND di.record_date BETWEEN $3 AND $4
       ORDER BY di.record_date DESC`,
      [branchId, itemId, from, to]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
