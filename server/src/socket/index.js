const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Configure Socket.IO for real-time collaboration
 */
const configureSocket = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.user._id})`);

    // Join user's personal room for notifications
    socket.join(`user:${socket.user._id}`);

    // Join organization room
    socket.on('join:organization', (orgId) => {
      socket.join(`org:${orgId}`);
      console.log(`${socket.user.name} joined org:${orgId}`);
    });

    // Leave organization room
    socket.on('leave:organization', (orgId) => {
      socket.leave(`org:${orgId}`);
    });

    // Join project room for real-time collaboration
    socket.on('join:project', (projectId) => {
      socket.join(`project:${projectId}`);
      // Notify other users in the project
      socket.to(`project:${projectId}`).emit('user:joined', {
        user: {
          _id: socket.user._id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
        projectId,
      });
      console.log(`${socket.user.name} joined project:${projectId}`);
    });

    // Leave project room
    socket.on('leave:project', (projectId) => {
      socket.leave(`project:${projectId}`);
      socket.to(`project:${projectId}`).emit('user:left', {
        user: {
          _id: socket.user._id,
          name: socket.user.name,
        },
        projectId,
      });
    });

    // Handle task drag events for real-time collaboration
    socket.on('task:dragging', (data) => {
      socket.to(`project:${data.projectId}`).emit('task:dragging', {
        ...data,
        user: {
          _id: socket.user._id,
          name: socket.user.name,
        },
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name}`);
    });
  });
};

module.exports = configureSocket;
