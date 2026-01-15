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
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
  created_at?: string;
  external_id?: string;
  status?: string;
  message?: string;
  received_at?: string;
  dob?: string;
  passport_number?: string;
  address?: string;
  preferred_country?: string;
  stage?: string;
  metadata?: any;
  academic_records?: any[];
  documents?: any[];
  applications?: any[];
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
  const [activities, setActivities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fetchingCallId, setFetchingCallId] = useState<string | number | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [uploading, setUploading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Education Modal State
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [eduForm, setEduForm] = useState({
    institution: "",
    degree: "10th",
    customDegree: "",
    start_year: new Date().getFullYear() - 2,
    end_year: new Date().getFullYear(),
    year_of_completion: new Date().getFullYear(),
    grade: "",
  });
  const [eduLoading, setEduLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);

  // Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    notes: "",
    due_at: "",
    priority: "medium",
    channel: "other"
  });
  const [taskCreating, setTaskCreating] = useState(false);

  // Document Upload State
  const [selectedEnglishTest, setSelectedEnglishTest] = useState("IELTS");
  const [customEnglishTest, setCustomEnglishTest] = useState("");
  const [showEnglishTestDropdown, setShowEnglishTestDropdown] = useState(false);
  const [scanningDocId, setScanningDocId] = useState<number | null>(null);

  // Stage configuration
  const stageConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    new: { label: "New", color: "text-blue-400", bgColor: "bg-blue-500/20" },
    docs_pending: { label: "Docs Pending", color: "text-amber-400", bgColor: "bg-amber-500/20" },
    verified: { label: "Verified", color: "text-green-400", bgColor: "bg-green-500/20" },
    rejected: { label: "Rejected", color: "text-red-400", bgColor: "bg-red-500/20" },
  };

  // English Test configuration
  const englishTestConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    IELTS: { label: "IELTS", color: "text-red-600", bgColor: "bg-red-50" },
    PTE: { label: "PTE", color: "text-purple-600", bgColor: "bg-purple-50" },
    Duolingo: { label: "Duolingo", color: "text-green-600", bgColor: "bg-green-50" },
    TOEFL: { label: "TOEFL", color: "text-blue-600", bgColor: "bg-blue-50" },
    Other: { label: "Other", color: "text-gray-600", bgColor: "bg-gray-50" },
  };

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

  const fetchActivities = async () => {
    if (!id) return;
    try {
      const activitiesData = await apiFetch(`/api/leads/${id}/activity/`);
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
        await loadLead();
        if (mounted) {
          await loadCalls();
          await loadTranscripts();
        }
      } catch (err: any) {
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
      apiFetch(`/api/tasks/`)
        .then(data => {
          const allTasks = Array.isArray(data) ? data : data.results || [];
          // Filter tasks that have lead_id in metadata
          const leadTasks = allTasks.filter((t: any) => t.metadata?.lead_id == id);
          setTasks(leadTasks);
        })
        .catch(err => console.error("Failed to load tasks", err))
        .finally(() => setTasksLoading(false));
    }
  }, [activeTab, id]);

  // Fetch Activities when Activity tab is active
  useEffect(() => {
    if (activeTab === "activity" && id) {
      fetchActivities();
    }
  }, [activeTab, id]);

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
      try {
        await apiFetch("/api/ai-calls/sync-elevenlabs/", {
          method: "POST",
          body: JSON.stringify({ hours_back: 48 })
        });
      } catch (syncErr) {
        console.log("Sync all failed, trying direct fetch", syncErr);
      }
      await apiFetch(`/api/calls/${callId}/fetch_data/?sync=true`, { method: "POST" });
      await loadCalls();
      await loadTranscripts();
    } catch (err: any) {
      alert("Failed to fetch data: " + (err.message || "Unknown error"));
    } finally {
      setFetchingCallId(null);
    }
  }

  const handleStageChange = async (newStage: string) => {
    if (!lead) return;
    try {
      await apiFetch(`/api/leads/${lead.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ stage: newStage }),
      });
      setLead({ ...lead, stage: newStage });
    } catch (err: any) {
      alert("Failed to update stage: " + err.message);
    }
  };

  const handleAddEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setEduLoading(true);
    const degreeValue = eduForm.degree === "Other" ? eduForm.customDegree : eduForm.degree;
    try {
      const payload = {
        lead: lead.id,
        institution: eduForm.institution,
        degree: degreeValue,
        start_year: eduForm.start_year,
        end_year: eduForm.end_year,
        year_of_completion: eduForm.year_of_completion,
        grade: eduForm.grade,
      };

      let updatedRecord: any;
      if (editingRecord) {
        updatedRecord = await apiFetch(`/api/academic-records/${editingRecord.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setLead({
          ...lead,
          academic_records: (lead.academic_records || []).map(r => r.id === editingRecord.id ? updatedRecord : r)
        });
        alert("Education record updated successfully!");
      } else {
        updatedRecord = await apiFetch(`/api/academic-records/`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setLead({
          ...lead,
          academic_records: [...(lead.academic_records || []), updatedRecord]
        });
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

  const handleDeleteEducation = async (recordId: number) => {
    if (!confirm("Are you sure you want to delete this education record?")) return;
    if (!lead) return;
    try {
      await apiFetch(`/api/academic-records/${recordId}/`, { method: "DELETE" });
      setLead({
        ...lead,
        academic_records: (lead.academic_records || []).filter((r: any) => r.id !== recordId)
      });
      alert("Education record deleted successfully!");
    } catch (err: any) {
      alert("Failed to delete education record: " + err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentType: string = "other") => {
    if (!e.target.files || e.target.files.length === 0 || !lead) return;
    const file = e.target.files[0];
    const MAX_SIZE = 10 * 1024 * 1024;
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
    formData.append("lead", lead.id.toString());
    formData.append("document_type", documentType);
    formData.append("status", "pending");
    setUploading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.cybriksolutions.com'}/api/documents/`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(JSON.stringify(errData));
      }
      const newDoc = await res.json();
      setLead({
        ...lead,
        documents: [newDoc, ...(lead.documents || [])]
      });
      alert("Document uploaded successfully!");
    } catch (err: any) {
      alert("Failed to upload document: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await apiFetch(`/api/documents/${docId}/`, { method: "DELETE" });
      setLead((prev) => {
        if (!prev) return null;
        return { ...prev, documents: prev.documents?.filter((d: any) => d.id !== docId) || [] };
      });
      alert("Document deleted successfully.");
    } catch (err: any) {
      alert("Failed to delete document: " + err.message);
    }
  };

  const handleGenerateFollowUps = async () => {
    if (!lead) return;
    setTasksLoading(true);
    try {
      const res = await apiFetch(`/api/leads/${lead.id}/generate-follow-ups/`, { method: "POST" });
      alert(`Analysis complete! ${res.tasks_created} new tasks created.`);
      // Reload tasks
      const tasksData = await apiFetch(`/api/tasks/`);
      const allTasks = Array.isArray(tasksData) ? tasksData : tasksData.results || [];
      const leadTasks = allTasks.filter((t: any) => t.metadata?.lead_id == id);
      setTasks(leadTasks);
    } catch (err: any) {
      console.error(err);
      alert("Failed to generate follow-ups: " + (err.message || "Unknown error"));
    } finally {
      setTasksLoading(false);
    }
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

  if (error || !lead) {
    return (
      <DashboardLayout>
        <div className="p-6 text-red-600 bg-red-50 rounded-xl border border-red-100">
          Error: {error || "Lead not found"}
        </div>
      </DashboardLayout>
    );
  }

  const displayName = lead.first_name ? `${lead.first_name} ${lead.last_name || ''}`.trim() : lead.name || "Unknown Lead";
  const currentStage = stageConfig[lead.stage || "new"] || stageConfig.new;

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="bg-white rounded-xl border border-[var(--cy-border)] p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-[var(--cy-border)] pb-2">
              <h3 className="text-lg font-bold text-[var(--cy-navy)]">Personal Details</h3>
              <button className="btn btn-sm btn-outline" onClick={() => setIsEditModalOpen(true)}>Edit Profile</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "Full Name", value: displayName },
                { label: "Email", value: lead.email || "N/A" },
                { label: "Phone", value: lead.phone || "N/A" },
                { label: "Date of Birth", value: lead.dob ? new Date(lead.dob).toLocaleDateString() : "N/A" },
                { label: "Passport Number", value: lead.passport_number || "N/A" },
                { label: "Stage", value: currentStage.label },
                { label: "Joined", value: lead.received_at ? new Date(lead.received_at).toLocaleDateString() : "N/A" },
                { label: "Address", value: lead.address || "Not available" },
                { label: "Preferred Country", value: lead.preferred_country || "Not specified" },
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
                <button onClick={handleGenerateFollowUps} disabled={tasksLoading} className="btn btn-sm btn-outline gap-2">
                  {tasksLoading ? <span className="loading loading-spinner loading-xs"></span> : "✨ Generate AI Follow-ups"}
                </button>
              </div>
            </div>
            {tasksLoading ? (
              <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--cy-lime)]"></div></div>
            ) : (!tasks || tasks.length === 0) ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-[var(--cy-text-muted)] italic">No follow-up tasks found for this lead.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="p-4 bg-white rounded-xl border border-[var(--cy-border)] hover:shadow-md transition-all">
                    <div className="font-bold text-[var(--cy-navy)]">{task.notes || "No notes"}</div>
                    <div className="text-xs text-[var(--cy-text-muted)] mt-1">
                      {task.due_at && <span>🕒 {new Date(task.due_at).toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "education":
        const records = lead.academic_records || [];
        // Helper to categorize records
        const schoolingKeywords = ["10th", "12th", "ssc", "hsc", "high school", "secondary", "matriculation"];
        const schooling = records.filter((r: any) =>
          schoolingKeywords.some(k => r.degree?.toLowerCase().includes(k))
        ).sort((a: any, b: any) => (b.end_year || b.year_of_completion) - (a.end_year || a.year_of_completion));

        const higherEd = records.filter((r: any) =>
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
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#0B1F3A]">Academic History</h3>
              <button
                onClick={() => { setEditingRecord(null); setShowEducationModal(true); }}
                className="px-4 py-2 bg-[#6FB63A] text-white text-sm font-medium rounded-lg hover:bg-[#5a9e2e] transition-colors"
              >
                + Add Education
              </button>
            </div>

            {/* Timeline Gaps */}
            {(gapAfter12th > 0 || higherEd.some((r: any, i: number) => i < higherEd.length - 1 && calculateGap(r, higherEd[i + 1]) > 0)) && (
              <div className="border border-amber-200 rounded-lg overflow-hidden bg-amber-50">
                <div className="px-4 py-2 bg-amber-500 text-white text-xs font-medium uppercase tracking-wide">
                  ⚠️ Timeline Gaps Detected
                </div>
                <div className="divide-y divide-amber-200">
                  {gapAfter12th > 0 && twelfthRecord && firstHigherEd && (
                    <div className="px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-amber-800">After 12th Grade</span>
                      <span className="text-sm font-medium text-amber-800">{gapAfter12th} year ({twelfthRecord.end_year || twelfthRecord.year_of_completion} → {firstHigherEd.start_year || firstHigherEd.year_of_completion})</span>
                    </div>
                  )}
                  {higherEd.map((record: any, i: number) => {
                    if (i >= higherEd.length - 1) return null;
                    const gap = calculateGap(record, higherEd[i + 1]);
                    if (gap <= 0) return null;
                    return (
                      <div key={`gap-${i}`} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-amber-800">{higherEd[i + 1].degree} → {record.degree}</span>
                        <span className="text-sm font-medium text-amber-800">{gap} year</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {records.length === 0 ? (
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
                      {higherEd.map((record: any) => (
                        <div key={record.id} className="p-4 bg-white border border-[#0B1F3A]/10 rounded-lg hover:border-[#6FB63A]/50 transition-colors group">
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
                            <button onClick={() => handleDeleteEducation(record.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
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
                      {schooling.map((record: any) => (
                        <div key={record.id} className="p-4 bg-white border border-[#0B1F3A]/10 rounded-lg hover:border-[#6FB63A]/50 transition-colors group">
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
                            <button onClick={() => handleDeleteEducation(record.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
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
          return lead?.documents?.filter((d: any) => d.document_type === type) || [];
        };

        const handleScanMatch = async (docId: number) => {
          if (!lead) return;
          setScanningDocId(docId);
          try {
            await apiFetch(`/api/ai/documents/${docId}/scan-match/`, { method: "POST" });
            await loadLead();
            alert("Document scanned and verified!");
          } catch (err: any) {
            alert("Scan failed: " + err.message);
          } finally {
            setScanningDocId(null);
          }
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
                                <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-[var(--cy-border)] rounded-xl shadow-lg overflow-hidden z-50">
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
                          <h4 className="font-bold text-sm text-[var(--cy-navy)] mb-1 truncate" title={doc.file?.split('/').pop()}>
                            {doc.file?.split('/').pop() || 'Document'}
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

      case "applications":
        const apps = lead.applications || [];
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-[var(--cy-navy)]">Applications</h3>
              <button className="btn btn-sm btn-primary" onClick={() => router.push(`/applications/new?leadId=${id}`)}>+ New Application</button>
            </div>
            {apps.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-[var(--cy-text-muted)] italic">No applications found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {apps.map((app: any) => (
                  <div key={app.id} onClick={() => router.push(`/applications/${app.id}`)} className="cursor-pointer p-5 bg-white rounded-xl border border-[var(--cy-border)] hover:shadow-md transition-all">
                    <div className="font-bold text-[var(--cy-navy)] text-lg">{app.program || `Application #${app.id}`}</div>
                    <div className="text-xs text-[var(--cy-text-muted)] mt-1">Created: {new Date(app.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "transcripts":
        return (
          <div className="card p-6">
            <h3 className="h3 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call History & Transcripts
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
                    <div key={call.id} className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${wasAnswered ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <Link href={`/calls/${call.id}`} className="group cursor-pointer flex-1">
                          <div className="text-xs font-semibold uppercase text-[var(--cy-text-muted)] tracking-wide">
                            {new Date(call.created_at).toLocaleString()}
                          </div>
                          <div className="text-sm font-medium text-[var(--cy-navy)] capitalize mt-1">
                            {call.direction || 'Outbound'} Call
                            {call.duration_seconds && (
                              <span className="text-xs text-[var(--cy-text-muted)] ml-2">
                                ({Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s)
                              </span>
                            )}
                          </div>
                        </Link>
                        <div className="flex gap-2 items-center">
                          {!wasAnswered && (
                            <button onClick={(e) => { e.stopPropagation(); handleFetchData(call.id); }} disabled={isFetching} className="btn btn-xs btn-ghost text-[var(--cy-primary)]">
                              {isFetching ? <span className="loading loading-spinner loading-xs"></span> : "Fetch Data"}
                            </button>
                          )}
                          <span className={`badge ${wasAnswered ? 'badge-success text-white' : 'badge-error text-white'}`}>
                            {wasAnswered ? 'Answered' : 'No Answer'}
                          </span>
                        </div>
                      </div>
                      {hasRecording && (
                        <div className="mt-3 p-3 bg-white/80 rounded-lg border border-emerald-200">
                          <label className="text-xs font-bold uppercase text-emerald-700 tracking-wider block mb-2">📞 Call Recording</label>
                          <audio controls src={call.recording_url} className="w-full" style={{ height: '40px' }} />
                        </div>
                      )}
                      {hasTranscript && (
                        <div className="mt-3 p-3 bg-white/80 rounded-lg border border-emerald-200">
                          <label className="text-xs font-bold uppercase text-emerald-700 tracking-wider mb-2 block">Transcript Preview</label>
                          <div className="text-sm text-[var(--cy-text-secondary)] leading-relaxed max-h-24 overflow-hidden">{transcript.transcript_text}</div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );

      case "activity":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[var(--cy-navy)]">Activity Log</h3>
            {activities.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-[var(--cy-text-muted)] italic">No activity recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity: any) => (
                  <div key={activity.id} className="p-4 bg-white rounded-xl border border-[var(--cy-border)]">
                    <div className="flex justify-between">
                      <div className="font-medium text-[var(--cy-navy)]">{activity.action}</div>
                      <div className="text-xs text-[var(--cy-text-muted)]">{new Date(activity.created_at).toLocaleString()}</div>
                    </div>
                    {activity.notes && <div className="text-sm text-[var(--cy-text-secondary)] mt-1">{activity.notes}</div>}
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
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/leads" className="p-2 rounded-lg hover:bg-[var(--cy-bg-surface-hover)] text-[var(--cy-text-muted)] hover:text-[var(--cy-navy)] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div className="text-sm text-[var(--cy-text-muted)]">← Back to Leads</div>
        </div>

        {/* Profile Header Card */}
        <div className="bg-[var(--cy-navy)] rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                  {displayName}
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${currentStage.bgColor} ${currentStage.color}`}>
                    {currentStage.label.toUpperCase()}
                  </span>
                </h1>
                <div className="flex items-center gap-4 mt-2 text-white/70 text-sm">
                  {lead.email && <span>✉️ {lead.email}</span>}
                  {lead.phone && <span>📞 {lead.phone}</span>}
                  {lead.received_at && <span>📅 Joined {new Date(lead.received_at).toLocaleDateString()}</span>}
                </div>
                {/* Stage Dropdown */}
                <div className="mt-3">
                  <select
                    value={lead.stage || "new"}
                    onChange={(e) => handleStageChange(e.target.value)}
                    className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-white/20 transition-colors"
                  >
                    {Object.entries(stageConfig).map(([key, config]) => (
                      <option key={key} value={key} className="text-[var(--cy-navy)]">{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold">{lead.applications?.length || 0}</div>
                <div className="text-xs text-white/60 uppercase">Applications</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{lead.documents?.length || 0}</div>
                <div className="text-xs text-white/60 uppercase">Documents</div>
              </div>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
            <button onClick={() => setIsEditModalOpen(true)} className="btn btn-sm bg-white/10 hover:bg-white/20 text-white border-none">
              Edit Lead
            </button>
            <button onClick={handleDelete} className="btn btn-sm bg-red-500/20 hover:bg-red-500/30 text-red-300 border-none">
              Delete
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--cy-border)]">
          <nav className="flex gap-6">
            {[
              { id: "profile", label: "Profile", icon: "👤" },
              { id: "follow_ups", label: "Follow Ups", icon: "📋" },
              { id: "applications", label: "Applications", icon: "📄" },
              { id: "education", label: "Education", icon: "🎓" },
              { id: "documents", label: "Documents", icon: "📁" },
              { id: "transcripts", label: "Transcripts", icon: "📞" },
              { id: "activity", label: "Activity", icon: "📊" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                  ? "border-[var(--cy-lime)] text-[var(--cy-navy)]"
                  : "border-transparent text-[var(--cy-text-muted)] hover:text-[var(--cy-navy)]"
                  }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {renderTabContent()}
        </div>

        {/* Edit Lead Modal */}
        {lead && (
          <EditLeadModal
            lead={lead}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={loadLead}
          />
        )}

        {/* Education Modal */}
        {showEducationModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">{editingRecord ? "Edit Education" : "Add Education"}</h3>
              <form onSubmit={handleAddEducation} className="space-y-4">
                <div>
                  <label className="label">Institution</label>
                  <input type="text" className="input input-bordered w-full" value={eduForm.institution} onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Degree</label>
                  <select className="select select-bordered w-full" value={eduForm.degree} onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}>
                    <option value="10th">10th</option>
                    <option value="12th">12th</option>
                    <option value="B.Tech">B.Tech</option>
                    <option value="B.Sc">B.Sc</option>
                    <option value="B.Com">B.Com</option>
                    <option value="B.A">B.A</option>
                    <option value="M.Tech">M.Tech</option>
                    <option value="M.Sc">M.Sc</option>
                    <option value="MBA">MBA</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {eduForm.degree === "Other" && (
                  <div>
                    <label className="label">Custom Degree</label>
                    <input type="text" className="input input-bordered w-full" value={eduForm.customDegree} onChange={(e) => setEduForm({ ...eduForm, customDegree: e.target.value })} />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Start Year</label>
                    <input type="number" className="input input-bordered w-full" value={eduForm.start_year} onChange={(e) => setEduForm({ ...eduForm, start_year: parseInt(e.target.value) })} />
                  </div>
                  <div>
                    <label className="label">End Year</label>
                    <input type="number" className="input input-bordered w-full" value={eduForm.end_year} onChange={(e) => setEduForm({ ...eduForm, end_year: parseInt(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label className="label">Grade/Score</label>
                  <input type="text" className="input input-bordered w-full" value={eduForm.grade} onChange={(e) => setEduForm({ ...eduForm, grade: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" className="btn btn-ghost" onClick={() => { setShowEducationModal(false); setEditingRecord(null); }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={eduLoading}>{eduLoading ? "Saving..." : "Save"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}