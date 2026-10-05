import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getInitials, getColorFromString, formatRelativeDate } from '../utils/helpers';
import {
  Building2,
  Plus,
  Users,
  FolderKanban,
  BarChart3,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgDesc, setOrgDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const res = await api.get('/organizations');
      setOrgs(res.data.data);
    } catch (err) {
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/organizations', {
        name: orgName,
        description: orgDesc,
      });
      setOrgs((prev) => [res.data.data, ...prev]);
      setShowModal(false);
      setOrgName('');
      setOrgDesc('');
      toast.success('Organization created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Welcome back, {user?.name}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          New Organization
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div
            className="stat-icon"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
          >
            <Building2 size={20} />
          </div>
          <div className="stat-value">{orgs.length}</div>
          <div className="stat-label">Organizations</div>
        </div>
        <div className="stat-card">
          <div
            className="stat-icon"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399' }}
          >
            <Users size={20} />
          </div>
          <div className="stat-value">
            {orgs.reduce((sum, o) => sum + (o.members?.length || 0), 0)}
          </div>
          <div className="stat-label">Total Members</div>
        </div>
        <div className="stat-card">
          <div
            className="stat-icon"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}
          >
            <FolderKanban size={20} />
          </div>
          <div className="stat-value">
            {orgs.reduce(
              (sum, o) =>
                sum +
                (o.members?.find((m) => m.user?._id === user?._id)
                  ? 1
                  : 0),
              0
            )}
          </div>
          <div className="stat-label">Active Roles</div>
        </div>
        <div className="stat-card">
          <div
            className="stat-icon"
            style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}
          >
            <BarChart3 size={20} />
          </div>
          <div className="stat-value">—</div>
          <div className="stat-label">Tasks This Week</div>
        </div>
      </div>

      {/* Organizations */}
      <h2 style={{ marginBottom: 'var(--space-md)', fontSize: '1.15rem' }}>
        Your Organizations
      </h2>

      {orgs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Building2 size={36} />
          </div>
          <h3>No organizations yet</h3>
          <p>Create your first organization to start managing projects and tasks.</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Create Organization
          </button>
        </div>
      ) : (
        <div className="org-grid">
          {orgs.map((org) => {
            const userMember = org.members?.find(
              (m) => m.user?._id === user?._id
            );
            return (
              <div
                key={org._id}
                className="card card-interactive org-card"
                onClick={() => navigate(`/organizations/${org._id}`)}
              >
                <div className="org-card-header">
                  <div
                    className="org-icon"
                    style={{ background: getColorFromString(org.name) }}
                  >
                    {getInitials(org.name)}
                  </div>
                  <div className="org-card-info">
                    <h3>{org.name}</h3>
                    <p>{org.description || 'No description'}</p>
                  </div>
                </div>
                <div className="org-card-meta">
                  <span>
                    <Users size={14} />
                    {org.members?.length || 0} members
                  </span>
                  <span
                    className={`member-role role-${userMember?.role?.toLowerCase()}`}
                  >
                    {userMember?.role}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>
                    {formatRelativeDate(org.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Organization Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Organization</h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateOrg}>
              <div className="modal-body">
                <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label htmlFor="org-name">Organization Name</label>
                  <input
                    id="org-name"
                    type="text"
                    className="input"
                    placeholder="Acme Corp"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="org-desc">Description (optional)</label>
                  <textarea
                    id="org-desc"
                    className="textarea"
                    placeholder="What does this organization do?"
                    value={orgDesc}
                    onChange={(e) => setOrgDesc(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating || !orgName.trim()}
                >
                  {creating ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
