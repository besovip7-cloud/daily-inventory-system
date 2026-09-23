const express = require('express');
const router = express.Router();
const operationsController = require('../controllers/operationsController');
const { auth, branchAccess, adminOnly } = require('../middleware/auth');
const { requirePerm } = require('../utils/permissions');

router.use(auth);

router.get('/receiving', requirePerm('receiving.view'), operationsController.getReceiving);
router.post('/receiving', requirePerm('receiving.manage'), branchAccess, operationsController.createReceiving);
router.delete('/receiving/:id', adminOnly, operationsController.deleteReceiving);

router.get('/waste', requirePerm('waste.view'), operationsController.getWaste);
router.post('/waste', requirePerm('waste.manage'), branchAccess, operationsController.createWaste);
router.delete('/waste/:id', adminOnly, operationsController.deleteWaste);

module.exports = router;
