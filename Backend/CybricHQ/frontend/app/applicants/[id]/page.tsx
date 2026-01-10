"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import Link from "next/link";

type Applicant = {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    dob?: string;
    passport_number?: string;
    created_at: string;
    stage?: string;
    address?: string;
    preferred_country?: string;
    academic_records: any[];
    documents?: any[];
    metadata?: any;
};

export default function ApplicantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;
    const [applicant, setApplicant] = useState<Applicant | null>(null);
    const [applications, setApplications] = useState<any[]>([]);
    const [calls, setCalls] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState("personal");

    // Follow Ups State
    const [tasks, setTasks] = useState<any[]>([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskForm, setTaskForm] = useState({
        notes: "",
        due_at: "",
        priority: "medium",
        channel: "other"
    });
    const [taskCreating, setTaskCreating] = useState(false);

    // Education Modal State
    const [showEducationModal, setShowEducationModal] = useState(false);
    const [eduForm, setEduForm] = useState({
        institution: "",
        degree: "10th", // Default
        customDegree: "",
        start_year: new Date().getFullYear() - 2,
        end_year: new Date().getFullYear(),
        year_of_completion: new Date().getFullYear(),
        grade: "",
    });
    const [eduLoading, setEduLoading] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);

    // Document Upload State
    const [selectedEnglishTest, setSelectedEnglishTest] = useState("IELTS");
    const [customEnglishTest, setCustomEnglishTest] = useState("");
    const [showStageDropdown, setShowStageDropdown] = useState(false);
    const [showEnglishTestDropdown, setShowEnglishTestDropdown] = useState(false);

    // Scanning State
    const [scanningDocId, setScanningDocId] = useState<number | null>(null);
    const [scanResult, setScanResult] = useState<any>(null);
    const [showScanResultModal, setShowScanResultModal] = useState(false);

    // Stage configuration with colors and icons
    const stageConfig: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
        new: { label: "New", color: "text-blue-400", bgColor: "bg-blue-500/20", icon: "sparkles" },
        docs_pending: { label: "Docs Pending", color: "text-amber-400", bgColor: "bg-amber-500/20", icon: "clock" },
        verified: { label: "Verified", color: "text-green-400", bgColor: "bg-green-500/20", icon: "check" },
        rejected: { label: "Rejected", color: "text-red-400", bgColor: "bg-red-500/20", icon: "x" },
    };

    // English Test configuration
    const englishTestConfig: Record<string, { label: string; color: string; bgColor: string }> = {
        IELTS: { label: "IELTS", color: "text-red-600", bgColor: "bg-red-50" },
        PTE: { label: "PTE", color: "text-purple-600", bgColor: "bg-purple-50" },
        Duolingo: { label: "Duolingo", color: "text-green-600", bgColor: "bg-green-50" },
        TOEFL: { label: "TOEFL", color: "text-blue-600", bgColor: "bg-blue-50" },
        Other: { label: "Other", color: "text-gray-600", bgColor: "bg-gray-50" },
    };

    const handleAddEducation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!applicant) return;
        setEduLoading(true);

        const degreeValue = eduForm.degree === "Other" ? eduForm.customDegree : eduForm.degree;

        try {
            const payload = {
                applicant: applicant.id,
                institution: eduForm.institution,
                degree: degreeValue,
                start_year: eduForm.start_year,
                end_year: eduForm.end_year,
                year_of_completion: eduForm.year_of_completion,
                grade: eduForm.grade,
            };

            let updatedRecord: any;
            if (editingRecord) {
                // Update existing
                updatedRecord = await apiFetch(`/api/academic-records/${editingRecord.id}/`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                });

                setApplicant({
                    ...applicant,
                    academic_records: applicant.academic_records.map(r => r.id === editingRecord.id ? updatedRecord : r)
                });
                alert("Education record updated successfully!");
            } else {
                // Create new
                updatedRecord = await apiFetch(`/api/academic-records/`, {
                    method: "POST",
                    body: JSON.stringify(payload),
                });

                setApplicant({
                    ...applicant,
                    academic_records: [...(applicant.academic_records || []), updatedRecord]
                });
                fetchActivities();
                alert("Education record added successfully!");
            }

            setShowEducationModal(false);
            setEditingRecord(null);
            setEduForm({
                institution: "",
                degree: "10th",
                customDegree: "",
                start_year: new Date().getFullYear() - 2,
                end_year: new Date().getFullYear(),
                year_of_completion: new Date().getFullYear(),
                grade: "",
            });
        } catch (err: any) {
            alert("Failed to save education: " + err.message);
        } finally {
            setEduLoading(false);
        }
    };

    const handleEditEducation = (record: any) => {
        setEditingRecord(record);
        const isStandardDegree = ["10th", "12th", "B.Tech", "B.Sc", "B.Com", "B.A", "M.Tech", "M.Sc", "MBA"].includes(record.degree);
        setEduForm({
            institution: record.institution,
            degree: isStandardDegree ? record.degree : "Other",
            customDegree: isStandardDegree ? "" : record.degree,
            start_year: record.start_year || new Date().getFullYear() - 2,
            end_year: record.end_year || record.year_of_completion || new Date().getFullYear(),
            year_of_completion: record.year_of_completion,
            grade: record.grade,
        });
        setShowEducationModal(true);
    };

    const handleDeleteEducation = async (recordId: number) => {
        if (!confirm("Are you sure you want to delete this education record?")) return;
        if (!applicant) return;

        try {
            await apiFetch(`/api/academic-records/${recordId}/`, {
                method: "DELETE",
            });

            setApplicant({
                ...applicant,
                academic_records: applicant.academic_records.filter((r: any) => r.id !== recordId)
            });
            fetchActivities();
            alert("Education record deleted successfully!");
        } catch (err: any) {
            alert("Failed to delete education record: " + err.message);
        }
    };

    const fetchActivities = async () => {
        if (!id) return;
        try {
            const activitiesData = await apiFetch(`/api/applicants/${id}/activity/`);
            setActivities(Array.isArray(activitiesData) ? activitiesData : []);
        } catch (e) {
            console.error("Failed to load activities", e);
        }
    };

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                // Fetch Applicant
                const applicantData = await apiFetch(`/api/applicants/${id}/`);
                if (!mounted) return;
                setApplicant(applicantData);

                // Fetch Applications
                try {
                    const appsData = await apiFetch(`/api/applications/?applicant=${id}`);
                    if (mounted) setApplications(Array.isArray(appsData) ? appsData : appsData.results ?? []);
                } catch (e) {
                    console.error("Failed to load applications", e);
                }

                // Fetch Calls
                try {
                    const callsData = await apiFetch(`/api/calls/?applicant_id=${id}`);
                    if (mounted) setCalls(Array.isArray(callsData) ? callsData : callsData.results ?? []);
                } catch (e) {
                    console.error("Failed to load calls", e);
                }

                // Fetch Activities
                try {
                    const activitiesData = await apiFetch(`/api/applicants/${id}/activity/`);
                    if (mounted) setActivities(Array.isArray(activitiesData) ? activitiesData : []);
                } catch (e) {
                    console.error("Failed to load activities", e);
                }

            } catch (err: any) {
                console.error(err);
                if (mounted) setError(err.message ?? "Failed to load applicant");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => {
            mounted = false;
        };
    }, [id]);

    // Fetch Tasks when Follow Ups tab is active
    useEffect(() => {
        if (activeTab === "follow_ups" && id) {
            setTasksLoading(true);
            apiFetch(`/api/tasks/?lead=${id}`)
                .then(data => {
                    setTasks(Array.isArray(data) ? data : data.results || []);
                })
                .catch(err => console.error("Failed to load tasks", err))
                .finally(() => setTasksLoading(false));
        }
    }, [activeTab, id]);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--cy-lime)]"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !applicant) {
        return (
            <DashboardLayout>
                <div className="p-6 text-red-600 bg-red-50 rounded-xl border border-red-100">
                    Error: {error || "Applicant not found"}
                </div>
            </DashboardLayout>
        );
    }

    const applicantMeta = applicant.metadata || {};

    // Sidebar Data
    const sidebarData = [
        { label: "Email Id", value: applicant.email || "N/A" },
        { label: "Mobile No", value: applicant.phone || "N/A" },
        { label: "Gender", value: applicantMeta.gender || "N/A" },
        { label: "Document Complete", value: applicant.documents && applicant.documents.length > 0 ? "YES" : "NO" },
    ];

    const handleStageChange = async (newStage: string) => {
        if (!applicant) return;
        try {
            await apiFetch(`/api/applicants/${applicant.id}/`, {
                method: "PATCH",
                body: JSON.stringify({ stage: newStage }),
            });
            setApplicant({ ...applicant, stage: newStage });
            fetchActivities();
        } catch (err: any) {
            alert("Failed to update stage: " + err.message);
        }
    };

    const handleDeleteDocument = async (docId: number) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        try {
            await apiFetch(`/api/documents/${docId}/`, { method: "DELETE" });
            setApplicant((prev) => {
                if (!prev) return null;
                return {
                    ...prev,
                    documents: prev.documents?.filter((d: any) => d.id !== docId) || []
                };
            });
            fetchActivities();
            alert("Document deleted successfully.");
        } catch (err: any) {
            alert("Failed to delete document: " + err.message);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentType: string = "other") => {
        if (!e.target.files || e.target.files.length === 0 || !applicant) return;
        const file = e.target.files[0];

        // Client-side Validation
        const MAX_SIZE = 10 * 1024 * 1024; // 10MB
        const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

        if (file.size > MAX_SIZE) {
            alert("File is too large. Max 10MB allowed.");
            return;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            alert("Unsupported file type. Allowed: PDF, JPG, PNG, DOC, DOCX.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("applicant", applicant.id.toString());
        formData.append("document_type", documentType);
        formData.append("status", "pending");

        // Add metadata for English Test
        if (documentType === "english_test") {
            const testName = selectedEnglishTest === "Other" ? customEnglishTest : selectedEnglishTest;
            formData.append("notes", `Test Type: ${testName}`); // Storing in notes for simplicity, or could use extraction_data
        }

        setUploading(true);
        try {
            const token = localStorage.getItem("accessToken");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.cybriksolutions.com'}/api/documents/`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(JSON.stringify(errData));
            }

            const newDoc = await res.json();
            setApplicant({
                ...applicant,
                documents: [newDoc, ...(applicant.documents || [])]
            });
            fetchActivities();
            alert("Document uploaded successfully!");
        } catch (err: any) {
            alert("Failed to upload document: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleScanMatch = async (docId: number) => {
        if (!applicant) return;
        setScanningDocId(docId);
        try {
            const result = await apiFetch(`/api/ai/documents/${docId}/scan-match/`, {
                method: "POST"
            });
            setScanResult(result);
            setShowScanResultModal(true);

            // Reload applicant to update status
            const applicantData = await apiFetch(`/api/applicants/${applicant.id}/`);
            setApplicant(applicantData);
        } catch (err: any) {
            alert("Scan failed: " + err.message);
        } finally {
            setScanningDocId(null);
        }
    };

    const handleGenerateFollowUps = async () => {
        if (!applicant) return;
        setTasksLoading(true);
        try {
            const res = await apiFetch(`/api/applicants/${applicant.id}/generate-follow-ups/`, {
                method: "POST"
            });
            alert(`Analysis complete! ${res.tasks_created} new tasks created.`);

            // Reload tasks
            const tasksData = await apiFetch(`/api/tasks/?lead=${applicant.id}`);
            setTasks(Array.isArray(tasksData) ? tasksData : tasksData.results || []);
            fetchActivities();

        } catch (err: any) {
            console.error(err);
            alert("Failed to generate follow-ups: " + (err.message || "Unknown error"));
        } finally {
            setTasksLoading(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!applicant) return;
        setTaskCreating(true);
        try {
            const payload = {
                lead: applicant.id, // Assuming 'lead' is the field for applicant relation on FollowUp/Task model
                notes: taskForm.notes,
                due_at: taskForm.due_at ? new Date(taskForm.due_at).toISOString() : null,
                priority: taskForm.priority,
                status: "pending",
                channel: taskForm.channel
            };

            const newTask = await apiFetch(`/api/tasks/`, {
                method: "POST",
                body: JSON.stringify(payload),
            });

            setTasks([newTask, ...tasks]);
            setShowTaskModal(false);
            setTaskForm({ notes: "", due_at: "", priority: "medium", channel: "other" });
            fetchActivities();
            alert("Task created successfully!");
        } catch (err: any) {
            alert("Failed to create task: " + err.message);
        } finally {
            setTaskCreating(false);
        }
    };

    const handleToggleTask = async (taskId: number, currentStatus: boolean) => {
        try {
            const updatedTask = await apiFetch(`/api/tasks/${taskId}/`, {
                method: "PATCH",
                body: JSON.stringify({ completed: !currentStatus }),
            });

            setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
            fetchActivities();
        } catch (err: any) {
            alert("Failed to update task: " + err.message);
        }
    };

    const handleDeleteTask = async (taskId: number) => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await apiFetch(`/api/tasks/${taskId}/`, { method: "DELETE" });
            setTasks(tasks.filter(t => t.id !== taskId));
            fetchActivities();
        } catch (err: any) {
            alert("Failed to delete task: " + err.message);
        }
    };

    const handleEditTask = async (taskId: number, updates: any) => {
        try {
            const updatedTask = await apiFetch(`/api/tasks/${taskId}/`, {
                method: "PATCH",
                body: JSON.stringify(updates),
            });
            setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
            fetchActivities();
            return true;
        } catch (err: any) {
            alert("Failed to update task: " + err.message);
            return false;
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case "personal":
                return (
                    <div className="bg-white rounded-xl border border-[var(--cy-border)] p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6 border-b border-[var(--cy-border)] pb-2">
                            <h3 className="text-lg font-bold text-[var(--cy-navy)]">Personal Details</h3>
                            <button className="btn btn-sm btn-outline" onClick={() => router.push(`/applicants/${id}/edit`)}>Edit Profile</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { label: "Full Name", value: `${applicant.first_name} ${applicant.last_name || ""}`.trim() },
                                { label: "Email", value: applicant.email },
                                { label: "Phone", value: applicant.phone || "N/A" },
                                { label: "Date of Birth", value: applicant.dob ? new Date(applicant.dob).toLocaleDateString() : "N/A" },
                                { label: "Passport Number", value: applicant.passport_number || "N/A" },
                                { label: "Stage", value: applicant.stage || "New" },
                                { label: "Joined", value: new Date(applicant.created_at).toLocaleDateString() },
                                { label: "Address", value: applicant.address || "Not available" },
                                { label: "Preferred Country", value: applicant.preferred_country || "Not specified" },
                            ].map((item, idx) => (
                                <div key={idx} className="flex flex-col">
                                    <span className="text-xs font-medium text-[var(--cy-text-muted)] uppercase tracking-wider mb-1">{item.label}</span>
                                    <span className="text-[var(--cy-navy)] font-medium text-base border-b border-dashed border-[var(--cy-border)] pb-1">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case "follow_ups":
                return (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-bold text-[var(--cy-navy)]">Follow Up Tasks</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleGenerateFollowUps}
                                    disabled={tasksLoading}
                                    className="btn btn-sm btn-outline gap-2"
                                >
                                    {tasksLoading ? <span className="loading loading-spinner loading-xs"></span> : "✨ Generate AI Follow-ups"}
                                </button>
                                <button
                                    onClick={() => setShowTaskModal(true)}
                                    className="btn btn-sm btn-outline text-[var(--cy-navy)] hover:bg-[var(--cy-navy)] hover:text-white transition-colors"
                                >
                                    + Add Task
                                </button>
                            </div>
                        </div>
                        {tasksLoading ? (
                            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--cy-lime)]"></div></div>
                        ) : (!tasks || tasks.length === 0) ? (
                            <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-[var(--cy-text-muted)] italic">No follow-up tasks found for this applicant.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {tasks.map((task) => {
                                    const isOverdue = !task.completed && task.due_at && new Date(task.due_at) < new Date();
                                    const status = task.completed ? 'completed' : isOverdue ? 'overdue' : 'pending';

                                    return (
                                        <div key={task.id} className={`p-4 bg-white rounded-xl border transition-all flex justify-between items-center ${status === 'completed' ? 'border-green-200 bg-green-50/30' :
                                            status === 'overdue' ? 'border-red-200 bg-red-50/30' :
                                                'border-[var(--cy-border)] hover:shadow-md'
                                            }`}>
                                            <div className="flex items-start gap-4">
                                                <div className="pt-1">
                                                    <input
                                                        type="checkbox"
                                                        className={`checkbox checkbox-sm ${status === 'overdue' ? 'checkbox-error' : 'checkbox-success'}`}
                                                        checked={task.completed}
                                                        onChange={() => handleToggleTask(task.id, task.completed)}
                                                    />
                                                </div>
                                                <div>
                                                    <div className={`font-bold text-[var(--cy-navy)] flex items-center gap-2 ${task.completed ? 'line-through opacity-60' : ''}`}>
                                                        {task.notes || "No notes"}
                                                        {task.metadata?.verified_by_ai && (
                                                            <span className="badge badge-xs badge-info gap-1" title={task.metadata.verification_evidence}>
                                                                🤖 AI Verified
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-[var(--cy-text-muted)] mt-1 flex items-center gap-3">
                                                        <span className="flex items-center gap-1">
                                                            {task.channel === 'email' ? '✉️' : task.channel === 'phone' ? '📞' : '📅'}
                                                            {task.channel}
                                                        </span>
                                                        {task.due_at && (
                                                            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : ''}`}>
                                                                🕒 {new Date(task.due_at).toLocaleString()}
                                                                {isOverdue && " (Overdue)"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        const newNotes = prompt('Edit task notes:', task.notes || '');
                                                        if (newNotes !== null && newNotes !== task.notes) {
                                                            handleEditTask(task.id, { notes: newNotes });
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTask(task.id)}
                                                    className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                                <span className={`badge ${status === 'completed' ? 'badge-success text-white' :
                                                    status === 'overdue' ? 'badge-error text-white' :
                                                        'badge-ghost'
                                                    }`}>
                                                    {status.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            case "education":
                // Helper to categorize records
                const schoolingKeywords = ["10th", "12th", "ssc", "hsc", "high school", "secondary", "matriculation"];
                const schooling = applicant.academic_records.filter((r: any) =>
                    schoolingKeywords.some(k => r.degree?.toLowerCase().includes(k))
                ).sort((a: any, b: any) => (b.end_year || b.year_of_completion) - (a.end_year || a.year_of_completion));

                const higherEd = applicant.academic_records.filter((r: any) =>
                    !schoolingKeywords.some(k => r.degree?.toLowerCase().includes(k))
                ).sort((a: any, b: any) => (b.end_year || b.year_of_completion) - (a.end_year || a.year_of_completion));

                const calculateGap = (nextRecord: any, previousRecord: any) => {
                    const nextStart = nextRecord.start_year || nextRecord.year_of_completion;
                    const previousEnd = previousRecord.end_year || previousRecord.year_of_completion;
                    if (!nextStart || !previousEnd) return 0;
                    const gap = nextStart - previousEnd;
                    return gap > 0 ? gap : 0;
                };

                const twelfthRecord = schooling.find((r: any) => r.degree?.toLowerCase().includes('12th'));
                const firstHigherEd = higherEd.length > 0 ? higherEd[higherEd.length - 1] : null;
                const gapAfter12th = twelfthRecord && firstHigherEd ? calculateGap(firstHigherEd, twelfthRecord) : 0;

                return (
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-[#0B1F3A]">Academic History</h3>
                            <button
                                onClick={() => {
                                    setEditingRecord(null);
                                    setEduForm({
                                        institution: "",
                                        degree: "10th",
                                        customDegree: "",
                                        start_year: new Date().getFullYear() - 2,
                                        end_year: new Date().getFullYear(),
                                        year_of_completion: new Date().getFullYear(),
                                        grade: "",
                                    });
                                    setShowEducationModal(true);
                                }}
                                className="px-4 py-2 bg-[#6FB63A] text-white text-sm font-medium rounded-lg hover:bg-[#5a9e2e] transition-colors"
                            >
                                + Add Education
                            </button>
                        </div>

                        {/* Timeline Gaps */}
                        {(gapAfter12th > 0 || higherEd.some((r: any, i: number) => i < higherEd.length - 1 && calculateGap(r, higherEd[i + 1]) > 0)) && (
                            <div className="border border-[#0B1F3A]/10 rounded-lg overflow-hidden">
                                <div className="px-4 py-2 bg-[#0B1F3A] text-white text-xs font-medium uppercase tracking-wide">
                                    Timeline Gaps
                                </div>
                                <div className="divide-y divide-[#0B1F3A]/10">
                                    {gapAfter12th > 0 && twelfthRecord && firstHigherEd && (
                                        <div className="px-4 py-3 flex items-center justify-between">
                                            <span className="text-sm text-[#0B1F3A]">After 12th Grade</span>
                                            <span className="text-sm font-medium text-[#0B1F3A]">{gapAfter12th} year ({twelfthRecord.end_year || twelfthRecord.year_of_completion} → {firstHigherEd.start_year || firstHigherEd.year_of_completion})</span>
                                        </div>
                                    )}
                                    {higherEd.map((record: any, i: number) => {
                                        if (i >= higherEd.length - 1) return null;
                                        const gap = calculateGap(record, higherEd[i + 1]);
                                        if (gap <= 0) return null;
                                        return (
                                            <div key={`gap-${i}`} className="px-4 py-3 flex items-center justify-between">
                                                <span className="text-sm text-[#0B1F3A]">{higherEd[i + 1].degree} → {record.degree}</span>
                                                <span className="text-sm font-medium text-[#0B1F3A]">{gap} year</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {(!applicant.academic_records || applicant.academic_records.length === 0) ? (
                            <div className="p-8 text-center border border-dashed border-[#0B1F3A]/20 rounded-lg">
                                <p className="text-[#0B1F3A]/60">No academic records yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Higher Education */}
                                <div>
                                    <h4 className="text-sm font-semibold text-[#0B1F3A]/60 uppercase tracking-wide mb-4">Higher Education</h4>
                                    {higherEd.length > 0 ? (
                                        <div className="space-y-3">
                                            {higherEd.map((record: any, i: number) => (
                                                <div key={i} className="p-4 bg-white border border-[#0B1F3A]/10 rounded-lg hover:border-[#6FB63A]/50 transition-colors group">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-semibold text-[#0B1F3A]">{record.degree}</div>
                                                            <div className="text-sm text-[#0B1F3A]/60">{record.institution}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-medium text-[#0B1F3A]/60">
                                                                {record.start_year && record.end_year ? `${record.start_year} - ${record.end_year}` : record.year_of_completion}
                                                            </div>
                                                            <div className="text-lg font-bold text-[#6FB63A]">{record.grade}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 mt-3 pt-3 border-t border-[#0B1F3A]/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); handleEditEducation(record); }} className="text-xs text-[#0B1F3A]/60 hover:text-[#0B1F3A]">Edit</button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteEducation(record.id); }} className="text-xs text-[#0B1F3A]/60 hover:text-[#0B1F3A]">Delete</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[#0B1F3A]/40">No records</p>
                                    )}
                                </div>

                                {/* Schooling */}
                                <div>
                                    <h4 className="text-sm font-semibold text-[#0B1F3A]/60 uppercase tracking-wide mb-4">Schooling</h4>
                                    {schooling.length > 0 ? (
                                        <div className="space-y-3">
                                            {schooling.map((record: any, i: number) => (
                                                <div key={i} className="p-4 bg-white border border-[#0B1F3A]/10 rounded-lg hover:border-[#6FB63A]/50 transition-colors group">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-semibold text-[#0B1F3A]">{record.degree}</div>
                                                            <div className="text-sm text-[#0B1F3A]/60">{record.institution}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-medium text-[#0B1F3A]/60">
                                                                {record.start_year && record.end_year ? `${record.start_year} - ${record.end_year}` : record.year_of_completion}
                                                            </div>
                                                            <div className="text-lg font-bold text-[#6FB63A]">{record.grade}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 mt-3 pt-3 border-t border-[#0B1F3A]/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); handleEditEducation(record); }} className="text-xs text-[#0B1F3A]/60 hover:text-[#0B1F3A]">Edit</button>
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteEducation(record.id); }} className="text-xs text-[#0B1F3A]/60 hover:text-[#0B1F3A]">Delete</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[#0B1F3A]/40">No records</p>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                );
            case "applications":
                return (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-bold text-[var(--cy-navy)]">Applications</h3>
                            <button className="btn btn-sm btn-primary" onClick={() => router.push(`/applications/new?applicantId=${id}`)}>+ New Application</button>
                        </div>
                        {applications.length === 0 ? (
                            <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-[var(--cy-text-muted)] italic">No applications found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {applications.map((app: any) => (
                                    <div key={app.id} onClick={() => router.push(`/applications/${app.id}`)} className="cursor-pointer p-5 bg-white rounded-xl border border-[var(--cy-border)] hover:border-[var(--cy-navy)] hover:shadow-md transition-all group">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-[var(--cy-navy)] text-lg">{app.program || `Application #${app.id}`}</div>
                                                <div className="text-xs text-[var(--cy-text-muted)] mt-1">Created: {new Date(app.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <span className={`badge ${app.status === 'accepted' ? 'badge-success' : app.status === 'rejected' ? 'badge-error' : 'badge-warning'}`}>
                                                {app.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case "documents":
                const docSections = [
                    { id: "10th_marksheet", title: "10th Marksheet" },
                    { id: "12th_marksheet", title: "12th Marksheet" },
                    { id: "degree_certificate", title: "Degree/Diploma" },
                    { id: "passport", title: "Passport" },
                    { id: "english_test", title: "English Test" },
                    { id: "other", title: "Other Documents" }
                ];

                const getDocsByType = (type: string) => {
                    return applicant?.documents?.filter((d: any) => d.document_type === type) || [];
                };

                return (
                    <div className="space-y-8">
                        {docSections.map((section) => {
                            const sectionDocs = getDocsByType(section.id);
                            return (
                                <div key={section.id} className="space-y-4">
                                    <div className="flex justify-between items-center border-b border-[var(--cy-border)] pb-2">
                                        <h3 className="text-lg font-bold text-[var(--cy-navy)]">{section.title}</h3>
                                        <div className="relative flex items-center gap-2">
                                            {section.id === "english_test" && (
                                                <div className="flex items-center gap-2">
                                                    {/* Custom English Test Dropdown */}
                                                    <div className="relative">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowEnglishTestDropdown(!showEnglishTestDropdown)}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--cy-border)] bg-white hover:bg-gray-50 transition-all ${englishTestConfig[selectedEnglishTest]?.color || "text-gray-700"}`}
                                                        >
                                                            <span className={`w-2 h-2 rounded-full ${selectedEnglishTest === "IELTS" ? "bg-red-500" : selectedEnglishTest === "PTE" ? "bg-purple-500" : selectedEnglishTest === "Duolingo" ? "bg-green-500" : selectedEnglishTest === "TOEFL" ? "bg-blue-500" : "bg-gray-500"}`}></span>
                                                            <span className="font-medium text-sm">{selectedEnglishTest}</span>
                                                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showEnglishTestDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>

                                                        {showEnglishTestDropdown && (
                                                            <>
                                                                <div className="fixed inset-0 z-40" onClick={() => setShowEnglishTestDropdown(false)} />
                                                                <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-[var(--cy-border)] rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                                                    <div className="py-1">
                                                                        {Object.entries(englishTestConfig).map(([key, config]) => (
                                                                            <button
                                                                                key={key}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setSelectedEnglishTest(key);
                                                                                    setShowEnglishTestDropdown(false);
                                                                                }}
                                                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${selectedEnglishTest === key
                                                                                    ? `${config.bgColor} ${config.color} font-medium`
                                                                                    : "text-gray-700 hover:bg-gray-50"
                                                                                    }`}
                                                                            >
                                                                                <span className={`w-2.5 h-2.5 rounded-full ${key === "IELTS" ? "bg-red-500" : key === "PTE" ? "bg-purple-500" : key === "Duolingo" ? "bg-green-500" : key === "TOEFL" ? "bg-blue-500" : "bg-gray-400"}`}></span>
                                                                                <span className="text-sm">{config.label}</span>
                                                                                {selectedEnglishTest === key && (
                                                                                    <svg className="w-4 h-4 ml-auto text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                    </svg>
                                                                                )}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    {selectedEnglishTest === "Other" && (
                                                        <input
                                                            type="text"
                                                            placeholder="Specify test..."
                                                            className="input input-bordered input-sm w-28 text-sm"
                                                            value={customEnglishTest}
                                                            onChange={(e) => setCustomEnglishTest(e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    onChange={(e) => handleFileUpload(e, section.id)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    disabled={uploading}
                                                />
                                                <button className="btn btn-xs btn-outline gap-2" disabled={uploading}>
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                    Upload
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {sectionDocs.length === 0 ? (
                                        <div className="p-6 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            <p className="text-xs text-[var(--cy-text-muted)] italic">No {section.title} uploaded.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {sectionDocs.map((doc: any) => (
                                                <div key={doc.id} className="group relative bg-white border border-[var(--cy-border)] rounded-xl p-4 hover:border-[var(--cy-navy)] hover:shadow-md transition-all">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="p-2 bg-[var(--cy-bg-surface)] rounded-lg text-[var(--cy-navy)]">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <span className={`badge badge-xs ${doc.status === 'verified' ? 'badge-success' : 'badge-warning'}`}>
                                                                {doc.status}
                                                            </span>
                                                            <button
                                                                onClick={() => handleDeleteDocument(doc.id)}
                                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                                                title="Delete Document"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <h4 className="font-bold text-sm text-[var(--cy-navy)] mb-1 truncate" title={doc.file.split('/').pop()}>
                                                        {doc.file.split('/').pop()}
                                                    </h4>
                                                    <p className="text-[10px] text-[var(--cy-text-muted)] mb-3">
                                                        {new Date(doc.created_at).toLocaleDateString()}
                                                    </p>
                                                    <a
                                                        href={doc.file}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-xs btn-outline w-full mb-1"
                                                    >
                                                        View
                                                    </a>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleScanMatch(doc.id); }}
                                                        disabled={scanningDocId === doc.id}
                                                        className={`btn btn-xs w-full ${doc.status === 'verified' ? 'btn-ghost text-green-600' : 'btn-primary'}`}
                                                    >
                                                        {scanningDocId === doc.id ? (
                                                            <span className="loading loading-spinner loading-xs"></span>
                                                        ) : (
                                                            <>
                                                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                Scan & Verify
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            case "transcripts":
                const normalizePhone = (p: string) => p?.replace(/\D/g, '') || '';
                const applicantPhone = normalizePhone(applicant?.phone || '');

                const filteredCalls = calls.filter(call => {
                    // If no applicant phone, show all
                    if (!applicantPhone) return true;

                    // Check call metadata for phone
                    const meta = call.metadata || {};
                    const callPhone = normalizePhone(
                        meta.phone_number ||
                        meta.customer_phone ||
                        meta.phone ||
                        meta.to ||
                        meta.from ||
                        ''
                    );

                    // If call has no phone, maybe show it? Or hide? 
                    // User said "only call with same caller_id".
                    // Let's be strict but allow if callPhone is empty (maybe manual link).
                    if (!callPhone) return true;

                    return callPhone.includes(applicantPhone) || applicantPhone.includes(callPhone);
                });

                return (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-[var(--cy-navy)]">Call Transcripts</h3>
                            <div className="text-xs text-[var(--cy-text-muted)]">
                                Showing {filteredCalls.length} calls matching {applicant?.phone}
                            </div>
                        </div>

                        {filteredCalls.length === 0 ? (
                            <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-[var(--cy-text-muted)] italic">No matching transcripts found.</p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {filteredCalls.map((call: any) => {
                                    const transcriptText = call.transcripts?.[0]?.transcript_text || call.metadata?.transcript;
                                    return (
                                        <div key={call.id} className="bg-white rounded-xl border border-[var(--cy-border)] shadow-sm overflow-hidden">
                                            {/* Header */}
                                            <div className="bg-gray-50 px-6 py-4 border-b border-[var(--cy-border)] flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-full ${call.direction === 'inbound' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        {call.direction === 'inbound' ? '↙️' : '↗️'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-[var(--cy-navy)]">
                                                            {call.direction === 'inbound' ? 'Inbound Call' : 'Outbound Call'}
                                                        </div>
                                                        <div className="text-xs text-[var(--cy-text-muted)] flex gap-2">
                                                            <span>{new Date(call.created_at).toLocaleString()}</span>
                                                            <span>•</span>
                                                            <span>{call.duration_seconds}s</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    {call.recording_url && (
                                                        <a href={call.recording_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline gap-2">
                                                            ▶️ Listen
                                                        </a>
                                                    )}
                                                    <span className={`badge ${call.status === 'completed' ? 'badge-success' : 'badge-ghost'}`}>
                                                        {call.status}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Transcript Body */}
                                            <div className="p-6 bg-white">
                                                {call.transcripts && call.transcripts.length > 0 ? (
                                                    <div className="space-y-4">
                                                        {call.transcripts.map((t: any, idx: number) => {
                                                            const isAgent = t.metadata?.role === 'agent' || t.metadata?.role === 'assistant';
                                                            return (
                                                                <div key={idx} className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
                                                                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${isAgent
                                                                        ? 'bg-gray-100 text-gray-800 rounded-tl-none'
                                                                        : 'bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-tr-none'
                                                                        }`}>
                                                                        <div className="font-bold text-xs mb-1 opacity-70">
                                                                            {isAgent ? 'AI Agent' : 'Student'}
                                                                        </div>
                                                                        <div className="whitespace-pre-wrap">{t.transcript_text}</div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : call.metadata?.transcript ? (
                                                    <div className="prose prose-sm max-w-none text-[var(--cy-navy)] font-mono text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-inner">
                                                        {call.metadata.transcript}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-8 text-[var(--cy-text-muted)] italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                        No transcript text available.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            case "activity":
                return (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-[var(--cy-navy)] mb-2">Activity Log</h3>
                        {activities.length === 0 && calls.length === 0 ? (
                            <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-[var(--cy-text-muted)] italic">No activity recorded.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Combine and sort activities and calls if needed, or just list them. 
                                    For now, let's show Audit Logs first, then Calls. 
                                    Ideally, we should merge and sort by date. */}

                                {activities.map((log: any) => (
                                    <div key={`log-${log.id}`} className="p-4 bg-white rounded-xl border border-[var(--cy-border)] flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-[var(--cy-navy)] text-sm">{log.action} {log.target_type}</div>
                                            {log.data && log.data.changes ? (
                                                <div className="mt-1 text-xs text-[var(--cy-text-muted)] bg-gray-50 p-2 rounded border border-gray-100">
                                                    {Object.entries(log.data.changes).map(([field, diff]: any) => (
                                                        <div key={field} className="flex gap-1 items-center">
                                                            <span className="font-semibold capitalize">{field.replace('_', ' ')}:</span>
                                                            <span className="text-red-400 line-through opacity-70">{diff.from && diff.from !== 'None' ? diff.from : 'Empty'}</span>
                                                            <span className="text-gray-400">→</span>
                                                            <span className="text-green-600 font-medium">{diff.to && diff.to !== 'None' ? diff.to : 'Empty'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-[var(--cy-text-muted)]">
                                                    {log.data && Object.entries(log.data).map(([k, v]) => (
                                                        <span key={k} className="mr-2">{k}: {String(v)}</span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="text-xs text-[var(--cy-text-muted)] mt-1">{new Date(log.created_at).toLocaleString()}</div>
                                        </div>
                                        <div className="badge badge-ghost text-xs">{log.actor || 'System'}</div>
                                    </div>
                                ))}

                                {calls.map((call: any) => (
                                    <div key={`call-${call.id}`} className="p-4 bg-white rounded-xl border border-[var(--cy-border)] flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-[var(--cy-navy)] uppercase text-sm">{call.direction} Call</div>
                                            <div className="text-xs text-[var(--cy-text-muted)]">{new Date(call.created_at).toLocaleString()}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`badge ${call.status === 'completed' ? 'badge-success' : 'badge-neutral'}`}>{call.status}</span>
                                            {call.recording_url && (
                                                <a href={call.recording_url} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-outline">
                                                    Listen
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Breadcrumb / Back Link */}
                <div className="mb-6 flex justify-between items-center">
                    <Link href="/applicants" className="text-sm text-[var(--cy-text-muted)] hover:text-[var(--cy-navy)] flex items-center gap-1 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Applicants
                    </Link>
                    <div className="flex gap-2">
                        <button
                            onClick={() => router.push(`/applications/new?applicantId=${id}`)}
                            className="btn btn-sm btn-primary"
                        >
                            + New Application
                        </button>
                        <button
                            onClick={async () => {
                                if (!confirm("Are you sure you want to delete this applicant?")) return;
                                try {
                                    await apiFetch(`/api/applicants/${id}/`, { method: "DELETE" });
                                    router.push("/applicants");
                                } catch (err: any) {
                                    alert("Failed to delete: " + err.message);
                                }
                            }}
                            className="btn btn-sm btn-outline text-red-600 hover:bg-red-50 border-red-200"
                        >
                            Delete
                        </button>
                    </div>
                </div>

                {/* Summary Card - Restoring the "Precise" Layout */}
                <div className="bg-white rounded-2xl overflow-visible border border-[var(--cy-border)] shadow-lg shadow-gray-100/50 mb-8">
                    <div className="bg-gradient-to-r from-[var(--cy-navy)] to-[#1a2b4b] p-8 text-white relative overflow-visible">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>

                        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                            {/* Avatar */}
                            <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm border-4 border-white/20 shadow-xl overflow-hidden flex items-center justify-center shrink-0">
                                <span className="text-4xl font-bold text-white">
                                    {applicant.first_name.charAt(0).toUpperCase()}
                                </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 text-center md:text-left">
                                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2">
                                    <h1 className="text-3xl font-bold">{applicant.first_name} {applicant.last_name}</h1>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-white/20 ${applicant.stage === 'verified' ? 'bg-green-500/20 text-green-100' : 'bg-white/10 text-white'}`}>
                                        {applicant.stage || "New Lead"}
                                    </span>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4 text-white/70 text-sm mb-4">
                                    <div className="flex items-center gap-2 justify-center md:justify-start">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        {applicant.email}
                                    </div>
                                    <div className="flex items-center gap-2 justify-center md:justify-start">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                        {applicant.phone || "N/A"}
                                    </div>
                                    <div className="flex items-center gap-2 justify-center md:justify-start">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        Joined {new Date(applicant.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                {/* Custom Stage Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowStageDropdown(!showStageDropdown)}
                                        className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-white/30 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/40 ${stageConfig[applicant.stage || "new"]?.bgColor || "bg-white/10"}`}
                                    >
                                        {/* Stage Icon */}
                                        <span className={`flex items-center justify-center w-5 h-5 rounded-full ${stageConfig[applicant.stage || "new"]?.bgColor} ${stageConfig[applicant.stage || "new"]?.color}`}>
                                            {stageConfig[applicant.stage || "new"]?.icon === "sparkles" && (
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>
                                            )}
                                            {stageConfig[applicant.stage || "new"]?.icon === "clock" && (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            )}
                                            {stageConfig[applicant.stage || "new"]?.icon === "check" && (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                            )}
                                            {stageConfig[applicant.stage || "new"]?.icon === "x" && (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                            )}
                                        </span>

                                        {/* Stage Label */}
                                        <span className="text-white font-semibold text-sm whitespace-nowrap">
                                            {stageConfig[applicant.stage || "new"]?.label || "New"}
                                        </span>

                                        {/* Chevron */}
                                        <svg className={`w-3.5 h-3.5 text-white/70 transition-transform ${showStageDropdown ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {showStageDropdown && (
                                        <>
                                            {/* Backdrop to close dropdown */}
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setShowStageDropdown(false)}
                                            />

                                            <div
                                                className="absolute top-full left-0 mt-2 w-56 rounded-xl shadow-2xl overflow-hidden z-50"
                                                style={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                                            >
                                                <div className="p-2">
                                                    <div className="text-xs font-bold uppercase tracking-wider px-3 py-2" style={{ color: '#94a3b8' }}>
                                                        Change Stage
                                                    </div>

                                                    {Object.entries(stageConfig).map(([key, config]) => (
                                                        <button
                                                            key={key}
                                                            onClick={() => {
                                                                handleStageChange(key);
                                                                setShowStageDropdown(false);
                                                            }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${applicant.stage === key
                                                                ? `${config.bgColor} ${config.color}`
                                                                : ""
                                                                }`}
                                                            style={applicant.stage !== key ? { color: '#cbd5e1' } : {}}
                                                        >
                                                            {/* Icon */}
                                                            <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${config.bgColor} ${config.color}`}>
                                                                {config.icon === "sparkles" && (
                                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>
                                                                )}
                                                                {config.icon === "clock" && (
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                )}
                                                                {config.icon === "check" && (
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                                )}
                                                                {config.icon === "x" && (
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                )}
                                                            </span>

                                                            {/* Label */}
                                                            <div className="flex-1 text-left">
                                                                <div className="font-medium text-sm">{config.label}</div>
                                                            </div>

                                                            {/* Check mark for selected */}
                                                            {applicant.stage === key && (
                                                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="hidden md:flex gap-8 border-l border-white/10 pl-8">
                                <div className="text-center">
                                    <div className="text-3xl font-bold">{applications.length}</div>
                                    <div className="text-xs uppercase tracking-wider text-white/60">Applications</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold">{applicant.documents?.length || 0}</div>
                                    <div className="text-xs uppercase tracking-wider text-white/60">Documents</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="flex flex-wrap gap-2 mb-6 border-b border-[var(--cy-border)] pb-1">
                    {[
                        { id: "personal", label: "Profile", icon: "👤" },
                        { id: "follow_ups", label: "Follow Ups", icon: "📅" },
                        { id: "applications", label: "Applications", icon: "🚀" },
                        { id: "education", label: "Education", icon: "🎓" },
                        { id: "documents", label: "Documents", icon: "📄" },
                        { id: "transcripts", label: "Transcripts", icon: "📝" },
                        { id: "activity", label: "Activity", icon: "📞" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all rounded-t-lg relative ${activeTab === tab.id
                                ? "text-[var(--cy-navy)]"
                                : "text-[var(--cy-text-muted)] hover:text-[var(--cy-navy)] hover:bg-gray-50"
                                }`}
                        >
                            <span>{tab.icon}</span>
                            {tab.label}
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--cy-navy)] rounded-t-full"></span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab Content Container */}
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {renderTabContent()}
                </div>
            </div>
            {/* Education Modal */}
            {showEducationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-[var(--cy-border)] flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-[var(--cy-navy)]">Add Education</h3>
                            <button onClick={() => setShowEducationModal(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddEducation} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--cy-navy)] mb-1">Level / Degree</label>
                                <select
                                    className="select select-bordered w-full"
                                    value={eduForm.degree}
                                    onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
                                >
                                    <option value="10th">10th / Matriculation</option>
                                    <option value="12th">12th / Intermediate</option>
                                    <option value="Diploma">Diploma</option>
                                    <option value="Bachelors">Bachelor's Degree</option>
                                    <option value="Masters">Master's Degree</option>
                                    <option value="PhD">PhD / Doctorate</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            {eduForm.degree === "Other" && (
                                <div>
                                    <label className="block text-sm font-medium text-[var(--cy-navy)] mb-1">Specify Degree</label>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full"
                                        placeholder="e.g. Certification"
                                        value={eduForm.customDegree}
                                        onChange={(e) => setEduForm({ ...eduForm, customDegree: e.target.value })}
                                        required
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-[var(--cy-navy)] mb-1">Institution / School</label>
                                <input
                                    type="text"
                                    className="input input-bordered w-full"
                                    placeholder="e.g. Harvard University"
                                    value={eduForm.institution}
                                    onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--cy-navy)] mb-1">Start Year</label>
                                    <input
                                        type="number"
                                        className="input input-bordered w-full"
                                        placeholder="YYYY"
                                        value={eduForm.start_year}
                                        onChange={(e) => setEduForm({ ...eduForm, start_year: parseInt(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--cy-navy)] mb-1">End Year</label>
                                    <input
                                        type="number"
                                        className="input input-bordered w-full"
                                        placeholder="YYYY"
                                        value={eduForm.end_year}
                                        onChange={(e) => setEduForm({ ...eduForm, end_year: parseInt(e.target.value) })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--cy-navy)] mb-1">Grade / Score</label>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full"
                                        placeholder="e.g. 85%"
                                        value={eduForm.grade}
                                        onChange={(e) => setEduForm({ ...eduForm, grade: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowEducationModal(false)} className="btn btn-ghost flex-1">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1" disabled={eduLoading}>
                                    {eduLoading ? "Saving..." : "Save Record"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Add Task Modal */}
            {showTaskModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-[var(--cy-border)] flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-[var(--cy-navy)]">Add Follow Up Task</h3>
                            <button onClick={() => setShowTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddTask} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--cy-navy)] mb-1">Task Description</label>
                                <textarea
                                    className="textarea textarea-bordered w-full"
                                    placeholder="e.g. Call to discuss documents"
                                    value={taskForm.notes}
                                    onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--cy-navy)] mb-1">Due Date</label>
                                <input
                                    type="datetime-local"
                                    className="input input-bordered w-full"
                                    value={taskForm.due_at}
                                    onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--cy-navy)] mb-1">Priority</label>
                                <select
                                    className="select select-bordered w-full"
                                    value={taskForm.priority}
                                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--cy-navy)] mb-1">Channel</label>
                                <select
                                    className="select select-bordered w-full"
                                    value={taskForm.channel}
                                    onChange={(e) => setTaskForm({ ...taskForm, channel: e.target.value })}
                                >
                                    <option value="other">Other</option>
                                    <option value="email">Email</option>
                                    <option value="phone">Phone</option>
                                    <option value="sms">SMS</option>
                                    <option value="in_app">In App</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowTaskModal(false)} className="btn btn-ghost flex-1">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1" disabled={taskCreating}>
                                    {taskCreating ? "Creating..." : "Create Task"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Scan Result Modal */}
            {showScanResultModal && scanResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-[var(--cy-border)] flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-[var(--cy-navy)] flex items-center gap-2">
                                <span className="text-xl">🤖</span> AI Verification Result
                            </h3>
                            <button onClick={() => setShowScanResultModal(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className={`alert mb-6 ${scanResult.verification_status === 'valid' ? 'alert-success' : scanResult.verification_status === 'suspicious' || scanResult.verification_status === 'invalid' ? 'alert-error' : 'alert-warning'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <div>
                                    <h3 className="font-bold uppercase">{scanResult.verification_status}</h3>
                                    <div className="text-xs">{scanResult.summary || "Verification complete."}</div>
                                </div>
                            </div>

                            {scanResult.comparison && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-[var(--cy-navy)] border-b pb-2">Data Comparison</h4>
                                    <div className="space-y-2">
                                        {scanResult.comparison.map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                                                <div className="font-medium text-gray-700 w-1/4">{item.field}</div>
                                                <div className="flex-1 px-4 flex flex-col">
                                                    <span className="text-xs text-gray-400 uppercase">Document</span>
                                                    <span className="font-mono text-gray-800">{item.document_value || "-"}</span>
                                                </div>
                                                <div className="flex-1 px-4 flex flex-col border-l border-gray-200">
                                                    <span className="text-xs text-gray-400 uppercase">System</span>
                                                    <span className="font-mono text-gray-800">{item.applicant_value || "-"}</span>
                                                </div>
                                                <div className="w-24 text-right">
                                                    {item.status === 'match' && <span className="badge badge-success badge-sm">Match</span>}
                                                    {item.status === 'mismatch' && <span className="badge badge-error badge-sm">Mismatch</span>}
                                                    {item.status?.includes('missing') && <span className="badge badge-warning badge-sm">Missing</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {scanResult.extracted_data && (
                                <div className="mt-8">
                                    <h4 className="font-bold text-[var(--cy-navy)] border-b pb-2 mb-4">Raw Extracted Data</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {Object.entries(scanResult.extracted_data).map(([key, val]) => (
                                            <div key={key} className="p-2 bg-gray-50 rounded">
                                                <div className="text-xs text-gray-500 uppercase">{key.replace(/_/g, " ")}</div>
                                                <div className="font-medium text-[var(--cy-navy)] text-sm truncate" title={String(val)}>{String(val)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end">
                            <button className="btn btn-primary" onClick={() => setShowScanResultModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}

