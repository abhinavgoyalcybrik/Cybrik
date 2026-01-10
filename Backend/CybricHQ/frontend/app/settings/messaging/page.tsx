"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import apiFetch from "@/lib/api";
import { useUser } from "@/context/UserContext";
import Loader from "@/components/ui/Loader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
    MessageSquare,
    Send,
    Inbox,
    Bot,
    RefreshCw,
    Filter,
    Search,
} from "lucide-react";

interface Message {
    id: number;
    channel: string;
    direction: string;
    to_number: string;
    from_number: string;
    body: string;
    status: string;
    is_from_ai: boolean;
    lead_id: number | null;
    lead_name: string | null;
    created_at: string;
    sent_at: string | null;
}

interface Stats {
    today: { sent: number; received: number; ai_responses: number };
    this_week: { sent: number; received: number; ai_responses: number };
    total: number;
    is_configured: boolean;
}

export default function MessagingPage() {
    const { user } = useUser();
    const [messages, setMessages] = useState<Message[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        direction: "",
        channel: "whatsapp",
    });

    useEffect(() => {
        loadData();
    }, [filter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter.direction) params.set("direction", filter.direction);
            if (filter.channel) params.set("channel", filter.channel);
            params.set("limit", "100");

            const [historyRes, statsRes] = await Promise.all([
                apiFetch(`/api/whatsapp/history/?${params}`),
                apiFetch("/api/whatsapp/stats/"),
            ]);

            setMessages(historyRes.messages || []);
            setStats(statsRes);
        } catch (e) {
            console.error("Failed to load messaging data", e);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            delivered: "bg-emerald-100 text-emerald-700",
            read: "bg-blue-100 text-blue-700",
            sent: "bg-cyan-100 text-cyan-700",
            failed: "bg-red-100 text-red-700",
            queued: "bg-slate-100 text-slate-600",
        };
        return styles[status] || "bg-slate-100 text-slate-600";
    };

    const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) => (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-sm text-slate-500 font-medium">{label}</p>
                    <p className="text-2xl font-bold text-slate-800">{value}</p>
                </div>
            </div>
        </div>
    );

    return (
        <DashboardLayout user={user}>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <MessageSquare className="w-10 h-10 text-[var(--cy-lime)]" />
                                Messaging
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                WhatsApp and SMS communication history with AI-powered responses.
                            </p>
                        </div>
                        <div className="hidden md:block opacity-20">
                            <MessageSquare className="w-32 h-32" />
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard icon={Send} label="Sent Today" value={stats.today.sent} color="bg-blue-50 text-blue-600" />
                        <StatCard icon={Inbox} label="Received Today" value={stats.today.received} color="bg-emerald-50 text-emerald-600" />
                        <StatCard icon={Bot} label="AI Responses" value={stats.today.ai_responses} color="bg-purple-50 text-purple-600" />
                        <StatCard icon={MessageSquare} label="Total Messages" value={stats.total} color="bg-slate-100 text-slate-600" />
                    </div>
                )}

                {/* API Status */}
                {stats && !stats.is_configured && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-3">
                        <div className="mt-0.5">⚠️</div>
                        <div>
                            <strong>WhatsApp not configured.</strong> Messages are in mock mode. Add <code className="bg-amber-100 px-1 rounded">WHATSAPP_ACCESS_TOKEN</code> to enable real messaging.
                        </div>
                    </div>
                )}

                {/* Filters & Actions */}
                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <select
                                    value={filter.direction}
                                    onChange={(e) => setFilter({ ...filter, direction: e.target.value })}
                                    className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent"
                                >
                                    <option value="">All Directions</option>
                                    <option value="outbound">Sent</option>
                                    <option value="inbound">Received</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={filter.channel}
                                    onChange={(e) => setFilter({ ...filter, channel: e.target.value })}
                                    className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent"
                                >
                                    <option value="">All Channels</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="sms">SMS</option>
                                </select>
                            </div>
                            <Button
                                variant="outline"
                                onClick={loadData}
                                disabled={loading}
                                className="ml-auto"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Messages Table */}
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center py-16">
                                <Loader />
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="py-16 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                                    <MessageSquare className="w-8 h-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-700 mb-1">No messages yet</h3>
                                <p className="text-slate-500 text-sm">
                                    Messages will appear here when you start communicating with leads.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Direction</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Lead</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Message</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {messages.map((msg) => (
                                            <motion.tr
                                                key={msg.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="hover:bg-slate-50 transition-colors"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {msg.direction === "inbound" ? (
                                                            <span className="flex items-center gap-1.5 text-emerald-600 font-medium text-sm">
                                                                <Inbox className="w-4 h-4" /> Received
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1.5 text-blue-600 font-medium text-sm">
                                                                <Send className="w-4 h-4" /> Sent
                                                            </span>
                                                        )}
                                                        {msg.is_from_ai && (
                                                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                                                                AI
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="font-medium text-slate-800">
                                                        {msg.lead_name || <span className="text-slate-400">Unknown</span>}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="font-mono text-sm text-slate-600">
                                                        {msg.direction === "inbound" ? msg.from_number : msg.to_number}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 max-w-xs">
                                                    <p className="text-slate-700 text-sm truncate">{msg.body}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(msg.status)}`}>
                                                        {msg.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-sm text-slate-500">
                                                    {new Date(msg.created_at).toLocaleString()}
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
