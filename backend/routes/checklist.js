const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');
const { auth } = require('../middleware/auth');
const { requirePerm } = require('../utils/permissions');

router.use(auth);

router.get('/items', requirePerm('checklist.view'), checklistController.getItems);
router.post('/items', requirePerm('checklist.view'), checklistController.createItem);
router.put('/items/:id', requirePerm('checklist.view'), checklistController.updateItem);
router.delete('/items/:id', requirePerm('checklist.view'), checklistController.deleteItem);
router.post('/items/reorder', requirePerm('checklist.view'), checklistController.reorderItems);

router.get('/checks', requirePerm('checklist.view'), checklistController.getChecks);
router.post('/checks', requirePerm('checklist.view'), checklistController.saveCheck);

router.get('/overview', requirePerm('checklist.view'), checklistController.getOverview);

module.exports = router;
