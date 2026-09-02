const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');
const { auth, branchAccess } = require('../middleware/auth');

router.get('/:branchId', auth, branchAccess, alertsController.getAlerts);
router.get('/:branchId/count', auth, branchAccess, alertsController.getUnreadCount);
router.put('/:id/resolve', auth, alertsController.resolveAlert);
router.put('/:branchId/resolve-all', auth, branchAccess, alertsController.resolveAll);

module.exports = router;
