const pool = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM branches ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM branches WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const itemsResult = await pool.query(
      'SELECT COUNT(*) FROM inventory_items WHERE branch_id = $1 AND is_active = TRUE',
      [id]
    );

    const lowResult = await pool.query(
      `SELECT COUNT(*) FROM inventory_items 
       WHERE branch_id = $1 AND current_quantity <= min_quantity`,
      [id]
    );

    const salesResult = await pool.query(
      `SELECT COALESCE(SUM(total_revenue), 0) as total FROM daily_sales 
       WHERE branch_id = $1 AND record_date = $2`,
      [id, today]
    );

    const invResult = await pool.query(
      `SELECT COUNT(*) FROM daily_inventory 
       WHERE branch_id = $1 AND record_date = $2`,
      [id, today]
    );

    const alertsResult = await pool.query(
      `SELECT * FROM alerts WHERE branch_id = $1 AND is_resolved = FALSE 
       ORDER BY created_at DESC LIMIT 5`,
      [id]
    );

    res.json({
      totalItems: parseInt(itemsResult.rows[0].count),
      lowStockItems: parseInt(lowResult.rows[0].count),
      todaySales: parseFloat(salesResult.rows[0].total),
      inventoryDone: parseInt(invResult.rows[0].count) > 0,
      alerts: alertsResult.rows
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, manager_name } = req.body;
    
    const result = await pool.query(
      `UPDATE branches 
       SET name = $1, location = $2, manager_name = $3
       WHERE id = $4 RETURNING *`,
      [name, location, manager_name, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Branch not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};