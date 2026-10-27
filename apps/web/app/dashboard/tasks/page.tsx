'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { actionItemsApi, meetingsApi, type ActionItem, type Meeting } from '@/lib/api';

export default function TasksPage() {
  const router = useRouter();
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({
    meetingId: '',
    task: '',
    assignee: '',
    dueDate: '',
    priority: 'medium',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [itemsRes, meetingsRes] = await Promise.all([
        actionItemsApi.getUserItems(),
        meetingsApi.list().catch(() => ({ data: [] })),
      ]);
      setActionItems(itemsRes.data);
      setMeetings(meetingsRes.data);
      if (meetingsRes.data.length > 0) {
        setNewTask((prev) => ({ ...prev, meetingId: meetingsRes.data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load tasks data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const response = await actionItemsApi.getUserItems();
      setActionItems(response.data);
    } catch (err) {
      console.error('Failed to reload tasks:', err);
    }
  };

  const filteredTasks = actionItems.filter((item) => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await actionItemsApi.updateStatus(id, newStatus);
      await loadTasks();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this action item?')) return;
    try {
      await actionItemsApi.delete(id);
      setActionItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.task.trim() || !newTask.meetingId) return;

    setCreating(true);
    try {
      await actionItemsApi.create({
        meetingId: newTask.meetingId,
        task: newTask.task.trim(),
        assignee: newTask.assignee.trim() || undefined,
        dueDate: newTask.dueDate || undefined,
        priority: newTask.priority,
      });

      setNewTask({
        meetingId: meetings[0]?.id || '',
        task: '',
        assignee: '',
        dueDate: '',
        priority: 'medium',
      });
      setShowAddModal(false);
      await loadTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
      alert('Failed to create action item');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    router.push('/login');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isOverdue = (dateString?: string) => {
    if (!dateString) return false;
    const dueDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-gray-600 font-medium">Loading tasks and action items...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950">
      {/* Navigation */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/dashboard" className="text-xl font-bold text-gray-900 tracking-tight">
              Meeti
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
                Home
              </Link>
              <Link href="/dashboard/meetings" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
                Meetings
              </Link>
              <Link href="/dashboard/tasks" className="text-sm font-semibold text-blue-600 transition">
                Tasks
              </Link>
              <Link href="/dashboard/search" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
                Search
              </Link>
              <Link href="/dashboard/settings" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-gray-500 hover:text-red-600 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tasks & Action Items</h1>
            <p className="text-gray-600 text-sm mt-1">
              Track decisions, deliverables, and follow-ups extracted from your meetings.
            </p>
          </div>

          {meetings.length > 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition shadow-sm self-start sm:self-auto"
            >
              Add Action Item
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {['all', 'pending', 'in_progress', 'completed', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                filter === status
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border text-gray-700 hover:bg-gray-50'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Task List */}
        {filteredTasks.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 text-center space-y-4 shadow-sm">
            <p className="text-base font-semibold text-gray-900">
              {filter === 'all' ? 'No action items yet' : `No ${filter.replace('_', ' ')} action items`}
            </p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Action items are automatically extracted when meetings finish processing, or you can add them manually.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/meetings/new"
                className="inline-flex items-center px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
              >
                Record a Meeting
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((item) => (
              <div
                key={item.id}
                className="bg-white border rounded-xl p-5 shadow-sm hover:border-gray-300 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <p className={`text-base font-medium ${item.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {item.task}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                      {item.meeting_id && (
                        <div className="flex items-center gap-1 text-blue-600 font-medium">
                          <span>Meeting:</span>
                          <Link
                            href={`/dashboard/meetings/${item.meeting_id}`}
                            className="hover:underline truncate max-w-xs"
                          >
                            {item.meeting_title || 'View Meeting'}
                          </Link>
                        </div>
                      )}

                      {item.assignee && (
                        <span>Assignee: <strong className="text-gray-800">{item.assignee}</strong></span>
                      )}

                      {item.due_date && (
                        <span className={isOverdue(item.due_date) && item.status !== 'completed' ? 'text-red-600 font-semibold' : ''}>
                          Due: {formatDate(item.due_date)} {isOverdue(item.due_date) && item.status !== 'completed' ? '(Overdue)' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
                        item.priority === 'high'
                          ? 'bg-red-100 text-red-700'
                          : item.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {item.priority}
                    </span>

                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <button
                      onClick={() => handleDeleteTask(item.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Action Item Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">Add Action Item</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Meeting
                  </label>
                  <select
                    value={newTask.meetingId}
                    onChange={(e) => setNewTask({ ...newTask, meetingId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {meetings.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Task Description
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Send updated project roadmap to client"
                    value={newTask.task}
                    onChange={(e) => setNewTask({ ...newTask, task: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                      Assignee (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Sarah Jenkins"
                      value={newTask.assignee}
                      onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                    Due Date (optional)
                  </label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? 'Saving...' : 'Create Action Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}