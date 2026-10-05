const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireOrgRole } = require('../middleware/permissions');
const { getAuditLogs } = require('../controllers/auditLogController');

router.use(auth);

// Get audit logs — requires ADMIN role
router.get(
  '/',
  (req, res, next) => {
    req.params.id = req.query.organization;
    next();
  },
  requireOrgRole('ADMIN'),
  getAuditLogs
);

module.exports = router;
