const pool = require('../config/database');

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
    const result = await pool.query(
      `INSERT INTO menu_items (name, category, price, cost) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, category, price, cost]
    );
    res.status(201).json(result.rows[0]);
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

        await client.query(
          `INSERT INTO daily_sales (branch_id, item_id, record_date, quantity_sold, total_revenue, payment_card, payment_cash, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (branch_id, item_id, record_date)
           DO UPDATE SET quantity_sold = $4, total_revenue = $5, payment_card = $6, payment_cash = $7, created_by = $8`,
          [branch_id, record.item_id, today, record.quantity_sold, total, payment_card, payment_cash, created_by]
        );
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
