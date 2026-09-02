const pool = require('../config/database');

exports.getAlerts = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { type, resolved } = req.query;

    let query = `SELECT a.*, ii.name as item_name 
                 FROM alerts a
                 LEFT JOIN inventory_items ii ON a.item_id = ii.id
                 WHERE a.branch_id = $1`;
    let params = [branchId];
    let paramIndex = 2;

    if (type) {
      query += ` AND a.alert_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (resolved !== undefined) {
      query += ` AND a.is_resolved = $${paramIndex}`;
      params.push(resolved === 'true');
      paramIndex++;
    }

    query += ` ORDER BY a.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const resolved_by = req.user.id;

    const result = await pool.query(
      `UPDATE alerts 
       SET is_resolved = TRUE, resolved_by = $1, resolved_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [resolved_by, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.resolveAll = async (req, res) => {
  try {
    const { branchId } = req.params;
    const resolved_by = req.user.id;

    await pool.query(
      `UPDATE alerts 
       SET is_resolved = TRUE, resolved_by = $1, resolved_at = CURRENT_TIMESTAMP
       WHERE branch_id = $2 AND is_resolved = FALSE`,
      [resolved_by, branchId]
    );

    res.json({ message: 'All alerts resolved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const { branchId } = req.params;
    const result = await pool.query(
      `SELECT COUNT(*) FROM alerts WHERE branch_id = $1 AND is_resolved = FALSE`,
      [branchId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
