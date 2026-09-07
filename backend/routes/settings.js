const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { requirePerm } = require('../utils/permissions');

// عام — صفحة الدخول تحتاج الاسم واللوكو بدون توكن
router.get('/', getSettings);

// تعديل — صلاحية إدارة الإعدادات (الأدمن افتراضياً)
router.put('/', auth, requirePerm('settings.manage'), updateSettings);

module.exports = router;
