const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');
const { auth, branchAccess, blockAccountant } = require('../middleware/auth');

router.use(auth, blockAccountant);

router.get('/my-count', auth, alertsController.getMyUnreadCount);
router.get('/my', auth, alertsController.getMyAlerts);
router.put('/resolve-mine', auth, alertsController.resolveMine);
router.get('/:branchId', auth, branchAccess, alertsController.getAlerts);
router.get('/:branchId/count', auth, branchAccess, alertsController.getUnreadCount);
router.put('/:id/resolve', auth, alertsController.resolveAlert);
router.put('/:branchId/resolve-all', auth, branchAccess, alertsController.resolveAll);

module.exports = router;
