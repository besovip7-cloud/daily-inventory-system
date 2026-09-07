const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { auth, branchAccess } = require('../middleware/auth');
const { requirePerm } = require('../utils/permissions');

router.use(auth, requirePerm('reports.view'));

router.get('/inventory/:branchId', branchAccess, reportsController.getInventoryReport);
router.get('/sales/:branchId', branchAccess, reportsController.getSalesReport);
router.get('/comparison', reportsController.getComparisonReport);
router.get('/low-stock/:branchId', branchAccess, reportsController.getLowStockReport);
router.get('/movements/:branchId', branchAccess, reportsController.getMovements);
router.get('/variance/:branchId', branchAccess, reportsController.getVariance);

module.exports = router;
