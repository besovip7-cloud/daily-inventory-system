const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { auth, branchAccess, adminOnly } = require('../middleware/auth');
const { requirePerm, getEffectivePermissions } = require('../utils/permissions');

// يسمح بأي صلاحية من القائمة (تعديل بيانات الأصناف إضافةً لإدارة الكتالوج)
const requireAnyPerm = (...perms) => async (req, res, next) => {
  try {
    if (req.user.role === 'admin') return next();
    const effective = await getEffectivePermissions(req.user);
    if (effective.includes('*') || perms.some(p => effective.includes(p))) return next();
    res.status(403).json({ message: 'ما عندك صلاحية لهذا الإجراء' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

router.use(auth);

router.get('/menu', requireAnyPerm('sales.view', 'catalog.manage'), salesController.getMenuItems);
router.post('/menu', requirePerm('catalog.manage'), salesController.createMenuItem);
router.put('/menu/:id', requireAnyPerm('catalog.manage', 'items.edit'), salesController.updateMenuItem);
router.delete('/menu', adminOnly, salesController.deleteMenuItems);
router.delete('/menu/:id', requirePerm('catalog.manage'), salesController.deleteMenuItem);

router.get('/recipes', requireAnyPerm('sales.view', 'catalog.manage'), salesController.getRecipes);
router.post('/recipes', requirePerm('catalog.manage'), salesController.saveRecipe);
router.delete('/recipes/:id', requirePerm('catalog.manage'), salesController.deleteRecipe);

router.get('/daily/:branchId', requirePerm('sales.view'), branchAccess, salesController.getDailySales);
router.post('/daily', requirePerm('sales.create'), branchAccess, salesController.saveDailySales);
router.put('/daily/:id', adminOnly, salesController.updateDailySale);
router.delete('/daily/:id', adminOnly, salesController.deleteDailySale);
router.delete('/daily', adminOnly, salesController.deleteDailySalesBulk);
router.get('/summary/:branchId', requirePerm('sales.view'), branchAccess, salesController.getSalesSummary);
router.get('/trend/:branchId', requirePerm('sales.view'), branchAccess, salesController.getSalesTrend);

module.exports = router;
