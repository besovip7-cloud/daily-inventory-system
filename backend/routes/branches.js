const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { auth, adminOnly, branchAccess, blockAccountant } = require('../middleware/auth');

// Branch list stays readable for all roles (needed by reports)
router.get('/', auth, branchController.getAll);

router.use(auth, blockAccountant);

router.get('/:id', auth, branchController.getById);
router.get('/:id/dashboard', auth, branchAccess, branchController.getDashboard);
router.post('/', auth, adminOnly, branchController.createBranch);
router.put('/:id', auth, adminOnly, branchController.updateBranch);
router.delete('/:id', auth, adminOnly, branchController.deleteBranch);

module.exports = router;