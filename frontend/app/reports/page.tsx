"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { BarChart, DonutChart, HorizontalBarChart } from "@/components/dashboard/Charts";
import apiFetch from "@/lib/api";
import { Download, FileText, Filter, TrendingUp, X, Globe } from "lucide-react";

interface ReportData {
    application_growth: { label: string; value: number }[];
    call_outcomes: { label: string; value: number; color?: string }[];
    lead_sources: { label: string; value: number; color?: string }[];
    conversion_funnel: { label: string; value: number; color?: string }[];
    counselor_stats: { 
        id?: number; 
        name: string; 
        leads_assigned: number; 
        calls_made: number; 
        applications: number; 
        conversion_rate: number;
        targets?: { leads: number; calls: number; applications: number; id: number };
    }[];
    ai_usage: { total_cost: number; total_duration_mins: number; avg_duration_secs: number; total_analyzed_calls: number };
    demographics: { label: string; value: number }[];
    document_status: { label: string; value: number }[];
    task_completion: { label: string; value: number }[];
    available_reports: { name: string; date: string; size: string; type: string }[];
    total_applications: number;
    total_leads?: number;
    total_converted_leads?: number;
    companies: { id: string; name: string }[];
    countries: string[];
    country_breakdown?: { [country: string]: Omit<ReportData, 'companies' | 'countries' | 'available_reports' | 'country_breakdown'> };
}

const formatLeadSourceLabel = (label: string) => {
    if (!label) return "Unknown";
    if (label === "No Data") return label;

    const normalized = label.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
    const map: Record<string, string> = {
        meta_ads: "Meta Ads",
        google_ads: "Google Ads",
        organic: "Organic",
        referral: "Referral",
        walk_in: "Walk-in",
        walkin: "Walk-in",
        website: "Website",
        other: "Other",
        whatsapp: "WhatsApp",
    };

    return map[normalized] || label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function ReportsPage() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [showBreakdownDialog, setShowBreakdownDialog] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<{ 
        title: string; 
        dataKey: keyof Omit<ReportData, 'companies' | 'countries' | 'available_reports' | 'country_breakdown' | 'ai_usage' | 'total_applications' | 'total_leads'>;
        label?: string;
        value?: number;
    } | null>(null);

    // Filter state with company and multiple countries
    const [filters, setFilters] = useState({
        dateRange: "Last 30 Days",
        counselor: "All Counselors",
        source: "All Sources",
        company: "",  // tenant_id
        countries: [] as string[]  // Multiple countries
    });

    // Country selection state
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [expandedCountries, setExpandedCountries] = useState<{ [key: string]: boolean }>({});

    // Target Setting State
    const [targetModalOpen, setTargetModalOpen] = useState(false);
    const [selectedCounselor, setSelectedCounselor] = useState<any>(null);
    const [targetForm, setTargetForm] = useState({
        leads: 0,
        calls: 0,
        applications: 0
    });

    const openTargetModal = (counselor: any) => {
        setSelectedCounselor(counselor);
        setTargetForm({
            leads: counselor.targets?.leads || 0,
            calls: counselor.targets?.calls || 0,
            applications: counselor.targets?.applications || 0
        });
        setTargetModalOpen(true);
    };

    const handleSaveTarget = async () => {
        if (!selectedCounselor || !selectedCounselor.id) return;
        try {
            const payload: any = {
                counselor: selectedCounselor.id,
                target_leads: parseInt(targetForm.leads as any) || 0,
                target_calls: parseInt(targetForm.calls as any) || 0,
                target_applications: parseInt(targetForm.applications as any) || 0,
                target_enrollments: 0, // Required by model
                period_type: 'monthly',
                status: 'active',
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
            };

            let url = '/api/counselor-targets/';
            let method = 'POST';

            if (selectedCounselor.targets?.id) {
                url += `${selectedCounselor.targets.id}/`;
                method = 'PATCH'; 
                delete payload.counselor;
                delete payload.start_date;
                delete payload.end_date;
            }

            const res = await apiFetch(url, {
                method,
                body: JSON.stringify(payload)
            });

            if (res) {
                 setTargetModalOpen(false);
                 window.location.reload(); 
            }
        } catch (error) {
            console.error("Failed to set target", error);
            alert("Failed to save target. Only admins can do this.");
        }
    };
    const [countrySelectValue, setCountrySelectValue] = useState<string>("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Build query params based on filters
                const params = new URLSearchParams();
                if (filters.company) params.append('tenant_id', filters.company);
                
                // Add multiple countries as array
                selectedCountries.forEach(country => {
                    params.append('countries[]', country);
                });
                
                const response = await apiFetch(`/api/reports/summary/?${params.toString()}`);
                setData(response);
            } catch (error) {
                console.error("Failed to fetch reports data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filters.company, selectedCountries]);  // Refetch when company or countries change

    const handleAddCountry = (country: string) => {
        if (country && !selectedCountries.includes(country)) {
            const newCountries = [...selectedCountries, country];
            setSelectedCountries(newCountries);
            setExpandedCountries({ ...expandedCountries, [country]: true });
        }
    };

    const handleRemoveCountry = (country: string) => {
        const newCountries = selectedCountries.filter(c => c !== country);
        setSelectedCountries(newCountries);
        const newExpanded = { ...expandedCountries };
        delete newExpanded[country];
        setExpandedCountries(newExpanded);
    };

    const toggleCountryExpand = (country: string) => {
        setExpandedCountries({
            ...expandedCountries,
            [country]: !expandedCountries[country]
        });
    };

    const handleGeneratePDF = async () => {
        setIsGeneratingPDF(true);
        try {
            // Build request body with filters
            const body: any = {};
            if (filters.company) body.tenant_id = filters.company;
            if (selectedCountries.length > 0) body.countries = selectedCountries;
            
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
                    <div className="card p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                                    onClick={() => {
                                        setFilters({
                                            dateRange: "Last 30 Days",
                                            counselor: "All Counselors",
                                            source: "All Sources",
                                            company: "",
                                            countries: []
                                        });
                                        setSelectedCountries([]);
                                        setCountrySelectValue("");
                                    }}
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                        
                        {/* Country Multi-Select */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Countries (Multi-Select)</label>
                            
                            <div className="flex gap-2 items-center">
                                <select
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={countrySelectValue}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value) {
                                            handleAddCountry(value);
                                            setCountrySelectValue("");
                                        }
                                    }}
                                >
                                    <option value="">+ Add Country</option>
                                    {data?.countries?.filter(c => !selectedCountries.includes(c)).map(c => 
                                        <option key={c} value={c}>{c}</option>
                                    )}
                                </select>
                            </div>
                            
                            {/* Selected Countries Tags */}
                            {selectedCountries.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {selectedCountries.map(country => (
                                        <div
                                            key={country}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
                                        >
                                            <span>🌍 {country}</span>
                                            <button
                                                onClick={() => handleRemoveCountry(country)}
                                                className="ml-1 hover:text-red-200 font-bold text-lg leading-none"
                                                type="button"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Country-Specific Widget Panels */}
                {selectedCountries.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <div>
                                <h2 className="text-2xl font-bold text-blue-900">Country-Specific Reports</h2>
                                <p className="text-sm text-blue-700 mt-1">
                                    Showing data for: {selectedCountries.join(', ')}
                                </p>
                            </div>
                            <span className="text-sm font-semibold text-blue-700 bg-white px-3 py-1 rounded-full">
                                {selectedCountries.length} {selectedCountries.length === 1 ? 'country' : 'countries'} selected
                            </span>
                        </div>
                        
                        {!data?.country_breakdown && (
                            <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                                <p className="text-yellow-800 font-medium">Loading country-specific data...</p>
                                <p className="text-yellow-600 text-sm mt-2">If this persists, the backend may not be returning country breakdown data.</p>
                            </div>
                        )}
                        
                        {data?.country_breakdown && Object.keys(data.country_breakdown).length === 0 && (
                            <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                                <p className="text-yellow-800 font-medium">No data available for selected countries</p>
                                <p className="text-yellow-600 text-sm mt-2">The selected countries may not have any data in the system yet.</p>
                            </div>
                        )}
                        
                        {data?.country_breakdown && selectedCountries.map(country => {
                            const countryData = data.country_breakdown![country];
                            if (!countryData) {
                                return (
                                    <div key={country} className="p-6 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-red-800 font-medium">⚠️ No data found for {country}</p>
                                        <p className="text-red-600 text-sm mt-1">This country was selected but has no data in the breakdown.</p>
                                    </div>
                                );
                            }
                            
                            const isExpanded = expandedCountries[country];
                            
                            return (
                                <div key={country} className="card overflow-hidden border-l-4 border-l-[var(--cy-lime)]">
                                    {/* Country Header */}
                                    <div 
                                        className="p-6 bg-gradient-to-r from-[var(--cy-navy)] to-blue-900 text-white cursor-pointer hover:brightness-110 transition-all"
                                        onClick={() => toggleCountryExpand(country)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="text-4xl">🌍</div>
                                                <div>
                                                    <h3 className="text-2xl font-bold">{country}</h3>
                                                    <p className="text-blue-100 text-sm mt-1">
                                                        {countryData.total_applications} applications · {countryData.total_leads || 0} leads
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <div className="text-xs text-blue-200">Conversion Rate</div>
                                                    <div className="text-2xl font-bold">
                                                        {(countryData.total_leads ?? 0) > 0 
                                                            ? ((countryData.total_applications / (countryData.total_leads ?? 1)) * 100).toFixed(1) 
                                                            : 0}%
                                                    </div>
                                                </div>
                                                <button className="text-white hover:text-[var(--cy-lime)] transition-colors">
                                                    {isExpanded ? (
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Country Details (Collapsible) */}
                                    {isExpanded && (
                                        <div className="p-6 space-y-6 bg-gray-50 animate-in slide-in-from-top-2 duration-300">
                                            {/* Country KPIs */}
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div className="card p-4 bg-white">
                                                    <div className="text-xs font-bold text-[var(--cy-text-secondary)] uppercase mb-1">Applications</div>
                                                    <div className="text-2xl font-bold text-[var(--cy-navy)]">{countryData.total_applications}</div>
                                                </div>
                                                <div className="card p-4 bg-white">
                                                    <div className="text-xs font-bold text-[var(--cy-text-secondary)] uppercase mb-1">Total Leads</div>
                                                    <div className="text-2xl font-bold text-[var(--cy-navy)]">{countryData.total_leads || 0}</div>
                                                </div>
                                                <div className="card p-4 bg-white">
                                                    <div className="text-xs font-bold text-[var(--cy-text-secondary)] uppercase mb-1">AI Calls</div>
                                                    <div className="text-2xl font-bold text-[var(--cy-navy)]">{countryData.ai_usage.total_analyzed_calls}</div>
                                                </div>
                                                <div className="card p-4 bg-white">
                                                    <div className="text-xs font-bold text-[var(--cy-text-secondary)] uppercase mb-1">AI Cost</div>
                                                    <div className="text-2xl font-bold text-[var(--cy-navy)]">${countryData.ai_usage.total_cost}</div>
                                                </div>
                                            </div>
                                            
                                            {/* Country Charts */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {/* Application Growth */}
                                                <div className="card p-4 bg-white">
                                                    <h4 className="font-bold text-sm mb-3 text-[var(--cy-navy)]">Application Growth</h4>
                                                    <div className="h-40">
                                                        {countryData.application_growth.length > 0 ? (
                                                            <BarChart data={countryData.application_growth} height={160} />
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-xs text-[var(--cy-text-muted)]">No data</div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Lead Sources */}
                                                <div className="card p-4 bg-white">
                                                    <h4 className="font-bold text-sm mb-3 text-[var(--cy-navy)]">Lead Sources</h4>
                                                    {countryData.lead_sources.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {countryData.lead_sources.slice(0, 5).map((item, i) => (
                                                                <div key={i}>
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span>{formatLeadSourceLabel(item.label)}</span>
                                                                        <span className="font-bold">{item.value}</span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                                                        <div
                                                                            className="h-full rounded-full"
                                                                            style={{ 
                                                                                width: `${(item.value / Math.max(...countryData.lead_sources.map(s => s.value))) * 100}%`, 
                                                                                backgroundColor: item.color 
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center h-32 text-xs text-[var(--cy-text-muted)]">No data</div>
                                                    )}
                                                </div>
                                                
                                                {/* Conversion Funnel */}
                                                <div className="card p-4 bg-white">
                                                    <h4 className="font-bold text-sm mb-3 text-[var(--cy-navy)]">Conversion Funnel</h4>
                                                    <div className="space-y-3">
                                                        {countryData.conversion_funnel.map((step, i) => {
                                                            const maxVal = Math.max(...countryData.conversion_funnel.map(d => d.value));
                                                            return (
                                                                <div key={i}>
                                                                    <div className="flex justify-between items-end mb-1">
                                                                        <span className="text-xs font-medium">{step.label}</span>
                                                                        <span className="text-xs font-bold">{step.value}</span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                                                        <div
                                                                            className="h-full rounded-full transition-all"
                                                                            style={{
                                                                                width: `${maxVal > 0 ? (step.value / maxVal) * 100 : 0}%`,
                                                                                backgroundColor: step.color
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Counselor Performance for this country */}
                                            {countryData.counselor_stats.length > 0 && (
                                                <div className="card bg-white overflow-hidden">
                                                    <div className="p-4 border-b border-[var(--cy-border)]">
                                                        <h4 className="font-bold text-sm text-[var(--cy-navy)]">Counselor Performance - {country}</h4>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-gray-50 text-xs">
                                                                <tr>
                                                                    <th className="px-4 py-2 text-left">Counselor</th>
                                                                    <th className="px-4 py-2 text-center">Leads</th>
                                                                    <th className="px-4 py-2 text-center">Calls</th>
                                                                    <th className="px-4 py-2 text-center">Applications</th>
                                                                    <th className="px-4 py-2 text-center">Conv. Rate</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-[var(--cy-border)]">
                                                                {countryData.counselor_stats.slice(0, 5).map((c, i) => (
                                                                    <tr key={i} className="hover:bg-gray-50">
                                                                        <td className="px-4 py-2 font-medium text-xs">{c.name}</td>
                                                                        <td className="px-4 py-2 text-center text-xs">{c.leads_assigned}</td>
                                                                        <td className="px-4 py-2 text-center text-xs">{c.calls_made}</td>
                                                                        <td className="px-4 py-2 text-center text-xs">{c.applications}</td>
                                                                        <td className="px-4 py-2 text-center">
                                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                                                c.conversion_rate > 20 ? 'bg-green-100 text-green-700' :
                                                                                c.conversion_rate > 10 ? 'bg-blue-100 text-blue-700' :
                                                                                'bg-gray-100 text-gray-700'
                                                                            }`}>
                                                                                {c.conversion_rate}%
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* KPI Cards */}
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Total Applications"
                        value={data.total_applications || 0}
                        trend="+12% growth"
                        trendDirection="up"
                        context="vs last month"
                    />
                    <StatCard
                        title="Calls Analyzed"
                        value={data.ai_usage?.total_analyzed_calls || 0}
                        trend="98% coverage"
                        trendDirection="neutral"
                        context="of total calls"
                    />
                    <StatCard
                        title="Avg Call Duration"
                        value={`${data.ai_usage?.avg_duration_secs || 0}s`}
                        trend="↓ 5s faster"
                        trendDirection="up" // Interpreted as improvement
                        context="industry avg: 52s"
                    />
                    <StatCard
                        title="AI Cost Efficiency"
                        value={`$${(data.ai_usage?.total_cost && data.ai_usage?.total_analyzed_calls ? (data.ai_usage.total_cost / data.ai_usage.total_analyzed_calls).toFixed(2) : '0.00')}`}
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
                                        <div 
                                            className="flex justify-between items-end mb-1 cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => {
                                                setSelectedMetric({ title: 'Conversion Funnel', dataKey: 'conversion_funnel', label: step.label, value: step.value });
                                                setShowBreakdownDialog(true);
                                            }}
                                        >
                                            <span className="text-sm font-medium text-[var(--cy-navy)]">{step.label}</span>
                                            <div className="text-right">
                                                <span className="text-sm font-bold block">{step.value}</span>
                                                <span className="text-[10px] text-[var(--cy-text-muted)]">
                                                    {i === 0 ? '100%' : `${conversionFromPrev}% conv.`}
                                                </span>
                                            </div>
                                        </div>
                                        <div 
                                            className="w-full bg-gray-100 rounded-full h-3 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                                            onClick={() => {
                                                setSelectedMetric({ title: 'Conversion Funnel', dataKey: 'conversion_funnel', label: step.label, value: step.value });
                                                setShowBreakdownDialog(true);
                                            }}
                                        >
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
                            {!data.application_growth || data.application_growth.length === 0 ? (
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
                    <div 
                        className="card p-6 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => {
                            setSelectedMetric({ title: 'Lead Sources', dataKey: 'lead_sources' });
                            setShowBreakdownDialog(true);
                        }}
                    >
                        <h3 className="h3 mb-6 flex items-center justify-between">
                            Lead Sources
                            <span className="text-xs font-normal text-[var(--cy-text-muted)]">Click to view by country</span>
                        </h3>
                        {!data.lead_sources || data.lead_sources.length === 0 ? (
                            <div className="flex items-center justify-center h-48 bg-gray-50 rounded text-sm text-[var(--cy-text-muted)]">No data</div>
                        ) : data.lead_sources.length < 5 ? (
                            // Use Bar Chart for few items
                            <div className="space-y-4">
                                {data.lead_sources.map((item, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span>{formatLeadSourceLabel(item.label)}</span>
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
                                            <span className="text-[var(--cy-text-secondary)] truncate flex-1">{formatLeadSourceLabel(item.label)}</span>
                                            <span className="font-bold">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Call Outcomes */}
                    <div 
                        className="card p-6 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => {
                            setSelectedMetric({ title: 'Call Outcomes', dataKey: 'call_outcomes' });
                            setShowBreakdownDialog(true);
                        }}
                    >
                        <h3 className="h3 mb-6 flex items-center justify-between">
                            Call Outcomes
                            <span className="text-xs font-normal text-[var(--cy-text-muted)]">Click to view by country</span>
                        </h3>
                        {!data.call_outcomes || data.call_outcomes.length === 0 ? (
                            <div className="flex items-center justify-center h-48 bg-gray-50 rounded text-sm text-[var(--cy-text-muted)]">No call data</div>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>

                    {/* Top Cities */}
                    <div 
                        className="card p-6 cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => {
                            setSelectedMetric({ title: 'Top Cities', dataKey: 'demographics' });
                            setShowBreakdownDialog(true);
                        }}
                    >
                        <h3 className="h3 mb-6 flex items-center justify-between">
                            Top Cities
                            <span className="text-xs font-normal text-[var(--cy-text-muted)]">Click to view by country</span>
                        </h3>
                        {!data.demographics || data.demographics.length === 0 ? (
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
                                    <th className="px-6 py-3 text-center">Leads <span className="text-xs font-normal">(Act/Tgt)</span></th>
                                    <th className="px-6 py-3 text-center">Calls <span className="text-xs font-normal">(Act/Tgt)</span></th>
                                    <th className="px-6 py-3 text-center">Apps <span className="text-xs font-normal">(Act/Tgt)</span></th>
                                    <th className="px-6 py-3 text-center">Conversion Rate</th>
                                    <th className="px-6 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--cy-border)]">
                                {data.counselor_stats && data.counselor_stats.map((c, i) => (
                                    <tr key={i} className="hover:bg-[var(--cy-bg-page)] transition-colors">
                                        <td className="px-6 py-4 font-medium text-[var(--cy-navy)]">{c.name}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold">{c.leads_assigned}</span>
                                                <span className="text-xs text-gray-500">/ {c.targets?.leads || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold">{c.calls_made}</span>
                                                <span className="text-xs text-gray-500">/ {c.targets?.calls || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold">{c.applications}</span>
                                                <span className="text-xs text-gray-500">/ {c.targets?.applications || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.conversion_rate > 20 ? 'bg-green-100 text-green-700' :
                                                c.conversion_rate > 10 ? 'bg-blue-100 text-blue-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                {c.conversion_rate}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => openTargetModal(c)}
                                                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                                                title="Set Monthly Target"
                                            >
                                                <TrendingUp className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {(!data.counselor_stats || data.counselor_stats.length === 0) && (
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

            {/* Country-wise Breakdown Dialog */}
            {showBreakdownDialog && selectedMetric && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden animate-in fade-in duration-200">
                        {/* Header */}
                        <div className="bg-[var(--cy-navy)] p-4 sm:p-6 text-white border-b border-[var(--cy-navy-light)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/10">
                                        <img src="/logo.png" alt="Cybrik Logo" className="h-8 w-auto brightness-0 invert opacity-90" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold tracking-tight text-white">Global Performance Report</h3>
                                        <p className="text-[var(--cy-text-muted)] text-sm">Real-time country breakdown</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowBreakdownDialog(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-170px)] bg-[var(--cy-bg-page)]">
                            {data?.country_breakdown && Object.keys(data.country_breakdown).length > 0 ? (
                                <div className="space-y-4">
                                    {Object.entries(data.country_breakdown).map(([country, countryData]) => {
                                        // Calculate conversion stats
                                        const totalLeads = countryData.total_leads ?? 0;
                                        const convertedLeads = countryData.total_converted_leads ?? 0;
                                        const totalApps = countryData.total_applications ?? 0;
                                        const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : "0.00";
                                        
                                        // Get conversion funnel data
                                        const funnel = countryData.conversion_funnel || [];
                                        
                                        return (
                                            <div 
                                                key={country}
                                                className="rounded-xl border border-[var(--cy-border)] bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-all group"
                                            >
                                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                                    <div className="flex items-center gap-3 min-w-[200px]">
                                                        <div className="w-10 h-10 rounded-full bg-[var(--cy-bg-page)] text-xl flex items-center justify-center border border-[var(--cy-border)] group-hover:border-[var(--cy-lime)] transition-colors">🌍</div>
                                                        <div>
                                                            <div className="font-bold text-[var(--cy-navy)] text-lg">{country}</div>
                                                            <div className="text-xs text-[var(--cy-text-secondary)] mt-0.5">{totalLeads} leads • {convertedLeads} converted</div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-3 flex-1 lg:max-w-xl">
                                                        <div className="rounded-lg bg-[var(--cy-lime-light)]/50 border border-[var(--cy-lime)]/20 px-3 py-2">
                                                            <p className="text-[10px] uppercase tracking-wider text-[var(--cy-lime-hover)] font-bold mb-1">Converted</p>
                                                            <p className="text-xl font-bold text-[var(--cy-navy)]">{convertedLeads}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-[var(--cy-bg-page)] border border-[var(--cy-border)] px-3 py-2">
                                                            <p className="text-[10px] uppercase tracking-wider text-[var(--cy-text-secondary)] font-semibold mb-1">Total Leads</p>
                                                            <p className="text-xl font-bold text-[var(--cy-navy)]">{totalLeads}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-[var(--cy-bg-page)] border border-[var(--cy-border)] px-3 py-2">
                                                            <p className="text-[10px] uppercase tracking-wider text-[var(--cy-text-secondary)] font-semibold mb-1">Conv. Rate</p>
                                                            <p className="text-xl font-bold text-[var(--cy-navy)]">{conversionRate}%</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {selectedMetric.dataKey === 'conversion_funnel' ? (
                                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {funnel.map((step, idx) => {
                                                            const maxValue = Math.max(...funnel.map(s => s.value));
                                                            const widthPercent = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
                                                            return (
                                                                <div key={idx} className="rounded-lg bg-white border border-gray-100 px-3 py-2">
                                                                    <div className="flex items-center justify-between text-xs mb-1">
                                                                        <span className="font-medium text-[var(--cy-navy)]">{step.label}</span>
                                                                        <span className="font-bold text-[var(--cy-navy)]">{step.value}</span>
                                                                    </div>
                                                                    <div className="h-2 w-full rounded-full bg-gray-100">
                                                                        <div
                                                                            className="h-2 rounded-full transition-all duration-500"
                                                                            style={{
                                                                                width: `${widthPercent}%`,
                                                                                backgroundColor: step.color || 'var(--cy-primary)'
                                                                            }}
                                                                        ></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {Array.isArray(countryData[selectedMetric.dataKey]) &&
                                                            (countryData[selectedMetric.dataKey] as any[]).slice(0, 6).map((item, idx) => (
                                                                <span key={idx} className="inline-flex items-center gap-2 rounded-full bg-gray-50 border border-gray-100 px-3 py-1 text-xs">
                                                                    <span
                                                                        className="w-2 h-2 rounded-full"
                                                                        style={{ backgroundColor: item.color || 'var(--cy-primary)' }}
                                                                    ></span>
                                                                    <span className="text-[var(--cy-text-secondary)]">
                                                                        {selectedMetric.dataKey === 'lead_sources' ? formatLeadSourceLabel(item.label) : item.label}
                                                                    </span>
                                                                    <span className="font-bold text-[var(--cy-navy)]">{item.value}</span>
                                                                </span>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Globe className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-[var(--cy-text-muted)] text-sm">
                                        No country-specific data available. Select countries from the filters above to view breakdown.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-200 p-4 bg-gray-50">
                            <div className="flex items-center justify-between text-xs text-[var(--cy-text-muted)]">
                                <span>💡 Click on any chart or metric to view detailed country breakdown</span>
                                <button
                                    onClick={() => setShowBreakdownDialog(false)}
                                    className="btn btn-sm btn-primary"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Target Setting Modal */}
            {targetModalOpen && selectedCounselor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-[var(--cy-bg-surface)] p-6 rounded-xl shadow-2xl w-full max-w-md border border-[var(--cy-border)] animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-[var(--cy-navy)]">Set Monthly Targets for {selectedCounselor.name}</h3>
                            <button onClick={() => setTargetModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Leads Target</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-primary)] focus:border-transparent outline-none transition-all"
                                        value={targetForm.leads}
                                        onChange={e => setTargetForm({...targetForm, leads: parseInt(e.target.value) || 0})}
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">Leads</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Calls Target</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-primary)] focus:border-transparent outline-none transition-all"
                                        value={targetForm.calls}
                                        onChange={e => setTargetForm({...targetForm, calls: parseInt(e.target.value) || 0})}
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">Calls</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Applications Target</label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-primary)] focus:border-transparent outline-none transition-all"
                                        value={targetForm.applications}
                                        onChange={e => setTargetForm({...targetForm, applications: parseInt(e.target.value) || 0})}
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">Apps</span>
                                </div>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                                <p>Targets are set for the current month and will reset automatically next month.</p>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button 
                                onClick={() => setTargetModalOpen(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveTarget}
                                className="px-4 py-2 bg-[var(--cy-lime)] text-[var(--cy-navy)] font-bold rounded-lg hover:brightness-110 transition-all shadow-md text-sm"
                            >
                                Save Targets
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
