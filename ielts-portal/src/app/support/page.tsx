'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
    Plus,
    MessageCircle,
    Clock,
    CheckCircle,
    AlertCircle,
    ChevronRight,
    Send,
    ArrowLeft,
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

export default function SupportPage() {
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [showNewTicketForm, setShowNewTicketForm] = useState(false);
    const [replyMessage, setReplyMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // New ticket form state
    const [newTicket, setNewTicket] = useState({
        subject: '',
        description: '',
        category: 'other',
        priority: 'medium',
    });

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
            return;
        }
        if (user) {
            fetchTickets();
        }
    }, [user, isLoading]);

    const fetchTickets = async () => {
        try {
            const res = await fetch('/api/ielts/tickets/', { credentials: 'include' });
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

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTicket.subject.trim() || !newTicket.description.trim()) return;

        setSubmitting(true);
        try {
            const res = await fetch('/api/ielts/tickets/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newTicket),
            });

            if (res.ok) {
                setNewTicket({ subject: '', description: '', category: 'other', priority: 'medium' });
                setShowNewTicketForm(false);
                fetchTickets();
            } else {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.detail || `Server error: ${res.status}`);
            }
        } catch (err) {
            console.error('Error creating ticket:', err);
            alert('Failed to create ticket: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendReply = async () => {
        if (!selectedTicket) {
            alert("Error: No ticket selected");
            return;
        }
        if (!replyMessage.trim()) {
            alert("Error: Message is empty");
            return;
        }

        console.log("Sending reply for ticket:", selectedTicket.id);

        setSubmitting(true);
        try {
            const res = await fetch(`/api/ielts/tickets/${selectedTicket.id}/reply/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: replyMessage }),
            });

            if (res.ok) {
                setReplyMessage('');
                // Refresh ticket details
                const ticketRes = await fetch(`/api/ielts/tickets/${selectedTicket.id}/`, { credentials: 'include' });
                if (ticketRes.ok) {
                    const updatedTicket = await ticketRes.json();
                    setSelectedTicket(updatedTicket);
                    setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.detail || `Server error: ${res.status}`);
            }
        } catch (err) {
            console.error('Error sending reply:', err);
            alert('Failed to answer: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading || loading) {
        return (
            <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    // Ticket Detail View
    if (selectedTicket) {
        return (
            <AdminLayout title="Support" subtitle="View your ticket">
                <div className="max-w-3xl mx-auto">
                    {/* Back Button */}
                    <button
                        onClick={() => setSelectedTicket(null)}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to tickets
                    </button>

                    {/* Ticket Header */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">{selectedTicket.subject}</h2>
                                <p className="text-sm text-slate-500 mt-1">
                                    Created {new Date(selectedTicket.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[selectedTicket.status] || 'bg-slate-100 text-slate-800'}`}>
                                {selectedTicket.status_display}
                            </span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                        </div>
                        <div className="flex gap-4 mt-4 text-sm text-slate-500">
                            <span>Category: <strong>{selectedTicket.category_display}</strong></span>
                            <span className={priorityColors[selectedTicket.priority]}>Priority: <strong>{selectedTicket.priority_display}</strong></span>
                        </div>
                    </div>

                    {/* Replies */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Conversation</h3>

                        <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                            {selectedTicket.replies.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">No replies yet. Our team will respond soon.</p>
                            ) : (
                                selectedTicket.replies.map((reply) => (
                                    <div
                                        key={reply.id}
                                        className={`p-4 rounded-xl ${reply.is_admin ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-slate-50'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-medium text-slate-900">
                                                {reply.is_admin ? '🛡️ Support Team' : reply.user_name}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {new Date(reply.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-slate-700 whitespace-pre-wrap">{reply.message}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Reply Input */}
                        {selectedTicket.status !== 'closed' && (
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={replyMessage}
                                    onChange={(e) => setReplyMessage(e.target.value)}
                                    placeholder="Type your message..."
                                    className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                                />
                                <button
                                    onClick={handleSendReply}
                                    disabled={submitting || !replyMessage.trim()}
                                    className="px-6 py-3 bg-[#6FB63A] text-white rounded-xl font-medium hover:bg-[#5FA030] transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    Send
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </AdminLayout>
        );
    }

    // New Ticket Form
    if (showNewTicketForm) {
        return (
            <AdminLayout title="Support" subtitle="Create a new ticket">
                <div className="max-w-2xl mx-auto">
                    <button
                        onClick={() => setShowNewTicketForm(false)}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to tickets
                    </button>

                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                        <h2 className="text-xl font-semibold text-slate-900 mb-6">New Support Ticket</h2>

                        <form onSubmit={handleCreateTicket} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                                <input
                                    type="text"
                                    value={newTicket.subject}
                                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                                    placeholder="Brief summary of your issue"
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                                    <select
                                        value={newTicket.category}
                                        onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent"
                                    >
                                        <option value="technical">Technical Issue</option>
                                        <option value="billing">Billing/Payment</option>
                                        <option value="test">Test Related</option>
                                        <option value="account">Account Issue</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                                    <select
                                        value={newTicket.priority}
                                        onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                                <textarea
                                    value={newTicket.description}
                                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                                    placeholder="Please describe your issue in detail..."
                                    rows={6}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent resize-none"
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowNewTicketForm(false)}
                                    className="px-6 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-3 bg-[#6FB63A] text-white rounded-xl font-medium hover:bg-[#5FA030] transition-colors disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Ticket'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    // Ticket List
    return (
        <AdminLayout
            title="Support"
            subtitle="Need help? Submit a ticket"
            actions={
                <button
                    onClick={() => setShowNewTicketForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#6FB63A] hover:bg-[#5FA030] rounded-lg text-white font-medium transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Ticket
                </button>
            }
        >
            <div className="max-w-4xl mx-auto">
                {tickets.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageCircle className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No tickets yet</h3>
                        <p className="text-slate-500 mb-6">Having an issue? Create a support ticket and we'll help you out.</p>
                        <button
                            onClick={() => setShowNewTicketForm(true)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-[#6FB63A] text-white rounded-xl font-medium hover:bg-[#5FA030] transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Create Your First Ticket
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {tickets.map((ticket) => (
                            <div
                                key={ticket.id}
                                onClick={() => setSelectedTicket(ticket)}
                                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold text-slate-900 group-hover:text-[#6FB63A] transition-colors">
                                                {ticket.subject}
                                            </h3>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[ticket.status] || 'bg-slate-100 text-slate-800'}`}>
                                                {ticket.status_display}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 text-sm line-clamp-2 mb-3">{ticket.description}</p>
                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(ticket.created_at).toLocaleDateString()}
                                            </span>
                                            <span>{ticket.category_display}</span>
                                            <span className={priorityColors[ticket.priority]}>{ticket.priority_display} priority</span>
                                            {ticket.replies.length > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <MessageCircle className="w-3 h-3" />
                                                    {ticket.replies.length} {ticket.replies.length === 1 ? 'reply' : 'replies'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#6FB63A] transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
