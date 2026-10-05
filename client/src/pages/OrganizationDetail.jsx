import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import {
  getInitials,
  getColorFromString,
  formatRelativeDate,
} from '../utils/helpers';
import {
  Plus,
  Users,
  FolderKanban,
  Settings,
  X,
  UserPlus,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrganizationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [org, setOrg] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('projects');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('MEMBER');
  const [creating, setCreating] = useState(false);
  
  // Pagination state for members
  const [memberPage, setMemberPage] = useState(1);
  const MEMBERS_PER_PAGE = 10;

  const userRole = org?.members?.find(
    (m) => m.user?._id === user?._id
  )?.role;
  const isAdmin = userRole === 'ADMIN' || userRole === 'OWNER';

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    if (socket) {
      socket.emit('join:organization', id);
      socket.on('project:created', (project) => {
        setProjects((prev) => [project, ...prev]);
      });
      socket.on('project:deleted', ({ projectId }) => {
        setProjects((prev) => prev.filter((p) => p._id !== projectId));
      });
      return () => {
        socket.emit('leave:organization', id);
        socket.off('project:created');
        socket.off('project:deleted');
      };
    }
  }, [id]);

  const fetchData = async () => {
    try {
      const [orgRes, projRes] = await Promise.all([
        api.get(`/organizations/${id}`),
        api.get(`/projects?organization=${id}`),
      ]);
      setOrg(orgRes.data.data);
      setProjects(projRes.data.data);
    } catch (err) {
      toast.error('Failed to load organization');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/projects', {
        name: projectName,
        description: projectDesc,
        organization: id,
      });
      setProjects((prev) => [res.data.data, ...prev]);
      setShowProjectModal(false);
      setProjectName('');
      setProjectDesc('');
      toast.success('Project created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberEmail.trim()) return;
    setCreating(true);
    try {
      const res = await api.post(`/organizations/${id}/members`, {
        email: memberEmail,
        role: memberRole,
      });
      setOrg(res.data.data);
      setShowMemberModal(false);
      setMemberEmail('');
      setMemberRole('MEMBER');
      toast.success('Member added!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    try {
      const res = await api.delete(`/organizations/${id}/members/${userId}`);
      setOrg(res.data.data);
      toast.success('Member removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/')}
          style={{ marginBottom: 'var(--space-sm)' }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <div
              className="org-icon"
              style={{ background: getColorFromString(org.name) }}
            >
              {getInitials(org.name)}
            </div>
            <div>
              <h1>{org.name}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                {org.description || 'No description'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {isAdmin && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowMemberModal(true)}
                >
                  <UserPlus size={16} />
                  Add Member
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowProjectModal(true)}
                >
                  <Plus size={16} />
                  New Project
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-xs)',
          marginBottom: 'var(--space-xl)',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: 'var(--space-xs)',
        }}
      >
        <button
          className={`btn btn-ghost ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
          style={
            activeTab === 'projects'
              ? {
                  background: 'var(--color-primary-bg)',
                  color: 'var(--color-primary-light)',
                  borderBottom: '2px solid var(--color-primary)',
                  borderRadius: 'var(--border-radius) var(--border-radius) 0 0',
                }
              : {}
          }
        >
          <FolderKanban size={16} />
          Projects ({projects.length})
        </button>
        <button
          className={`btn btn-ghost ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
          style={
            activeTab === 'members'
              ? {
                  background: 'var(--color-primary-bg)',
                  color: 'var(--color-primary-light)',
                  borderBottom: '2px solid var(--color-primary)',
                  borderRadius: 'var(--border-radius) var(--border-radius) 0 0',
                }
              : {}
          }
        >
          <Users size={16} />
          Members ({org.members?.length || 0})
        </button>
      </div>

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <>
          {projects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FolderKanban size={36} />
              </div>
              <h3>No projects yet</h3>
              <p>Create your first project to start managing tasks.</p>
              {isAdmin && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowProjectModal(true)}
                >
                  <Plus size={18} />
                  Create Project
                </button>
              )}
            </div>
          ) : (
            <div className="project-grid">
              {projects.map((project) => (
                <div
                  key={project._id}
                  className="card card-interactive project-card"
                  style={{ borderTop: `3px solid ${project.color || '#6366f1'}` }}
                  onClick={() => navigate(`/projects/${project._id}`)}
                >
                  <div className="project-card-body">
                    <h3>{project.name}</h3>
                    <p>{project.description || 'No description'}</p>
                    <div className="project-card-footer">
                      <span>{project.taskCount || 0} tasks</span>
                      <span>{formatRelativeDate(project.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (() => {
        const totalMembers = org.members?.length || 0;
        const totalPages = Math.ceil(totalMembers / MEMBERS_PER_PAGE);
        const startIndex = (memberPage - 1) * MEMBERS_PER_PAGE;
        const displayedMembers = org.members?.slice(startIndex, startIndex + MEMBERS_PER_PAGE) || [];

        return (
          <>
            <div className="members-list">
              {displayedMembers.map((member) => (
                <div key={member._id} className="member-item">
                  <div
                    className="avatar"
                    style={{ background: getColorFromString(member.user?.name) }}
                  >
                    {getInitials(member.user?.name)}
                  </div>
                  <div className="member-info">
                    <div className="member-name">{member.user?.name}</div>
                    <div className="member-email">{member.user?.email}</div>
                  </div>
                  <span
                    className={`member-role role-${member.role?.toLowerCase()}`}
                  >
                    {member.role}
                  </span>
                  {isAdmin &&
                    member.user?._id !== user?._id &&
                    member.role !== 'OWNER' && (
                      <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => handleRemoveMember(member.user?._id)}
                        title="Remove member"
                      >
                        <Trash2 size={16} style={{ color: 'var(--color-danger)' }} />
                      </button>
                    )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination" style={{ borderTop: '1px solid var(--border-color)', marginTop: 'var(--space-lg)' }}>
                <span className="pagination-info">Page {memberPage} of {totalPages}</span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={memberPage === 1}
                  onClick={() => setMemberPage(p => p - 1)}
                >
                  Prev
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={memberPage === totalPages}
                  onClick={() => setMemberPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        );
      })()}

      {/* Create Project Modal */}
      {showProjectModal && (
        <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Project</h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowProjectModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="modal-body">
                <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label htmlFor="proj-name">Project Name</label>
                  <input
                    id="proj-name"
                    type="text"
                    className="input"
                    placeholder="My Project"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="proj-desc">Description (optional)</label>
                  <textarea
                    id="proj-desc"
                    className="textarea"
                    placeholder="Describe this project"
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowProjectModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !projectName.trim()}
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Member</h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowMemberModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="modal-body">
                <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label htmlFor="member-email">Email Address</label>
                  <input
                    id="member-email"
                    type="email"
                    className="input"
                    placeholder="user@company.com"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="member-role">Role</label>
                  <select
                    id="member-role"
                    className="select"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowMemberModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !memberEmail.trim()}
                >
                  {creating ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
