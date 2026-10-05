const cron = require('node-cron');
const Task = require('../models/Task');
const Notification = require('../models/Notification');

/**
 * Deadline notification scheduler
 * Runs every hour to check for tasks with approaching deadlines
 */
const startDeadlineNotifier = (io) => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find tasks with deadlines within the next 24 hours
      // that haven't been completed
      const approachingTasks = await Task.find({
        dueDate: { $gte: now, $lte: in24Hours },
        status: { $ne: 'DONE' },
        assignee: { $ne: null },
      }).populate('assignee', 'name email');

      for (const task of approachingTasks) {
        // Check if we already sent a notification for this deadline
        const existing = await Notification.findOne({
          recipient: task.assignee._id,
          type: 'TASK_DEADLINE_APPROACHING',
          entityId: task._id,
          createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        });

        if (!existing) {
          const notification = await Notification.create({
            recipient: task.assignee._id,
            type: 'TASK_DEADLINE_APPROACHING',
            title: 'Deadline Approaching',
            message: `Task "${task.title}" is due ${task.dueDate.toLocaleDateString()}.`,
            organization: task.organization,
            entityType: 'Task',
            entityId: task._id,
          });

          if (io) {
            const populated = await Notification.findById(notification._id)
              .populate('organization', 'name');
            io.to(`user:${task.assignee._id}`).emit(
              'notification:new',
              populated
            );
          }
        }
      }

      console.log(
        `[CRON] Checked deadlines: ${approachingTasks.length} approaching tasks found.`
      );
    } catch (error) {
      console.error('[CRON] Deadline notifier error:', error);
    }
  });

  console.log('[CRON] Deadline notifier started (runs every hour)');
};

module.exports = startDeadlineNotifier;
