const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { auth, branchAccess, adminOnly } = require('../middleware/auth');
const { requirePerm } = require('../utils/permissions');

router.use(auth);

router.get('/items/:branchId', requirePerm('inventory.view'), branchAccess, inventoryController.getItems);
router.post('/items', requirePerm('catalog.manage'), inventoryController.createItem);
router.put('/items/:id', requirePerm('catalog.manage'), inventoryController.updateItem);
router.delete('/items/:id', requirePerm('catalog.manage'), inventoryController.deleteItem);

router.get('/daily/:branchId', requirePerm('inventory.view'), branchAccess, inventoryController.getDailyInventory);
router.post('/daily', requirePerm('inventory.edit'), branchAccess, inventoryController.saveDailyInventory);
router.put('/daily/:id', adminOnly, inventoryController.updateDailyInventory);
router.delete('/daily/:id', adminOnly, inventoryController.deleteDailyInventory);
router.get('/history/:branchId/:itemId', requirePerm('inventory.view'), branchAccess, inventoryController.getInventoryHistory);

module.exports = router;
