'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
    PenTool,
    Mic,
    Users,
    Settings,
    LogOut,
    Home,
    ChevronRight,
    Headphones,
    BookOpen,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

const navItems = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Writing Tests', href: '/admin/writing', icon: PenTool },
    { name: 'Speaking Tests', href: '/admin/speaking', icon: Mic },
    { name: 'Listening Tests', href: '/admin/listening', icon: Headphones },
    { name: 'Reading Tests', href: '/admin/reading', icon: BookOpen },
    { name: 'Manage Students', href: '/admin/users', icon: Users },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
];

interface TestCounts {
    writing: number;
    speaking: number;
    listening: number;
    reading: number;
    students: number;
}

export default function AdminDashboard() {
    const { user, isAdmin, logout, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [counts, setCounts] = useState<TestCounts>({
        writing: 0,
        speaking: 0,
        listening: 0,
        reading: 0,
        students: 0,
    });

    useEffect(() => {
        if (!isLoading) {
            // Not authenticated at all - go to admin login
            if (!user) {
                router.push('/admin/login');
                return;
            }
            // Authenticated but NOT admin - redirect to student dashboard
            if (!isAdmin) {
                console.log('Non-admin user trying to access admin panel, redirecting to dashboard');
                router.push('/dashboard');
                return;
            }
        }
    }, [isLoading, isAdmin, user, router]);

    // Fetch actual counts from local JSON files and backend API
    useEffect(() => {
        Promise.all([
            fetch('/data/writing_tests.json').then(r => r.json()).catch(() => ({ tests: [] })),
            fetch('/data/speaking_tests.json').then(r => r.json()).catch(() => ({ tests: [] })),
            fetch('/api/ielts/tests/?module_type=listening').then(r => r.json()).catch(() => []),
            fetch('/api/ielts/tests/?module_type=reading').then(r => r.json()).catch(() => []),
            fetch('/data/users.json').then(r => r.json()).catch(() => ({ students: [] })),
        ]).then(([writing, speaking, listening, reading, users]) => {
            const listeningCount = Array.isArray(listening) ? listening.length : (listening.results?.length || listening.length || 0);
            const readingCount = Array.isArray(reading) ? reading.length : (reading.results?.length || reading.length || 0);

            setCounts({
                writing: writing.tests?.length || 0,
                speaking: speaking.tests?.length || 0,
                listening: listeningCount,
                reading: readingCount,
                students: users.students?.length || 0,
            });
        });
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <AdminLayout
            title={`Welcome, ${user?.name}`}
            subtitle="Manage your IELTS portal from here"
        >
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <PenTool className="w-8 h-8 text-amber-500 p-1.5 bg-amber-50 rounded-lg" />
                        <span className="text-3xl font-bold text-slate-900">{counts.writing}</span>
                    </div>
                    <h3 className="font-medium text-sm text-slate-500">Writing</h3>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <Mic className="w-8 h-8 text-blue-500 p-1.5 bg-blue-50 rounded-lg" />
                        <span className="text-3xl font-bold text-slate-900">{counts.speaking}</span>
                    </div>
                    <h3 className="font-medium text-sm text-slate-500">Speaking</h3>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <Headphones className="w-8 h-8 text-purple-500 p-1.5 bg-purple-50 rounded-lg" />
                        <span className="text-3xl font-bold text-slate-900">{counts.listening}</span>
                    </div>
                    <h3 className="font-medium text-sm text-slate-500">Listening</h3>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <BookOpen className="w-8 h-8 text-emerald-500 p-1.5 bg-emerald-50 rounded-lg" />
                        <span className="text-3xl font-bold text-slate-900">{counts.reading}</span>
                    </div>
                    <h3 className="font-medium text-sm text-slate-500">Reading</h3>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                        <Users className="w-8 h-8 text-[#6FB63A] p-1.5 bg-[#6FB63A]/10 rounded-lg" />
                        <span className="text-3xl font-bold text-slate-900">{counts.students}</span>
                    </div>
                    <h3 className="font-medium text-sm text-slate-500">Students</h3>
                </div>
            </div>

            {/* Quick Actions */}
            <h3 className="text-xl font-bold text-slate-900 mb-6">Manage Tests</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <Link
                    href="/admin/writing"
                    className="flex items-center gap-5 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-amber-500 hover:shadow-md transition-all group"
                >
                    <div className="p-4 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
                        <PenTool className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                            Writing Tests
                        </h4>
                        <p className="text-sm text-slate-500">{counts.writing} tests available</p>
                    </div>
                </Link>
                <Link
                    href="/admin/speaking"
                    className="flex items-center gap-5 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all group"
                >
                    <div className="p-4 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                        <Mic className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            Speaking Tests
                        </h4>
                        <p className="text-sm text-slate-500">{counts.speaking} tests available</p>
                    </div>
                </Link>
                <Link
                    href="/admin/listening"
                    className="flex items-center gap-5 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-purple-500 hover:shadow-md transition-all group"
                >
                    <div className="p-4 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                        <Headphones className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                            Listening Tests
                        </h4>
                        <p className="text-sm text-slate-500">{counts.listening > 0 ? `${counts.listening} tests` : 'Coming soon'}</p>
                    </div>
                </Link>
                <Link
                    href="/admin/reading"
                    className="flex items-center gap-5 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all group"
                >
                    <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                            Reading Tests
                        </h4>
                        <p className="text-sm text-slate-500">{counts.reading > 0 ? `${counts.reading} tests` : 'Coming soon'}</p>
                    </div>
                </Link>
            </div>

            {/* User Management */}
            <h3 className="text-xl font-bold text-slate-900 mb-6">Student Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link
                    href="/admin/users"
                    className="flex items-center gap-5 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-[#6FB63A] hover:shadow-md transition-all group"
                >
                    <div className="p-4 rounded-xl bg-[#6FB63A]/10 text-[#6FB63A] group-hover:bg-[#6FB63A]/20 transition-colors">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-900 group-hover:text-[#6FB63A] transition-colors">
                            Manage Students
                        </h4>
                        <p className="text-sm text-slate-500">Create CRM students, manage access</p>
                    </div>
                </Link>
                <Link
                    href="/admin/settings"
                    className="flex items-center gap-5 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-400 hover:shadow-md transition-all group"
                >
                    <div className="p-4 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-slate-200 transition-colors">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
                            Settings
                        </h4>
                        <p className="text-sm text-slate-500">Configure portal settings</p>
                    </div>
                </Link>
            </div>
        </AdminLayout>
    );
}
