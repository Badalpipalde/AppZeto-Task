const AuditLog = require('../models/AuditLog');

/**
 * GET /api/audit-logs
 * Get audit logs with filtering and pagination
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    const {
      organization,
      action,
      entity,
      user: userId,
      entityId,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 30,
    } = req.query;

    const filter = {};

    if (organization) filter.organization = organization;
    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (userId) filter.user = userId;
    if (entityId) filter.entityId = entityId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('user', 'name email avatar')
        .populate('organization', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};
