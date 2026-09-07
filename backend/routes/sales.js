const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { auth, branchAccess, adminOnly } = require('../middleware/auth');
const { requirePerm } = require('../utils/permissions');

router.use(auth);

router.get('/menu', requirePerm('sales.view'), salesController.getMenuItems);
router.post('/menu', requirePerm('catalog.manage'), salesController.createMenuItem);
router.put('/menu/:id', requirePerm('catalog.manage'), salesController.updateMenuItem);
router.delete('/menu/:id', requirePerm('catalog.manage'), salesController.deleteMenuItem);

router.get('/recipes', requirePerm('sales.view'), salesController.getRecipes);
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
