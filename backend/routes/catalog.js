const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const { auth } = require('../middleware/auth');
const { requirePerm } = require('../utils/permissions');

router.use(auth);

// إدارة الكتالوج كله لحاملي catalog.manage فقط (الأدمن يتجاوز تلقائياً)
router.get('/groups', requirePerm('catalog.manage'), catalogController.getGroups);
router.post('/groups', requirePerm('catalog.manage'), catalogController.createGroup);
router.put('/groups/:id', requirePerm('catalog.manage'), catalogController.updateGroup);
router.delete('/groups/:id', requirePerm('catalog.manage'), catalogController.deleteGroup);

router.get('/departments', requirePerm('catalog.manage'), catalogController.getDepartments);
router.post('/departments', requirePerm('catalog.manage'), catalogController.createDepartment);
router.put('/departments/:id', requirePerm('catalog.manage'), catalogController.updateDepartment);
router.delete('/departments/:id', requirePerm('catalog.manage'), catalogController.deleteDepartment);

router.get('/units', requirePerm('catalog.manage'), catalogController.getUnits);
router.post('/units', requirePerm('catalog.manage'), catalogController.createUnit);
router.put('/units/:id', requirePerm('catalog.manage'), catalogController.updateUnit);
router.delete('/units/:id', requirePerm('catalog.manage'), catalogController.deleteUnit);

router.get('/suppliers', requirePerm('catalog.manage'), catalogController.getSuppliers);
router.post('/suppliers', requirePerm('catalog.manage'), catalogController.createSupplier);
router.put('/suppliers/:id', requirePerm('catalog.manage'), catalogController.updateSupplier);
router.delete('/suppliers/:id', requirePerm('catalog.manage'), catalogController.deleteSupplier);

router.get('/options', requirePerm('catalog.manage'), catalogController.getOptions);

module.exports = router;
