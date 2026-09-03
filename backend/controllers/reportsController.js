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
