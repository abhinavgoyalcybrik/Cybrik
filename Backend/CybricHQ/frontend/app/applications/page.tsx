"use client";

import React, { useEffect, useState, useCallback } from "react";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// Stage configuration with colors and icons
const STAGES = [
    { key: "inquiry", label: "Inquiry", color: "bg-slate-500", icon: "📋" },
    { key: "documents_pending", label: "Documents", color: "bg-amber-500", icon: "📄" },
    { key: "application_submitted", label: "Applied", color: "bg-blue-500", icon: "📤" },
    { key: "offer_received", label: "Offer", color: "bg-purple-500", icon: "🎓" },
    { key: "fee_paid", label: "Fee Paid", color: "bg-teal-500", icon: "💳" },
    { key: "i20_cas_received", label: "I-20/CAS", color: "bg-indigo-500", icon: "📃" },
    { key: "visa_applied", label: "Visa Applied", color: "bg-pink-500", icon: "🛂" },
    { key: "visa_interview", label: "Interview", color: "bg-orange-500", icon: "🗣️" },
    { key: "visa_approved", label: "Approved", color: "bg-green-500", icon: "✅" },
    { key: "pre_departure", label: "Pre-Departure", color: "bg-cyan-500", icon: "✈️" },
    { key: "enrolled", label: "Enrolled", color: "bg-emerald-600", icon: "🏫" },
    { key: "rejected", label: "Rejected", color: "bg-red-500", icon: "❌" },
    { key: "withdrawn", label: "Withdrawn", color: "bg-gray-500", icon: "🚫" },
];

type Application = {
    id: number;
    applicant_name: string;
    applicant_email: string;
    university_name: string | null;
    program: string;
    intake: string;
    stage: string;
    stage_display: string;
    priority: string;
    priority_display: string;
    visa_interview_date: string | null;
    assigned_to: number | null;
    assigned_to_name: string | null;
    documents_count: number;
    created_at: string;
    updated_at: string;
};

type StageData = {
    code: string;
    name: string;
    count: number;
};

export default function ApplicationsPage() {
    const [applications, setApplications] = useState<Application[]>([]);
    const [stageCounts, setStageCounts] = useState<Record<string, StageData>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
    const [selectedStage, setSelectedStage] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [appsData, stagesData] = await Promise.all([
                apiFetch(`/api/applications/${selectedStage ? `?stage=${selectedStage}` : ""}`),
                apiFetch("/api/applications/stages/"),
            ]);
            setApplications(Array.isArray(appsData) ? appsData : appsData.results ?? []);
            setStageCounts(stagesData);
        } catch (err: any) {
            console.error(err);
            setError(err.message ?? "Failed to load applications");
        } finally {
            setLoading(false);
        }
    }, [selectedStage]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const totalCount = Object.values(stageCounts).reduce((sum, s) => sum + (s?.count || 0), 0);

    const getStageConfig = (stageKey: string) => {
        return STAGES.find((s) => s.key === stageKey) || STAGES[0];
    };

    const getPriorityBadge = (priority: string) => {
        const colors: Record<string, string> = {
            urgent: "bg-red-100 text-red-700 border-red-200",
            high: "bg-orange-100 text-orange-700 border-orange-200",
            medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
            low: "bg-gray-100 text-gray-600 border-gray-200",
        };
        return colors[priority] || colors.medium;
    };

    if (loading && applications.length === 0) {
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
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <svg className="w-10 h-10 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Application Processing
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                Track and manage student applications from inquiry to enrollment.
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* View Toggle */}
                            <div className="flex bg-white/10 rounded-xl p-1">
                                <button
                                    onClick={() => setViewMode("list")}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "list" ? "bg-white text-gray-900" : "text-white hover:bg-white/10"}`}
                                >
                                    List
                                </button>
                                <button
                                    onClick={() => setViewMode("kanban")}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "kanban" ? "bg-white text-gray-900" : "text-white hover:bg-white/10"}`}
                                >
                                    Kanban
                                </button>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-bold text-[var(--cy-lime)]">{totalCount}</div>
                                <div className="text-sm text-blue-200">Total Applications</div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
                </div>

                {/* Stage Filter Pills */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedStage(null)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!selectedStage ? "bg-[var(--cy-navy)] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    >
                        All ({totalCount})
                    </button>
                    {STAGES.slice(0, -2).map((stage) => {
                        const count = stageCounts[stage.key]?.count || 0;
                        return (
                            <button
                                key={stage.key}
                                onClick={() => setSelectedStage(stage.key)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${selectedStage === stage.key ? `${stage.color} text-white` : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                            >
                                <span>{stage.icon}</span>
                                {stage.label} ({count})
                            </button>
                        );
                    })}
                </div>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {/* Applications List */}
                {viewMode === "list" && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="font-bold text-lg text-gray-800">
                                {selectedStage ? `${getStageConfig(selectedStage).label} Applications` : "All Applications"}
                            </h2>
                        </div>

                        {applications.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <div className="text-4xl mb-4">📋</div>
                                <p>No applications found{selectedStage ? ` in ${getStageConfig(selectedStage).label} stage` : ""}.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {applications.map((app) => {
                                    const stageConfig = getStageConfig(app.stage);
                                    return (
                                        <motion.div
                                            key={app.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-xl ${stageConfig.color} flex items-center justify-center text-xl`}>
                                                        {stageConfig.icon}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-gray-900">{app.applicant_name}</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-xs border ${getPriorityBadge(app.priority)}`}>
                                                                {app.priority_display}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {app.university_name || "No University"} • {app.program || "No Program"}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="text-right">
                                                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${stageConfig.color} text-white`}>
                                                            {stageConfig.icon} {app.stage_display}
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-1">
                                                            {app.intake || "No Intake"}
                                                        </div>
                                                    </div>
                                                    <div className="text-right text-sm">
                                                        <div className="text-gray-500">
                                                            {app.assigned_to_name || "Unassigned"}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {new Date(app.updated_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <Link
                                                        href={`/applications/${app.id}`}
                                                        className="px-4 py-2 bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                                                    >
                                                        View
                                                    </Link>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Kanban View */}
                {viewMode === "kanban" && (
                    <KanbanBoard refreshData={loadData} />
                )}
            </div>
        </DashboardLayout>
    );
}

// Kanban Board Component
function KanbanBoard({ refreshData }: { refreshData: () => void }) {
    const [kanbanData, setKanbanData] = useState<Record<string, { name: string; applications: Application[] }>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadKanban() {
            setLoading(true);
            try {
                const data = await apiFetch("/api/applications/kanban/");
                setKanbanData(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadKanban();
    }, []);

    const handleStageChange = async (appId: number, newStage: string) => {
        try {
            await apiFetch(`/api/applications/${appId}/change-stage/`, {
                method: "POST",
                body: JSON.stringify({ stage: newStage }),
            });
            refreshData();
            // Reload kanban
            const data = await apiFetch("/api/applications/kanban/");
            setKanbanData(data);
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--cy-lime)]"></div>
            </div>
        );
    }

    // Show only main workflow stages (exclude rejected/withdrawn)
    const workflowStages = STAGES.slice(0, -2);

    return (
        <div className="flex gap-4 overflow-x-auto pb-4">
            {workflowStages.map((stage) => {
                const stageApps = kanbanData[stage.key]?.applications || [];
                return (
                    <div key={stage.key} className="flex-shrink-0 w-72">
                        <div className={`rounded-t-xl ${stage.color} px-4 py-3 text-white font-semibold flex items-center justify-between`}>
                            <span className="flex items-center gap-2">
                                <span>{stage.icon}</span>
                                {stage.label}
                            </span>
                            <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
                                {stageApps.length}
                            </span>
                        </div>
                        <div className="bg-gray-50 rounded-b-xl min-h-[400px] p-2 space-y-2">
                            <AnimatePresence>
                                {stageApps.map((app) => (
                                    <motion.div
                                        key={app.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                                    >
                                        <div className="font-medium text-gray-900 text-sm mb-1">{app.applicant_name}</div>
                                        <div className="text-xs text-gray-500 mb-2">
                                            {app.university_name || "No University"}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">{app.intake || "-"}</span>
                                            <Link
                                                href={`/applications/${app.id}`}
                                                className="text-xs text-[var(--cy-lime-hover)] hover:underline"
                                            >
                                                View →
                                            </Link>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {stageApps.length === 0 && (
                                <div className="text-center text-gray-400 text-sm py-8">
                                    No applications
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
