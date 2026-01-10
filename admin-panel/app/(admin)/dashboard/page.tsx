'use client';

import { useEffect, useState } from 'react';
import { tenantApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CreditCard, TrendingUp, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface DashboardStats {
    total_tenants: number;
    new_tenants_30d: number;
    active_subscriptions: number;
    mrr: number;
    system_status: string;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch real stats from backend
                const data: any = await tenantApi.dashboardStats();
                setStats(data);
            } catch (err) {
                console.error("Failed to fetch dashboard stats", err);
                // Fallback mock data if API fails
                setStats({
                    total_tenants: 0,
                    new_tenants_30d: 0,
                    active_subscriptions: 0,
                    mrr: 0,
                    system_status: 'Offline',
                });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                    <p className="text-slate-500">Overview of your platform performance</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Tenants</CardTitle>
                        <div className="p-2 bg-brand-green-50 rounded-lg">
                            <Users className="h-4 w-4 text-brand-green" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{stats?.total_tenants || 0}</div>
                        <p className="text-xs text-slate-500 mt-1">
                            {stats?.new_tenants_30d ? `+${stats.new_tenants_30d} in last 30 days` : 'Organizations onboarded'}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Active Subscriptions</CardTitle>
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <CreditCard className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">{stats?.active_subscriptions || 0}</div>
                        <p className="text-xs text-slate-500 mt-1">Paid plans active</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Monthly Revenue</CardTitle>
                        <div className="p-2 bg-purple-50 rounded-lg">
                            <TrendingUp className="h-4 w-4 text-purple-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-slate-900">${stats?.mrr?.toLocaleString() || 0}</div>
                        {/* No history yet for growth rate */}
                        <p className="text-xs text-slate-500 mt-1">Recurring Revenue</p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">System Status</CardTitle>
                        <div className="p-2 bg-green-50 rounded-lg">
                            <Activity className="h-4 w-4 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{stats?.system_status || 'Unknown'}</div>
                        <p className="text-xs text-slate-500 mt-1">All services operational</p>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-slate-900">Recent Tenants</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-8 text-slate-400">
                            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No tenants yet. Create your first one!</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-slate-900">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <a href="/tenants" className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group">
                            <span className="font-medium text-slate-700">Add New Tenant</span>
                            <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-brand-green transition-colors" />
                        </a>
                        <a href="/billing" className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group">
                            <span className="font-medium text-slate-700">Manage Products</span>
                            <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-brand-green transition-colors" />
                        </a>
                        <a href="/telephony" className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group">
                            <span className="font-medium text-slate-700">Configure Telephony</span>
                            <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-brand-green transition-colors" />
                        </a>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
