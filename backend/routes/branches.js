const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { auth, adminOnly, branchAccess } = require('../middleware/auth');

router.get('/', auth, branchController.getAll);
router.get('/:id', auth, branchController.getById);
router.get('/:id/dashboard', auth, branchAccess, branchController.getDashboard);

module.exports = router;
