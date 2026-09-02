const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { auth, branchAccess } = require('../middleware/auth');

router.get('/inventory/:branchId', auth, branchAccess, reportsController.getInventoryReport);
router.get('/sales/:branchId', auth, branchAccess, reportsController.getSalesReport);
router.get('/comparison', auth, reportsController.getComparisonReport);
router.get('/low-stock/:branchId', auth, branchAccess, reportsController.getLowStockReport);

module.exports = router;
