"use client";

import React, { useState, useEffect } from 'react';
import apiFetch from '@/lib/api';
import { Filter, Globe, ChevronDown, ChevronUp } from 'lucide-react';

interface CountryStats {
    country: string;
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    junk: number;
    lost: number;
}

interface ConversionFunnel {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    converted: number;
    junk: number;
    lost: number;
}

interface CountryWiseWidgetProps {
    onFilterChange?: (country: string | null) => void;
    className?: string;
}

// Helper to get country code for flag CDN
const getCountryCode = (countryName: string): string => {
    const map: Record<string, string> = {
        'usa': 'us', 'united states': 'us', 'us': 'us', 'uk': 'gb', 'united kingdom': 'gb', 'great britain': 'gb',
        'canada': 'ca', 'australia': 'au', 'germany': 'de', 'ireland': 'ie', 'new zealand': 'nz',
        'france': 'fr', 'netherlands': 'nl', 'singapore': 'sg', 'uae': 'ae', 'dubai': 'ae',
        'india': 'in', 'china': 'cn', 'japan': 'jp', 'italy': 'it', 'spain': 'es', 'sweden': 'se',
        'switzerland': 'ch', 'malaysia': 'my', 'south korea': 'kr', 'vietnam': 'vn'
    };
    return map[countryName.toLowerCase()] || 'un'; // 'un' for unknown/united nations generic
};

export default function CountryWiseWidget({ onFilterChange, className = "" }: CountryWiseWidgetProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{
        country_distribution: CountryStats[];
        conversion_funnel: ConversionFunnel;
        conversion_rate_percent: number;
        available_countries: string[];
        active_filter: string | null;
    } | null>(null);

    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(true);

    const fetchStats = async (country: string | null = null) => {
        setLoading(true);
        try {
            const query = country ? `?country=${encodeURIComponent(country)}` : '';
            const response = await apiFetch(`/api/dashboard/country-stats/${query}`);
            if (response) {
                setData(response);
            }
        } catch (error) {
            console.error("Failed to fetch country stats:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats(selectedCountry);
    }, [selectedCountry]);

    const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value || null;
        setSelectedCountry(val);
        if (onFilterChange) {
            onFilterChange(val);
        }
    };

    if (loading && !data) {
        return (
            <div className={`card p-6 h-[400px] flex items-center justify-center ${className}`}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--cy-blue)]"></div>
            </div>
        );
    }

    if (!data) return null;

    // Find max total for progress bar calculations
    const maxTotal = Math.max(...data.country_distribution.map(c => c.total), 1);

    return (
        <div className={`card p-0 overflow-hidden ${className}`}>
            {/* Header with Filter */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                        <Globe size={18} />
                    </div>
                    <div>
                        <h3 className="font-bold text-[var(--cy-navy)]">Geographic Insights</h3>
                        <p className="text-xs text-[var(--cy-text-muted)]">Lead distribution by preferred country</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                            value={selectedCountry || ""}
                            onChange={handleCountryChange}
                            className="pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        >
                            <option value="">All Countries</option>
                            {data.available_countries.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1.5 text-gray-400 hover:text-[var(--cy-navy)] hover:bg-gray-100 rounded-md transition-colors"
                    >
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="p-6 grid lg:grid-cols-3 gap-8">
                    {/* Left: Country List with Flags */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-[var(--cy-navy)]">Top Destinations</h4>
                            <span className="text-xs text-gray-500">Sorted by lead volume</span>
                        </div>

                        <div className="space-y-3 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {data.country_distribution.length > 0 ? (
                                data.country_distribution.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 overflow-hidden flex items-center justify-center">
                                            <img
                                                src={`https://flagcdn.com/w40/${getCountryCode(item.country)}.png`}
                                                alt={item.country}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    // Fallback if image fails
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="font-semibold text-sm text-[var(--cy-navy)]">{item.country || "Unknown"}</span>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-emerald-600 font-medium">{item.converted} Converted</span>
                                                    <span className="text-gray-400">|</span>
                                                    <span className="font-bold text-[var(--cy-navy)]">{item.total} Leads</span>
                                                </div>
                                            </div>
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[var(--cy-blue)] rounded-full group-hover:bg-[var(--cy-blue-dark)] transition-colors"
                                                    style={{ width: `${(item.total / maxTotal) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                                    <Globe className="w-8 h-8 opacity-20" />
                                    No country data available yet
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Funnel & Conversion Stats */}
                    <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 flex flex-col justify-between h-full">
                        <div>
                            <h4 className="text-sm font-semibold text-[var(--cy-navy)] mb-4">Conversion Funnel</h4>

                            {data.country_distribution.length > 0 ? (
                                <div className="space-y-4">
                                    {/* Funnel Steps */}
                                    <div className="relative pt-2">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500">Total Leads</span>
                                            <span className="font-medium">{data.conversion_funnel.total}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }}></div>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500">Contacted</span>
                                            <span className="font-medium">{data.conversion_funnel.contacted}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                                style={{ width: `${data.conversion_funnel.total ? (data.conversion_funnel.contacted / data.conversion_funnel.total * 100) : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500">Qualified</span>
                                            <span className="font-medium">{data.conversion_funnel.qualified}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                                style={{ width: `${data.conversion_funnel.total ? (data.conversion_funnel.qualified / data.conversion_funnel.total * 100) : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="relative">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500">Converted</span>
                                            <span className="font-medium">{data.conversion_funnel.converted}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                                style={{ width: `${data.conversion_funnel.total ? (data.conversion_funnel.converted / data.conversion_funnel.total * 100) : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 py-10 text-center">No data to show funnel</p>
                            )}
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Conversion Rate</p>
                                    <p className="text-2xl font-bold text-[var(--cy-navy)]">{data.conversion_rate_percent}%</p>
                                </div>
                                <div className={`p-2 rounded-full ${data.conversion_rate_percent >= 10 ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
