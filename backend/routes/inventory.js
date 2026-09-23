const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
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

router.get('/items/:branchId', requirePerm('inventory.view'), branchAccess, inventoryController.getItems);
router.post('/items', requirePerm('catalog.manage'), inventoryController.createItem);
router.put('/items/:id', requireAnyPerm('catalog.manage', 'items.edit'), inventoryController.updateItem);
router.delete('/items', adminOnly, inventoryController.deleteItems);
router.delete('/items/:id', requirePerm('catalog.manage'), inventoryController.deleteItem);

router.get('/daily/:branchId', requirePerm('inventory.view'), branchAccess, inventoryController.getDailyInventory);
router.post('/daily', requirePerm('inventory.edit'), branchAccess, inventoryController.saveDailyInventory);
router.put('/daily/:id', adminOnly, inventoryController.updateDailyInventory);
router.delete('/daily/:id', adminOnly, inventoryController.deleteDailyInventory);
router.get('/history/:branchId/:itemId', requirePerm('inventory.view'), branchAccess, inventoryController.getInventoryHistory);

module.exports = router;
