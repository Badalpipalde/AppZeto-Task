# Appzeto PM - Multi-Tenant Project Management & Collaboration

A full-stack project management SaaS application built with the MERN stack (MongoDB, Express, React, Node.js) featuring real-time collaboration via Socket.IO.

## Features

- **Multi-Tenant Architecture**: Users can belong to multiple organizations. Role-based access control (OWNER, ADMIN, MEMBER, VIEWER) is enforced at the organization and project level.
- **Kanban Board**: Drag-and-drop task management with real-time updates across all connected clients.
- **Real-Time Collaboration**: Using Socket.IO, any changes made to tasks (creation, updates, movement) are instantly broadcast to other users viewing the same project. Notifications are also delivered in real time.
- **Audit Logging**: Comprehensive tracking of all important actions (task creation, status changes, member additions, etc.) with a searchable and filterable UI.
- **Advanced Search**: Filter tasks by status, priority, assignee, labels, and due dates, along with text search capabilities.
- **Notifications**: Automated real-time notifications for task assignments, mentions, status changes, approaching deadlines (via cron job), and organization invitations.
- **Modern UI**: Clean, premium aesthetic featuring dark mode, glassmorphism, responsive design, and smooth micro-animations.

## Indexing & Performance Strategy

To meet the performance requirements of supporting 100,000 tasks, 10,000 users, and 1,000 organizations, the following database indexing and query strategies have been implemented:

### Database Indexes

1. **Tasks Collection (`Task.js`)**
   - `{ project: 1, status: 1, position: 1 }`: Optimizes the primary Kanban board fetch query. It allows the database to instantly retrieve and sort tasks for a specific column in a specific project.
   - `{ organization: 1 }`, `{ assignee: 1 }`, `{ status: 1 }`, `{ priority: 1 }`, `{ dueDate: 1 }`, `{ labels: 1 }`: Single-field indexes for advanced filtering.
   - `{ createdAt: -1 }`: Optimizes pagination sorting for task lists.
   - `{ title: 'text', description: 'text' }`: Enables efficient full-text search across task content.
   - `{ project: 1, status: 1, priority: 1, assignee: 1 }`: Compound index specifically targeting the most common combinations of filters in the advanced search view.

2. **Audit Logs Collection (`AuditLog.js`)**
   - `{ organization: 1, createdAt: -1 }`: Extremely important for the audit log list view, enabling fast retrieval of an organization's history ordered by time.
   - `{ user: 1, createdAt: -1 }`: Allows users to quickly see their own activity history.
   - `{ entity: 1, entityId: 1 }`: Polymorphic compound index for querying the full history of a specific entity (e.g., all actions on "Task" ID 123).

3. **Notifications Collection (`Notification.js`)**
   - `{ recipient: 1, read: 1, createdAt: -1 }`: Optimizes the most frequent notification query: fetching a user's unread notifications.

4. **Organizations and Users**
   - `{ 'members.user': 1 }`: Crucial index on the array of subdocuments in Organizations, allowing fast lookup of all organizations a specific user belongs to.
   - `{ email: 1 }` (unique) and `{ slug: 1 }` (unique) for fast exact-match lookups.

### Query Optimization

- **Pagination**: All list endpoints (`/tasks`, `/audit-logs`, `/notifications`) implement `skip` and `limit` pagination. The frontend requests specific pages to ensure memory and network limits aren't exceeded.
- **Avoiding N+1 Queries**: The dashboard projects list uses MongoDB Aggregation (`$group` and `$sum`) to fetch task counts for all projects in a single query, rather than executing a separate `countDocuments` query for every project returned.
- **Selective Population**: Mongoose `.populate()` calls explicitly select only required fields (e.g., `'name email avatar'`) to minimize data transfer over the network.
- **Real-time Optimizations**: WebSockets use targeted rooms (`project:ID`, `org:ID`, `user:ID`). Events are only broadcast to clients actively viewing the relevant context, preventing a flood of unnecessary messages to unconnected parts of the application.

## Run Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB (Local instance or Atlas URI)

### Setup
1. Install dependencies:
   ```bash
   npm run install:all
   ```

2. Configure environment:
   The `.env` file in the `server` directory is already created for local development with defaults:
   - `PORT=5000`
   - `MONGODB_URI=mongodb://127.0.0.1:27017/appzeto_pm`
   - `JWT_SECRET=...`

3. Start the application:
   ```bash
   npm run dev
   ```
   This uses `concurrently` to start both the Node server on port 5000 and the Vite React app on port 5173.
