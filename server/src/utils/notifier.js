const Notification = require('../models/Notification');

/**
 * Create and emit a notification in real-time
 *
 * @param {Object} io - Socket.IO instance
 * @param {Object} params - Notification parameters
 */
const createNotification = async (io, params) => {
  try {
    const notification = await Notification.create(params);

    const populated = await Notification.findById(notification._id)
      .populate('sender', 'name email avatar')
      .populate('organization', 'name');

    // Emit to the recipient in real-time
    if (io) {
      io.to(`user:${params.recipient}`).emit('notification:new', populated);
    }

    return populated;
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

module.exports = createNotification;
