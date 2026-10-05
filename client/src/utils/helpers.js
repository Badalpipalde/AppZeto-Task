import { formatDistanceToNow, format, isPast, isToday, isTomorrow } from 'date-fns';

/**
 * Get initials from a name
 */
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Get a deterministic color from a string
 */
export const getColorFromString = (str) => {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
    '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
    '#14b8a6', '#f97316', '#a855f7', '#84cc16',
  ];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Format a date relative to now
 */
export const formatRelativeDate = (date) => {
  if (!date) return '';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

/**
 * Format due date with context
 */
export const formatDueDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isPast(d)) return `Overdue: ${format(d, 'MMM d')}`;
  return format(d, 'MMM d, yyyy');
};

/**
 * Check if a due date is overdue
 */
export const isOverdue = (date) => {
  if (!date) return false;
  return isPast(new Date(date)) && !isToday(new Date(date));
};

/**
 * Get status display name
 */
export const getStatusLabel = (status) => {
  const labels = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    REVIEW: 'Review',
    DONE: 'Done',
  };
  return labels[status] || status;
};

/**
 * Get priority display info
 */
export const getPriorityInfo = (priority) => {
  const info = {
    LOW: { label: 'Low', class: 'badge-low' },
    MEDIUM: { label: 'Medium', class: 'badge-medium' },
    HIGH: { label: 'High', class: 'badge-high' },
    URGENT: { label: 'Urgent', class: 'badge-urgent' },
  };
  return info[priority] || { label: priority, class: '' };
};

/**
 * Get status badge class
 */
export const getStatusClass = (status) => {
  const classes = {
    TODO: 'badge-todo',
    IN_PROGRESS: 'badge-in-progress',
    REVIEW: 'badge-review',
    DONE: 'badge-done',
  };
  return classes[status] || '';
};

/**
 * Format audit action for display
 */
export const formatAuditAction = (action) => {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
};
