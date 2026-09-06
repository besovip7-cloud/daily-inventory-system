const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { auth, branchAccess, blockAccountant } = require('../middleware/auth');

router.use(auth, blockAccountant);

router.get('/', purchaseController.getRequests);
router.post('/', branchAccess, purchaseController.createRequest);
router.put('/:id/confirm', purchaseController.confirmRequest);
router.put('/:id/cancel', purchaseController.cancelRequest);

module.exports = router;
