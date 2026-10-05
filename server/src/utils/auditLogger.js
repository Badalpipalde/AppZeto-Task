const AuditLog = require('../models/AuditLog');

/**
 * Create an audit log entry
 *
 * @param {Object} params
 * @param {string} params.userId - The user performing the action
 * @param {string} params.organizationId - The organization context
 * @param {string} params.action - The action performed
 * @param {string} params.entity - The entity type (Task, Project, etc.)
 * @param {string} params.entityId - The entity ID
 * @param {*} params.oldValue - Previous value
 * @param {*} params.newValue - New value
 * @param {Object} params.metadata - Additional metadata
 */
const createAuditLog = async ({
  userId,
  organizationId,
  action,
  entity,
  entityId,
  oldValue = null,
  newValue = null,
  metadata = {},
}) => {
  try {
    await AuditLog.create({
      user: userId,
      organization: organizationId,
      action,
      entity,
      entityId,
      oldValue,
      newValue,
      metadata,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

module.exports = createAuditLog;
