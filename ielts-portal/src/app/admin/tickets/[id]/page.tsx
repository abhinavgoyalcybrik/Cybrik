'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
    ArrowLeft,
    MessageCircle,
    Clock,
    User,
    Mail,
    Send,
    AlertTriangle,
    CheckCircle,
    AlertCircle,
    MoreHorizontal
} from 'lucide-react';

interface TicketReply {
    id: string;
    user_name: string;
    user_email: string;
    message: string;
    is_admin: boolean;
    created_at: string;
}

interface Ticket {
    id: string;
    user_name: string;
    user_email: string;
    subject: string;
    description: string;
    category: string;
    category_display: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    status_display: string;
    priority: string;
    priority_display: string;
    created_at: string;
    updated_at: string;
    replies: TicketReply[];
}

const statusColors: Record<string, string> = {
    open: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-slate-100 text-slate-800',
};

const priorityColors: Record<string, string> = {
    low: 'text-slate-500',
    medium: 'text-yellow-600',
    high: 'text-red-600',
};

export default function AdminTicketDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, isLoading } = useAuth();
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [replyMessage, setReplyMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        if (!isLoading && (!user || (!user.is_staff && !user.is_superuser))) {
            router.push('/admin/login');
            return;
        }
        if (user && params?.id) {
            fetchTicket();
        }
    }, [user, isLoading, params?.id]);

    const fetchTicket = async () => {
        try {
            const res = await fetch(`/api/ielts/tickets/${params?.id}/`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setTicket(data);
            } else {
                // If not found, redirect back
                router.push('/admin/tickets');
            }
        } catch (err) {
            console.error('Error fetching ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendReply = async () => {
        if (!ticket || !replyMessage.trim()) return;

        setSubmitting(true);
        try {
            const res = await fetch(`/api/ielts/tickets/${ticket.id}/reply/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: replyMessage }),
            });

            if (res.ok) {
                setReplyMessage('');
                fetchTicket(); // Refresh to show new reply and potential status change
            }
        } catch (err) {
            console.error('Error sending reply:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!ticket) return;

        setUpdatingStatus(true);
        try {
            const res = await fetch(`/api/ielts/tickets/${ticket.id}/update_status/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus }),
            });

            if (res.ok) {
                const updatedTicket = await res.json();
                setTicket(prev => prev ? { ...prev, status: updatedTicket.status, status_display: updatedTicket.status_display } : null);
            }
        } catch (err) {
            console.error('Error updating status:', err);
        } finally {
            setUpdatingStatus(false);
        }
    };

    if (isLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!ticket) return null;

    return (
        <AdminLayout title="Ticket Details" subtitle={`#${ticket.id.slice(0, 8)}`}>
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => router.push('/admin/tickets')}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to tickets
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content: Description & Conversation */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Ticket Description */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h2 className="text-xl font-semibold text-slate-900 mb-2">{ticket.subject}</h2>
                            <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(ticket.created_at).toLocaleString()}
                                </span>
                                <span>Category: {ticket.category_display}</span>
                            </div>
                            <div className="bg-slate-50 rounded-xl p-4 text-slate-700 whitespace-pre-wrap">
                                {ticket.description}
                            </div>
                        </div>

                        {/* Conversation */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                                <MessageCircle className="w-5 h-5 text-blue-600" />
                                Discussion History
                            </h3>

                            <div className="space-y-6 mb-8">
                                {ticket.replies.length === 0 ? (
                                    <p className="text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        No replies yet.
                                    </p>
                                ) : (
                                    ticket.replies.map((reply) => (
                                        <div
                                            key={reply.id}
                                            className={`flex gap-4 ${reply.is_admin ? 'flex-row-reverse' : ''}`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${reply.is_admin ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-600'}`}>
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div className={`max-w-[85%] rounded-2xl p-4 ${reply.is_admin ? 'bg-blue-50 text-slate-900 rounded-tr-none' : 'bg-slate-50 text-slate-900 rounded-tl-none'}`}>
                                                <div className={`flex items-center gap-2 mb-1 text-xs ${reply.is_admin ? 'justify-end' : ''}`}>
                                                    <span className="font-semibold">{reply.is_admin ? 'Support Team' : reply.user_name}</span>
                                                    <span className="text-slate-400">•</span>
                                                    <span className="text-slate-500">{new Date(reply.created_at).toLocaleString()}</span>
                                                </div>
                                                <p className="whitespace-pre-wrap">{reply.message}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Reply Input */}
                            {ticket.status !== 'closed' && (
                                <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
                                    <textarea
                                        value={replyMessage}
                                        onChange={(e) => setReplyMessage(e.target.value)}
                                        placeholder="Type your reply here... (This will notify the student)"
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px]"
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleSendReply}
                                            disabled={submitting || !replyMessage.trim()}
                                            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Send className="w-4 h-4" />
                                            {submitting ? 'Sending...' : 'Send Reply'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar: Details & Actions */}
                    <div className="space-y-6">

                        {/* User Info */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Student Info</h3>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">{ticket.user_name}</p>
                                    <p className="text-xs text-slate-500">Student</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Mail className="w-4 h-4 text-slate-400" />
                                <a href={`mailto:${ticket.user_email}`} className="hover:text-blue-600 hover:underline">
                                    {ticket.user_email}
                                </a>
                            </div>
                        </div>

                        {/* Ticket Properties */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Ticket Status</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Current Status</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => handleStatusChange(s)}
                                                disabled={updatingStatus}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${ticket.status === s
                                                        ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-500'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Priority</label>
                                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 font-medium ${priorityColors[ticket.priority]}`}>
                                        {ticket.priority === 'high' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                                            ticket.priority === 'medium' ? <Clock className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                        {ticket.priority_display}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">Category</label>
                                    <div className="inline-block px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm">
                                        {ticket.category_display}
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
