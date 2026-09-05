const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!result.rows[0].is_active) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const branchAccess = (req, res, next) => {
  // مدير الفرع والموظف يقدرون يشوفون فرعهم فقط
  if (['manager', 'staff'].includes(req.user.role) && req.user.branch_id) {
    const requestedBranch = req.params.branchId || req.body.branch_id || req.query.branch_id;
    if (requestedBranch && parseInt(requestedBranch) !== req.user.branch_id) {
      return res.status(403).json({ message: 'Access denied for this branch' });
    }
  }
  next();
};

const blockAccountant = (req, res, next) => {
  if (req.user.role === 'accountant') {
    return res.status(403).json({ message: 'Accountants can only access reports' });
  }
  next();
};

module.exports = { auth, adminOnly, branchAccess, blockAccountant };
