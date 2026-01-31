import React from 'react';
import Link from 'next/link';
import KPIGrid from "./KPIGrid";
import DataGrid from "./DataGrid";
import { HorizontalBarChart } from "./Charts";

export default function CounsellorDashboard({ data }: any) {
  const kpis = [
    {
      title: "My Leads",
      value: data.my_total_applicants,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      trend: "+2 this week",
      trendUp: true
    },
    {
      title: "Followups Due",
      value: data.followups_due,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      trend: data.followups_due > 0 ? "Action Required" : "All Clear",
      trendUp: data.followups_due === 0
    },
  ];

  const pipelineData = Object.entries(data.pipeline_counts || {}).map(([label, value]) => ({
    label,
    value: Number(value),
    color: '#6FB63A'
  }));

  const applicantColumns = [
    {
      header: 'Lead',
      cell: (row: any) => (
        <Link href={`/leads/${row.id}`} className="block hover:bg-gray-50 rounded-lg transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--cy-lime-soft)] flex items-center justify-center text-[var(--cy-lime)] text-xs font-bold">
              {(row.name || "U").charAt(0)}
            </div>
            <div>
              <div className="font-medium text-[var(--cy-navy)] hover:text-[var(--cy-lime)] transition-colors">{row.name}</div>
              <div className="text-xs text-[var(--cy-text-muted)]">{row.email}</div>
            </div>
          </div>
        </Link>
      )
    },
    {
      header: 'Status',
      cell: () => (
        <span className="badge badge-info">In Progress</span>
      )
    },
    {
      header: 'Action',
      cell: () => (
        <button className="btn btn-ghost text-xs py-1">Contact</button>
      )
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="h2">My Performance</h2>
      </div>

      <KPIGrid kpis={kpis} />

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Pipeline Stages */}
        <div className="card p-6">
          <h3 className="h3 mb-6">Pipeline Stages</h3>
          {pipelineData.length > 0 ? (
            <HorizontalBarChart data={pipelineData} />
          ) : (
            <p className="text-sm text-[var(--cy-text-muted)]">No pipeline data available.</p>
          )}
        </div>

        {/* Recent Leads Table */}
        <div className="lg:col-span-2">
          <DataGrid
            title="Recent Leads"
            data={data.recent_applicants || []}
            columns={applicantColumns}
            action={<button className="btn btn-ghost text-xs">View All</button>}
          />
        </div>
      </div>
    </div>
  );
}
