import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import {
  getInitials,
  getColorFromString,
  formatDueDate,
  getStatusLabel,
  getPriorityInfo,
  getStatusClass,
  isOverdue,
  formatRelativeDate,
} from '../utils/helpers';
import {
  Plus,
  Search,
  Filter,
  X,
  AlignLeft,
  Calendar,
  Flag,
  MessageSquare,
  Paperclip,
  Clock,
  ArrowLeft,
  MoreVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState({});
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgMembers, setOrgMembers] = useState([]);
  
  // Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  
  // Real-time
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Search/Filter
  const [search, setSearch] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    assignee: '',
    dueDate: '',
  });

  // Comment State
  const [commentText, setCommentText] = useState('');

  const userRole = project?.orgDetails?.members?.find(
    (m) => m.user?._id === user?._id
  )?.role;
  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'MEMBER';
  const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

  const fetchData = useCallback(async () => {
    try {
      const projRes = await api.get(`/projects/${id}`);
      const p = projRes.data.data;
      setProject(p);
      setColumns(p.columns || ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']);

      // Fetch org members for assignment
      if (p.organization) {
        const orgRes = await api.get(`/organizations/${p.organization}`);
        const org = orgRes.data.data;
        setOrgMembers(org.members || []);
        p.orgDetails = org; // Attach for permission check
      }

      // Fetch Tasks
      const tasksRes = await api.get(`/tasks?project=${id}&limit=1000`); // get all for kanban
      const allTasks = tasksRes.data.data;
      
      // Group tasks by status
      const grouped = {};
      (p.columns || ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).forEach(col => {
        grouped[col] = [];
      });
      
      allTasks.forEach(task => {
        if (grouped[task.status]) {
          grouped[task.status].push(task);
        } else {
           // fallback if task has invalid status
           grouped[p.columns[0]] = grouped[p.columns[0]] || [];
           grouped[p.columns[0]].push(task);
        }
      });
      
      // Sort within columns by position
      Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => (a.position || 0) - (b.position || 0));
      });

      setTasks(grouped);
    } catch (err) {
      toast.error('Failed to load project');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchData();

    const socket = getSocket();
    if (socket) {
      socket.emit('join:project', id);

      socket.on('user:joined', ({ user }) => {
        setOnlineUsers((prev) => {
          if (!prev.find((u) => u._id === user._id)) {
            return [...prev, user];
          }
          return prev;
        });
      });

      socket.on('user:left', ({ user }) => {
        setOnlineUsers((prev) => prev.filter((u) => u._id !== user._id));
      });

      socket.on('task:created', (task) => {
        setTasks((prev) => {
          const newTasks = { ...prev };
          if (newTasks[task.status]) {
            newTasks[task.status] = [...newTasks[task.status], task];
          }
          return newTasks;
        });
      });

      socket.on('task:updated', (updatedTask) => {
        setTasks((prev) => {
          const newTasks = { ...prev };
          // Find and replace
          Object.keys(newTasks).forEach(col => {
            const idx = newTasks[col].findIndex(t => t._id === updatedTask._id);
            if (idx !== -1) {
               // If status changed, we need to move it (though task:moved should handle drag-drops)
               if (col !== updatedTask.status) {
                 newTasks[col].splice(idx, 1);
                 newTasks[updatedTask.status] = newTasks[updatedTask.status] || [];
                 newTasks[updatedTask.status].push(updatedTask);
               } else {
                 newTasks[col][idx] = updatedTask;
               }
            }
          });
          return newTasks;
        });
        
        // Update selected task if open
        if (selectedTask?._id === updatedTask._id) {
          setSelectedTask(updatedTask);
        }
      });

      socket.on('task:deleted', ({ taskId }) => {
        setTasks((prev) => {
          const newTasks = { ...prev };
          Object.keys(newTasks).forEach(col => {
            newTasks[col] = newTasks[col].filter(t => t._id !== taskId);
          });
          return newTasks;
        });
        if (selectedTask?._id === taskId) {
          setShowTaskModal(false);
        }
      });

      socket.on('task:moved', ({ task, oldStatus, newStatus, position }) => {
        if (task.createdBy?._id === user?._id || task.assignee?._id === user?._id) {
            // Already updated optimistically by the person who moved it
            // Only update if we didn't initiate the move (could refine this by checking socket id)
        }
        
        setTasks((prev) => {
            // Re-fetch or apply precisely
            // For simplicity and correctness in concurrent edits, re-fetch all tasks if someone else moved
            fetchData();
            return prev;
        });
      });

      return () => {
        socket.emit('leave:project', id);
        socket.off('user:joined');
        socket.off('user:left');
        socket.off('task:created');
        socket.off('task:updated');
        socket.off('task:deleted');
        socket.off('task:moved');
      };
    }
  }, [id, fetchData, selectedTask, user]);

  const handleDragEnd = async (result) => {
    if (!result.destination || !canEdit) return;
    
    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const sourceCol = source.droppableId;
    const destCol = destination.droppableId;
    
    // Optimistic UI update
    const newTasks = { ...tasks };
    const sourceTasks = [...newTasks[sourceCol]];
    const destTasks = sourceCol === destCol ? sourceTasks : [...newTasks[destCol]];
    
    const [movedTask] = sourceTasks.splice(source.index, 1);
    movedTask.status = destCol;
    
    // Position logic: basic index for now, backend could handle precise ordering
    destTasks.splice(destination.index, 0, movedTask);
    
    // Update positions
    destTasks.forEach((t, i) => { t.position = i; });
    if (sourceCol !== destCol) {
        sourceTasks.forEach((t, i) => { t.position = i; });
    }

    newTasks[sourceCol] = sourceTasks;
    newTasks[destCol] = destTasks;
    
    setTasks(newTasks);

    try {
      await api.put(`/tasks/${draggableId}/move`, {
        status: destCol,
        position: destination.index
      });
    } catch (err) {
      toast.error('Failed to move task');
      fetchData(); // Revert on failure
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    
    try {
      await api.post('/tasks', {
        ...formData,
        project: id,
        assignee: formData.assignee || null,
        dueDate: formData.dueDate || null,
      });
      setShowTaskModal(false);
      setFormData({
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        assignee: '',
        dueDate: '',
      });
      toast.success('Task created');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/tasks/${selectedTask._id}`, {
        ...formData,
        assignee: formData.assignee || null,
        dueDate: formData.dueDate || null,
      });
      setIsEditingTask(false);
      toast.success('Task updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success('Task deleted');
      setShowTaskModal(false);
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await api.post(`/tasks/${selectedTask._id}/comments`, {
        content: commentText
      });
      setCommentText('');
    } catch (err) {
      toast.error('Failed to add comment');
    }
  };

  const openNewTaskModal = (status = 'TODO') => {
    setFormData({
      title: '',
      description: '',
      status,
      priority: 'MEDIUM',
      assignee: '',
      dueDate: '',
    });
    setSelectedTask(null);
    setIsEditingTask(false);
    setShowTaskModal(true);
  };

  const openTaskDetail = async (task) => {
    try {
      const res = await api.get(`/tasks/${task._id}`);
      setSelectedTask(res.data.data);
      setFormData({
        title: res.data.data.title,
        description: res.data.data.description || '',
        status: res.data.data.status,
        priority: res.data.data.priority,
        assignee: res.data.data.assignee?._id || '',
        dueDate: res.data.data.dueDate ? res.data.data.dueDate.substring(0, 10) : '',
      });
      setIsEditingTask(false);
      setShowTaskModal(true);
    } catch (err) {
      toast.error('Failed to load task details');
    }
  };

  // Filter tasks based on search
  const filteredTasks = {};
  if (tasks) {
      Object.keys(tasks).forEach(col => {
          filteredTasks[col] = tasks[col].filter(t => 
             t.title.toLowerCase().includes(search.toLowerCase()) || 
             (t.assignee?.name || '').toLowerCase().includes(search.toLowerCase())
          );
      });
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!project) return null;

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 0 }}>
      {/* Header */}
      <div style={{ padding: 'var(--space-lg) var(--space-xl)', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)', zIndex: 10 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(`/organizations/${project.organization}`)}
          style={{ marginBottom: 'var(--space-sm)', padding: '4px 8px', marginLeft: '-8px' }}
        >
          <ArrowLeft size={16} /> Back to Org
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, background: project.color }}></div>
                <h1 style={{ fontSize: '1.4rem' }}>{project.name}</h1>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                {onlineUsers.length > 0 && (
                    <div className="online-users" title="Users currently viewing this project">
                        {onlineUsers.slice(0, 5).map(u => (
                            <div key={u._id} className="avatar avatar-sm online-user-avatar" style={{ background: getColorFromString(u.name) }}>
                                {getInitials(u.name)}
                            </div>
                        ))}
                        {onlineUsers.length > 5 && (
                            <div className="avatar avatar-sm online-user-avatar" style={{ background: 'var(--bg-tertiary)' }}>
                                +{onlineUsers.length - 5}
                            </div>
                        )}
                    </div>
                )}
                
                <div className="search-input-wrapper">
                    <Search size={16} className="search-icon" />
                    <input 
                        type="text" 
                        className="input" 
                        placeholder="Search tasks..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ height: 36, paddingLeft: 34 }}
                    />
                </div>
                
                {canEdit && (
                    <button className="btn btn-primary" onClick={() => openNewTaskModal()}>
                        <Plus size={16} /> New Task
                    </button>
                )}
            </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-lg) var(--space-xl)', background: 'var(--bg-primary)' }}>
          <DragDropContext onDragEnd={handleDragEnd}>
              <div className="kanban-board">
                  {columns.map(col => (
                      <div key={col} className="kanban-column">
                          <div className="kanban-column-header">
                              <div className="kanban-column-title">
                                  {getStatusLabel(col)}
                                  <div className="kanban-column-count">{filteredTasks[col]?.length || 0}</div>
                              </div>
                              {canEdit && (
                                  <button 
                                      className="btn btn-ghost btn-icon" 
                                      onClick={() => openNewTaskModal(col)}
                                      style={{ padding: 4 }}
                                  >
                                      <Plus size={16} />
                                  </button>
                              )}
                          </div>
                          
                          <Droppable droppableId={col}>
                              {(provided, snapshot) => (
                                  <div
                                      ref={provided.innerRef}
                                      {...provided.droppableProps}
                                      className={`kanban-column-body ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                                  >
                                      {filteredTasks[col]?.map((task, index) => (
                                          <Draggable 
                                              key={task._id} 
                                              draggableId={task._id} 
                                              index={index}
                                              isDragDisabled={!canEdit}
                                          >
                                              {(provided, snapshot) => (
                                                  <div
                                                      ref={provided.innerRef}
                                                      {...provided.draggableProps}
                                                      {...provided.dragHandleProps}
                                                      className={`task-card ${snapshot.isDragging ? 'dragging' : ''}`}
                                                      onClick={() => openTaskDetail(task)}
                                                  >
                                                      <div className="task-card-header">
                                                          <div className="task-card-title">{task.title}</div>
                                                      </div>
                                                      
                                                      <div className="task-card-meta">
                                                          <span className={`badge ${getPriorityInfo(task.priority).class}`}>
                                                              {getPriorityInfo(task.priority).label}
                                                          </span>
                                                          {task.labels?.map(l => (
                                                              <span key={l} className="badge badge-label">{l}</span>
                                                          ))}
                                                      </div>
                                                      
                                                      <div className="task-card-footer">
                                                          <div className="assignee-row">
                                                              {task.assignee ? (
                                                                  <div className="avatar avatar-sm" style={{ background: getColorFromString(task.assignee.name) }} title={task.assignee.name}>
                                                                      {getInitials(task.assignee.name)}
                                                                  </div>
                                                              ) : (
                                                                  <div className="avatar avatar-sm" style={{ background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }} title="Unassigned">
                                                                      ?
                                                                  </div>
                                                              )}
                                                              {task.comments?.length > 0 && (
                                                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                                                                      <MessageSquare size={12} /> {task.comments.length}
                                                                  </span>
                                                              )}
                                                          </div>
                                                          {task.dueDate && (
                                                              <div className={`due-date ${isOverdue(task.dueDate) ? 'overdue' : ''}`}>
                                                                  <Calendar size={12} />
                                                                  {formatDueDate(task.dueDate)}
                                                              </div>
                                                          )}
                                                      </div>
                                                  </div>
                                              )}
                                          </Draggable>
                                      ))}
                                      {provided.placeholder}
                                  </div>
                              )}
                          </Droppable>
                      </div>
                  ))}
              </div>
          </DragDropContext>
      </div>

      {/* Task Modal (Create / Edit / View) */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal task-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedTask ? (isEditingTask ? 'Edit Task' : selectedTask.title) : 'Create Task'}</h2>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                {selectedTask && canEdit && !isEditingTask && (
                   <>
                     <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingTask(true)}>Edit</button>
                     {isAdmin && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(selectedTask._id)}>Delete</button>
                     )}
                   </>
                )}
                <button className="btn btn-ghost btn-icon" onClick={() => setShowTaskModal(false)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* View Mode */}
            {selectedTask && !isEditingTask ? (
                <div className="modal-body" style={{ display: 'flex', gap: 'var(--space-xl)' }}>
                    <div style={{ flex: 2 }}>
                        <div className="task-detail-section">
                            <h4>Description</h4>
                            {selectedTask.description ? (
                                <div style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{selectedTask.description}</div>
                            ) : (
                                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No description provided.</div>
                            )}
                        </div>
                        
                        <div className="task-detail-section">
                            <h4>Comments</h4>
                            <div className="comment-list">
                                {selectedTask.comments?.map(c => (
                                    <div key={c._id} className="comment-item">
                                        <div className="avatar" style={{ background: getColorFromString(c.user?.name) }}>
                                            {getInitials(c.user?.name)}
                                        </div>
                                        <div className="comment-body">
                                            <div className="comment-header">
                                                <span className="comment-author">{c.user?.name}</span>
                                                <span className="comment-time">{formatRelativeDate(c.createdAt)}</span>
                                            </div>
                                            <div className="comment-text">{c.content}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {canEdit && (
                                <form className="comment-input-wrapper" onSubmit={handleAddComment}>
                                    <input 
                                        type="text" 
                                        className="input" 
                                        placeholder="Write a comment..." 
                                        value={commentText}
                                        onChange={e => setCommentText(e.target.value)}
                                    />
                                    <button type="submit" className="btn btn-secondary" disabled={!commentText.trim()}>Post</button>
                                </form>
                            )}
                        </div>
                    </div>
                    
                    <div style={{ flex: 1, background: 'var(--bg-card)', padding: 'var(--space-md)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', alignSelf: 'flex-start' }}>
                        <div className="task-detail-section">
                            <h4>Details</h4>
                            <div className="task-detail-field" style={{ marginBottom: 'var(--space-md)' }}>
                                <span className="field-label">Status</span>
                                <div><span className={`badge ${getStatusClass(selectedTask.status)}`}>{getStatusLabel(selectedTask.status)}</span></div>
                            </div>
                            <div className="task-detail-field" style={{ marginBottom: 'var(--space-md)' }}>
                                <span className="field-label">Priority</span>
                                <div><span className={`badge ${getPriorityInfo(selectedTask.priority).class}`}>{getPriorityInfo(selectedTask.priority).label}</span></div>
                            </div>
                            <div className="task-detail-field" style={{ marginBottom: 'var(--space-md)' }}>
                                <span className="field-label">Assignee</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                    {selectedTask.assignee ? (
                                        <>
                                            <div className="avatar avatar-sm" style={{ background: getColorFromString(selectedTask.assignee.name) }}>
                                                {getInitials(selectedTask.assignee.name)}
                                            </div>
                                            <span className="field-value">{selectedTask.assignee.name}</span>
                                        </>
                                    ) : (
                                        <span className="field-value" style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                                    )}
                                </div>
                            </div>
                            <div className="task-detail-field" style={{ marginBottom: 'var(--space-md)' }}>
                                <span className="field-label">Due Date</span>
                                <span className="field-value">{selectedTask.dueDate ? formatDueDate(selectedTask.dueDate) : 'None'}</span>
                            </div>
                            <div className="task-detail-field">
                                <span className="field-label">Created By</span>
                                <span className="field-value" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selectedTask.createdBy?.name} on {new Date(selectedTask.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                        
                        <div className="task-detail-section" style={{ marginTop: 'var(--space-xl)' }}>
                            <h4>Activity</h4>
                            <div className="activity-list">
                                {selectedTask.activity?.slice().reverse().slice(0, 5).map((act, i) => (
                                    <div key={i} className="activity-item">
                                        <div>
                                            <strong>{act.user?.name}</strong> {act.action.replace('_', ' ')} {act.field ? ` ${act.field}` : ''}
                                            <div className="activity-time">{formatRelativeDate(act.createdAt)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Create / Edit Form */
                <form onSubmit={selectedTask ? handleUpdateTask : handleCreateTask}>
                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div className="input-group">
                            <label>Title *</label>
                            <input 
                                type="text" 
                                className="input" 
                                value={formData.title} 
                                onChange={e => setFormData({...formData, title: e.target.value})} 
                                required
                            />
                        </div>
                        
                        <div className="input-group">
                            <label>Description</label>
                            <textarea 
                                className="textarea" 
                                value={formData.description} 
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                rows={4}
                            />
                        </div>
                        
                        <div className="task-detail-grid">
                            <div className="input-group">
                                <label>Status</label>
                                <select className="select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                    {columns.map(c => <option key={c} value={c}>{getStatusLabel(c)}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Priority</label>
                                <select className="select" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                    <option value="URGENT">Urgent</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Assignee</label>
                                <select className="select" value={formData.assignee} onChange={e => setFormData({...formData, assignee: e.target.value})}>
                                    <option value="">Unassigned</option>
                                    {orgMembers.map(m => (
                                        <option key={m.user._id} value={m.user._id}>{m.user.name} ({m.user.email})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label>Due Date</label>
                                <input 
                                    type="date" 
                                    className="input" 
                                    value={formData.dueDate} 
                                    onChange={e => setFormData({...formData, dueDate: e.target.value})} 
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => selectedTask ? setIsEditingTask(false) : setShowTaskModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={!formData.title.trim()}>
                            {selectedTask ? 'Save Changes' : 'Create Task'}
                        </button>
                    </div>
                </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
