const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireOrgRole } = require('../middleware/permissions');
const {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');

router.use(auth);

// Create project — requires ADMIN role in the organization
router.post('/', (req, res, next) => {
  req.params.id = req.body.organization;
  next();
}, requireOrgRole('ADMIN'), createProject);

// Get projects for an organization
router.get('/', (req, res, next) => {
  req.params.id = req.query.organization;
  next();
}, requireOrgRole('VIEWER'), getProjects);

// Get single project
router.get('/:id', getProject);

// Update project
router.put('/:id', updateProject);

// Delete project
router.delete('/:id', deleteProject);

module.exports = router;
