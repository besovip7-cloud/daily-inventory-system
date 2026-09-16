const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { auth, adminOnly } = require('../middleware/auth');

// مقيّد يطبق على تسجيل الدخول فقط — مو على كل مسارات auth
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'محاولات دخول كثيرة — انتظر 15 دقيقة وحاول مرة أخرى' }
});

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  next();
};

router.post('/login',
  loginLimiter,
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
  handleValidation,
  authController.login
);

// الدخول السريع برقم PIN
router.post('/quick-login',
  loginLimiter,
  body('identifier').notEmpty().withMessage('أدخل الإيميل أو رقم الواتساب'),
  body('pin').notEmpty().withMessage('الرقم السري مطلوب'),
  handleValidation,
  authController.quickLogin
);

router.post('/quick-pin',
  auth,
  body('pin').matches(/^\d{4,6}$/).withMessage('الرقم السري 4 إلى 6 أرقام'),
  handleValidation,
  authController.setQuickPin
);

router.delete('/quick-pin', auth, authController.removeQuickPin);

router.get('/me', auth, authController.me);

// البروفايل الشخصي — أي مستخدم مسجل
router.put('/profile',
  auth,
  authController.updateProfile
);

router.put('/change-password',
  auth,
  body('current_password').notEmpty().withMessage('كلمة المرور الحالية مطلوبة'),
  body('new_password').isLength({ min: 6 }).withMessage('كلمة المرور الجديدة 6 أحرف على الأقل'),
  handleValidation,
  authController.changePassword
);

router.get('/users', auth, adminOnly, authController.listUsers);

router.post('/users',
  auth,
  adminOnly,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['admin', 'manager', 'staff', 'accountant']).withMessage('Invalid role'),
  handleValidation,
  authController.createUser
);

router.put('/users/:id',
  auth,
  adminOnly,
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').isIn(['admin', 'manager', 'staff', 'accountant']).withMessage('Invalid role'),
  handleValidation,
  authController.updateUser
);

router.put('/users/:id/active',
  auth,
  adminOnly,
  authController.setUserActive
);

router.put('/users/:id/password',
  auth,
  adminOnly,
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidation,
  authController.resetPassword
);

router.delete('/users/:id',
  auth,
  adminOnly,
  authController.deleteUser
);

module.exports = router;
