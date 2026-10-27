'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { meetingsApi, type Meeting } from '@/lib/api';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Initial load of all recent meetings
    performSearch('');
  }, []);

  const performSearch = async (searchTerm: string) => {
    setLoading(true);
    try {
      const res = await meetingsApi.search(searchTerm);
      setResults(res.data);
      setSearched(true);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query.trim());
  };

  const handleClear = () => {
    setQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    performSearch('');
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    router.push('/login');
  };

  const filteredResults = results.filter((item) => {
    if (typeFilter !== 'all' && item.meeting_type !== typeFilter) {
      return false;
    }
    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0 min';
    const mins = Math.round(seconds / 60);
    return `${mins} min`;
  };

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950">
      {/* Top Navigation */}
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
              <Link href="/dashboard/tasks" className="text-sm font-medium text-gray-700 hover:text-blue-600 transition">
                Tasks
              </Link>
              <Link href="/dashboard/search" className="text-sm font-semibold text-blue-600 transition">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Search Meetings & Notes</h1>
          <p className="text-gray-600 text-sm mt-1">
            Search titles, transcripts, key decisions, summaries, and action items.
          </p>
        </div>

        {/* Search Input Box */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search across all meetings, transcripts, and action items..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 text-sm"
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-3 border border-gray-300 bg-white text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition"
            >
              Reset All
            </button>
          )}
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="business">Business Meeting</option>
              <option value="interview">Interview</option>
              <option value="class">Class</option>
              <option value="client">Client Meeting</option>
              <option value="church">Church Meeting</option>
              <option value="team">Team Meeting</option>
              <option value="personal">Personal Notes</option>
              <option value="research">Research</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="recording">Recording</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div className="ml-auto text-xs text-gray-500">
            {filteredResults.length} {filteredResults.length === 1 ? 'meeting found' : 'meetings found'}
          </div>
        </div>

        {/* Results List */}
        {loading ? (
          <div className="bg-white border rounded-xl p-12 text-center text-gray-500">
            Searching records...
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 text-center space-y-3">
            <p className="text-base font-semibold text-gray-900">
              {searched && query ? `No meetings found for "${query}"` : 'No meetings available'}
            </p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {query
                ? 'Try searching with different keywords, or check for typos.'
                : 'Start a meeting to record audio and generate searchable notes and transcripts.'}
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/meetings/new"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                Start New Meeting
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResults.map((meeting) => (
              <div
                key={meeting.id}
                className="bg-white border rounded-xl p-5 shadow-sm hover:border-blue-400 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/meetings/${meeting.id}`}
                        className="text-base font-semibold text-gray-900 hover:text-blue-600 transition"
                      >
                        {meeting.title}
                      </Link>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full uppercase tracking-wider ${
                          meeting.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : meeting.status === 'processing'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {meeting.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span>{formatDate(meeting.created_at)}</span>
                      <span>Duration: {formatDuration(meeting.duration_seconds)}</span>
                      {meeting.meeting_type && (
                        <span className="capitalize">Type: {meeting.meeting_type.replace('_', ' ')}</span>
                      )}
                      {meeting.output_language && (
                        <span className="uppercase">Language: {meeting.output_language}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <Link
                      href={`/dashboard/meetings/${meeting.id}`}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                      View Notes
                    </Link>
                    {meeting.status === 'processing' ? (
                      <Link
                        href={`/dashboard/meetings/${meeting.id}/processing`}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition"
                      >
                        Processing Status
                      </Link>
                    ) : (
                      <Link
                        href={`/dashboard/meetings/${meeting.id}/record`}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                      >
                        Record
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
