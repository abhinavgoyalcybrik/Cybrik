import React from 'react';
import KPIGrid from "./KPIGrid";
import { HorizontalBarChart } from "./Charts";

export default function AdmissionsDashboard({ data }: any) {
  const kpis = [
    {
      title: "Total Applications",
      value: data.total_applications,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      trend: "Active",
      trendUp: true
    },
  ];

  const countryData = (data.country_distribution || []).map((c: any) => ({
    label: c.country,
    value: c.count,
    color: '#6FB63A'
  }));

  const intakeData = (data.intake_distribution || []).map((i: any) => ({
    label: i.intake,
    value: i.count,
    color: '#0B1F3A'
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="h2">Admissions Overview</h2>
      </div>

      <KPIGrid kpis={kpis} />

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Country Distribution */}
        <div className="card p-6">
          <h3 className="h3 mb-6">Country Distribution</h3>
          {countryData.length > 0 ? (
            <HorizontalBarChart data={countryData} />
          ) : (
            <p className="text-sm text-[var(--cy-text-muted)]">No country data available.</p>
          )}
        </div>

        {/* Intake Distribution */}
        <div className="card p-6">
          <h3 className="h3 mb-6">Intake Distribution</h3>
          {intakeData.length > 0 ? (
            <HorizontalBarChart data={intakeData} />
          ) : (
            <p className="text-sm text-[var(--cy-text-muted)]">No intake data available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
