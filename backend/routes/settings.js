const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');

// عام — صفحة الدخول تحتاج الاسم واللوكو بدون توكن
router.get('/', getSettings);

// تعديل — مدير النظام فقط
router.put('/', auth, adminOnly, updateSettings);

module.exports = router;
