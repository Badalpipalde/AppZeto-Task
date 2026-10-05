const Task = require('../models/Task');
const Project = require('../models/Project');
const createAuditLog = require('../utils/auditLogger');
const createNotification = require('../utils/notifier');
const { ROLE_HIERARCHY } = require('../middleware/permissions');

/**
 * POST /api/tasks
 * Create a new task
 */
exports.createTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      project: projectId,
      assignee,
      dueDate,
      labels,
    } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
      });
    }

    // Get the max position for the status column
    const lastTask = await Task.findOne({
      project: projectId,
      status: status || 'TODO',
    }).sort({ position: -1 });

    const position = lastTask ? lastTask.position + 1 : 0;

    const task = await Task.create({
      title,
      description,
      status: status || 'TODO',
      priority: priority || 'MEDIUM',
      project: projectId,
      organization: project.organization,
      assignee: assignee || null,
      createdBy: req.user._id,
      dueDate: dueDate || null,
      labels: labels || [],
      position,
      activity: [
        {
          user: req.user._id,
          action: 'created',
          newValue: title,
        },
      ],
    });

    await createAuditLog({
      userId: req.user._id,
      organizationId: project.organization,
      action: 'TASK_CREATED',
      entity: 'Task',
      entityId: task._id,
      newValue: { title, status: task.status, priority: task.priority },
    });

    // Notify assignee if assigned
    const io = req.app.get('io');
    if (assignee && assignee.toString() !== req.user._id.toString()) {
      await createNotification(io, {
        recipient: assignee,
        sender: req.user._id,
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned',
        message: `You have been assigned to "${title}".`,
        organization: project.organization,
        entityType: 'Task',
        entityId: task._id,
      });
    }

    const populated = await Task.findById(task._id)
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    // Real-time broadcast
    if (io) {
      io.to(`project:${projectId}`).emit('task:created', populated);
    }

    res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tasks
 * Get tasks with advanced filtering, search, and pagination
 */
exports.getTasks = async (req, res, next) => {
  try {
    const {
      project,
      organization,
      status,
      priority,
      assignee,
      labels,
      dueDate,
      dueDateBefore,
      dueDateAfter,
      createdAfter,
      createdBefore,
      search,
      page = 1,
      limit = 50,
      sort = '-createdAt',
    } = req.query;

    const filter = {};

    if (project) filter.project = project;
    if (organization) filter.organization = organization;
    if (status) {
      filter.status = Array.isArray(status)
        ? { $in: status }
        : { $in: status.split(',') };
    }
    if (priority) {
      filter.priority = Array.isArray(priority)
        ? { $in: priority }
        : { $in: priority.split(',') };
    }
    if (assignee) filter.assignee = assignee;
    if (labels) {
      const labelArr = Array.isArray(labels) ? labels : labels.split(',');
      filter.labels = { $in: labelArr };
    }
    if (dueDate) filter.dueDate = new Date(dueDate);
    if (dueDateBefore) filter.dueDate = { ...filter.dueDate, $lt: new Date(dueDateBefore) };
    if (dueDateAfter) filter.dueDate = { ...filter.dueDate, $gt: new Date(dueDateAfter) };
    if (createdAfter) filter.createdAt = { $gte: new Date(createdAfter) };
    if (createdBefore) {
      filter.createdAt = { ...filter.createdAt, $lte: new Date(createdBefore) };
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate('assignee', 'name email avatar')
        .populate('createdBy', 'name email avatar')
        .sort(sort === 'position' ? { status: 1, position: 1 } : sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Task.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: tasks,
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

/**
 * GET /api/tasks/:id
 * Get a single task with all details
 */
exports.getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .populate('comments.user', 'name email avatar')
      .populate('activity.user', 'name email avatar');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tasks/:id
 * Update a task
 */
exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    // Members can only edit their assigned tasks
    if (
      req.userRole === 'MEMBER' &&
      task.assignee?.toString() !== req.user._id.toString() &&
      task.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Members can only edit their own assigned tasks.',
      });
    }

    const io = req.app.get('io');
    const updates = req.body;
    const activityEntries = [];

    // Track changes for audit log and activity
    if (updates.status && updates.status !== task.status) {
      activityEntries.push({
        user: req.user._id,
        action: 'status_changed',
        field: 'status',
        oldValue: task.status,
        newValue: updates.status,
      });

      await createAuditLog({
        userId: req.user._id,
        organizationId: task.organization,
        action: 'TASK_STATUS_CHANGED',
        entity: 'Task',
        entityId: task._id,
        oldValue: { status: task.status },
        newValue: { status: updates.status },
      });

      // Notify assignee of status change
      if (
        task.assignee &&
        task.assignee.toString() !== req.user._id.toString()
      ) {
        await createNotification(io, {
          recipient: task.assignee,
          sender: req.user._id,
          type: 'TASK_STATUS_CHANGED',
          title: 'Task Status Changed',
          message: `"${task.title}" moved from ${task.status} to ${updates.status}.`,
          organization: task.organization,
          entityType: 'Task',
          entityId: task._id,
        });
      }
    }

    if (updates.assignee && updates.assignee !== task.assignee?.toString()) {
      activityEntries.push({
        user: req.user._id,
        action: 'assignee_changed',
        field: 'assignee',
        oldValue: task.assignee,
        newValue: updates.assignee,
      });

      await createAuditLog({
        userId: req.user._id,
        organizationId: task.organization,
        action: 'TASK_ASSIGNED',
        entity: 'Task',
        entityId: task._id,
        oldValue: { assignee: task.assignee },
        newValue: { assignee: updates.assignee },
      });

      // Notify new assignee
      if (updates.assignee !== req.user._id.toString()) {
        await createNotification(io, {
          recipient: updates.assignee,
          sender: req.user._id,
          type: 'TASK_ASSIGNED',
          title: 'Task Assigned',
          message: `You have been assigned to "${task.title}".`,
          organization: task.organization,
          entityType: 'Task',
          entityId: task._id,
        });
      }
    }

    if (updates.priority && updates.priority !== task.priority) {
      activityEntries.push({
        user: req.user._id,
        action: 'priority_changed',
        field: 'priority',
        oldValue: task.priority,
        newValue: updates.priority,
      });

      await createAuditLog({
        userId: req.user._id,
        organizationId: task.organization,
        action: 'TASK_PRIORITY_CHANGED',
        entity: 'Task',
        entityId: task._id,
        oldValue: { priority: task.priority },
        newValue: { priority: updates.priority },
      });
    }

    if (updates.title && updates.title !== task.title) {
      activityEntries.push({
        user: req.user._id,
        action: 'title_changed',
        field: 'title',
        oldValue: task.title,
        newValue: updates.title,
      });
    }

    // Apply updates
    const allowedFields = [
      'title',
      'description',
      'status',
      'priority',
      'assignee',
      'dueDate',
      'labels',
      'position',
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        task[field] = updates[field];
      }
    });

    // Push activity entries
    if (activityEntries.length > 0) {
      task.activity.push(...activityEntries);
    }

    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    // Real-time broadcast
    if (io) {
      io.to(`project:${task.project}`).emit('task:updated', populated);
    }

    res.json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    await createAuditLog({
      userId: req.user._id,
      organizationId: task.organization,
      action: 'TASK_DELETED',
      entity: 'Task',
      entityId: task._id,
      oldValue: { title: task.title, status: task.status },
    });

    await Task.findByIdAndDelete(task._id);

    // Real-time broadcast
    const io = req.app.get('io');
    if (io) {
      io.to(`project:${task.project}`).emit('task:deleted', {
        taskId: task._id,
        project: task.project,
      });
    }

    res.json({
      success: true,
      message: 'Task deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tasks/:id/comments
 * Add a comment to a task
 */
exports.addComment = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    const { content, mentions = [] } = req.body;

    task.comments.push({
      user: req.user._id,
      content,
      mentions,
    });

    task.activity.push({
      user: req.user._id,
      action: 'comment_added',
      newValue: content.substring(0, 100),
    });

    await task.save();

    await createAuditLog({
      userId: req.user._id,
      organizationId: task.organization,
      action: 'TASK_COMMENT_ADDED',
      entity: 'Task',
      entityId: task._id,
      newValue: { comment: content.substring(0, 200) },
    });

    // Notify mentioned users
    const io = req.app.get('io');
    for (const mentionedUserId of mentions) {
      if (mentionedUserId.toString() !== req.user._id.toString()) {
        await createNotification(io, {
          recipient: mentionedUserId,
          sender: req.user._id,
          type: 'TASK_MENTION',
          title: 'Mentioned in Comment',
          message: `You were mentioned in a comment on "${task.title}".`,
          organization: task.organization,
          entityType: 'Task',
          entityId: task._id,
        });
      }
    }

    // Notify task assignee about the comment
    if (
      task.assignee &&
      task.assignee.toString() !== req.user._id.toString() &&
      !mentions.includes(task.assignee.toString())
    ) {
      await createNotification(io, {
        recipient: task.assignee,
        sender: req.user._id,
        type: 'TASK_COMMENT',
        title: 'New Comment',
        message: `New comment on "${task.title}": "${content.substring(0, 100)}".`,
        organization: task.organization,
        entityType: 'Task',
        entityId: task._id,
      });
    }

    const populated = await Task.findById(task._id)
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .populate('comments.user', 'name email avatar');

    // Real-time broadcast
    if (io) {
      io.to(`project:${task.project}`).emit('task:updated', populated);
    }

    res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tasks/:id/move
 * Move a task between columns (Kanban drag-and-drop)
 */
exports.moveTask = async (req, res, next) => {
  try {
    const { status, position } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
      });
    }

    const oldStatus = task.status;
    const oldPosition = task.position;

    task.status = status;
    task.position = position;

    task.activity.push({
      user: req.user._id,
      action: 'moved',
      field: 'status',
      oldValue: oldStatus,
      newValue: status,
    });

    await task.save();

    if (oldStatus !== status) {
      await createAuditLog({
        userId: req.user._id,
        organizationId: task.organization,
        action: 'TASK_STATUS_CHANGED',
        entity: 'Task',
        entityId: task._id,
        oldValue: { status: oldStatus, position: oldPosition },
        newValue: { status, position },
      });

      // Notify assignee of status change
      const io = req.app.get('io');
      if (
        task.assignee &&
        task.assignee.toString() !== req.user._id.toString()
      ) {
        await createNotification(io, {
          recipient: task.assignee,
          sender: req.user._id,
          type: 'TASK_STATUS_CHANGED',
          title: 'Task Moved',
          message: `"${task.title}" moved from ${oldStatus} to ${status}.`,
          organization: task.organization,
          entityType: 'Task',
          entityId: task._id,
        });
      }
    }

    const populated = await Task.findById(task._id)
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    // Real-time broadcast
    const io = req.app.get('io');
    if (io) {
      io.to(`project:${task.project}`).emit('task:moved', {
        task: populated,
        oldStatus,
        newStatus: status,
        position,
      });
    }

    res.json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};
