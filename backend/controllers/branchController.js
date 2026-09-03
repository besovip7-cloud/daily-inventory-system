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

exports.createBranch = async (req, res) => {
  try {
    const { name, location, manager_name, phone } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Branch name is required' });
    }

    const result = await pool.query(
      `INSERT INTO branches (name, location, manager_name, phone)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, location || null, manager_name || null, phone || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;

    const usersCount = await pool.query(
      'SELECT COUNT(*) FROM users WHERE branch_id = $1',
      [id]
    );
    if (parseInt(usersCount.rows[0].count) > 0) {
      return res.status(400).json({
        message: 'Branch has assigned users. Remove or reassign them first.'
      });
    }

    const result = await pool.query(
      'DELETE FROM branches WHERE id = $1 RETURNING id, name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    res.json({ message: 'Branch deleted', branch: result.rows[0] });
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