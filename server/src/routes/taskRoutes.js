const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireOrgRole, requireTaskPermission } = require('../middleware/permissions');
const {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  addComment,
  moveTask,
} = require('../controllers/taskController');

router.use(auth);

// Create task — body must include project, we resolve org from project in middleware
router.post(
  '/',
  async (req, res, next) => {
    // Resolve organization from project
    const Project = require('../models/Project');
    const project = await Project.findById(req.body.project);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }
    req.params.id = project.organization.toString();
    req.body.organization = project.organization.toString();
    next();
  },
  requireOrgRole('MEMBER'),
  requireTaskPermission('create'),
  createTask
);

// Get tasks with filters
router.get(
  '/',
  async (req, res, next) => {
    // Resolve org from project or use query param
    if (req.query.project) {
      const Project = require('../models/Project');
      const project = await Project.findById(req.query.project);
      if (project) {
        req.params.id = project.organization.toString();
        req.query.organization = project.organization.toString();
      }
    }
    if (req.query.organization) {
      req.params.id = req.query.organization;
    }
    next();
  },
  requireOrgRole('VIEWER'),
  getTasks
);

// Get single task
router.get(
  '/:id',
  async (req, res, next) => {
    const Task = require('../models/Task');
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    req.taskOrg = task.organization.toString();
    req.params.orgId = task.organization.toString();
    next();
  },
  (req, res, next) => {
    req.params.id = req.params.orgId || req.taskOrg;
    next();
  },
  requireOrgRole('VIEWER'),
  (req, res, next) => {
    // Restore task id
    req.params.id = req.params.id; // Keep the original
    next();
  },
  getTask
);

// Update task
router.put(
  '/:id',
  async (req, res, next) => {
    const Task = require('../models/Task');
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    req.taskId = req.params.id;
    req.params.id = task.organization.toString();
    next();
  },
  requireOrgRole('MEMBER'),
  requireTaskPermission('edit'),
  (req, res, next) => {
    req.params.id = req.taskId;
    next();
  },
  updateTask
);

// Delete task
router.delete(
  '/:id',
  async (req, res, next) => {
    const Task = require('../models/Task');
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    req.taskId = req.params.id;
    req.params.id = task.organization.toString();
    next();
  },
  requireOrgRole('ADMIN'),
  requireTaskPermission('delete'),
  (req, res, next) => {
    req.params.id = req.taskId;
    next();
  },
  deleteTask
);

// Add comment
router.post(
  '/:id/comments',
  async (req, res, next) => {
    const Task = require('../models/Task');
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    req.taskId = req.params.id;
    req.params.id = task.organization.toString();
    next();
  },
  requireOrgRole('MEMBER'),
  requireTaskPermission('comment'),
  (req, res, next) => {
    req.params.id = req.taskId;
    next();
  },
  addComment
);

// Move task (Kanban drag-drop)
router.put(
  '/:id/move',
  async (req, res, next) => {
    const Task = require('../models/Task');
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }
    req.taskId = req.params.id;
    req.params.id = task.organization.toString();
    next();
  },
  requireOrgRole('MEMBER'),
  (req, res, next) => {
    req.params.id = req.taskId;
    next();
  },
  moveTask
);

module.exports = router;
