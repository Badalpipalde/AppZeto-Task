const Organization = require('../models/Organization');
const User = require('../models/User');
const createAuditLog = require('../utils/auditLogger');
const createNotification = require('../utils/notifier');

/**
 * POST /api/organizations
 * Create a new organization
 */
exports.createOrganization = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const org = await Organization.create({
      name,
      description,
      createdBy: req.user._id,
      members: [{ user: req.user._id, role: 'OWNER' }],
    });

    await createAuditLog({
      userId: req.user._id,
      organizationId: org._id,
      action: 'ORGANIZATION_CREATED',
      entity: 'Organization',
      entityId: org._id,
      newValue: { name, description },
    });

    const populated = await Organization.findById(org._id)
      .populate('members.user', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/organizations
 * Get all organizations the user belongs to
 */
exports.getOrganizations = async (req, res, next) => {
  try {
    const orgs = await Organization.find({
      'members.user': req.user._id,
    })
      .populate('members.user', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: orgs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/organizations/:id
 * Get a single organization
 */
exports.getOrganization = async (req, res, next) => {
  try {
    const org = await Organization.findById(req.params.id)
      .populate('members.user', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.',
      });
    }

    if (!org.isMember(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this organization.',
      });
    }

    res.json({
      success: true,
      data: org,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/organizations/:id/members
 * Add a member to organization
 */
exports.addMember = async (req, res, next) => {
  try {
    const { email, role = 'MEMBER' } = req.body;
    const org = req.organization;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with that email.',
      });
    }

    if (org.isMember(user._id)) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member.',
      });
    }

    org.members.push({ user: user._id, role });
    await org.save();

    await createAuditLog({
      userId: req.user._id,
      organizationId: org._id,
      action: 'MEMBER_ADDED',
      entity: 'Member',
      entityId: user._id,
      newValue: { email: user.email, role },
    });

    // Notify the added user
    const io = req.app.get('io');
    await createNotification(io, {
      recipient: user._id,
      sender: req.user._id,
      type: 'ORGANIZATION_INVITE',
      title: 'Added to Organization',
      message: `You have been added to ${org.name} as ${role}.`,
      organization: org._id,
      entityType: 'Organization',
      entityId: org._id,
    });

    const populated = await Organization.findById(org._id)
      .populate('members.user', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/organizations/:id/members/:userId
 * Remove a member from organization
 */
exports.removeMember = async (req, res, next) => {
  try {
    const org = req.organization;
    const { userId } = req.params;

    // Cannot remove the owner
    const memberToRemove = org.members.find(
      (m) => m.user.toString() === userId
    );
    if (!memberToRemove) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.',
      });
    }

    if (memberToRemove.role === 'OWNER' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot remove the organization owner.',
      });
    }

    org.members = org.members.filter(
      (m) => m.user.toString() !== userId
    );
    await org.save();

    const removedUser = await User.findById(userId);

    await createAuditLog({
      userId: req.user._id,
      organizationId: org._id,
      action: 'MEMBER_REMOVED',
      entity: 'Member',
      entityId: userId,
      oldValue: {
        email: removedUser?.email,
        role: memberToRemove.role,
      },
    });

    const populated = await Organization.findById(org._id)
      .populate('members.user', 'name email avatar')
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
 * PATCH /api/organizations/:id/members/:userId/role
 * Update a member's role
 */
exports.updateMemberRole = async (req, res, next) => {
  try {
    const org = req.organization;
    const { userId } = req.params;
    const { role } = req.body;

    const member = org.members.find(
      (m) => m.user.toString() === userId
    );
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found.',
      });
    }

    const oldRole = member.role;
    member.role = role;
    await org.save();

    await createAuditLog({
      userId: req.user._id,
      organizationId: org._id,
      action: 'MEMBER_ROLE_CHANGED',
      entity: 'Member',
      entityId: userId,
      oldValue: { role: oldRole },
      newValue: { role },
    });

    const populated = await Organization.findById(org._id)
      .populate('members.user', 'name email avatar')
      .populate('createdBy', 'name email avatar');

    res.json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};
