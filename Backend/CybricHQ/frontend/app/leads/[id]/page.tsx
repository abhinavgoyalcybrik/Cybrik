"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import EditLeadModal from "@/components/leads/EditLeadModal";

type Lead = {
  id: number | string;
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
  created_at?: string;
  external_id?: string;
  status?: string;
  message?: string;
  received_at?: string;
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fetchingCallId, setFetchingCallId] = useState<string | number | null>(null);

  async function loadLead() {
    try {
      const leadData = await apiFetch(`/api/leads/${id}/`);
      setLead(leadData);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load lead");
    }
  }

  async function loadCalls() {
    try {
      const callsData = await apiFetch(`/api/calls/?lead_id=${id}`);
      setCalls(Array.isArray(callsData) ? callsData : callsData.results ?? []);
    } catch (e) {
      console.error("Failed to load calls", e);
    }
  }

  async function loadTranscripts() {
    try {
      const transcriptsData = await apiFetch(`/api/transcripts/`);
      setTranscripts(Array.isArray(transcriptsData) ? transcriptsData : transcriptsData.results ?? []);
    } catch (e) {
      console.error("Failed to load transcripts", e);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        await loadLead();
        if (mounted) {
          await loadCalls();
          await loadTranscripts();
        }
      } catch (err: any) {
        // Error handled in loadLead
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this lead? This action cannot be undone.")) return;

    try {
      await apiFetch(`/api/leads/${id}/`, { method: "DELETE" });
      router.push("/leads");
    } catch (err: any) {
      alert("Failed to delete lead: " + err.message);
    }
  }

  async function handleFetchData(callId: string | number) {
    setFetchingCallId(callId);
    try {
      // First, try to sync all ElevenLabs calls (this will find the conversation_id)
      try {
        await apiFetch("/api/ai-calls/sync-elevenlabs/", {
          method: "POST",
          body: JSON.stringify({ hours_back: 48 })
        });
      } catch (syncErr) {
        console.log("Sync all failed, trying direct fetch", syncErr);
      }

      // Then fetch data for this specific call
      await apiFetch(`/api/calls/${callId}/fetch_data/?sync=true`, { method: "POST" });
      // Reload calls and transcripts
      await loadCalls();
      await loadTranscripts();
    } catch (err: any) {
      alert("Failed to fetch data: " + (err.message || "Unknown error"));
    } finally {
      setFetchingCallId(null);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--cy-lime)]"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6 text-red-600 bg-red-50 rounded-xl border border-red-100">
          Error: {error}
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <div className="p-6 text-[var(--cy-text-secondary)]">Lead not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/leads"
            className="p-2 rounded-lg hover:bg-[var(--cy-bg-surface-hover)] text-[var(--cy-text-muted)] hover:text-[var(--cy-navy)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="h2 text-[var(--cy-navy)]">Lead Details</h1>
            <p className="text-sm text-[var(--cy-text-muted)]">ID: {lead.id}</p>
          </div>
          <div className="ml-auto flex gap-3">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="btn btn-outline"
            >
              Edit Lead
            </button>
            <button
              onClick={handleDelete}
              className="btn bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
            >
              Delete
            </button>
            <Link
              href={`/applicants/new?leadId=${lead.id}`}
              className="btn btn-primary"
            >
              Convert to Applicant
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Info & Notes */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Info Card */}
            <div className="card p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-[var(--cy-bg-page)] flex items-center justify-center text-[var(--cy-navy)] font-bold text-2xl">
                    {lead.name ? lead.name.charAt(0).toUpperCase() : "?"}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--cy-navy)]">{lead.name || "Unknown Lead"}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="badge badge-neutral uppercase text-[10px] tracking-wider">
                        {lead.source || "Unknown Source"}
                      </span>
                      <span className={`badge ${lead.status === 'forwarded' ? 'badge-success' : 'badge-warning'}`}>
                        {lead.status || "Received"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="label">Email Address</label>
                  <div className="font-medium text-[var(--cy-text-primary)]">{lead.email || "N/A"}</div>
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <div className="font-medium text-[var(--cy-text-primary)] font-mono">{lead.phone || "N/A"}</div>
                </div>
                <div>
                  <label className="label">Created At</label>
                  <div className="text-sm text-[var(--cy-text-secondary)]">
                    {lead.created_at || lead.received_at ? new Date(lead.created_at || lead.received_at!).toLocaleString() : "N/A"}
                  </div>
                </div>
                <div>
                  <label className="label">External ID</label>
                  <div className="text-xs font-mono text-[var(--cy-text-muted)] truncate" title={lead.external_id}>
                    {lead.external_id || "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Message / Notes */}
            <div className="card p-6">
              <h3 className="h3 mb-4">Message & Notes</h3>
              {lead.message && (
                <div className="mb-4">
                  <label className="label">Original Message</label>
                  <div className="p-4 bg-[var(--cy-bg-page)] rounded-lg text-sm text-[var(--cy-text-secondary)] italic">
                    "{lead.message}"
                  </div>
                </div>
              )}
              <div>
                <label className="label">Internal Notes</label>
                <p className="text-sm text-[var(--cy-text-secondary)] whitespace-pre-wrap">
                  {lead.notes || "No internal notes added yet."}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Call History & Actions */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="card p-6 bg-[var(--cy-navy)] text-white">
              <h3 className="font-bold text-lg mb-2">Quick Actions</h3>
              <p className="text-sm text-white/70 mb-4">
                Manage this lead's journey through the pipeline.
              </p>
              <div className="space-y-2">
                <button className="w-full btn bg-white/10 hover:bg-white/20 text-white border-none justify-start">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Email
                </button>
                <button className="w-full btn bg-white/10 hover:bg-white/20 text-white border-none justify-start">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Log Call
                </button>
              </div>
            </div>

            {/* Call History - Enhanced */}
            <div className="card p-6">
              <h3 className="h3 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call History
              </h3>
              <div className="space-y-3">
                {calls.length === 0 ? (
                  <p className="text-sm text-[var(--cy-text-muted)] italic">No calls recorded for this lead.</p>
                ) : (
                  calls.map((call) => {
                    const transcript = transcripts.find(t => t.call === call.id);
                    const hasRecording = !!call.recording_url;
                    const hasTranscript = !!transcript?.transcript_text;
                    const wasAnswered = hasRecording || hasTranscript || (call.duration_seconds && call.duration_seconds > 0);
                    const isFetching = fetchingCallId === call.id;

                    return (
                      <div
                        key={call.id}
                        className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${wasAnswered
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-red-50/50 border-red-200'
                          }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <Link href={`/calls/${call.id}`} className="group cursor-pointer flex-1">
                            <div>
                              <div className="text-xs font-semibold uppercase text-[var(--cy-text-muted)] tracking-wide group-hover:text-[var(--cy-primary)] transition-colors flex items-center gap-1">
                                {new Date(call.created_at).toLocaleString()}
                                <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </div>
                              <div className="text-sm font-medium text-[var(--cy-navy)] capitalize mt-1">
                                {call.direction || 'Outbound'} Call
                                {call.duration_seconds && (
                                  <span className="text-xs text-[var(--cy-text-muted)] ml-2">
                                    ({Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s)
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                          <div className="flex gap-2 items-center">
                            {!wasAnswered && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFetchData(call.id);
                                }}
                                disabled={isFetching}
                                className="btn btn-xs btn-ghost text-[var(--cy-primary)] hover:bg-[var(--cy-primary)]/10"
                              >
                                {isFetching ? (
                                  <span className="loading loading-spinner loading-xs"></span>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                )}
                                {isFetching ? "Fetching..." : "Fetch Data"}
                              </button>
                            )}
                            {wasAnswered ? (
                              <Link href={`/calls/${call.id}`} className="badge badge-success flex items-center gap-1 hover:bg-emerald-600 cursor-pointer text-white no-underline">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Answered
                              </Link>
                            ) : (
                              <span className="badge badge-error flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                No Answer
                              </span>
                            )}
                          </div>
                        </div>

                        {!wasAnswered && (
                          <div className="bg-white/80 rounded-lg p-3 border border-red-200">
                            <div className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <div>
                                <p className="text-sm font-semibold text-red-800">Call Not Picked Up</p>
                                <p className="text-xs text-red-600 mt-1">
                                  No recording or transcript available. The lead may not have answered the call.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {hasRecording && (
                          <div className="mt-3 p-3 bg-white/80 rounded-lg border border-emerald-200">
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-xs font-bold uppercase text-emerald-700 tracking-wider block">
                                📞 Call Recording
                              </label>
                              <Link href={`/calls/${call.id}`} className="text-xs text-[var(--cy-primary)] hover:underline font-medium">
                                View Full Transcript &rarr;
                              </Link>
                            </div>
                            <audio
                              controls
                              src={call.recording_url}
                              className="w-full"
                              style={{ height: '40px' }}
                            />
                          </div>
                        )}

                        {hasTranscript && (
                          <div className="mt-3 p-3 bg-white/80 rounded-lg border border-emerald-200 relative group/transcript">
                            <Link href={`/calls/${call.id}`} className="absolute inset-0 z-10" aria-label="View Transcript"></Link>
                            <label className="text-xs font-bold uppercase text-emerald-700 tracking-wider mb-2 block flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                              </svg>
                              Transcript Preview
                            </label>
                            <div className="text-sm text-[var(--cy-text-secondary)] leading-relaxed max-h-24 overflow-hidden relative">
                              {transcript.transcript_text}
                              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/90 to-transparent flex items-end justify-center">
                                <span className="text-xs text-[var(--cy-primary)] font-medium bg-white px-2 py-0.5 rounded shadow-sm">Click to read more</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {lead && (
          <EditLeadModal
            lead={lead}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={loadLead}
          />
        )}
      </div>
    </DashboardLayout>
  );
}