"use client";

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import apiFetch from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

interface Integration {
    id: number;
    platform: string;
    platform_display: string;
    account_id: string;
    account_name: string;
    status: string;
    status_display: string;
    campaigns_count: number;
    last_synced_at: string | null;
}

interface Campaign {
    id: number;
    platform: string;
    platform_display: string;
    name: string;
    status: string;
    status_display: string;
    objective: string;
    total_spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
    start_date: string;
}

interface Summary {
    total_campaigns: number;
    active_campaigns: number;
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    avg_ctr: number;
    avg_cpc: number;
    avg_cpm: number;
    platform_breakdown: {
        google_ads: { campaigns: number; spend: number; conversions: number };
        meta_ads: { campaigns: number; spend: number; conversions: number };
    };
    currency: string;
}

interface GoogleAdsForm {
    account_id: string;
    account_name: string;
    developer_token: string;
    client_id: string;
    client_secret: string;
    refresh_token: string;
    login_customer_id: string;
}

interface MetaAdsForm {
    account_id: string;
    account_name: string;
    access_token: string;
    app_id: string;
    app_secret: string;
}

const initialGoogleForm: GoogleAdsForm = {
    account_id: '',
    account_name: '',
    developer_token: '',
    client_id: '',
    client_secret: '',
    refresh_token: '',
    login_customer_id: '',
};

const initialMetaForm: MetaAdsForm = {
    account_id: '',
    account_name: '',
    access_token: '',
    app_id: '',
    app_secret: '',
};

export default function MarketingAdsPage() {
    const [integrations, setIntegrations] = useState<Integration[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<number | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [connectPlatform, setConnectPlatform] = useState<'google_ads' | 'meta_ads'>('google_ads');
    const [googleForm, setGoogleForm] = useState<GoogleAdsForm>(initialGoogleForm);
    const [metaForm, setMetaForm] = useState<MetaAdsForm>(initialMetaForm);
    const [connecting, setConnecting] = useState(false);
    const [connectError, setConnectError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'integrations'>('overview');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [integrationsData, campaignsData, summaryData] = await Promise.all([
                apiFetch('/api/integrations/'),
                apiFetch('/api/campaigns/'),
                apiFetch('/api/campaigns/summary/')
            ]);
            setIntegrations(integrationsData);
            setCampaigns(campaignsData);
            setSummary(summaryData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async (integrationId: number) => {
        setSyncing(integrationId);
        setSyncError(null);
        try {
            const result = await apiFetch(`/api/integrations/${integrationId}/sync/`, { method: 'POST' });
            if (result.error) {
                setSyncError(result.error);
            }
            await fetchData();
        } catch (error: any) {
            console.error('Sync error:', error);
            setSyncError(error.message || 'Sync failed');
        } finally {
            setSyncing(null);
        }
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setConnecting(true);
        setConnectError(null);

        try {
            let payload: any;

            if (connectPlatform === 'google_ads') {
                payload = {
                    platform: 'google_ads',
                    account_id: googleForm.account_id,
                    account_name: googleForm.account_name,
                    refresh_token: googleForm.refresh_token,
                    metadata: {
                        developer_token: googleForm.developer_token,
                        client_id: googleForm.client_id,
                        client_secret: googleForm.client_secret,
                        login_customer_id: googleForm.login_customer_id || null,
                    }
                };
            } else {
                payload = {
                    platform: 'meta_ads',
                    account_id: metaForm.account_id,
                    account_name: metaForm.account_name,
                    access_token: metaForm.access_token,
                    metadata: {
                        app_id: metaForm.app_id,
                        app_secret: metaForm.app_secret,
                    }
                };
            }

            await apiFetch('/api/integrations/', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            setShowConnectModal(false);
            setGoogleForm(initialGoogleForm);
            setMetaForm(initialMetaForm);
            await fetchData();
        } catch (error: any) {
            console.error('Connect error:', error);
            setConnectError(error.message || 'Connection failed');
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async (integrationId: number) => {
        if (!confirm('Are you sure you want to disconnect this integration?')) return;
        try {
            await apiFetch(`/api/integrations/${integrationId}/disconnect/`, { method: 'POST' });
            await fetchData();
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    const formatNumber = (value: number) => {
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
        return value.toString();
    };

    const getPlatformIcon = (platform: string) => {
        if (platform === 'google_ads') {
            return (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C6.505 2 1.545 6.96 1.545 13s4.96 11 11 11c6.348 0 10.545-4.464 10.545-10.75 0-.721-.065-1.413-.189-2.011h-10.356z" />
                    </svg>
                </div>
            );
        }
        return (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
            </div>
        );
    };

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <svg className="w-10 h-10 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                                </svg>
                                Ad Manager
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                Track and manage your Google & Meta advertising campaigns.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => { setConnectPlatform('google_ads'); setShowConnectModal(true); setConnectError(null); }}
                                className="px-4 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl font-medium hover:bg-white/20 transition-all flex items-center gap-2"
                            >
                                <svg className="w-5 h-5 text-blue-300" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C6.505 2 1.545 6.96 1.545 13s4.96 11 11 11c6.348 0 10.545-4.464 10.545-10.75 0-.721-.065-1.413-.189-2.011h-10.356z" />
                                </svg>
                                Connect Google Ads
                            </button>
                            <button
                                onClick={() => { setConnectPlatform('meta_ads'); setShowConnectModal(true); setConnectError(null); }}
                                className="px-5 py-3 bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-xl font-bold hover:brightness-110 transition-all flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                                </svg>
                                Connect Meta Ads
                            </button>
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
                </div>

                {/* Sync Error Alert */}
                {syncError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-sm font-medium text-red-800">Sync Failed</p>
                            <p className="text-sm text-red-600 mt-1">{syncError}</p>
                        </div>
                        <button onClick={() => setSyncError(null)} className="ml-auto text-red-400 hover:text-red-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="flex gap-6">
                        {(['overview', 'campaigns', 'integrations'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                    ? 'border-[var(--cy-navy)] text-[var(--cy-navy)]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </nav>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--cy-navy)]"></div>
                    </div>
                ) : (
                    <>
                        {/* Overview Tab */}
                        {activeTab === 'overview' && (
                            <div className="space-y-6">
                                {/* KPI Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-500 font-medium">Total Spend</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">{summary ? formatCurrency(summary.total_spend) : '$0'}</p>
                                            </div>
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center text-sm">
                                            <span className="text-emerald-600 font-medium">Across {summary?.total_campaigns || 0} campaigns</span>
                                        </div>
                                    </motion.div>

                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-500 font-medium">Impressions</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">{summary ? formatNumber(summary.total_impressions) : '0'}</p>
                                            </div>
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center text-sm">
                                            <span className="text-blue-600 font-medium">CPM: {formatCurrency(summary?.avg_cpm || 0)}</span>
                                        </div>
                                    </motion.div>

                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-500 font-medium">Clicks</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">{summary ? formatNumber(summary.total_clicks) : '0'}</p>
                                            </div>
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center text-sm">
                                            <span className="text-purple-600 font-medium">CTR: {summary?.avg_ctr || 0}%</span>
                                        </div>
                                    </motion.div>

                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-500 font-medium">Conversions</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">{summary ? formatNumber(summary.total_conversions) : '0'}</p>
                                            </div>
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center text-sm">
                                            <span className="text-orange-600 font-medium">CPC: {formatCurrency(summary?.avg_cpc || 0)}</span>
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Platform Breakdown */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Breakdown</h3>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    {getPlatformIcon('google_ads')}
                                                    <div>
                                                        <p className="font-medium text-gray-900">Google Ads</p>
                                                        <p className="text-sm text-gray-500">{summary?.platform_breakdown?.google_ads?.campaigns || 0} campaigns</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">{formatCurrency(summary?.platform_breakdown?.google_ads?.spend || 0)}</p>
                                                    <p className="text-sm text-gray-500">{summary?.platform_breakdown?.google_ads?.conversions || 0} conversions</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    {getPlatformIcon('meta_ads')}
                                                    <div>
                                                        <p className="font-medium text-gray-900">Meta Ads</p>
                                                        <p className="text-sm text-gray-500">{summary?.platform_breakdown?.meta_ads?.campaigns || 0} campaigns</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-gray-900">{formatCurrency(summary?.platform_breakdown?.meta_ads?.spend || 0)}</p>
                                                    <p className="text-sm text-gray-500">{summary?.platform_breakdown?.meta_ads?.conversions || 0} conversions</p>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>

                                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Connected Accounts</h3>
                                        {integrations.length === 0 ? (
                                            <div className="text-center py-8">
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                </div>
                                                <p className="text-gray-500">No ad accounts connected yet</p>
                                                <p className="text-sm text-gray-400 mt-1">Connect Google Ads or Meta Ads to get started</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {integrations.map((integration) => (
                                                    <div key={integration.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                                        <div className="flex items-center gap-3">
                                                            {getPlatformIcon(integration.platform)}
                                                            <div>
                                                                <p className="font-medium text-gray-900">{integration.account_name || integration.account_id}</p>
                                                                <p className="text-sm text-gray-500">{integration.platform_display}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${integration.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : integration.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                {integration.status_display}
                                                            </span>
                                                            <button onClick={() => handleSync(integration.id)} disabled={syncing === integration.id} className="p-2 text-gray-500 hover:text-[var(--cy-navy)] transition-colors">
                                                                <svg className={`w-4 h-4 ${syncing === integration.id ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                </div>
                            </div>
                        )}

                        {/* Campaigns Tab */}
                        {activeTab === 'campaigns' && (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Campaign</th>
                                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Platform</th>
                                                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Spend</th>
                                                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Impressions</th>
                                                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
                                                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">CTR</th>
                                                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Conversions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {campaigns.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                                        <div className="flex flex-col items-center">
                                                            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                            <p>No campaigns found</p>
                                                            <p className="text-sm text-gray-400 mt-1">Connect an ad account and sync to see campaigns</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                campaigns.map((campaign) => (
                                                    <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div>
                                                                <p className="font-medium text-gray-900">{campaign.name}</p>
                                                                <p className="text-sm text-gray-500">{campaign.objective}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${campaign.platform === 'google_ads' ? 'bg-gradient-to-br from-blue-500 to-green-500' : 'bg-gradient-to-br from-blue-600 to-purple-600'}`}>
                                                                    <span className="text-white text-xs font-bold">{campaign.platform === 'google_ads' ? 'G' : 'M'}</span>
                                                                </div>
                                                                <span className="text-sm text-gray-600">{campaign.platform_display}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${campaign.status === 'active' ? 'bg-emerald-100 text-emerald-700' : campaign.status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                {campaign.status_display}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-medium text-gray-900">{formatCurrency(campaign.total_spend)}</td>
                                                        <td className="px-6 py-4 text-right text-gray-600">{formatNumber(campaign.impressions)}</td>
                                                        <td className="px-6 py-4 text-right text-gray-600">{formatNumber(campaign.clicks)}</td>
                                                        <td className="px-6 py-4 text-right text-gray-600">{campaign.ctr}%</td>
                                                        <td className="px-6 py-4 text-right font-medium text-gray-900">{campaign.conversions}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Integrations Tab */}
                        {activeTab === 'integrations' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {integrations.map((integration) => (
                                    <motion.div key={integration.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                {getPlatformIcon(integration.platform)}
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{integration.platform_display}</h3>
                                                    <p className="text-sm text-gray-500">{integration.account_name || integration.account_id}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${integration.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : integration.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {integration.status_display}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="bg-gray-50 rounded-xl p-3">
                                                <p className="text-xs text-gray-500">Campaigns</p>
                                                <p className="text-lg font-bold text-gray-900">{integration.campaigns_count}</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl p-3">
                                                <p className="text-xs text-gray-500">Last Synced</p>
                                                <p className="text-sm font-medium text-gray-900">{integration.last_synced_at ? new Date(integration.last_synced_at).toLocaleDateString() : 'Never'}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button onClick={() => handleSync(integration.id)} disabled={syncing === integration.id} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--cy-navy)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
                                                <svg className={`w-4 h-4 ${syncing === integration.id ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                {syncing === integration.id ? 'Syncing...' : 'Sync Now'}
                                            </button>
                                            <button onClick={() => handleDisconnect(integration.id)} className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-all">
                                                Disconnect
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}

                                {integrations.length === 0 && (
                                    <div className="col-span-2 text-center py-12 bg-white rounded-2xl border border-gray-100">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900">No integrations yet</h3>
                                        <p className="text-gray-500 mt-1 mb-4">Connect your ad accounts to start tracking performance</p>
                                        <div className="flex justify-center gap-3">
                                            <button onClick={() => { setConnectPlatform('google_ads'); setShowConnectModal(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                                                Connect Google Ads
                                            </button>
                                            <button onClick={() => { setConnectPlatform('meta_ads'); setShowConnectModal(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-all">
                                                Connect Meta Ads
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Connect Modal */}
                <AnimatePresence>
                    {showConnectModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
                            >
                                <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {getPlatformIcon(connectPlatform)}
                                            <h3 className="text-lg font-bold text-gray-900">
                                                Connect {connectPlatform === 'google_ads' ? 'Google Ads' : 'Meta Ads'}
                                            </h3>
                                        </div>
                                        <button onClick={() => setShowConnectModal(false)} className="text-gray-400 hover:text-gray-600">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {connectError && (
                                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                        {connectError}
                                    </div>
                                )}

                                <form onSubmit={handleConnect} className="p-6 space-y-4">
                                    {connectPlatform === 'google_ads' ? (
                                        <>
                                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
                                                <strong>Required:</strong> You need a Google Ads API Developer Token and OAuth2 credentials.
                                                <a href="https://developers.google.com/google-ads/api/docs/first-call/overview" target="_blank" rel="noopener noreferrer" className="underline ml-1">Learn more</a>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account ID *</label>
                                                    <input type="text" value={googleForm.account_id} onChange={(e) => setGoogleForm({ ...googleForm, account_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="123-456-7890" required />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                                                    <input type="text" value={googleForm.account_name} onChange={(e) => setGoogleForm({ ...googleForm, account_name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="My Ads Account" />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Developer Token *</label>
                                                <input type="password" value={googleForm.developer_token} onChange={(e) => setGoogleForm({ ...googleForm, developer_token: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="Your developer token" required />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">OAuth Client ID *</label>
                                                    <input type="text" value={googleForm.client_id} onChange={(e) => setGoogleForm({ ...googleForm, client_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="xxxxx.apps.googleusercontent.com" required />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret *</label>
                                                    <input type="password" value={googleForm.client_secret} onChange={(e) => setGoogleForm({ ...googleForm, client_secret: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="GOCSPX-xxx" required />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Refresh Token *</label>
                                                <input type="password" value={googleForm.refresh_token} onChange={(e) => setGoogleForm({ ...googleForm, refresh_token: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="1//0xxx..." required />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Login Customer ID (MCC)</label>
                                                <input type="text" value={googleForm.login_customer_id} onChange={(e) => setGoogleForm({ ...googleForm, login_customer_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="Optional - for manager accounts" />
                                                <p className="text-xs text-gray-500 mt-1">Required if accessing via a manager account</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-sm text-purple-700">
                                                <strong>Required:</strong> You need a Meta App and long-lived access token.
                                                <a href="https://developers.facebook.com/docs/marketing-apis/get-started" target="_blank" rel="noopener noreferrer" className="underline ml-1">Learn more</a>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ad Account ID *</label>
                                                    <input type="text" value={metaForm.account_id} onChange={(e) => setMetaForm({ ...metaForm, account_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="act_1234567890" required />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                                                    <input type="text" value={metaForm.account_name} onChange={(e) => setMetaForm({ ...metaForm, account_name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="My Meta Ads" />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Access Token *</label>
                                                <textarea value={metaForm.access_token} onChange={(e) => setMetaForm({ ...metaForm, access_token: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)] h-20 resize-none" placeholder="EAAxxxxxxx..." required />
                                                <p className="text-xs text-gray-500 mt-1">Use a long-lived access token (60-day or system user token)</p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">App ID</label>
                                                    <input type="text" value={metaForm.app_id} onChange={(e) => setMetaForm({ ...metaForm, app_id: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="1234567890" />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">App Secret</label>
                                                    <input type="password" value={metaForm.app_secret} onChange={(e) => setMetaForm({ ...metaForm, app_secret: e.target.value })} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--cy-lime)]" placeholder="xxxxxxx" />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="pt-4 flex gap-3">
                                        <button type="button" onClick={() => setShowConnectModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                                            Cancel
                                        </button>
                                        <button type="submit" disabled={connecting} className="flex-1 px-4 py-2.5 bg-[var(--cy-navy)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50">
                                            {connecting ? 'Connecting...' : 'Connect'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}
