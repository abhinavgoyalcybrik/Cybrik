"use client";

import React, { useEffect, useState } from 'react';
import apiFetch from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    LayoutDashboard,
    Users,
    TrendingUp,
    BarChart3,
    Filter,
    Bot,
    PieChart,
    DollarSign,
    Save,
    Shield,
    UserCircle,
    Lock,
    Phone,
    FileText,
    CheckSquare,
    Settings
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// Define widget categories for better organization
const WIDGET_CATEGORIES = {
    'Key Metrics': [
        {
            id: 'stat_leads',
            name: 'Total Leads',
            description: 'Summary of all leads in the system',
            icon: Users,
            color: 'text-[var(--cy-lime)]'
        },
        {
            id: 'stat_applicants',
            name: 'Total Applicants',
            description: 'Count of active applications',
            icon: UserCircle,
            color: 'text-emerald-400'
        },
        {
            id: 'stat_conversion',
            name: 'Conversion Rate',
            description: 'Lead to applicant conversion %',
            icon: TrendingUp,
            color: 'text-cyan-400'
        },
    ],
    'Analytics & Trends': [
        {
            id: 'trend_chart',
            name: 'Lead Trend Chart',
            description: 'Visual timeline of lead acquisition',
            icon: BarChart3,
            color: 'text-blue-400'
        },
        {
            id: 'funnel_chart',
            name: 'Conversion Funnel',
            description: 'Stage-by-stage pipeline view',
            icon: Filter,
            color: 'text-indigo-400'
        },
        {
            id: 'app_status',
            name: 'Application Status',
            description: 'Distribution of application statuses',
            icon: PieChart,
            color: 'text-sky-400'
        },
    ],
    'Operations & Costs': [
        {
            id: 'llm_usage',
            name: 'LLM Usage',
            description: 'AI token consumption metrics',
            icon: Bot,
            color: 'text-[var(--cy-lime)]'
        },
        {
            id: 'cost_chart',
            name: 'Cost Analysis',
            description: 'Operational cost trends over time',
            icon: DollarSign,
            color: 'text-red-400'
        },
    ]
};

const SIDEBAR_ITEMS = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads', name: 'Leads', icon: Users },
    { id: 'applications', name: 'Applications', icon: FileText },
    { id: 'applicants', name: 'Applicants', icon: UserCircle },
    { id: 'tasks', name: 'Tasks', icon: CheckSquare },
    { id: 'calls', name: 'Calls', icon: Phone },
    { id: 'staff', name: 'Staff', icon: Users },
    { id: 'analytics', name: 'Reports', icon: BarChart3 },
    { id: 'tools', name: 'Tools', icon: DollarSign },
    { id: 'marketing', name: 'Marketing', icon: PieChart },
    { id: 'billing', name: 'Billing', icon: DollarSign },
    { id: 'settings', name: 'Settings', icon: Settings },
];

const ROLES = ['Admin', 'Counsellor', 'Admissions'];

export default function DashboardSettingsPage() {
    const { user, loading: userLoading } = useUser();
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState("Counsellor");
    const [roleLayout, setRoleLayout] = useState<any[]>([]);
    const [sidebarConfig, setSidebarConfig] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState("personal");
    const router = useRouter();

    const isAdmin = (user as any)?.role === 'admin' || user?.is_superuser;

    useEffect(() => {
        if (userLoading) return;
        // Load user config by default for everyone
        loadUserConfig();
    }, [userLoading]);

    useEffect(() => {
        if (userLoading || !isAdmin) return;
        if (activeTab === 'roles') {
            loadRoleConfig(selectedRole);
        }
    }, [selectedRole, userLoading, isAdmin, activeTab]);

    const loadUserConfig = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/api/dashboard/config/');
            // Personal config
            if (res.layout) setRoleLayout(res.layout);
            if (res.sidebar_config) setSidebarConfig(res.sidebar_config);
        } catch (err) {
            console.error("Failed to load user config", err);
        } finally {
            setLoading(false);
        }
    };

    const saveUserConfig = async () => {
        try {
            await apiFetch('/api/dashboard/config/save/', {
                method: 'POST',
                body: JSON.stringify({
                    layout: roleLayout,
                    sidebar_config: sidebarConfig
                }),
            });
            alert("Personal settings saved!");
            window.location.reload();
        } catch (err: any) {
            console.error(err);
            alert(`Failed to save settings: ${err.message || 'Unknown error'}`);
        }
    };

    const loadRoleConfig = async (role: string) => {
        setLoading(true);
        try {
            const res = await apiFetch(`/api/dashboard/config/get-role/?role=${role}`);
            if (res.layout !== null && res.layout !== undefined) {
                setRoleLayout(res.layout);
            } else {
                const DEFAULT_LAYOUT = [
                    { i: 'stat_leads', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
                    { i: 'stat_applicants', x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
                    { i: 'stat_conversion', x: 8, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
                    { i: 'trend_chart', x: 0, y: 2, w: 8, h: 4, minW: 4, minH: 3 },
                    { i: 'funnel_chart', x: 8, y: 2, w: 4, h: 4, minW: 3, minH: 3 },
                    { i: 'llm_usage', x: 0, y: 6, w: 4, h: 3, minW: 3, minH: 2 },
                    { i: 'app_status', x: 4, y: 6, w: 4, h: 3, minW: 3, minH: 2 },
                    { i: 'cost_chart', x: 8, y: 6, w: 4, h: 3, minW: 3, minH: 2 },
                ];
                setRoleLayout(DEFAULT_LAYOUT);
            }

            if (res.sidebar_config) {
                setSidebarConfig(res.sidebar_config);
            } else {
                setSidebarConfig({});
            }
        } catch (err) {
            console.error("Failed to load role config", err);
            setRoleLayout([]);
            setSidebarConfig({});
        } finally {
            setLoading(false);
        }
    };

    const saveRoleConfig = async () => {
        try {
            await apiFetch('/api/dashboard/config/save-role/', {
                method: 'POST',
                body: JSON.stringify({
                    role: selectedRole,
                    layout: roleLayout,
                    sidebar_config: sidebarConfig
                }),
            });
            alert(`Default settings for ${selectedRole} saved!`);
        } catch (err: any) {
            console.error(err);
            alert(`Failed to save role settings: ${err.message || 'Unknown error'}`);
        }
    };

    const toggleWidget = (widgetId: string, currentLayout: any[], setLayoutFunc: Function) => {
        const exists = currentLayout.find(w => w.i === widgetId);
        let newLayout;
        if (exists) {
            newLayout = currentLayout.filter(w => w.i !== widgetId);
        } else {
            const maxY = currentLayout.reduce((max: number, item: any) => Math.max(max, item.y + item.h), 0);
            newLayout = [...currentLayout, { i: widgetId, x: 0, y: maxY, w: 4, h: 4 }];
        }
        setLayoutFunc(newLayout);
    };

    const toggleSidebarItem = (itemId: string) => {
        setSidebarConfig(prev => ({
            ...prev,
            [itemId]: prev[itemId] === false ? true : false // Default is true (undefined = true)
        }));
    };

    const WidgetCard = ({ widget, isVisible, onToggle }: { widget: any, isVisible: boolean, onToggle: () => void }) => (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
        >
            <div
                className={`
                    relative p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer group
                    ${isVisible
                        ? 'bg-gradient-to-br from-[var(--cy-navy)] to-slate-800 border-[var(--cy-lime)] shadow-lg shadow-blue-900/20'
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }
                `}
                onClick={onToggle}
            >
                <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${isVisible ? 'bg-white/10' : 'bg-slate-100'}`}>
                        <widget.icon className={`w-6 h-6 ${isVisible ? 'text-[var(--cy-lime)]' : widget.color}`} />
                    </div>
                    <Switch
                        checked={isVisible}
                        onCheckedChange={onToggle}
                        className="data-[state=checked]:bg-[var(--cy-lime)]"
                    />
                </div>
                <div>
                    <h3 className={`font-semibold text-lg mb-1 ${isVisible ? 'text-white' : 'text-slate-800'}`}>
                        {widget.name}
                    </h3>
                    <p className={`text-sm ${isVisible ? 'text-slate-300' : 'text-slate-500'}`}>
                        {widget.description}
                    </p>
                </div>
            </div>
        </motion.div>
    );

    return (
        <DashboardLayout user={user}>
            <div className="max-w-6xl mx-auto space-y-8 pb-10 animate-in fade-in duration-500">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <Shield className="w-10 h-10 text-[var(--cy-lime)]" />
                                Dashboard Configuration
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                Manage dashboard layouts and sidebar visibility.
                            </p>
                        </div>
                        <div className="hidden md:block opacity-20">
                            <LayoutDashboard className="w-32 h-32" />
                        </div>
                    </div>
                    {/* Decorative background elements */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
                </div>

                <Card className="border-none shadow-none bg-transparent">
                    <CardContent className="p-0 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <Tabs defaultValue="personal" className="w-full" onValueChange={(val) => {
                                setActiveTab(val);
                                if (val === 'personal') loadUserConfig();
                                else if (val === 'roles' && isAdmin) loadRoleConfig(selectedRole);
                            }}>
                                <TabsList className="mb-6">
                                    <TabsTrigger value="personal">Personal Settings</TabsTrigger>
                                    {isAdmin && <TabsTrigger value="roles">Role Defaults (Admin)</TabsTrigger>}
                                </TabsList>

                                <TabsContent value="personal">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <UserCircle className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-semibold text-slate-800">Your Personal Preferences</h2>
                                            <p className="text-sm text-slate-500">Customize your own dashboard experience. These settings override role defaults.</p>
                                        </div>
                                    </div>
                                </TabsContent>

                                {isAdmin && (
                                    <TabsContent value="roles">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-amber-50 rounded-lg">
                                                    <Shield className="w-6 h-6 text-amber-600" />
                                                </div>
                                                <div>
                                                    <h2 className="font-semibold text-slate-800">Role Default Settings</h2>
                                                    <p className="text-sm text-slate-500">Configure default layouts for user roles</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                                                {ROLES.map(role => (
                                                    <Button
                                                        key={role}
                                                        variant="ghost"
                                                        onClick={() => setSelectedRole(role)}
                                                        className={`
                                                            rounded-md transition-all
                                                            ${selectedRole === role
                                                                ? 'bg-white text-[var(--cy-navy)] shadow-sm font-semibold'
                                                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                                                            }
                                                        `}
                                                    >
                                                        {role}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-sm flex items-start gap-3 mb-6">
                                            <div className="mt-0.5 min-w-[16px]">ℹ️</div>
                                            <p>
                                                These settings will be applied as the <strong>enforced default layout</strong> for users with the <strong>{selectedRole}</strong> role.
                                            </p>
                                        </div>
                                    </TabsContent>
                                )}
                            </Tabs>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader />
                            </div>
                        ) : (
                            <>
                                {/* Sidebar Configuration Section */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                        <div className="w-1 h-6 bg-[var(--cy-lime)] rounded-full"></div>
                                        Sidebar Visibility
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                        {SIDEBAR_ITEMS.map(item => {
                                            const isVisible = sidebarConfig[item.id] !== false; // Default true
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => toggleSidebarItem(item.id)}
                                                    className={`
                                                        flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                                                        ${isVisible
                                                            ? 'bg-white border-[var(--cy-lime)] shadow-sm'
                                                            : 'bg-slate-50 border-slate-200 opacity-60'
                                                        }
                                                    `}
                                                >
                                                    <div className={`p-1.5 rounded-lg ${isVisible ? 'bg-[var(--cy-navy)] text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                        <item.icon className="w-4 h-4" />
                                                    </div>
                                                    <span className={`text-sm font-medium ${isVisible ? 'text-slate-900' : 'text-slate-500'}`}>
                                                        {item.name}
                                                    </span>
                                                    <Switch
                                                        checked={isVisible}
                                                        onCheckedChange={() => toggleSidebarItem(item.id)}
                                                        className="ml-auto scale-75 data-[state=checked]:bg-[var(--cy-lime)]"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Widget Configuration Section */}
                                {Object.entries(WIDGET_CATEGORIES).map(([category, widgets]) => (
                                    <div key={category} className="space-y-4">
                                        <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                                            <div className="w-1 h-6 bg-[var(--cy-lime)] rounded-full"></div>
                                            {category}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                            {widgets.map(widget => (
                                                <WidgetCard
                                                    key={widget.id}
                                                    widget={widget}
                                                    isVisible={!!roleLayout.find(w => w.i === widget.id)}
                                                    onToggle={() => toggleWidget(widget.id, roleLayout, setRoleLayout)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        <div className="flex justify-end pt-4">
                            {activeTab === 'personal' ? (
                                <Button
                                    onClick={saveUserConfig}
                                    className="bg-[var(--cy-navy)] hover:bg-slate-800 text-white shadow-lg shadow-blue-900/20 px-8 py-6 text-lg transition-all hover:scale-105"
                                >
                                    <Save className="w-5 h-5 mr-2" />
                                    Save Personal Settings
                                </Button>
                            ) : (
                                <Button
                                    onClick={saveRoleConfig}
                                    className="bg-[var(--cy-navy)] hover:bg-slate-800 text-white shadow-lg shadow-blue-900/20 px-8 py-6 text-lg transition-all hover:scale-105"
                                >
                                    <Save className="w-5 h-5 mr-2" />
                                    Save Default for {selectedRole}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
