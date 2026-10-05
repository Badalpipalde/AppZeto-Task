const mongoose = require('mongoose');

const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'MEMBER',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    logo: {
      type: String,
      default: '',
    },
    members: [memberSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
organizationSchema.index({ slug: 1 });
organizationSchema.index({ 'members.user': 1 });
organizationSchema.index({ createdBy: 1 });
organizationSchema.index({ name: 'text', description: 'text' });

// Generate slug before saving
organizationSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + Date.now().toString(36);
  }
  next();
});

// Helper method to get member role
organizationSchema.methods.getMemberRole = function (userId) {
  const member = this.members.find(
    (m) => (m.user._id || m.user).toString() === userId.toString()
  );
  return member ? member.role : null;
};

// Helper to check if user is a member
organizationSchema.methods.isMember = function (userId) {
  return this.members.some(
    (m) => (m.user._id || m.user).toString() === userId.toString()
  );
};

module.exports = mongoose.model('Organization', organizationSchema);
module.exports.ROLES = ROLES;
