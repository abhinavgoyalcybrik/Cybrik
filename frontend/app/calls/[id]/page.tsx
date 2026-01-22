"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
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
    created_at: string;
    transcripts: any[];
    metadata: any;
    ai_analysis_result: any;
    ai_quality_score: number | null;
    applicant: number | null;
    lead: number | null;
    external_call_id?: string;
    conversation_id?: string;
};

export default function CallDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;
    const [call, setCall] = useState<CallRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadCall() {
            try {
                const data = await apiFetch(`/api/calls/${id}/`);
                setCall(data);
            } catch (err: any) {
                console.error(err);
                setError(err.message ?? "Failed to load call details");
            } finally {
                setLoading(false);
            }
        }
        if (id) {
            loadCall();
        }
    }, [id]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    const [syncing, setSyncing] = useState(false);
    const [followUpTriggered, setFollowUpTriggered] = useState(false);

    const handleSync = async () => {
        if (!id) return;
        setSyncing(true);
        try {
            await apiFetch(`/api/calls/${id}/fetch_data/?sync=true`, { method: "POST" });
            // Reload call data
            const data = await apiFetch(`/api/calls/${id}/`);
            setCall(data);
        } catch (err: any) {
            console.error("Sync failed", err);
        } finally {
            setSyncing(false);
        }
    };

    // Auto-trigger Sync while call is active, then Generate Follow-ups when completed
    useEffect(() => {
        if (!call) return;

        const activeStatuses = ['initiated', 'ringing', 'in_progress', 'scheduled'];
        const isActive = activeStatuses.includes(call.status);

        let intervalId: NodeJS.Timeout | null = null;

        if (isActive) {
            // Auto-sync every 5 seconds while call is active
            intervalId = setInterval(() => {
                handleSync();
            }, 5000);
        } else if (call.status === 'completed' && !followUpTriggered) {
            // Call just completed - trigger follow-up generation
            setFollowUpTriggered(true);
            const leadId = call.lead;
            if (leadId) {
                apiFetch(`/api/leads/${leadId}/generate-follow-ups/`, { method: "POST" })
                    .then(() => console.log("Follow-ups generated automatically"))
                    .catch((err) => console.error("Auto follow-up generation failed", err));
            }
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [call?.status, followUpTriggered]);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--cy-lime)]"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !call) {
        return (
            <DashboardLayout>
                <div className="p-6 text-red-600 bg-red-50 rounded-xl border border-red-100">
                    Error: {error || "Call not found"}
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-[var(--cy-bg-surface-hover)] text-[var(--cy-text-muted)] hover:text-[var(--cy-navy)] transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="h2 text-[var(--cy-navy)]">Call Details</h1>
                        <p className="text-sm text-[var(--cy-text-muted)]">
                            {new Date(call.created_at).toLocaleString()} • {formatDuration(call.duration_seconds)}
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="btn btn-sm btn-outline gap-2"
                        >
                            {syncing ? (
                                <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            )}
                            Sync Data
                        </button>
                        <span className={`badge ${call.status === 'completed' ? 'badge-success' : 'badge-warning'} text-lg px-4 py-3`}>
                            {call.status}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Transcript & Analysis */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Recording Player */}
                        {call.recording_url && (
                            <div className="card p-6 border-l-4 border-[var(--cy-primary)]">
                                <h3 className="h3 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-[var(--cy-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Recording
                                </h3>
                                <audio controls src={call.recording_url} className="w-full" />
                            </div>
                        )}

                        {/* Transcript */}
                        <div className="card p-6">
                            <h3 className="h3 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Transcript
                            </h3>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                {call.transcripts && call.transcripts.length > 0 ? (
                                    call.transcripts.map((t: any, i: number) => (
                                        <div key={i} className={`flex gap-4 ${t.metadata?.speaker === 'agent' ? 'flex-row-reverse' : ''}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${t.metadata?.speaker === 'agent'
                                                ? 'bg-[var(--cy-primary)] text-white'
                                                : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                {t.metadata?.speaker === 'agent' ? 'AI' : 'U'}
                                            </div>
                                            <div className={`p-4 rounded-2xl text-sm max-w-[80%] ${t.metadata?.speaker === 'agent'
                                                ? 'bg-[var(--cy-primary)] text-white rounded-tr-none'
                                                : 'bg-gray-100 text-[var(--cy-navy)] rounded-tl-none'
                                                }`}>
                                                {t.transcript_text}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-[var(--cy-text-muted)] italic py-8">
                                        No transcript available for this call.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Metadata & AI Insights */}
                    <div className="space-y-6">
                        {/* AI Analysis */}
                        {call.ai_analysis_result && (
                            <div className="card p-6 bg-gradient-to-br from-[var(--cy-navy)] to-[#1a2e4d] text-white">
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    AI Insights
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs uppercase tracking-wider text-white/60">Interest Level</label>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={`badge ${call.ai_analysis_result.interest_level === 'high' ? 'badge-success' :
                                                call.ai_analysis_result.interest_level === 'medium' ? 'badge-warning' : 'badge-error'
                                                }`}>
                                                {(call.ai_analysis_result.interest_level || 'Unknown').toUpperCase()}
                                            </div>
                                            {call.ai_quality_score && (
                                                <span className="text-sm font-bold text-[var(--cy-lime)]">
                                                    Score: {call.ai_quality_score}/100
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {call.ai_analysis_result.summary && (
                                        <div>
                                            <label className="text-xs uppercase tracking-wider text-white/60">Summary</label>
                                            <p className="text-sm mt-1 text-white/90 leading-relaxed">
                                                {call.ai_analysis_result.summary}
                                            </p>
                                        </div>
                                    )}

                                    {call.ai_analysis_result.follow_up && (
                                        <div className="bg-white/10 p-3 rounded-lg">
                                            <label className="text-xs uppercase tracking-wider text-[var(--cy-lime)] font-bold">Recommendation</label>
                                            <p className="text-sm mt-1 text-white">
                                                {call.ai_analysis_result.follow_up.reason || "No specific recommendation."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Call Metadata */}
                        <div className="card p-6">
                            <h3 className="font-bold text-[var(--cy-navy)] mb-4">Call Info</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-[var(--cy-text-muted)]">Phone</span>
                                    <span className="font-mono">{call.phone_number}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-[var(--cy-text-muted)]">Direction</span>
                                    <span className="capitalize">{call.direction}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-[var(--cy-text-muted)]">Cost</span>
                                    <span>${call.cost?.toFixed(4) || "0.00"}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="text-[var(--cy-text-muted)]">Provider</span>
                                    <span className="capitalize">{call.metadata?.provider || "ElevenLabs"}</span>
                                </div>
                                <div className="pt-2">
                                    <span className="text-[var(--cy-text-muted)] block mb-1">Call ID</span>
                                    <code className="text-xs bg-gray-100 p-1 rounded block break-all">
                                        {call.conversation_id || call.external_call_id || call.metadata?.conversation_id || call.metadata?.external_call_id || "N/A"}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
