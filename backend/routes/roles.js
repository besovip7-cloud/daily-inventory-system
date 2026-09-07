const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/rolesController');
const { auth, adminOnly } = require('../middleware/auth');

router.use(auth, adminOnly);

router.get('/', rolesController.listRoles);
router.get('/permissions', rolesController.getPermissionsCatalog);
router.post('/', rolesController.createRole);
router.put('/:id', rolesController.updateRole);
router.delete('/:id', rolesController.deleteRole);

module.exports = router;
