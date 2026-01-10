import React from 'react';
import Link from 'next/link';
import KPIGrid from "./KPIGrid";
import DataGrid from "./DataGrid";
import { BarChart, DonutChart } from "./Charts";
import { motion } from 'framer-motion';

export default function AdminDashboard({ data }: any) {
  const kpis = [
    {
      title: "Total Users",
      value: data.total_users,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      trend: "+12%",
      trendUp: true
    },
    {
      title: "Total Applicants",
      value: data.total_applicants,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      trend: "+5%",
      trendUp: true
    },
    {
      title: "Applications",
      value: data.total_applications,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      trend: "+8%",
      trendUp: true
    },
    {
      title: "Conversion Rate",
      value: `${data.conversion_rate_percent ?? 0}%`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      trend: "+2.4%",
      trendUp: true
    },
  ];

  // Use real data if available, else fallback to empty or mock
  const trendsData = data.application_trends?.length > 0 ? data.application_trends : [];
  const userDistData = data.user_distribution || [];

  // Calculate percentages for user distribution
  const totalUsers = userDistData.reduce((acc: number, curr: any) => acc + curr.value, 0);
  const getPercent = (val: number) => totalUsers > 0 ? Math.round((val / totalUsers) * 100) : 0;

  const applicantColumns = [
    {
      header: 'Applicant',
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
      header: 'Date',
      accessorKey: 'date',
      cell: (row: any) => new Date(row.date).toLocaleDateString()
    },
    {
      header: 'Status',
      cell: () => (
        <span className="badge badge-success">Active</span>
      )
    }
  ];

  return (
    <div className="space-y-8">
      {/* Overview Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="h2">Overview</h2>
          <button className="btn btn-outline text-xs">Download Report</button>
        </div>
        <KPIGrid kpis={kpis} />
      </section>

      {/* Charts Section */}
      <section className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 card p-6">
          <h3 className="h3 mb-6">Application Trends</h3>
          <BarChart data={trendsData} height={240} />
        </div>
        <div className="card p-6">
          <h3 className="h3 mb-6">User Distribution</h3>
          <DonutChart
            data={userDistData}
          />
          <div className="mt-6 space-y-2">
            {userDistData.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                  {item.label}
                </span>
                <span className="font-semibold">{getPercent(item.value)}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Activity Section */}
      <section className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <DataGrid
            title="Recent Applicants"
            data={data.recent_applicants || []}
            columns={applicantColumns}
            action={<button className="btn btn-ghost text-xs">View All</button>}
          />
        </div>

        <div className="card p-6">
          <h3 className="h3 mb-6">Top Counselors</h3>
          <div className="space-y-4">
            {data.per_counselor_counts?.slice(0, 5).map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--cy-bg-page)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--cy-navy)] text-white flex items-center justify-center text-xs font-bold">
                    {(c.name || "U").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--cy-navy)]">{c.name}</div>
                    <div className="text-xs text-[var(--cy-text-muted)]">{c.value} applicants</div>
                  </div>
                </div>
                <div className="text-[var(--cy-lime)] font-bold text-sm">#{i + 1}</div>
              </div>
            ))}
            {!data.per_counselor_counts?.length && (
              <p className="text-sm text-[var(--cy-text-muted)]">No data available.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
