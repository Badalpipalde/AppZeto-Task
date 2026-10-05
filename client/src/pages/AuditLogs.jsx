import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatRelativeDate, formatAuditAction } from '../utils/helpers';
import { History, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function AuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  
  // Filters
  const [selectedOrg, setSelectedOrg] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  useEffect(() => {
    // Fetch orgs where user is admin to populate filter
    const fetchOrgs = async () => {
        try {
            const res = await api.get('/organizations');
            setOrganizations(res.data.data.filter(org => {
                const member = org.members?.find(m => m.user?._id === user?._id);
                return member && (member.role === 'ADMIN' || member.role === 'OWNER');
            }));
        } catch (err) {
            console.error(err);
        }
    };
    fetchOrgs();
  }, [user]);

  useEffect(() => {
    if (organizations.length > 0 && !selectedOrg) {
        setSelectedOrg(organizations[0]._id);
    }
  }, [organizations, selectedOrg]);

  useEffect(() => {
    if (!selectedOrg) {
        setLoading(false);
        return;
    }
    
    const fetchLogs = async () => {
      setLoading(true);
      try {
        let url = `/audit-logs?organization=${selectedOrg}&page=${page}&limit=20`;
        if (entityFilter) url += `&entity=${entityFilter}`;
        
        const res = await api.get(url);
        setLogs(res.data.data);
        setPagination(res.data.pagination);
      } catch (err) {
        toast.error('Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [selectedOrg, entityFilter, page]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Audit Logs</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            System-wide activity tracking
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 'var(--space-md) var(--space-xl) 0', marginBottom: 'var(--space-lg)' }}>
        <div className="filter-bar">
          <div className="input-group">
              <label>Organization (Admin access required)</label>
              <select 
                  className="select" 
                  value={selectedOrg} 
                  onChange={(e) => { setSelectedOrg(e.target.value); setPage(1); }}
              >
                  {organizations.map(org => (
                      <option key={org._id} value={org._id}>{org.name}</option>
                  ))}
                  {organizations.length === 0 && <option value="">No admin organizations</option>}
              </select>
          </div>
          
          <div className="input-group">
              <label>Entity</label>
              <select 
                  className="select" 
                  value={entityFilter} 
                  onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
              >
                  <option value="">All Entities</option>
                  <option value="Task">Tasks</option>
                  <option value="Project">Projects</option>
                  <option value="Organization">Organizations</option>
                  <option value="Member">Members</option>
              </select>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : logs.length === 0 ? (
          <div className="empty-state" style={{ padding: '4rem 2rem' }}>
            <div className="empty-icon"><History size={32} /></div>
            <h3>No audit logs found</h3>
            <p>Try adjusting your filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="audit-log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {log.user?.name || 'System'}
                        </div>
                    </td>
                    <td>
                      <span className="badge badge-in-progress" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                        {formatAuditAction(log.action)}
                      </span>
                    </td>
                    <td>{log.entity}</td>
                    <td>
                      {/* Simple rendering of old/new values */}
                      {log.oldValue && log.newValue && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Updated</span>
                      )}
                      {log.newValue && !log.oldValue && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-success)' }}>Created</span>
                      )}
                      {log.oldValue && !log.newValue && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-danger)' }}>Deleted</span>
                      )}
                      <div style={{ fontSize: '0.75rem', marginTop: 4, fontFamily: 'monospace', color: 'var(--text-secondary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {JSON.stringify(log.newValue || log.oldValue || {})}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {pagination.pages > 1 && (
            <div className="pagination" style={{ borderTop: '1px solid var(--border-color)', padding: 'var(--space-md)' }}>
                <span className="pagination-info">Page {pagination.page} of {pagination.pages}</span>
                <button 
                    className="btn btn-secondary btn-sm" 
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                >
                    Prev
                </button>
                <button 
                    className="btn btn-secondary btn-sm" 
                    disabled={page === pagination.pages}
                    onClick={() => setPage(p => p + 1)}
                >
                    Next
                </button>
            </div>
        )}
      </div>
    </div>
  );
}
