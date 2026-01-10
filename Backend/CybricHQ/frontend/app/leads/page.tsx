"use client";

import React, { useEffect, useState } from "react";
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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [showCaptureModal, setShowCaptureModal] = useState(false);

  async function loadLeads() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/leads/");
      setLeads(Array.isArray(data) ? data : data.results ?? []);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  async function handleDelete(id: number | string) {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      await apiFetch(`/api/leads/${id}/`, { method: "DELETE" });
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      alert("Failed to delete lead: " + err.message);
    }
  }

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
        const status = lead.status || "received";
        const isSuccess = status === "forwarded" || status === "converted";
        return (
          <span className={`badge ${isSuccess ? "badge-success" : "badge-warning"}`}>
            {status}
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
      cell: (lead: Lead) => (
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/applicants/new?leadId=${lead.id}`}
            className="text-xs font-medium text-[var(--cy-navy)] hover:text-[var(--cy-lime)] transition-colors"
            title="Convert to Applicant"
          >
            Convert
          </Link>
          <Link
            href={`/leads/${lead.id}`}
            className="text-xs font-medium text-[var(--cy-lime-hover)] hover:text-[var(--cy-lime)] transition-colors"
          >
            View
          </Link>
          <button
            onClick={() => handleDelete(lead.id)}
            className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      ),
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
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <DataGrid
          data={leads}
          columns={columns}
          title="Recent Leads"
        />

        <LeadCaptureModal
          isOpen={showCaptureModal}
          onClose={() => setShowCaptureModal(false)}
          onSuccess={() => {
            loadLeads();
          }}
        />
      </div>
    </DashboardLayout>
  );
}
