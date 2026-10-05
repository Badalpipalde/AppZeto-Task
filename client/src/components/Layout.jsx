import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import api from '../services/api';
import { getInitials, getColorFromString, formatRelativeDate } from '../utils/helpers';
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  History,
  Settings,
  LogOut,
  Bell,
  Sparkles,
  Menu,
  X,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Click outside notification dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications and setup socket
  useEffect(() => {
    if (!user) return;
    
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications?limit=20');
        setNotifications(res.data.data);
        setUnreadCount(res.data.unreadCount);
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };
    
    fetchNotifications();

    const socket = getSocket();
    if (socket) {
      socket.on('notification:new', (notification) => {
        setNotifications(prev => [notification, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);
        toast.custom((t) => (
            <div className="toast-custom" style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ background: 'var(--color-primary-bg)', color: 'var(--color-primary)', padding: 8, borderRadius: 8 }}>
                    <Bell size={18} />
                </div>
                <div>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: 2 }}>{notification.title}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{notification.message}</p>
                </div>
            </div>
        ), { duration: 4000 });
      });
      
      return () => {
        socket.off('notification:new');
      };
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const markAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {}
  };

  const navLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    // Only admins usually need global audit logs, but keeping simple for test
    { to: '/audit-logs', icon: History, label: 'Audit Logs' },
  ];

  // Exclude project detail from rendering default layout header (it has its own)
  const isProjectView = location.pathname.startsWith('/projects/');

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo">
            <div className="logo-icon"><Sparkles size={20} /></div>
            Appzeto PM
          </Link>
        </div>
        
        <div className="sidebar-nav">
          <div className="sidebar-section-title">Main Menu</div>
          {navLinks.map(link => (
            <NavLink 
              key={link.to}
              to={link.to} 
              className={({ isActive }) => `sidebar-link ${isActive && link.to === location.pathname ? 'active' : ''}`}
            >
              <link.icon className="link-icon" />
              {link.label}
            </NavLink>
          ))}
        </div>
        
        <div className="sidebar-footer">
          <button className="sidebar-link" onClick={handleLogout} style={{ color: 'var(--color-danger)' }}>
            <LogOut className="link-icon" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {!isProjectView && (
            <header className="header">
              <div className="header-left">
                <button 
                  className="btn btn-ghost btn-icon" 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  style={{ display: window.innerWidth <= 768 ? 'block' : 'none' }}
                >
                  <Menu size={20} />
                </button>
                <div className="page-title">
                  {/* Simplistic dynamic title */}
                  {location.pathname === '/' ? 'Dashboard' : 
                   location.pathname === '/audit-logs' ? 'Audit Logs' : 
                   location.pathname.includes('/organizations/') ? 'Organization' : ''}
                </div>
              </div>
              
              <div className="header-right">
                <div className="notification-bell" ref={notificationRef}>
                  <button className="btn btn-ghost btn-icon" onClick={() => setShowNotifications(!showNotifications)}>
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                  </button>
                  
                  {showNotifications && (
                    <div className="notification-dropdown">
                      <div className="notification-dropdown-header">
                        <h4>Notifications</h4>
                        {unreadCount > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={markAllAsRead} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                              Mark all as read
                            </button>
                        )}
                      </div>
                      <div className="notification-list">
                        {notifications.length === 0 ? (
                            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                No notifications yet.
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div key={n._id} className={`notification-item ${!n.read ? 'unread' : ''}`} onClick={(e) => !n.read && markAsRead(n._id, e)}>
                                    <div className="notification-content">
                                        <div className="notification-title">{n.title}</div>
                                        <div className="notification-message" title={n.message}>{n.message}</div>
                                        <div className="notification-time">{formatRelativeDate(n.createdAt)}</div>
                                    </div>
                                    {!n.read && (
                                        <button className="btn btn-ghost btn-icon" onClick={(e) => markAsRead(n._id, e)} title="Mark as read" style={{ color: 'var(--text-muted)' }}>
                                            <CheckCircle2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="avatar avatar-lg" style={{ background: getColorFromString(user?.name) }}>
                  {getInitials(user?.name)}
                </div>
              </div>
            </header>
        )}
        
        {/* Child Routes */}
        <Outlet />
      </main>
      
      {/* Mobile overlay */}
      {sidebarOpen && (
          <div className="modal-overlay" style={{ zIndex: 90, background: 'rgba(0,0,0,0.5)' }} onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}

// Ensure Link is imported
import { Link } from 'react-router-dom';
