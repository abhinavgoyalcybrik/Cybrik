"use client";

import React, { useEffect, useState, useMemo } from "react";
import apiFetch from "@/lib/api";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import DataGrid from "@/components/dashboard/DataGrid";
import { useRouter } from "next/navigation";
import LeadCaptureModal from "@/components/leads/LeadCaptureModal";

type Lead = {
  id: number | string;
  name?: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
  created_at?: string;
  received_at?: string;
  status?: string;
  external_id?: string;
};

const STATUS_TABS = [
  { key: "all", label: "All", color: "bg-slate-100 text-slate-700", activeColor: "bg-slate-700 text-white", description: "All leads in the system." },
  { key: "new", label: "New", color: "bg-blue-50 text-blue-700", activeColor: "bg-blue-600 text-white", description: "Fresh leads, not yet contacted." },
  { key: "contacted", label: "Contacted", color: "bg-amber-50 text-amber-700", activeColor: "bg-amber-500 text-white", description: "Leads reached via AI/Agent call." },
  { key: "qualified", label: "Qualified", color: "bg-emerald-50 text-emerald-700", activeColor: "bg-emerald-600 text-white", description: "High interest or valid criteria met." },
  { key: "converted", label: "Converted", color: "bg-green-50 text-green-700", activeColor: "bg-green-600 text-white", description: "Leads converted to Applications." },
  { key: "junk", label: "Junk", color: "bg-red-50 text-red-700", activeColor: "bg-red-500 text-white", description: "Spam or low-quality leads." },
  { key: "lost", label: "Lost", color: "bg-gray-50 text-gray-600", activeColor: "bg-gray-600 text-white", description: "Unresponsive or not interested." },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const router = useRouter();

  const [showCaptureModal, setShowCaptureModal] = useState(false);

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/leads/");
      setLeads(Array.isArray(data) ? data : data.results ?? []);
    } catch (err: any) {
      console.error("Failed to load leads:", err);
      setError(err.message ?? "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Small delay to ensure auth is ready
    const timer = setTimeout(() => {
      loadLeads();
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  // Filter leads by selected status
  const filteredLeads = useMemo(() => {
    if (selectedStatus === "all") return leads;
    return leads.filter(l => {
      const s = (l.status || "new").toLowerCase();
      const normalized = (s === 'received' || s === 'new') ? 'new' : s;
      return normalized === selectedStatus;
    });
  }, [leads, selectedStatus]);

  // Get count for each status
  const getCount = (statusKey: string) => {
    if (statusKey === "all") return leads.length;
    return leads.filter(l => {
      const s = (l.status || "new").toLowerCase();
      const normalized = (s === 'received' || s === 'new') ? 'new' : s;
      return normalized === statusKey;
    }).length;
  };

  async function handleDelete(id: number | string) {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      await apiFetch(`/api/leads/${id}/`, { method: "DELETE" });
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      alert("Failed to delete lead: " + err.message);
    }
  }

  async function handleStatusChange(id: number | string, newStatus: string) {
    try {
      await apiFetch(`/api/leads/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
      );
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  }

  const getStatusBadgeClass = (status: string) => {
    const s = (status || "new").toLowerCase();
    switch (s) {
      case "new":
      case "received": return "bg-blue-100 text-blue-700";
      case "contacted": return "bg-amber-100 text-amber-700";
      case "qualified": return "bg-emerald-100 text-emerald-700";
      case "converted": return "bg-green-100 text-green-700";
      case "junk": return "bg-red-100 text-red-700";
      case "lost": return "bg-gray-100 text-gray-600";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const columns = [
    {
      header: "Lead Name",
      accessorKey: "name" as keyof Lead,
      cell: (lead: Lead) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--cy-bg-page)] flex items-center justify-center text-[var(--cy-navy)] font-bold text-xs">
            {lead.name ? lead.name.charAt(0).toUpperCase() : "?"}
          </div>
          <div>
            <div className="font-medium text-[var(--cy-navy)]">{lead.name || "Unknown"}</div>
            <div className="text-xs text-[var(--cy-text-muted)]">{lead.email || "No email"}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Contact",
      accessorKey: "phone" as keyof Lead,
      cell: (lead: Lead) => (
        <span className="text-sm text-[var(--cy-text-secondary)] font-mono">
          {lead.phone || "-"}
        </span>
      ),
    },
    {
      header: "Source",
      accessorKey: "source" as keyof Lead,
      cell: (lead: Lead) => (
        <span className="badge badge-neutral uppercase text-[10px] tracking-wider">
          {lead.source || "Unknown"}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status" as keyof Lead,
      cell: (lead: Lead) => {
        const status = lead.status || "new";
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(status)}`}>
            {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
          </span>
        );
      },
    },
    {
      header: "Date",
      accessorKey: "received_at" as keyof Lead,
      cell: (lead: Lead) => (
        <span className="text-xs text-[var(--cy-text-muted)]">
          {lead.created_at || lead.received_at ? new Date(lead.created_at || lead.received_at!).toLocaleDateString() : "-"}
        </span>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id" as keyof Lead,
      className: "text-right",
      cell: (lead: Lead) => {
        const isConverted = (lead.status || "").toLowerCase() === "converted";
        return (
          <div className="flex items-center justify-end gap-2">
            {isConverted ? (
              // Converted leads show a locked badge instead of dropdown
              <span className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 font-semibold flex items-center gap-1">
                ✓ Converted
              </span>
            ) : (
              <select
                value={lead.status || "new"}
                onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent cursor-pointer"
                title="Change Status"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
                <option value="junk">Junk</option>
                <option value="lost">Lost</option>
              </select>
            )}
            <Link
              href={`/leads/${lead.id}`}
              className="text-xs font-medium text-[var(--cy-lime-hover)] hover:text-[var(--cy-lime)] transition-colors"
            >
              View
            </Link>
            {!isConverted && (
              <button
                onClick={() => handleDelete(lead.id)}
                className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )
      },
    },
  ];

  if (loading && leads.length === 0) {
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Leads Management
              </h1>
              <p className="text-blue-100 text-lg max-w-2xl">
                Track and manage incoming leads from all sources.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadLeads}
                disabled={loading}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                title="Refresh Leads"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => setShowCaptureModal(true)}
                className="px-5 py-3 bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-xl font-bold hover:brightness-110 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Capture New Lead
              </button>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2 p-1 bg-white/50 backdrop-blur rounded-2xl border border-white/20 shadow-sm">
          {STATUS_TABS.map((tab) => {
            const count = getCount(tab.key);
            const isActive = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                title={tab.description}
                className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${isActive ? tab.activeColor + " shadow-md" : tab.color + " hover:opacity-80"
                  }`}
              >
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? "bg-white/20" : "bg-black/10"
                  }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>



        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <DataGrid
          data={filteredLeads}
          columns={columns}
          title={selectedStatus === "all" ? "All Leads" : `${STATUS_TABS.find(t => t.key === selectedStatus)?.label || 'Leads'} Leads`}
          subtitle={
            (() => {
              const tab = STATUS_TABS.find(t => t.key === selectedStatus);
              return tab?.description ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {tab.description}
                </span>
              ) : null;
            })()
          }
        />

        <LeadCaptureModal
          isOpen={showCaptureModal}
          onClose={() => setShowCaptureModal(false)}
          onSuccess={() => {
            loadLeads();
          }}
        />
      </div>
    </DashboardLayout >
  );
}

