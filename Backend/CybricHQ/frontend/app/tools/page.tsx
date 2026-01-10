"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Calculator, DollarSign, TrendingUp, RefreshCw, ArrowRight } from "lucide-react";

export default function ToolsPage() {
    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <Calculator className="w-10 h-10 text-[var(--cy-lime)]" />
                                Tools & Calculators
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                Utility tools for revenue estimation and financial planning.
                            </p>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <RevenueCalculator />
                    <CurrencyConverter />
                    <ROICalculator />
                </div>
            </div>
        </DashboardLayout>
    );
}

import apiFetch from "@/lib/api";

function RevenueCalculator() {
    const [apps, setApps] = useState(100);
    const [avgRevenue, setAvgRevenue] = useState(500);
    const [total, setTotal] = useState(0);
    const [source, setSource] = useState<'manual' | 'system'>('manual');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setTotal(apps * avgRevenue);
    }, [apps, avgRevenue]);

    useEffect(() => {
        if (source === 'system') {
            const fetchSystemData = async () => {
                setLoading(true);
                try {
                    const data = await apiFetch('/api/reports/summary/');
                    if (data && typeof data.total_applications === 'number') {
                        setApps(data.total_applications);
                    }
                } catch (error) {
                    console.error("Failed to fetch system data", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchSystemData();
        }
    }, [source]);

    return (
        <div className="card p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                    <DollarSign size={20} />
                </div>
                <h3 className="h3">Revenue Projector</h3>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-[var(--cy-text-secondary)] mb-2">
                        Data Source
                    </label>
                    <div className="flex p-1 bg-[var(--cy-bg-page)] rounded-lg border border-[var(--cy-border)]">
                        <button
                            onClick={() => setSource('manual')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${source === 'manual'
                                ? 'bg-white text-[var(--cy-navy)] shadow-sm'
                                : 'text-[var(--cy-text-muted)] hover:text-[var(--cy-text-secondary)]'
                                }`}
                        >
                            Manual Entry
                        </button>
                        <button
                            onClick={() => setSource('system')}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${source === 'system'
                                ? 'bg-white text-[var(--cy-navy)] shadow-sm'
                                : 'text-[var(--cy-text-muted)] hover:text-[var(--cy-text-secondary)]'
                                }`}
                        >
                            System Data
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-[var(--cy-text-secondary)] mb-1">
                        Number of Applications
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={apps}
                            onChange={(e) => setApps(Number(e.target.value))}
                            disabled={source === 'system'}
                            className={`input ${source === 'system' ? 'bg-gray-50 text-gray-500' : ''}`}
                        />
                        {loading && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <RefreshCw size={14} className="animate-spin text-[var(--cy-lime)]" />
                            </div>
                        )}
                    </div>
                    {source === 'system' && (
                        <p className="text-xs text-[var(--cy-text-muted)] mt-1">
                            Fetching active applications from database.
                        </p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--cy-text-secondary)] mb-1">
                        Average Revenue per App ($)
                    </label>
                    <input
                        type="number"
                        value={avgRevenue}
                        onChange={(e) => setAvgRevenue(Number(e.target.value))}
                        className="input"
                    />
                </div>

                <div className="pt-4 border-t border-[var(--cy-border)] mt-4">
                    <div className="text-sm text-[var(--cy-text-muted)]">Projected Total Revenue</div>
                    <div className="text-3xl font-bold text-[var(--cy-navy)]">
                        ${total.toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CurrencyConverter() {
    const [amount, setAmount] = useState(1000);
    const [from, setFrom] = useState("USD");
    const [to, setTo] = useState("EUR");
    const [result, setResult] = useState(0);
    const [rates, setRates] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchRates = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await res.json();
            if (data.result === "success") {
                setRates(data.rates);
                setLastUpdated(new Date(data.time_last_update_utc).toLocaleString());
            } else {
                setError("Failed to fetch rates");
            }
        } catch (err) {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRates();
    }, []);

    useEffect(() => {
        if (rates[from] && rates[to]) {
            const baseAmount = amount / rates[from];
            const converted = baseAmount * rates[to];
            setResult(converted);
        }
    }, [amount, from, to, rates]);

    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </div>
                    <h3 className="h3">Currency Converter</h3>
                </div>
                <button
                    onClick={fetchRates}
                    className="btn btn-ghost btn-sm text-xs text-[var(--cy-text-muted)] hover:text-[var(--cy-navy)]"
                    title="Refresh Rates"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-[var(--cy-text-secondary)] mb-1">
                        Amount
                    </label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="input"
                    />
                </div>

                {loading && Object.keys(rates).length === 0 ? (
                    <div className="py-8 text-center text-sm text-[var(--cy-text-muted)]">
                        Loading exchange rates...
                    </div>
                ) : error ? (
                    <div className="py-8 text-center text-sm text-red-500">
                        {error}
                        <button onClick={fetchRates} className="block mx-auto mt-2 text-xs underline">Try Again</button>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-end">
                            <div>
                                <label className="block text-sm font-medium text-[var(--cy-text-secondary)] mb-1">From</label>
                                <select value={from} onChange={(e) => setFrom(e.target.value)} className="input">
                                    {Object.keys(rates).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="pb-2 text-[var(--cy-text-muted)]">
                                <ArrowRight size={20} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[var(--cy-text-secondary)] mb-1">To</label>
                                <select value={to} onChange={(e) => setTo(e.target.value)} className="input">
                                    {Object.keys(rates).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[var(--cy-border)] mt-4">
                            <div className="text-sm text-[var(--cy-text-muted)]">Converted Amount</div>
                            <div className="text-3xl font-bold text-[var(--cy-navy)]">
                                {result.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-lg text-[var(--cy-text-secondary)]">{to}</span>
                            </div>
                            {lastUpdated && (
                                <div className="text-[10px] text-[var(--cy-text-muted)] mt-2 text-right">
                                    Rates updated: {lastUpdated}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function ROICalculator() {
    const [spend, setSpend] = useState(5000);
    const [revenue, setRevenue] = useState(15000);
    const [roi, setRoi] = useState(0);

    useEffect(() => {
        if (spend === 0) setRoi(0);
        else setRoi(((revenue - spend) / spend) * 100);
    }, [spend, revenue]);

    return (
        <div className="card p-6 lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <TrendingUp size={20} />
                </div>
                <h3 className="h3">Marketing ROI Calculator</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4 md:col-span-2">
                    <div>
                        <label className="block text-sm font-medium text-[var(--cy-text-secondary)] mb-1">
                            Total Marketing Spend ($)
                        </label>
                        <input
                            type="number"
                            value={spend}
                            onChange={(e) => setSpend(Number(e.target.value))}
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--cy-text-secondary)] mb-1">
                            Total Revenue Generated ($)
                        </label>
                        <input
                            type="number"
                            value={revenue}
                            onChange={(e) => setRevenue(Number(e.target.value))}
                            className="input"
                        />
                    </div>
                </div>

                <div className="flex flex-col justify-center items-center p-6 bg-[var(--cy-bg-page)] rounded-xl border border-[var(--cy-border)]">
                    <div className="text-sm text-[var(--cy-text-muted)] mb-2">Return on Investment</div>
                    <div className={`text-4xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {roi.toFixed(1)}%
                    </div>
                    <div className="text-xs text-[var(--cy-text-muted)] mt-2">
                        {roi >= 0 ? 'Positive Return' : 'Negative Return'}
                    </div>
                </div>
            </div>
        </div>
    );
}
