const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');
const { auth, branchAccess } = require('../middleware/auth');
const { requirePerm } = require('../utils/permissions');

router.use(auth, requirePerm('alerts.view'));

router.get('/my-count', alertsController.getMyUnreadCount);
router.get('/my', alertsController.getMyAlerts);
router.put('/resolve-mine', alertsController.resolveMine);
router.get('/:branchId', branchAccess, alertsController.getAlerts);
router.get('/:branchId/count', branchAccess, alertsController.getUnreadCount);
router.put('/:id/resolve', alertsController.resolveAlert);
router.put('/:branchId/resolve-all', branchAccess, alertsController.resolveAll);

module.exports = router;
