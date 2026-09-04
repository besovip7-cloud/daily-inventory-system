const pool = require('../config/database');

exports.getInventoryReport = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { from, to } = req.query;

    const result = await pool.query(
      `SELECT 
        di.id,
        ii.name, ii.unit, ii.min_quantity,
        di.record_date,
        di.opening_qty,
        di.received_qty,
        di.consumed_qty,
        di.closing_qty,
        (di.closing_qty - ii.min_quantity) as variance
       FROM daily_inventory di
       JOIN inventory_items ii ON di.item_id = ii.id
       WHERE di.branch_id = $1 AND di.record_date BETWEEN $2 AND $3
       ORDER BY di.record_date DESC, ii.category, ii.name`,
      [branchId, from, to]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { from, to } = req.query;

    const result = await pool.query(
      `SELECT 
        ds.id,
        mi.name, mi.price,
        ds.record_date,
        ds.quantity_sold,
        ds.total_revenue,
        ds.payment_card,
        ds.payment_cash
       FROM daily_sales ds
       JOIN menu_items mi ON ds.item_id = mi.id
       WHERE ds.branch_id = $1 AND ds.record_date BETWEEN $2 AND $3
       ORDER BY ds.record_date DESC, mi.category, mi.name`,
      [branchId, from, to]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getComparisonReport = async (req, res) => {
  try {
    const { from, to } = req.query;

    // Compare all branches
    const result = await pool.query(
      `SELECT 
        b.name as branch_name,
        COALESCE(SUM(ds.total_revenue), 0) as total_revenue,
        COALESCE(SUM(ds.quantity_sold), 0) as total_orders
       FROM branches b
       LEFT JOIN daily_sales ds ON b.id = ds.branch_id 
         AND ds.record_date BETWEEN $1 AND $2
       GROUP BY b.id, b.name
       ORDER BY total_revenue DESC`,
      [from, to]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMovements = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { from, to } = req.query;

    const result = await pool.query(
      `SELECT m.id, m.movement_type, m.quantity, m.balance_before, m.balance_after,
              m.reference, m.created_at, ii.name as item_name, ii.unit, u.name as created_by_name
       FROM inventory_movements m
       JOIN inventory_items ii ON ii.id = m.item_id
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.branch_id = $1 AND m.created_at::date BETWEEN $2 AND $3
       ORDER BY m.created_at DESC`,
      [branchId, from, to]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getVariance = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT di.item_id, ii.name, ii.unit,
              di.opening_qty, di.received_qty, di.closing_qty,
              COALESCE((
                SELECT SUM(-m.quantity)
                FROM inventory_movements m
                WHERE m.item_id = di.item_id AND m.branch_id = di.branch_id
                  AND m.movement_type = 'sale' AND m.created_at::date = di.record_date
              ), 0) as recipe_deductions
       FROM daily_inventory di
       JOIN inventory_items ii ON ii.id = di.item_id
       WHERE di.branch_id = $1 AND di.record_date = $2
       ORDER BY ii.name`,
      [branchId, targetDate]
    );

    const rows = result.rows.map(r => {
      const expected = parseFloat(r.opening_qty) + parseFloat(r.received_qty) - parseFloat(r.recipe_deductions);
      const actual = parseFloat(r.closing_qty);
      const variance = actual - expected;
      return {
        ...r,
        expected: expected.toFixed(3),
        variance: variance.toFixed(3)
      };
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getLowStockReport = async (req, res) => {
  try {
    const { branchId } = req.params;

    const result = await pool.query(
      `SELECT 
        ii.name, ii.unit, ii.min_quantity, ii.current_quantity,
        b.name as branch_name,
        CASE 
          WHEN ii.current_quantity <= 0 THEN 'out_of_stock'
          WHEN ii.current_quantity <= ii.min_quantity * 0.5 THEN 'critical'
          WHEN ii.current_quantity <= ii.min_quantity THEN 'low'
          ELSE 'normal'
        END as status
       FROM inventory_items ii
       JOIN branches b ON ii.branch_id = b.id
       WHERE ii.branch_id = $1 AND ii.is_active = TRUE
       AND ii.current_quantity <= ii.min_quantity
       ORDER BY ii.current_quantity ASC`,
      [branchId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
