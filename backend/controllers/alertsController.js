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

// Bell badge: admins see all branches, managers only their own
exports.getMyUnreadCount = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query(`SELECT COUNT(*) FROM alerts WHERE is_resolved = FALSE`);
    } else if (req.user.role === 'manager' && req.user.branch_id) {
      result = await pool.query(
        `SELECT COUNT(*) FROM alerts WHERE branch_id = $1 AND is_resolved = FALSE`,
        [req.user.branch_id]
      );
    } else {
      return res.json({ count: 0 });
    }
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Bell dropdown: latest unresolved alerts for the current user
exports.getMyAlerts = async (req, res) => {
  try {
    let query = `SELECT a.*, ii.name as item_name, ii.unit, b.name as branch_name
                 FROM alerts a
                 LEFT JOIN inventory_items ii ON a.item_id = ii.id
                 LEFT JOIN branches b ON a.branch_id = b.id
                 WHERE a.is_resolved = FALSE`;
    const params = [];
    if (req.user.role !== 'admin') {
      query += ` AND a.branch_id = $1`;
      params.push(req.user.branch_id || -1);
    }
    query += ` ORDER BY a.created_at DESC LIMIT 15`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mark all of the current user's alerts as read
exports.resolveMine = async (req, res) => {
  try {
    let query = `UPDATE alerts SET is_resolved = TRUE, resolved_by = $1, resolved_at = CURRENT_TIMESTAMP
                 WHERE is_resolved = FALSE`;
    const params = [req.user.id];
    if (req.user.role !== 'admin') {
      query += ` AND branch_id = $2`;
      params.push(req.user.branch_id || -1);
    }
    await pool.query(query, params);
    res.json({ message: 'All alerts resolved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
