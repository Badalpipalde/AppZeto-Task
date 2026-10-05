const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireOrgRole } = require('../middleware/permissions');
const {
  createOrganization,
  getOrganizations,
  getOrganization,
  addMember,
  removeMember,
  updateMemberRole,
} = require('../controllers/organizationController');

// All org routes require authentication
router.use(auth);

router.post('/', createOrganization);
router.get('/', getOrganizations);
router.get('/:id', getOrganization);

// Member management — requires ADMIN role
router.post('/:id/members', requireOrgRole('ADMIN'), addMember);
router.delete('/:id/members/:userId', requireOrgRole('ADMIN'), removeMember);
router.patch(
  '/:id/members/:userId/role',
  requireOrgRole('OWNER'),
  updateMemberRole
);

module.exports = router;
