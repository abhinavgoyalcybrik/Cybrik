"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// Stage configuration
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
];

type Application = {
    id: number;
    applicant: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
    };
    university: {
        id: number;
        name: string;
        country: string;
        logo_url: string;
    } | null;
    program: string;
    program_type: string;
    program_type_display: string;
    intake: string;
    intake_display: string;
    status: string;
    stage: string;
    stage_display: string;
    priority: string;
    priority_display: string;
    offer_type: string;
    offer_type_display: string;
    offer_received_date: string | null;
    offer_deadline: string | null;
    conditions: string | null;
    tuition_fee: string | null;
    fee_currency: string;
    deposit_paid: boolean;
    deposit_paid_date: string | null;
    i20_cas_number: string | null;
    i20_cas_received_date: string | null;
    visa_type: string;
    visa_type_display: string;
    visa_interview_date: string | null;
    visa_interview_location: string | null;
    visa_approved: boolean;
    planned_departure_date: string | null;
    flight_booked: boolean;
    accommodation_arranged: boolean;
    assigned_to: number | null;
    assigned_to_name: string | null;
    stage_history: Array<{
        from_stage: string;
        to_stage: string;
        changed_at: string;
        changed_by: number | null;
    }>;
    notes: string | null;
    documents: Array<{
        id: number;
        document_type: string;
        document_type_display: string;
        file_url: string | null;
        status: string;
        status_display: string;
        is_required: boolean;
    }>;
    created_at: string;
    updated_at: string;
};

export default function ApplicationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [application, setApplication] = useState<Application | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [changingStage, setChangingStage] = useState(false);

    const loadApplication = async () => {
        try {
            const data = await apiFetch(`/api/applications/${params.id}/`);
            setApplication(data);
        } catch (err: any) {
            setError(err.message ?? "Failed to load application");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadApplication();
    }, [params.id]);

    const handleStageChange = async (newStage: string) => {
        if (!application || changingStage) return;
        setChangingStage(true);
        try {
            const updated = await apiFetch(`/api/applications/${application.id}/change-stage/`, {
                method: "POST",
                body: JSON.stringify({ stage: newStage }),
            });
            setApplication(updated);
        } catch (err: any) {
            alert(err.message || "Failed to change stage");
        } finally {
            setChangingStage(false);
        }
    };

    const getCurrentStageIndex = () => {
        return STAGES.findIndex((s) => s.key === application?.stage);
    };

    const getStageConfig = (stageKey: string) => {
        return STAGES.find((s) => s.key === stageKey) || STAGES[0];
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

    if (error || !application) {
        return (
            <DashboardLayout>
                <div className="p-8 text-center">
                    <div className="text-red-500 mb-4">{error || "Application not found"}</div>
                    <Link href="/applications" className="text-[var(--cy-lime-hover)] hover:underline">
                        ← Back to Applications
                    </Link>
                </div>
            </DashboardLayout>
        );
    }

    const currentStageIndex = getCurrentStageIndex();
    const stageConfig = getStageConfig(application.stage);

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/applications"
                            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {application.applicant.first_name} {application.applicant.last_name}
                            </h1>
                            <p className="text-gray-500">
                                {application.university?.name || "No University"} • {application.program || "No Program"}
                            </p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${stageConfig.color} text-white`}>
                        <span className="text-xl">{stageConfig.icon}</span>
                        <span className="font-semibold">{application.stage_display}</span>
                    </div>
                </div>

                {/* Stage Stepper */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="font-bold text-lg text-gray-800 mb-4">Application Progress</h2>
                    <div className="relative">
                        {/* Progress Line */}
                        <div className="absolute top-5 left-0 right-0 h-1 bg-gray-200 rounded-full">
                            <div
                                className="h-full bg-[var(--cy-lime)] rounded-full transition-all duration-500"
                                style={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
                            />
                        </div>

                        {/* Stage Points */}
                        <div className="relative flex justify-between">
                            {STAGES.map((stage, index) => {
                                const isCompleted = index < currentStageIndex;
                                const isCurrent = index === currentStageIndex;
                                const isClickable = index === currentStageIndex + 1;

                                return (
                                    <div
                                        key={stage.key}
                                        className="flex flex-col items-center"
                                        style={{ width: `${100 / STAGES.length}%` }}
                                    >
                                        <button
                                            onClick={() => isClickable && handleStageChange(stage.key)}
                                            disabled={!isClickable || changingStage}
                                            className={`
                                                w-10 h-10 rounded-full flex items-center justify-center text-lg z-10 transition-all
                                                ${isCompleted ? "bg-[var(--cy-lime)] text-[var(--cy-navy)]" : ""}
                                                ${isCurrent ? `${stage.color} text-white ring-4 ring-opacity-30 ${stage.color.replace('bg-', 'ring-')}` : ""}
                                                ${!isCompleted && !isCurrent ? "bg-gray-200 text-gray-400" : ""}
                                                ${isClickable ? "cursor-pointer hover:scale-110 hover:ring-2 hover:ring-[var(--cy-lime)]" : "cursor-default"}
                                            `}
                                        >
                                            {isCompleted ? "✓" : stage.icon}
                                        </button>
                                        <span className={`text-xs mt-2 text-center ${isCurrent ? "font-bold text-gray-900" : "text-gray-500"}`}>
                                            {stage.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Next Stage Button */}
                    {currentStageIndex < STAGES.length - 1 && (
                        <div className="mt-6 flex justify-center">
                            <button
                                onClick={() => handleStageChange(STAGES[currentStageIndex + 1].key)}
                                disabled={changingStage}
                                className="px-6 py-3 bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                            >
                                {changingStage ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--cy-navy)]" />
                                ) : (
                                    <>
                                        Move to {STAGES[currentStageIndex + 1].label}
                                        <span className="text-xl">{STAGES[currentStageIndex + 1].icon}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Details */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Applicant Info */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h2 className="font-bold text-lg text-gray-800 mb-4">Applicant Information</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <InfoItem label="Name" value={`${application.applicant.first_name} ${application.applicant.last_name}`} />
                                <InfoItem label="Email" value={application.applicant.email} />
                                <InfoItem label="Phone" value={application.applicant.phone || "N/A"} />
                                <InfoItem label="Assigned To" value={application.assigned_to_name || "Unassigned"} />
                            </div>
                        </div>

                        {/* Program Details */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h2 className="font-bold text-lg text-gray-800 mb-4">Program Details</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <InfoItem label="University" value={application.university?.name || "Not selected"} />
                                <InfoItem label="Country" value={application.university?.country || "N/A"} />
                                <InfoItem label="Program" value={application.program || "Not specified"} />
                                <InfoItem label="Program Type" value={application.program_type_display || "N/A"} />
                                <InfoItem label="Intake" value={application.intake_display || "Not selected"} />
                                <InfoItem label="Priority" value={application.priority_display} />
                            </div>
                        </div>

                        {/* Offer & Fee Details */}
                        {(application.offer_received_date || application.tuition_fee) && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <h2 className="font-bold text-lg text-gray-800 mb-4">Offer & Fee Details</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <InfoItem label="Offer Type" value={application.offer_type_display || "N/A"} />
                                    <InfoItem label="Offer Date" value={application.offer_received_date ? new Date(application.offer_received_date).toLocaleDateString() : "N/A"} />
                                    <InfoItem label="Offer Deadline" value={application.offer_deadline ? new Date(application.offer_deadline).toLocaleDateString() : "N/A"} />
                                    <InfoItem label="Tuition Fee" value={application.tuition_fee ? `${application.fee_currency} ${application.tuition_fee}` : "N/A"} />
                                    <InfoItem label="Deposit Paid" value={application.deposit_paid ? "✅ Yes" : "❌ No"} />
                                    {application.conditions && (
                                        <div className="col-span-2">
                                            <InfoItem label="Conditions" value={application.conditions} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Visa Details */}
                        {application.visa_type && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <h2 className="font-bold text-lg text-gray-800 mb-4">Visa Details</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <InfoItem label="Visa Type" value={application.visa_type_display} />
                                    <InfoItem label="I-20/CAS Number" value={application.i20_cas_number || "N/A"} />
                                    <InfoItem label="Interview Date" value={application.visa_interview_date ? new Date(application.visa_interview_date).toLocaleString() : "Not scheduled"} />
                                    <InfoItem label="Interview Location" value={application.visa_interview_location || "N/A"} />
                                    <InfoItem label="Visa Approved" value={application.visa_approved ? "✅ Yes" : "❌ No"} />
                                    <InfoItem label="Departure Date" value={application.planned_departure_date ? new Date(application.planned_departure_date).toLocaleDateString() : "Not set"} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Documents & Timeline */}
                    <div className="space-y-6">
                        {/* Document Checklist */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h2 className="font-bold text-lg text-gray-800 mb-4">Documents</h2>
                            {application.documents.length === 0 ? (
                                <div className="text-center text-gray-500 py-4">
                                    No documents yet
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {application.documents.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${doc.status === "verified" ? "bg-green-500" :
                                                        doc.status === "rejected" ? "bg-red-500" :
                                                            doc.status === "uploaded" ? "bg-blue-500" :
                                                                "bg-gray-400"
                                                    }`}>
                                                    {doc.status === "verified" ? "✓" :
                                                        doc.status === "rejected" ? "✗" :
                                                            doc.status === "uploaded" ? "📄" : "⏳"}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{doc.document_type_display}</div>
                                                    <div className="text-xs text-gray-500">{doc.status_display}</div>
                                                </div>
                                            </div>
                                            {doc.file_url && (
                                                <a
                                                    href={doc.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-[var(--cy-lime-hover)] hover:underline"
                                                >
                                                    View
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Stage History / Timeline */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h2 className="font-bold text-lg text-gray-800 mb-4">Activity Timeline</h2>
                            {application.stage_history.length === 0 ? (
                                <div className="text-center text-gray-500 py-4">
                                    No stage changes yet
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {[...application.stage_history].reverse().map((entry, index) => {
                                        const fromConfig = getStageConfig(entry.from_stage);
                                        const toConfig = getStageConfig(entry.to_stage);
                                        return (
                                            <div key={index} className="flex gap-3">
                                                <div className="flex-shrink-0">
                                                    <div className={`w-8 h-8 rounded-full ${toConfig.color} flex items-center justify-center text-white text-sm`}>
                                                        {toConfig.icon}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-sm text-gray-900">
                                                        Moved from <span className="font-medium">{fromConfig.label}</span> to <span className="font-medium">{toConfig.label}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {new Date(entry.changed_at).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        {application.notes && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <h2 className="font-bold text-lg text-gray-800 mb-4">Notes</h2>
                                <p className="text-gray-600 text-sm whitespace-pre-wrap">{application.notes}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-sm font-medium text-gray-900">{value}</div>
        </div>
    );
}
