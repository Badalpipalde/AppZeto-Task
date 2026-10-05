const Organization = require('../models/Organization');

/**
 * Role hierarchy for permission checks
 * Higher index = more permissions
 */
const ROLE_HIERARCHY = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

/**
 * Middleware to check organization membership and minimum role
 * Attaches org and member role to request
 *
 * @param {string} minRole - Minimum role required (VIEWER, MEMBER, ADMIN, OWNER)
 */
const requireOrgRole = (minRole = 'VIEWER') => {
  return async (req, res, next) => {
    try {
      const orgId =
        req.params.orgId ||
        req.params.id ||
        req.body.organization ||
        req.query.organization;

      if (!orgId) {
        return res.status(400).json({
          success: false,
          message: 'Organization ID is required.',
        });
      }

      const org = await Organization.findById(orgId);
      if (!org) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found.',
        });
      }

      const userRole = org.getMemberRole(req.user._id);
      if (!userRole) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this organization.',
        });
      }

      if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minRole]) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required role: ${minRole}, your role: ${userRole}.`,
        });
      }

      req.organization = org;
      req.userRole = userRole;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check task-level permissions
 * VIEWER: view only
 * MEMBER: create tasks, edit assigned tasks, comment
 * ADMIN: manage projects, members, delete tasks
 * OWNER: full access
 */
const requireTaskPermission = (action) => {
  return async (req, res, next) => {
    try {
      const userRole = req.userRole;

      switch (action) {
        case 'view':
          // All roles can view
          break;

        case 'create':
          if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY['MEMBER']) {
            return res.status(403).json({
              success: false,
              message: 'Viewers cannot create tasks.',
            });
          }
          break;

        case 'edit':
          if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY['MEMBER']) {
            return res.status(403).json({
              success: false,
              message: 'Viewers cannot edit tasks.',
            });
          }
          // Members can only edit their assigned tasks — checked in controller
          break;

        case 'delete':
          if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY['ADMIN']) {
            return res.status(403).json({
              success: false,
              message: 'Only admins and owners can delete tasks.',
            });
          }
          break;

        case 'comment':
          if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY['MEMBER']) {
            return res.status(403).json({
              success: false,
              message: 'Viewers cannot comment on tasks.',
            });
          }
          break;

        default:
          break;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { requireOrgRole, requireTaskPermission, ROLE_HIERARCHY };
