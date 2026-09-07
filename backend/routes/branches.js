const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { auth, branchAccess } = require('../middleware/auth');
const { requirePerm } = require('../utils/permissions');

// قائمة الفروع تبقى متاحة للجميع (لازمة لكل الصفحات)
router.get('/', auth, branchController.getAll);

router.use(auth);

router.get('/:id', requirePerm('branches.view'), branchController.getById);
router.get('/:id/dashboard', requirePerm('dashboard.view'), branchAccess, branchController.getDashboard);
router.post('/', requirePerm('catalog.manage'), branchController.createBranch);
router.put('/:id', requirePerm('catalog.manage'), branchController.updateBranch);
router.delete('/:id', requirePerm('catalog.manage'), branchController.deleteBranch);

module.exports = router;
