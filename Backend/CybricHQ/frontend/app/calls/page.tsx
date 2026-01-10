"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import apiFetch from "@/lib/api";
import { format } from "date-fns";
import Link from "next/link";

type CallRecord = {
    id: number;
    phone_number: string;
    status: string;
    direction: string;
    duration_seconds: number;
    cost: number | null;
    currency: string;
    recording_url: string | null;
    conversation_id: string | null;
    created_at: string;
    transcripts: any[];
    metadata: any;
};

export default function CallsPage() {
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCallId, setExpandedCallId] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [syncingId, setSyncingId] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [deleting, setDeleting] = useState(false);
    const [playingId, setPlayingId] = useState<number | null>(null);
    const [audioError, setAudioError] = useState<number | null>(null);

    const getAudioUrl = (call: CallRecord): string | null => {
        if (call.recording_url) return call.recording_url;
        const convId = call.conversation_id || call.metadata?.conversation_id || call.metadata?.conversationId;
        if (convId) return `/api/elevenlabs/audio/${convId}/`;
        return null;
    };

    useEffect(() => {
        loadCalls();
    }, []);

    async function loadCalls() {
        try {
            const data = await apiFetch("/api/calls/");
            setCalls(Array.isArray(data) ? data : data.results || []);
        } catch (e) {
            console.error("Failed to load calls", e);
        } finally {
            setLoading(false);
        }
    }

    async function handleRefresh() {
        setRefreshing(true);
        await loadCalls();
        setRefreshing(false);
    }

    async function handleSync(e: React.MouseEvent, callId: number) {
        e.preventDefault();
        e.stopPropagation();
        setSyncingId(callId);
        try {
            await apiFetch(`/api/calls/${callId}/fetch_data/?sync=true`, { method: "POST" });
            await loadCalls(); // Reload list to show updated data
        } catch (err: any) {
            console.error("Sync failed", err);
            alert("Failed to sync data: " + (err.message || "Unknown error"));
        } finally {
            setSyncingId(null);
        }
    }

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(calls.map(c => c.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} calls? This cannot be undone.`)) return;

        setDeleting(true);
        try {
            await apiFetch("/api/calls/bulk_delete/", {
                method: "POST",
                body: JSON.stringify({ ids: selectedIds }),
            });
            setSelectedIds([]);
            await loadCalls();
        } catch (err: any) {
            console.error("Delete failed", err);
            alert("Failed to delete calls: " + (err.message || "Unknown error"));
        } finally {
            setDeleting(false);
        }
    };

    // Calculate metrics
    const totalCalls = calls.length;
    const totalCost = calls.reduce((sum, call) => sum + (call.cost || 0), 0);
    const totalDuration = calls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const formatCurrency = (amount: number, currency: string = "USD") => {
        try {
            if (amount > 0 && amount < 0.01) {
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, minimumFractionDigits: 5 }).format(amount);
            }
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
        } catch (e) {
            return `${amount.toLocaleString()} ${currency}`;
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <svg className="w-10 h-10 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                Conversations & Costs
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                Monitor ElevenLabs AI calls and usage costs.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                className="px-4 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl font-medium hover:bg-white/20 transition-all flex items-center gap-2"
                                onClick={handleRefresh}
                                disabled={refreshing}
                            >
                                {refreshing ? <span className="loading loading-spinner loading-xs"></span> : null}
                                Refresh
                            </button>
                            {selectedIds.length > 0 && (
                                <button
                                    className="px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all flex items-center gap-2"
                                    onClick={handleBulkDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? <span className="loading loading-spinner loading-xs"></span> : null}
                                    Delete ({selectedIds.length})
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="card p-6 border-l-4 border-[var(--cy-primary)]">
                        <h3 className="text-sm font-semibold text-[var(--cy-text-muted)] uppercase tracking-wider">Total Calls</h3>
                        <div className="text-3xl font-bold text-[var(--cy-navy)] mt-2">{totalCalls}</div>
                    </div>
                    <div className="card p-6 border-l-4 border-blue-500">
                        <h3 className="text-sm font-semibold text-[var(--cy-text-muted)] uppercase tracking-wider">Total Cost (Est.)</h3>
                        <div className="text-3xl font-bold text-[var(--cy-navy)] mt-2">{formatCurrency(totalCost)}</div>
                    </div>
                    <div className="card p-6 border-l-4 border-purple-500">
                        <h3 className="text-sm font-semibold text-[var(--cy-text-muted)] uppercase tracking-wider">Total Duration</h3>
                        <div className="text-3xl font-bold text-[var(--cy-navy)] mt-2">{formatDuration(totalDuration)}</div>
                    </div>
                    <div className="card p-6 border-l-4 border-green-500">
                        <h3 className="text-sm font-semibold text-[var(--cy-text-muted)] uppercase tracking-wider">Avg Duration</h3>
                        <div className="text-3xl font-bold text-[var(--cy-navy)] mt-2">{formatDuration(avgDuration)}</div>
                    </div>
                </div>

                {/* Calls Table */}
                <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr className="bg-gray-50 text-left text-xs font-semibold text-[var(--cy-text-muted)] uppercase tracking-wider">
                                    <th className="p-4 w-10">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm"
                                            checked={calls.length > 0 && selectedIds.length === calls.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="p-4">Date/Time</th>
                                    <th className="p-4">Phone / Contact</th>
                                    <th className="p-4">Direction</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Duration</th>
                                    <th className="p-4">Cost</th>
                                    <th className="p-4 min-w-[180px]">Recording</th>
                                    <th className="p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cy-border)]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-[var(--cy-text-muted)]">Loading conversations...</td>
                                    </tr>
                                ) : calls.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-[var(--cy-text-muted)]">No conversations found.</td>
                                    </tr>
                                ) : (
                                    calls.map((call) => (
                                        <React.Fragment key={call.id}>
                                            <tr className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4">
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox checkbox-sm"
                                                        checked={selectedIds.includes(call.id)}
                                                        onChange={() => handleSelectOne(call.id)}
                                                    />
                                                </td>
                                                <td className="p-4 text-sm text-[var(--cy-navy)]">
                                                    {format(new Date(call.created_at), "MMM d, yyyy HH:mm")}
                                                </td>
                                                <td className="p-4 text-sm font-medium text-[var(--cy-navy)]">
                                                    {call.phone_number || "Unknown"}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`badge ${call.direction === 'inbound' ? 'badge-info' : 'badge-neutral'}`}>
                                                        {call.direction || 'outbound'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`badge ${call.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                                                        {call.status || 'unknown'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm text-[var(--cy-text-secondary)]">
                                                    {formatDuration(call.duration_seconds || 0)}
                                                </td>
                                                <td className="p-4 text-sm font-medium text-[var(--cy-navy)]">
                                                    {call.cost != null ? formatCurrency(call.cost, call.currency) : "-"}
                                                </td>
                                                <td className="p-4">
                                                    {(() => {
                                                        const audioUrl = getAudioUrl(call);
                                                        if (!audioUrl) {
                                                            return (
                                                                <span className="text-xs text-gray-400 italic">No recording</span>
                                                            );
                                                        }
                                                        if (audioError === call.id) {
                                                            return (
                                                                <span className="text-xs text-red-500">Audio unavailable</span>
                                                            );
                                                        }
                                                        return (
                                                            <div className="flex items-center gap-2">
                                                                <audio
                                                                    controls
                                                                    src={audioUrl}
                                                                    className="h-8 w-40"
                                                                    preload="none"
                                                                    onPlay={() => setPlayingId(call.id)}
                                                                    onPause={() => setPlayingId(null)}
                                                                    onEnded={() => setPlayingId(null)}
                                                                    onError={() => setAudioError(call.id)}
                                                                />
                                                                {playingId === call.id && (
                                                                    <span className="flex gap-0.5">
                                                                        <span className="w-1 h-3 bg-[var(--cy-primary)] animate-pulse rounded-full"></span>
                                                                        <span className="w-1 h-4 bg-[var(--cy-primary)] animate-pulse rounded-full" style={{ animationDelay: '0.1s' }}></span>
                                                                        <span className="w-1 h-2 bg-[var(--cy-primary)] animate-pulse rounded-full" style={{ animationDelay: '0.2s' }}></span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex gap-2 items-center">
                                                        <button
                                                            onClick={(e) => handleSync(e, call.id)}
                                                            disabled={syncingId === call.id}
                                                            className="btn btn-xs btn-ghost text-indigo-600 hover:bg-indigo-50"
                                                            title="Sync data from ElevenLabs"
                                                        >
                                                            {syncingId === call.id ? (
                                                                <span className="loading loading-spinner loading-xs"></span>
                                                            ) : (
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                        <Link
                                                            href={`/calls/${call.id}`}
                                                            className="btn btn-xs btn-outline"
                                                        >
                                                            View Details
                                                        </Link>
                                                        <button
                                                            className="btn btn-xs btn-ghost"
                                                            onClick={() => setExpandedCallId(expandedCallId === call.id ? null : call.id)}
                                                        >
                                                            {expandedCallId === call.id ? "Hide Transcript" : "Show Transcript"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedCallId === call.id && (
                                                <tr className="bg-gray-50">
                                                    <td colSpan={9} className="p-6">
                                                        <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                                                            {call.transcripts && call.transcripts.length > 0 ? (
                                                                call.transcripts.map((t: any, i: number) => (
                                                                    <div key={i} className={`flex gap-3 ${t.metadata?.speaker === 'agent' ? 'flex-row-reverse' : ''}`}>
                                                                        <div className={`p-3 rounded-lg text-sm max-w-[80%] ${t.metadata?.speaker === 'agent'
                                                                            ? 'bg-[var(--cy-primary)] text-white'
                                                                            : 'bg-white border border-gray-200 text-[var(--cy-navy)]'
                                                                            }`}>
                                                                            <div className="text-xs opacity-70 mb-1 uppercase tracking-wider font-bold">
                                                                                {t.metadata?.speaker || 'Unknown'}
                                                                            </div>
                                                                            {t.transcript_text}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <p className="text-sm text-[var(--cy-text-muted)] italic text-center">No transcript available.</p>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
