const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { auth, branchAccess, blockAccountant, adminOnly } = require('../middleware/auth');

router.use(auth, blockAccountant);

router.get('/items/:branchId', auth, branchAccess, inventoryController.getItems);
router.post('/items', auth, branchAccess, inventoryController.createItem);
router.put('/items/:id', auth, inventoryController.updateItem);
router.delete('/items/:id', auth, inventoryController.deleteItem);

router.get('/daily/:branchId', auth, branchAccess, inventoryController.getDailyInventory);
router.post('/daily', auth, branchAccess, inventoryController.saveDailyInventory);
router.put('/daily/:id', auth, adminOnly, inventoryController.updateDailyInventory);
router.delete('/daily/:id', auth, adminOnly, inventoryController.deleteDailyInventory);
router.get('/history/:branchId/:itemId', auth, branchAccess, inventoryController.getInventoryHistory);

module.exports = router;
