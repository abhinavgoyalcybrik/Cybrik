"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import DataGrid from "@/components/dashboard/DataGrid";

type Applicant = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob?: string;
  passport_number?: string;
  created_at: string;
};

export default function ApplicantsPage() {
  const router = useRouter();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await apiFetch("/api/applicants/");
        if (!mounted) return;
        setApplicants(Array.isArray(data) ? data : data.results ?? []);
      } catch (err: any) {
        console.error(err);
        setError(err.message ?? "Failed to load applicants");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleConvertToApplication = async (applicantId: number) => {
    const program = prompt("Enter the program name for this application:");
    if (!program) return;

    try {
      await apiFetch("/api/applicants/convert-to-application/", {
        method: "POST",
        body: JSON.stringify({ applicant_id: applicantId, program }),
      });
      alert("Successfully converted to application!");
      router.push("/applications");
    } catch (err: any) {
      alert("Failed to convert: " + err.message);
    }
  };

  const handleDelete = async (applicant: Applicant) => {
    if (!confirm(`Are you sure you want to delete ${applicant.first_name} ${applicant.last_name}? This action cannot be undone.`)) return;
    try {
      await apiFetch(`/api/applicants/${applicant.id}/`, { method: "DELETE" });
      // Reload applicants
      setApplicants(applicants.filter(a => a.id !== applicant.id));
      alert("Applicant deleted successfully");
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  const columns = [
    {
      header: "Name",
      accessorKey: "first_name",
      cell: (applicant: Applicant) => (
        <div
          className="flex items-center gap-3 cursor-pointer hover:text-[var(--cy-lime-hover)] transition-colors"
          onClick={() => router.push(`/applicants/${applicant.id}`)}
        >
          <div className="w-10 h-10 rounded-full bg-[var(--cy-bg-page)] flex items-center justify-center text-[var(--cy-navy)] font-bold">
            {applicant.first_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-[var(--cy-navy)]">
              {applicant.first_name} {applicant.last_name}
            </div>
            <div className="text-xs text-[var(--cy-text-muted)]">{applicant.email}</div>
          </div>
        </div>
      ),
    },
    {
      header: "Phone",
      accessorKey: "phone",
      cell: (applicant: Applicant) => (
        <span className="font-mono text-sm text-[var(--cy-text-secondary)]">{applicant.phone || "N/A"}</span>
      ),
    },
    {
      header: "Date of Birth",
      accessorKey: "dob",
      cell: (applicant: Applicant) => (
        <span className="text-sm text-[var(--cy-text-secondary)]">{applicant.dob || "N/A"}</span>
      ),
    },
    {
      header: "Created",
      accessorKey: "created_at",
      cell: (applicant: Applicant) => (
        <span className="text-xs text-[var(--cy-text-muted)]">
          {new Date(applicant.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id" as any,
      cell: (applicant: Applicant) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleConvertToApplication(applicant.id);
            }}
            className="btn btn-sm bg-[var(--cy-lime)] text-[var(--cy-navy)] hover:bg-[var(--cy-lime-hover)]"
          >
            Convert
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(applicant);
            }}
            className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

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

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <svg className="w-10 h-10 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Applicants
              </h1>
              <p className="text-blue-100 text-lg max-w-2xl">
                Manage and track all applicants in your pipeline.
              </p>
            </div>
            <a href="/applicants/new" className="px-5 py-3 bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-xl font-bold hover:brightness-110 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Applicant
            </a>
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
          data={applicants}
          columns={columns as any}
          title="All Applicants"
        />
      </div>
    </DashboardLayout>
  );
}