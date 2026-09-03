const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { auth, branchAccess, blockAccountant, adminOnly } = require('../middleware/auth');

router.use(auth, blockAccountant);

router.get('/menu', auth, salesController.getMenuItems);
router.post('/menu', auth, salesController.createMenuItem);

router.get('/daily/:branchId', auth, branchAccess, salesController.getDailySales);
router.post('/daily', auth, salesController.saveDailySales);
router.put('/daily/:id', auth, adminOnly, salesController.updateDailySale);
router.delete('/daily/:id', auth, adminOnly, salesController.deleteDailySale);
router.get('/summary/:branchId', auth, branchAccess, salesController.getSalesSummary);
router.get('/trend/:branchId', auth, branchAccess, salesController.getSalesTrend);

module.exports = router;
