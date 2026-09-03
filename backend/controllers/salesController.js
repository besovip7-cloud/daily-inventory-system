const pool = require('../config/database');
const { checkAndCreateAlerts } = require('../utils/alerts');

// Deducts (or restores, for negative delta) recipe quantities from inventory
const applyRecipeDelta = async (executor, branchId, menuItemId, deltaQty) => {
  if (!deltaQty) return;
  const recipes = await executor.query(
    'SELECT inventory_item_id, quantity FROM menu_recipes WHERE branch_id = $1 AND menu_item_id = $2',
    [branchId, menuItemId]
  );
  for (const r of recipes.rows) {
    const used = deltaQty * parseFloat(r.quantity);
    const upd = await executor.query(
      'UPDATE inventory_items SET current_quantity = current_quantity - $1 WHERE id = $2 RETURNING name, min_quantity, current_quantity',
      [used, r.inventory_item_id]
    );
    if (upd.rows.length > 0) {
      await checkAndCreateAlerts(branchId, r.inventory_item_id, upd.rows[0].current_quantity, upd.rows[0].min_quantity, upd.rows[0].name);
    }
  }
};

exports.getMenuItems = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM menu_items WHERE is_active = TRUE ORDER BY category, name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    const { name, category, price, cost } = req.body;

    // Reject duplicate names
    const duplicate = await pool.query(
      `SELECT id FROM menu_items
       WHERE is_active = TRUE AND LOWER(TRIM(name)) = LOWER(TRIM($1))`,
      [name]
    );
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ message: 'الصنف موجود مسبقاً' });
    }

    const result = await pool.query(
      `INSERT INTO menu_items (name, category, price, cost) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, category, price, cost]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const { name, category, price, cost } = req.body;

    // Reject duplicate names (excluding the item being edited)
    const duplicate = await pool.query(
      `SELECT id FROM menu_items
       WHERE is_active = TRUE AND id != $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))`,
      [req.params.id, name]
    );
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ message: 'الصنف موجود مسبقاً' });
    }

    const result = await pool.query(
      `UPDATE menu_items SET name = $1, category = $2, price = $3, cost = $4
       WHERE id = $5 RETURNING *`,
      [name, category, price, cost, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE menu_items SET is_active = FALSE WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json({ message: 'Menu item deleted', item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDailySales = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT ds.*, mi.name as item_name, mi.price as unit_price, mi.category
       FROM daily_sales ds
       JOIN menu_items mi ON ds.item_id = mi.id
       WHERE ds.branch_id = $1 AND ds.record_date = $2
       ORDER BY mi.category, mi.name`,
      [branchId, targetDate]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveDailySales = async (req, res) => {
  try {
    const { branch_id, records, payment_card, payment_cash } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const created_by = req.user.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const record of records) {
        const total = record.quantity_sold * record.unit_price;

        // Previous quantity (for recipe delta calculation)
        const prev = await client.query(
          'SELECT quantity_sold FROM daily_sales WHERE branch_id = $1 AND item_id = $2 AND record_date = $3',
          [branch_id, record.item_id, today]
        );
        const delta = record.quantity_sold - (prev.rows.length ? prev.rows[0].quantity_sold : 0);

        await client.query(
          `INSERT INTO daily_sales (branch_id, item_id, record_date, quantity_sold, total_revenue, payment_card, payment_cash, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (branch_id, item_id, record_date)
           DO UPDATE SET quantity_sold = $4, total_revenue = $5, payment_card = $6, payment_cash = $7, created_by = $8`,
          [branch_id, record.item_id, today, record.quantity_sold, total, payment_card, payment_cash, created_by]
        );

        // Deduct recipe ingredients from inventory
        await applyRecipeDelta(client, branch_id, record.item_id, delta);
      }

      await client.query('COMMIT');
      res.json({ message: 'Daily sales saved successfully', date: today });
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

exports.updateDailySale = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity_sold, payment_card, payment_cash, notes } = req.body;

    // Recalculate revenue from the item's unit price
    const oldResult = await pool.query('SELECT * FROM daily_sales WHERE id = $1', [id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }
    const old = oldResult.rows[0];
    const priceResult = await pool.query(
      'SELECT price FROM menu_items WHERE id = $1',
      [old.item_id]
    );

    const total = quantity_sold * parseFloat(priceResult.rows[0].price);

    const result = await pool.query(
      `UPDATE daily_sales
       SET quantity_sold = $1, total_revenue = $2, payment_card = $3, payment_cash = $4, notes = $5
       WHERE id = $6
       RETURNING *`,
      [quantity_sold, total, payment_card || 0, payment_cash || 0, notes || null, id]
    );

    // Apply the difference in recipe ingredients
    await applyRecipeDelta(pool, old.branch_id, old.item_id, quantity_sold - old.quantity_sold);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteDailySale = async (req, res) => {
  try {
    const old = await pool.query('SELECT * FROM daily_sales WHERE id = $1', [req.params.id]);
    if (old.rows.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    await pool.query('DELETE FROM daily_sales WHERE id = $1', [req.params.id]);

    // Restore recipe ingredients to inventory
    await applyRecipeDelta(pool, old.rows[0].branch_id, old.rows[0].item_id, -old.rows[0].quantity_sold);

    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ===== Recipes (menu item ingredients) =====
exports.getRecipes = async (req, res) => {
  try {
    const { branch_id, menu_id } = req.query;
    const result = await pool.query(
      `SELECT r.id, r.inventory_item_id, r.quantity, ii.name as inventory_name, ii.unit
       FROM menu_recipes r
       JOIN inventory_items ii ON ii.id = r.inventory_item_id
       WHERE r.branch_id = $1 AND r.menu_item_id = $2
       ORDER BY ii.name`,
      [branch_id, menu_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveRecipe = async (req, res) => {
  try {
    const { branch_id, menu_item_id, inventory_item_id, quantity } = req.body;
    const result = await pool.query(
      `INSERT INTO menu_recipes (branch_id, menu_item_id, inventory_item_id, quantity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (branch_id, menu_item_id, inventory_item_id)
       DO UPDATE SET quantity = $4
       RETURNING *`,
      [branch_id, menu_item_id, inventory_item_id, quantity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteRecipe = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM menu_recipes WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSalesSummary = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { from, to } = req.query;

    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(quantity_sold), 0) as total_orders,
        COALESCE(SUM(total_revenue), 0) as total_revenue,
        COALESCE(SUM(payment_card), 0) as total_card,
        COALESCE(SUM(payment_cash), 0) as total_cash
       FROM daily_sales 
       WHERE branch_id = $1 AND record_date BETWEEN $2 AND $3`,
      [branchId, from, to]
    );

    // Top selling items
    const topItems = await pool.query(
      `SELECT mi.name, SUM(ds.quantity_sold) as total_qty, SUM(ds.total_revenue) as total_rev
       FROM daily_sales ds
       JOIN menu_items mi ON ds.item_id = mi.id
       WHERE ds.branch_id = $1 AND ds.record_date BETWEEN $2 AND $3
       GROUP BY mi.id, mi.name
       ORDER BY total_qty DESC
       LIMIT 5`,
      [branchId, from, to]
    );

    res.json({
      summary: result.rows[0],
      topItems: topItems.rows
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSalesTrend = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { days = 7 } = req.query;

    const result = await pool.query(
      `SELECT record_date, SUM(total_revenue) as revenue, SUM(quantity_sold) as orders
       FROM daily_sales 
       WHERE branch_id = $1 
       AND record_date >= CURRENT_DATE - INTERVAL '${days} days'
       GROUP BY record_date
       ORDER BY record_date`,
      [branchId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
