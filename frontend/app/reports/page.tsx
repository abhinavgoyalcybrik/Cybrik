"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { BarChart, DonutChart, HorizontalBarChart } from "@/components/dashboard/Charts";
import apiFetch from "@/lib/api";
import { Download, FileText, Filter, TrendingUp } from "lucide-react";

interface ReportData {
    application_growth: { label: string; value: number }[];
    call_outcomes: { label: string; value: number; color?: string }[];
    lead_sources: { label: string; value: number; color?: string }[];
    conversion_funnel: { label: string; value: number; color?: string }[];
    counselor_stats: { name: string; leads_assigned: number; calls_made: number; applications: number; conversion_rate: number }[];
    ai_usage: { total_cost: number; total_duration_mins: number; avg_duration_secs: number; total_analyzed_calls: number };
    demographics: { label: string; value: number }[];
    document_status: { label: string; value: number }[];
    task_completion: { label: string; value: number }[];
    available_reports: { name: string; date: string; size: string; type: string }[];
    total_applications: number;
    companies: { id: string; name: string }[];
    countries: string[];
}

export default function ReportsPage() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    // Filter state with company and country
    const [filters, setFilters] = useState({
        dateRange: "Last 30 Days",
        counselor: "All Counselors",
        source: "All Sources",
        company: "",  // tenant_id
        country: ""
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Build query params based on filters
                const params = new URLSearchParams();
                if (filters.company) params.append('tenant_id', filters.company);
                if (filters.country) params.append('country', filters.country);
                
                const response = await apiFetch(`/api/reports/summary/?${params.toString()}`);
                setData(response);
            } catch (error) {
                console.error("Failed to fetch reports data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filters.company, filters.country]);  // Refetch when company or country changes

    const handleGeneratePDF = async () => {
        setIsGeneratingPDF(true);
        try {
            // Build request body with filters
            const body: any = {};
            if (filters.company) body.tenant_id = filters.company;
            if (filters.country) body.country = filters.country;
            
            const response = await fetch('/api/reports/summary/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                credentials: 'include',
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }
            
            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `CRM_Report_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--cy-navy)]"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (!data) return null;

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <svg className="w-10 h-10 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Reports Center
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                Comprehensive analytics across all operations.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                className={`px-4 py-2.5 ${showFilters ? 'bg-white/20' : 'bg-white/10'} text-white border border-white/20 rounded-xl font-medium hover:bg-white/20 transition-all flex items-center gap-2`}
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <Filter size={16} /> Filters
                            </button>
                            <button className="px-4 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl font-medium hover:bg-white/20 transition-all flex items-center gap-2">
                                <Download size={16} /> Export
                            </button>
                            <button 
                                className="px-5 py-3 bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-xl font-bold hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleGeneratePDF}
                                disabled={isGeneratingPDF}
                            >
                                <FileText size={16} /> {isGeneratingPDF ? 'Generating...' : 'Generate PDF'}
                            </button>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="card p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 animate-in slide-in-from-top-2 duration-200">
                        <div>
                            <label className="label-text text-xs font-bold mb-1 block">Company</label>
                            <select
                                className="select select-bordered select-sm w-full"
                                value={filters.company}
                                onChange={(e) => setFilters({ ...filters, company: e.target.value })}
                            >
                                <option value="">All Companies</option>
                                {data?.companies?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label-text text-xs font-bold mb-1 block">Country</label>
                            <select
                                className="select select-bordered select-sm w-full"
                                value={filters.country}
                                onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                            >
                                <option value="">All Countries</option>
                                {data?.countries?.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label-text text-xs font-bold mb-1 block">Date Range</label>
                            <select
                                className="select select-bordered select-sm w-full"
                                value={filters.dateRange}
                                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                            >
                                <option>Last 7 Days</option>
                                <option>Last 30 Days</option>
                                <option>Last Quarter</option>
                                <option>This Year</option>
                                <option>Custom Range</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-text text-xs font-bold mb-1 block">Counselor</label>
                            <select
                                className="select select-bordered select-sm w-full"
                                value={filters.counselor}
                                onChange={(e) => setFilters({ ...filters, counselor: e.target.value })}
                            >
                                <option>All Counselors</option>
                                {data?.counselor_stats.map(c => <option key={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button 
                                className="btn btn-sm btn-ghost w-full"
                                onClick={() => setFilters({
                                    dateRange: "Last 30 Days",
                                    counselor: "All Counselors",
                                    source: "All Sources",
                                    company: "",
                                    country: ""
                                })}
                            >
                                Reset Filters
                            </button>
                        </div>
                    </div>
                )}

                {/* KPI Cards */}
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Total Applications"
                        value={data.total_applications}
                        trend="+12% growth"
                        trendDirection="up"
                        context="vs last month"
                    />
                    <StatCard
                        title="Calls Analyzed"
                        value={data.ai_usage.total_analyzed_calls}
                        trend="98% coverage"
                        trendDirection="neutral"
                        context="of total calls"
                    />
                    <StatCard
                        title="Avg Call Duration"
                        value={`${data.ai_usage.avg_duration_secs}s`}
                        trend="↓ 5s faster"
                        trendDirection="up" // Interpreted as improvement
                        context="industry avg: 52s"
                    />
                    <StatCard
                        title="AI Cost Efficiency"
                        value={`$${(data.ai_usage.total_cost / (data.ai_usage.total_analyzed_calls || 1)).toFixed(2)}`}
                        trend="Stable"
                        trendDirection="neutral"
                        context="per analyzed call"
                    />
                </div>

                {/* Main Charts Grid */}
                {/* Conversion Funnel & Growth */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Conversion Funnel (Prioritized) */}
                    <div className="card p-6 lg:col-span-1">
                        <h3 className="h3 mb-1">Conversion Funnel</h3>
                        <p className="text-xs text-[var(--cy-text-muted)] mb-6">Lead to Enrollment</p>
                        <div className="space-y-5">
                            {data.conversion_funnel.map((step, i) => {
                                const maxVal = Math.max(...data.conversion_funnel.map(d => d.value));
                                const percentage = maxVal > 0 ? ((step.value / maxVal) * 100).toFixed(1) : "0";
                                const prevStep = i > 0 ? data.conversion_funnel[i - 1] : null;
                                const conversionFromPrev = prevStep && prevStep.value > 0
                                    ? ((step.value / prevStep.value) * 100).toFixed(1)
                                    : i === 0 ? "100" : "0";

                                return (
                                    <div key={i} className="relative group">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-sm font-medium text-[var(--cy-navy)]">{step.label}</span>
                                            <div className="text-right">
                                                <span className="text-sm font-bold block">{step.value}</span>
                                                <span className="text-[10px] text-[var(--cy-text-muted)]">
                                                    {i === 0 ? '100%' : `${conversionFromPrev}% conv.`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-1000 relative"
                                                style={{
                                                    width: `${(step.value / maxVal) * 100}%`,
                                                    backgroundColor: step.color || 'var(--cy-primary)'
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Application Growth */}
                    <div className="card p-6 lg:col-span-2 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="h3">Application Growth</h3>
                                <p className="text-xs text-[var(--cy-text-muted)]">Monthly application trends</p>
                            </div>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-2 text-xs mr-4">
                                    <span className="w-2 h-2 rounded-full bg-[var(--cy-primary)]"></span>
                                    <span>Applications</span>
                                </div>
                                <select className="select select-bordered select-xs w-auto">
                                    <option>Last 6 Months</option>
                                    <option>Last 30 Days</option>
                                    <option>This Year</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex-1 min-h-[250px] relative">
                            {data.application_growth.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--cy-text-muted)] bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                    <TrendingUp size={32} className="mb-2 opacity-20" />
                                    <p>No growth data for this period.</p>
                                </div>
                            ) : (
                                <BarChart data={data.application_growth} height={300} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Secondary Charts Grid */}
                {/* Breakdown Charts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Lead Sources */}
                    <div className="card p-6">
                        <h3 className="h3 mb-6">Lead Sources</h3>
                        {data.lead_sources.length === 0 ? (
                            <div className="flex items-center justify-center h-48 bg-gray-50 rounded text-sm text-[var(--cy-text-muted)]">No data</div>
                        ) : data.lead_sources.length < 5 ? (
                            // Use Bar Chart for few items
                            <div className="space-y-4">
                                {data.lead_sources.map((item, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span>{item.label}</span>
                                            <span className="font-bold">{item.value}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div
                                                className="h-full rounded-full"
                                                style={{ width: `${(item.value / Math.max(...data.lead_sources.map(s => s.value))) * 100}%`, backgroundColor: item.color }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            // Use Donut for many items
                            <>
                                <div className="flex justify-center">
                                    <DonutChart data={data.lead_sources} size={180} />
                                </div>
                                <div className="mt-6 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {data.lead_sources.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs p-1 hover:bg-gray-50 rounded">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                                            <span className="text-[var(--cy-text-secondary)] truncate flex-1">{item.label}</span>
                                            <span className="font-bold">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Call Outcomes */}
                    <div className="card p-6">
                        <h3 className="h3 mb-6">Call Outcomes</h3>
                        <div className="flex justify-center">
                            <DonutChart data={data.call_outcomes} size={180} />
                        </div>
                        <div className="mt-6 space-y-2">
                            {data.call_outcomes.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-xs border-b border-gray-50 pb-2 last:border-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                        <span className="text-[var(--cy-text-secondary)]">{item.label}</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <span className="font-bold">{item.value}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Cities */}
                    <div className="card p-6">
                        <h3 className="h3 mb-6">Top Cities</h3>
                        {data.demographics.length === 0 ? (
                            <div className="flex items-center justify-center h-48 bg-gray-50 rounded text-sm text-[var(--cy-text-muted)]">No demographic data</div>
                        ) : (
                            <HorizontalBarChart
                                data={data.demographics.map((d, i) => ({
                                    ...d,
                                    color: ['#0B1F3A', '#3B82F6', '#6FB63A', '#F59E0B', '#EF4444'][i % 5]
                                }))}
                            />
                        )}
                    </div>
                </div>

                {/* Counselor Performance */}
                <div className="card overflow-hidden">
                    <div className="p-6 border-b border-[var(--cy-border)] flex justify-between items-center">
                        <h3 className="h3">Counselor Performance</h3>
                        <button className="btn btn-ghost btn-sm text-xs">View All</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-[var(--cy-bg-page)] text-[var(--cy-text-secondary)] font-medium">
                                <tr>
                                    <th className="px-6 py-3">Counselor</th>
                                    <th className="px-6 py-3 text-center">Leads Assigned</th>
                                    <th className="px-6 py-3 text-center">Calls Made</th>
                                    <th className="px-6 py-3 text-center">Applications</th>
                                    <th className="px-6 py-3 text-center">Conversion Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cy-border)]">
                                {data.counselor_stats.map((c, i) => (
                                    <tr key={i} className="hover:bg-[var(--cy-bg-page)] transition-colors">
                                        <td className="px-6 py-4 font-medium text-[var(--cy-navy)]">{c.name}</td>
                                        <td className="px-6 py-4 text-center">{c.leads_assigned}</td>
                                        <td className="px-6 py-4 text-center">{c.calls_made}</td>
                                        <td className="px-6 py-4 text-center">{c.applications}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.conversion_rate > 20 ? 'bg-green-100 text-green-700' :
                                                c.conversion_rate > 10 ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                {c.conversion_rate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {data.counselor_stats.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-[var(--cy-text-muted)]">
                                            No performance data available yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Available Reports */}
                {/* Available Reports */}
                <div className="card overflow-hidden">
                    <div className="p-6 border-b border-[var(--cy-border)] flex justify-between items-center">
                        <h3 className="h3">Available Reports</h3>
                        <button className="btn btn-ghost btn-xs text-blue-600">Auto-send settings</button>
                    </div>
                    <div className="divide-y divide-[var(--cy-border)]">
                        {data.available_reports.map((report, i) => (
                            <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-[var(--cy-bg-page)] transition-colors gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${report.type === 'PDF' ? 'bg-red-50 text-red-600' :
                                        report.type === 'XLSX' ? 'bg-green-50 text-green-600' :
                                            'bg-blue-50 text-blue-600'
                                        }`}>
                                        {report.type}
                                    </div>
                                    <div>
                                        <div className="font-medium text-[var(--cy-navy)]">{report.name}</div>
                                        <div className="text-xs text-[var(--cy-text-muted)] flex flex-wrap gap-2 mt-1">
                                            <span>Generated on {report.date}</span>
                                            <span>•</span>
                                            <span>{report.size}</span>
                                            {/* Report Description simulated based on name */}
                                            <span>•</span>
                                            <span className="italic opacity-80">
                                                {report.name.includes("Admissions") ? "Includes lead volume, conversion rates, and counselor activity." :
                                                    report.name.includes("Financial") ? "Revenue projection, cost analysis, and payment tracking." :
                                                        "General performance analytics."}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn btn-sm btn-ghost text-xs flex items-center gap-1">
                                        Scan contents
                                    </button>
                                    <button className="btn btn-sm btn-outline text-xs flex items-center gap-1">
                                        <Download size={14} /> Download
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

function StatCard({
    title,
    value,
    trend,
    trendDirection = "neutral",
    context
}: {
    title: string;
    value: string | number;
    trend: string;
    trendDirection?: "up" | "down" | "neutral";
    context?: string;
}) {


    // For 'duration' or 'cost', 'up' might be bad, but assuming 'improvement' logic is handled by caller or we add a 'goodTrend' prop.
    // For now, Green = Good contextually passed in `trendDirection`.

    return (
        <div className="card p-5 hover:shadow-lg transition-all border-l-4 border-l-transparent hover:border-l-[var(--cy-primary)]">
            <div className="flex justify-between items-start mb-2">
                <p className="text-xs font-bold text-[var(--cy-text-secondary)] uppercase tracking-wider">{title}</p>
                {/* Optional: Add icon back if needed, but per request removing clear icons */}
            </div>

            <h2 className="text-3xl font-extrabold text-[var(--cy-navy)] tracking-tight">{value}</h2>

            <div className="mt-3 flex items-center gap-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trendDirection === 'up' ? 'bg-green-50 text-green-700' : trendDirection === 'down' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                    {trend}
                </span>
                {context && (
                    <span className="text-[11px] text-[var(--cy-text-muted)] truncate">
                        {context}
                    </span>
                )}
            </div>
        </div>
    );
}
