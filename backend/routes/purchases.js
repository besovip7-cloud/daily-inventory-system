const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { auth, branchAccess, adminOnly } = require('../middleware/auth');
const { requirePerm } = require('../utils/permissions');

router.use(auth);

router.get('/', requirePerm('purchases.view'), purchaseController.getRequests);
router.post('/', requirePerm('purchases.create'), branchAccess, purchaseController.createRequest);
router.put('/:id/confirm', requirePerm('purchases.confirm'), purchaseController.confirmRequest);
router.put('/:id/cancel', requirePerm('purchases.create'), purchaseController.cancelRequest);
router.delete('/:id', adminOnly, purchaseController.deleteRequest);

module.exports = router;
