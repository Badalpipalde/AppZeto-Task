require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Organization = require('../models/Organization');

const MONGODB_URI = process.env.MONGODB_URI;

const createMembers = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the most recently created organization
    const org = await Organization.findOne().sort({ createdAt: -1 });

    if (!org) {
      console.log('No organization found. Please create an organization first from the UI.');
      process.exit(1);
    }

    console.log(`Found organization: ${org.name}`);
    console.log('Creating 20 new users...');

    const newUsers = [];
    for (let i = 1; i <= 20; i++) {
      newUsers.push({
        name: `Test Member ${i}`,
        email: `member${i}_${Date.now()}@example.com`,
        password: 'password123',
      });
    }

    const createdUsers = await User.insertMany(newUsers);
    console.log(`Successfully created 20 users in the database.`);

    console.log(`Adding them to the organization "${org.name}"...`);
    
    // Add them to the organization
    const memberObjects = createdUsers.map(u => ({
      user: u._id,
      role: ['VIEWER', 'MEMBER', 'MEMBER', 'ADMIN'][Math.floor(Math.random() * 4)] // Random roles
    }));

    org.members.push(...memberObjects);
    await org.save();

    console.log('✅ Successfully added 20 members to the organization!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating members:', error);
    process.exit(1);
  }
};

createMembers();
