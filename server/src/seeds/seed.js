require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Project = require('../models/Project');
const Task = require('../models/Task');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/appzeto_pm';

const seedData = async () => {
  try {
    console.log('Connecting to database...', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data (optional, but good for a fresh start)
    console.log('Clearing old data...');
    await Promise.all([
      User.deleteMany({}),
      Organization.deleteMany({}),
      Project.deleteMany({}),
      Task.deleteMany({}),
      AuditLog.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    // Create Users
    console.log('Creating users...');
    const users = await User.create([
      { name: 'Admin User', email: 'admin@appzeto.com', password: 'password123' },
      { name: 'Jane Doe', email: 'jane@appzeto.com', password: 'password123' },
      { name: 'John Smith', email: 'john@appzeto.com', password: 'password123' },
    ]);

    const admin = users[0];
    const jane = users[1];
    const john = users[2];

    // Create Organization
    console.log('Creating organization...');
    const org = await Organization.create({
      name: 'Appzeto Engineering',
      description: 'Main engineering workspace for Appzeto products',
      createdBy: admin._id,
      members: [
        { user: admin._id, role: 'OWNER' },
        { user: jane._id, role: 'ADMIN' },
        { user: john._id, role: 'MEMBER' },
      ],
    });

    // Create Projects
    console.log('Creating projects...');
    const projects = await Project.create([
      {
        name: 'Alpha Project - MVP',
        description: 'Building the first minimum viable product for testing.',
        organization: org._id,
        createdBy: admin._id,
        color: '#6366f1', // primary
      },
      {
        name: 'Website Redesign',
        description: 'Updating the marketing website.',
        organization: org._id,
        createdBy: jane._id,
        color: '#ec4899', // pink
      },
    ]);

    const proj1 = projects[0];

    // Create Tasks
    console.log('Creating tasks...');
    
    // Some dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await Task.create([
      {
        title: 'Design database schema',
        description: 'Create ERD and schema models for the new feature.',
        status: 'DONE',
        priority: 'HIGH',
        project: proj1._id,
        organization: org._id,
        assignee: admin._id,
        createdBy: admin._id,
        labels: ['Backend', 'Design'],
        position: 0,
      },
      {
        title: 'Implement authentication API',
        description: 'Set up JWT login and registration routes.',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        project: proj1._id,
        organization: org._id,
        assignee: jane._id,
        createdBy: admin._id,
        labels: ['Backend', 'Security'],
        position: 0,
        dueDate: tomorrow,
      },
      {
        title: 'Create Dashboard UI',
        description: 'Build the React components for the main dashboard.',
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        project: proj1._id,
        organization: org._id,
        assignee: john._id,
        createdBy: jane._id,
        labels: ['Frontend', 'React'],
        position: 1,
      },
      {
        title: 'Write unit tests for Task logic',
        description: 'Ensure Kanban logic is fully tested.',
        status: 'TODO',
        priority: 'LOW',
        project: proj1._id,
        organization: org._id,
        assignee: null,
        createdBy: john._id,
        labels: ['QA', 'Testing'],
        position: 0,
      },
      {
        title: 'Setup Socket.IO Server',
        description: 'Configure real-time sync for the Kanban board.',
        status: 'REVIEW',
        priority: 'HIGH',
        project: proj1._id,
        organization: org._id,
        assignee: jane._id,
        createdBy: admin._id,
        labels: ['Backend', 'Real-time'],
        position: 0,
        dueDate: yesterday, // Overdue example
      }
    ]);

    console.log('✅ Seed data inserted successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
