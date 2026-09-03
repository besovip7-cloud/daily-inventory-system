const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { auth, adminOnly } = require('../middleware/auth');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

router.post('/login',
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidation,
  authController.login
);

router.get('/me', auth, authController.me);

router.get('/users', auth, adminOnly, authController.listUsers);

router.post('/users',
  auth,
  adminOnly,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'manager', 'staff']).withMessage('Invalid role'),
  handleValidation,
  authController.createUser
);

router.put('/users/:id/active',
  auth,
  adminOnly,
  authController.setUserActive
);

module.exports = router;
