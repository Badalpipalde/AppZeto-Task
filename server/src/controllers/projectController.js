const Project = require('../models/Project');
const Task = require('../models/Task');
const createAuditLog = require('../utils/auditLogger');

/**
 * POST /api/projects
 * Create a new project
 */
exports.createProject = async (req, res, next) => {
  try {
    const { name, description, organization, color } = req.body;

    const project = await Project.create({
      name,
      description,
      organization,
      color,
      createdBy: req.user._id,
    });

    await createAuditLog({
      userId: req.user._id,
      organizationId: organization,
      action: 'PROJECT_CREATED',
      entity: 'Project',
      entityId: project._id,
      newValue: { name, description },
    });

    const populated = await Project.findById(project._id)
      .populate('createdBy', 'name email avatar');

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`org:${organization}`).emit('project:created', populated);
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
 * GET /api/projects?organization=xxx
 * Get all projects for an organization
 */
exports.getProjects = async (req, res, next) => {
  try {
    const { organization } = req.query;

    const projects = await Project.find({ organization })
      .populate('createdBy', 'name email avatar')
      .sort({ createdAt: -1 });

    // Get task counts per project efficiently (avoid N+1)
    const projectIds = projects.map((p) => p._id);
    const taskCounts = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: '$project', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    taskCounts.forEach((tc) => {
      countMap[tc._id.toString()] = tc.count;
    });

    const projectsWithCounts = projects.map((p) => ({
      ...p.toObject(),
      taskCount: countMap[p._id.toString()] || 0,
    }));

    res.json({
      success: true,
      data: projectsWithCounts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/projects/:id
 * Get a single project with its tasks
 */
exports.getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name email avatar');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
      });
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/projects/:id
 * Update a project
 */
exports.updateProject = async (req, res, next) => {
  try {
    const { name, description, color, columns } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
      });
    }

    const oldValues = { name: project.name, description: project.description };

    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (color) project.color = color;
    if (columns) project.columns = columns;

    await project.save();

    await createAuditLog({
      userId: req.user._id,
      organizationId: project.organization,
      action: 'PROJECT_UPDATED',
      entity: 'Project',
      entityId: project._id,
      oldValue: oldValues,
      newValue: { name: project.name, description: project.description },
    });

    const populated = await Project.findById(project._id)
      .populate('createdBy', 'name email avatar');

    res.json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/projects/:id
 * Delete a project and all its tasks
 */
exports.deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
      });
    }

    // Delete all tasks in the project
    await Task.deleteMany({ project: project._id });

    await createAuditLog({
      userId: req.user._id,
      organizationId: project.organization,
      action: 'PROJECT_DELETED',
      entity: 'Project',
      entityId: project._id,
      oldValue: { name: project.name },
    });

    await Project.findByIdAndDelete(project._id);

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`org:${project.organization}`).emit('project:deleted', {
        projectId: project._id,
      });
    }

    res.json({
      success: true,
      message: 'Project deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
