"use client";

import React, { useEffect, useState } from "react";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";

type Transcript = {
    id: number;
    transcript_text: string;
    asr_provider: string;
    created_at: string;
};

type CallRecord = {
    id: number;
    provider: string;
    external_call_id: string;
    status: string;
    direction: string;
    duration_seconds: number;
    cost: number | null;
    conversation_id: string;
    phone_number: string;
    metadata: any;
    qualified_data: any;
    created_at: string;
    transcripts: Transcript[];
};

type AIResult = {
    id: number;
    application: number;
    call_id?: number;
    payload: any;
    extractor_version: string;
    confidence: number;
    created_at: string;
    transcript?: string;
};

export default function ElevenLabsPage() {
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [aiResults, setAiResults] = useState<AIResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
    const [selectedResult, setSelectedResult] = useState<AIResult | null>(null);

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                const [callsData, resultsData] = await Promise.all([
                    apiFetch("/api/calls/"),
                    apiFetch("/api/airesults/")
                ]);
                if (!mounted) return;
                setCalls(Array.isArray(callsData) ? callsData : callsData.results ?? []);
                setAiResults(Array.isArray(resultsData) ? resultsData : resultsData.results ?? []);
            } catch (err: any) {
                console.error(err);
                setError(err.message ?? "Failed to load data");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => {
            mounted = false;
        };
    }, []);

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            completed: "bg-green-100 text-green-700",
            in_progress: "bg-blue-100 text-blue-700",
            initiated: "bg-yellow-100 text-yellow-700",
            failed: "bg-red-100 text-red-700",
        };
        return colors[status] || "bg-gray-100 text-gray-700";
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--cy-lime)]"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="h1">ElevenLabs AI Voice</h1>
                        <p className="text-[var(--cy-text-secondary)] mt-1">
                            Call transcripts and AI extraction results
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="card p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-[var(--cy-text-muted)]">Total Calls</p>
                                <p className="text-2xl font-bold text-[var(--cy-navy)]">{calls.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-[var(--cy-text-muted)]">Transcripts</p>
                                <p className="text-2xl font-bold text-[var(--cy-navy)]">
                                    {calls.filter(c => c.transcripts && c.transcripts.length > 0).length}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-[var(--cy-text-muted)]">AI Extractions</p>
                                <p className="text-2xl font-bold text-[var(--cy-navy)]">{aiResults.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="card p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm text-[var(--cy-text-muted)]">Total Cost (Est.)</p>
                                <p className="text-2xl font-bold text-[var(--cy-navy)]">
                                    ${calls.reduce((sum, c) => sum + (c.cost || 0), 0).toFixed(4)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Calls with Transcripts */}
                <div className="card">
                    <div className="p-5 border-b border-[var(--cy-border)]">
                        <h2 className="h3">Call Recordings & Transcripts</h2>
                        <p className="text-sm text-[var(--cy-text-muted)] mt-1">View call details and conversation transcripts</p>
                    </div>
                    
                    {calls.length === 0 ? (
                        <div className="p-10 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-[var(--cy-navy)]">No Calls Yet</h3>
                            <p className="text-sm text-[var(--cy-text-muted)] mt-1">
                                Calls will appear here when leads receive AI voice calls
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--cy-border)]">
                            {calls.map((call) => (
                                <div 
                                    key={call.id} 
                                    className="p-5 hover:bg-[var(--cy-bg-surface)] transition-colors cursor-pointer"
                                    onClick={() => setSelectedCall(call)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-[var(--cy-lime)] bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0">
                                                <svg className="w-5 h-5 text-[var(--cy-lime-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-[var(--cy-navy)]">
                                                        {call.phone_number || "Unknown Number"}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(call.status)}`}>
                                                        {call.status}
                                                    </span>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                        {call.direction}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-[var(--cy-text-muted)]">
                                                    {new Date(call.created_at).toLocaleString()}
                                                    {call.duration_seconds > 0 && ` • ${Math.floor(call.duration_seconds / 60)}:${(call.duration_seconds % 60).toString().padStart(2, '0')}`}
                                                    {call.cost != null && call.cost > 0 && ` • $${call.cost.toFixed(4)}`}
                                                </p>
                                                {call.conversation_id && (
                                                    <p className="text-xs text-[var(--cy-text-muted)] font-mono mt-1">
                                                        Conv: {call.conversation_id}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {call.transcripts && call.transcripts.length > 0 ? (
                                                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Transcript Available
                                                </span>
                                            ) : (
                                                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                                                    Awaiting Transcript
                                                </span>
                                            )}
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                    
                                    {/* Preview of transcript if available */}
                                    {call.transcripts && call.transcripts.length > 0 && (
                                        <div className="mt-3 p-3 bg-[var(--cy-bg-surface)] rounded-lg border border-[var(--cy-border)]">
                                            <p className="text-sm text-[var(--cy-text-secondary)] line-clamp-2">
                                                {call.transcripts[0].transcript_text}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* AI Extraction Results */}
                {aiResults.length > 0 && (
                    <div className="card">
                        <div className="p-5 border-b border-[var(--cy-border)]">
                            <h2 className="h3">AI Extraction Results</h2>
                            <p className="text-sm text-[var(--cy-text-muted)] mt-1">
                                Automatically extracted data from call conversations
                            </p>
                        </div>
                        <div className="divide-y divide-[var(--cy-border)]">
                            {aiResults.map((result) => (
                                <div 
                                    key={result.id} 
                                    className="p-5 hover:bg-[var(--cy-bg-surface)] transition-colors cursor-pointer"
                                    onClick={() => setSelectedResult(result)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-medium text-[var(--cy-navy)]">
                                                    Extraction #{result.id}
                                                </p>
                                                <p className="text-sm text-[var(--cy-text-muted)]">
                                                    {new Date(result.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className={`font-bold ${result.confidence > 0.8 ? 'text-green-600' : result.confidence > 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {(result.confidence * 100).toFixed(0)}%
                                                </p>
                                                <p className="text-xs text-[var(--cy-text-muted)]">Confidence</p>
                                            </div>
                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Call Detail Modal */}
                {selectedCall && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-[var(--cy-border)] flex justify-between items-center bg-[var(--cy-bg-page)]">
                                <div>
                                    <h2 className="h3 flex items-center gap-2">
                                        <svg className="w-6 h-6 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        Call Details
                                    </h2>
                                    <p className="text-sm text-[var(--cy-text-muted)]">
                                        {selectedCall.phone_number || "Unknown"} • {new Date(selectedCall.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedCall(null)} className="btn btn-ghost btn-sm">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6">
                                {/* Call Info */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-4 bg-[var(--cy-bg-surface)] rounded-xl border border-[var(--cy-border)]">
                                        <p className="text-xs font-bold text-[var(--cy-text-muted)] uppercase mb-1">Status</p>
                                        <span className={`text-sm px-2 py-0.5 rounded-full ${getStatusBadge(selectedCall.status)}`}>
                                            {selectedCall.status}
                                        </span>
                                    </div>
                                    <div className="p-4 bg-[var(--cy-bg-surface)] rounded-xl border border-[var(--cy-border)]">
                                        <p className="text-xs font-bold text-[var(--cy-text-muted)] uppercase mb-1">Direction</p>
                                        <p className="font-medium text-[var(--cy-navy)]">{selectedCall.direction}</p>
                                    </div>
                                    <div className="p-4 bg-[var(--cy-bg-surface)] rounded-xl border border-[var(--cy-border)]">
                                        <p className="text-xs font-bold text-[var(--cy-text-muted)] uppercase mb-1">Duration</p>
                                        <p className="font-medium text-[var(--cy-navy)]">
                                            {selectedCall.duration_seconds > 0 
                                                ? `${Math.floor(selectedCall.duration_seconds / 60)}:${(selectedCall.duration_seconds % 60).toString().padStart(2, '0')}`
                                                : "N/A"
                                            }
                                        </p>
                                    </div>
                                    <div className="p-4 bg-[var(--cy-bg-surface)] rounded-xl border border-[var(--cy-border)]">
                                        <p className="text-xs font-bold text-[var(--cy-text-muted)] uppercase mb-1">Provider</p>
                                        <p className="font-medium text-[var(--cy-navy)]">{selectedCall.provider || "ElevenLabs"}</p>
                                    </div>
                                </div>

                                {/* Conversation ID */}
                                {selectedCall.conversation_id && (
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Conversation ID</p>
                                        <p className="font-mono text-sm text-slate-700 break-all">{selectedCall.conversation_id}</p>
                                    </div>
                                )}

                                {/* Transcript Section */}
                                <div>
                                    <h3 className="h4 mb-3 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Call Transcript
                                    </h3>
                                    {selectedCall.transcripts && selectedCall.transcripts.length > 0 ? (
                                        <div className="space-y-4">
                                            {selectedCall.transcripts.map((t, idx) => (
                                                <div key={t.id || idx} className="p-4 bg-white rounded-xl border border-[var(--cy-border)] shadow-sm">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-xs font-medium text-[var(--cy-text-muted)]">
                                                            {t.asr_provider || "AI Transcription"}
                                                        </span>
                                                        <span className="text-xs text-[var(--cy-text-muted)]">
                                                            {new Date(t.created_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="prose prose-sm max-w-none">
                                                        <p className="text-[var(--cy-text-secondary)] whitespace-pre-wrap leading-relaxed">
                                                            {t.transcript_text}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 bg-yellow-50 rounded-xl border border-yellow-100 text-center">
                                            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <p className="text-yellow-800 font-medium">Transcript Pending</p>
                                            <p className="text-sm text-yellow-600 mt-1">
                                                The transcript will appear here once the call is completed and processed by ElevenLabs AI.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Qualified Data (Extracted Info) */}
                                {selectedCall.qualified_data && Object.keys(selectedCall.qualified_data).length > 0 && (
                                    <div>
                                        <h3 className="h4 mb-3 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                            Extracted Data
                                        </h3>
                                        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                                            <pre className="text-xs font-mono text-green-400 overflow-x-auto">
                                                {JSON.stringify(selectedCall.qualified_data, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-[var(--cy-border)] bg-[var(--cy-bg-page)] flex justify-end">
                                <button onClick={() => setSelectedCall(null)} className="btn btn-outline">Close</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Result Detail Modal */}
                {selectedResult && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-[var(--cy-border)] flex justify-between items-center bg-[var(--cy-bg-page)]">
                                <div>
                                    <h2 className="h3">AI Analysis Details</h2>
                                    <p className="text-sm text-[var(--cy-text-muted)]">
                                        Result #{selectedResult.id} • {new Date(selectedResult.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedResult(null)} className="btn btn-ghost btn-sm">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-[var(--cy-bg-surface)] rounded-xl border border-[var(--cy-border)]">
                                        <p className="text-xs font-bold text-[var(--cy-text-muted)] uppercase mb-1">Extractor Version</p>
                                        <p className="font-mono text-[var(--cy-navy)]">{selectedResult.extractor_version || "v1.0.0"}</p>
                                    </div>
                                    <div className="p-4 bg-[var(--cy-bg-surface)] rounded-xl border border-[var(--cy-border)]">
                                        <p className="text-xs font-bold text-[var(--cy-text-muted)] uppercase mb-1">Confidence Score</p>
                                        <p className={`font-bold text-lg ${selectedResult.confidence > 0.8 ? 'text-green-600' : 'text-yellow-600'}`}>
                                            {(selectedResult.confidence * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                </div>

                                {selectedResult.transcript && (
                                    <div>
                                        <h3 className="h4 mb-2">Transcript</h3>
                                        <div className="p-4 bg-[var(--cy-bg-surface)] rounded-xl border border-[var(--cy-border)] text-sm text-[var(--cy-text-secondary)] whitespace-pre-wrap max-h-48 overflow-y-auto">
                                            {selectedResult.transcript}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h3 className="h4 mb-2">Extracted Data</h3>
                                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono text-green-400 overflow-x-auto">
                                        <pre>{JSON.stringify(selectedResult.payload, null, 2)}</pre>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-[var(--cy-border)] bg-[var(--cy-bg-page)] flex justify-end">
                                <button onClick={() => setSelectedResult(null)} className="btn btn-outline">Close</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
