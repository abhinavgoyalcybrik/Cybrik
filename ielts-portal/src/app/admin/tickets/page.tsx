'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
    MessageCircle,
    Clock,
    Filter,
    Search,
    ChevronRight,
    AlertTriangle,
    CheckCircle,
    Loader,
    Inbox,
} from 'lucide-react';

interface Ticket {
    id: string;
    user_name: string;
    user_email: string;
    subject: string;
    description: string;
    category: string;
    category_display: string;
    status: string;
    status_display: string;
    priority: string;
    priority_display: string;
    created_at: string;
    updated_at: string;
    replies: any[];
}

const statusColors: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-slate-100 text-slate-800',
};

const priorityIcons: Record<string, React.ReactNode> = {
    high: <AlertTriangle className="w-4 h-4 text-red-500" />,
    medium: <Clock className="w-4 h-4 text-yellow-500" />,
    low: <CheckCircle className="w-4 h-4 text-slate-400" />,
};

export default function AdminTicketsPage() {
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isLoading && (!user || (!user.is_staff && !user.is_superuser))) {
            router.push('/admin/login');
            return;
        }
        if (user) {
            fetchTickets();
        }
    }, [user, isLoading]);

    const fetchTickets = async () => {
        try {
            const res = await fetch('/api/ielts/admin/tickets/', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setTickets(Array.isArray(data) ? data : data.results || []);
            }
        } catch (err) {
            console.error('Error fetching tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredTickets = tickets.filter((ticket) => {
        // Status filter
        if (filter !== 'all' && ticket.status !== filter) return false;
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                ticket.subject.toLowerCase().includes(query) ||
                ticket.user_name.toLowerCase().includes(query) ||
                ticket.user_email.toLowerCase().includes(query)
            );
        }
        return true;
    });

    const statusCounts = {
        all: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        in_progress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length,
    };

    if (isLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <AdminLayout title="Support Tickets" subtitle="Manage student support requests">
            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    {/* Status Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === status
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                                <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-white/20">
                                    {statusCounts[status]}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tickets..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Ticket List */}
            {filteredTickets.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Inbox className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No tickets found</h3>
                    <p className="text-slate-500">
                        {filter !== 'all' ? 'No tickets match the selected filter.' : 'No support tickets have been submitted yet.'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Ticket</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Student</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Status</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Priority</th>
                                <th className="text-left px-6 py-4 text-sm font-medium text-slate-600">Created</th>
                                <th className="w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTickets.map((ticket) => (
                                <tr
                                    key={ticket.id}
                                    onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                <MessageCircle className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 line-clamp-1">{ticket.subject}</p>
                                                <p className="text-sm text-slate-500">{ticket.category_display}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-slate-900">{ticket.user_name}</p>
                                        <p className="text-sm text-slate-500">{ticket.user_email}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                                            {ticket.status_display}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {priorityIcons[ticket.priority]}
                                            <span className="text-sm text-slate-600">{ticket.priority_display}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {new Date(ticket.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <ChevronRight className="w-5 h-5 text-slate-400" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </AdminLayout>
    );
}
