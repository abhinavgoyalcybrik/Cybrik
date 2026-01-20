'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
    Shield,
    PenTool,
    Mic,
    Users,
    Settings,
    LogOut,
    Home,
    ChevronRight,
    Headphones,
    BookOpen,
    Plus,
    Trash2,
    Edit,
    Play,
    Clock,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

const navItems = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Writing Tests', href: '/admin/writing', icon: PenTool },
    { name: 'Speaking Tests', href: '/admin/speaking', icon: Mic },
    { name: 'Listening Tests', href: '/admin/listening', icon: Headphones },
    { name: 'Reading Tests', href: '/admin/reading', icon: BookOpen },
    { name: 'Manage Users', href: '/admin/users', icon: Users },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
];

interface ListeningTest {
    id: string;
    title: string;
    description: string;
    test_type: string;
    active: boolean;
    created_at: string;
    modules?: { question_groups?: { questions?: any[] }[] }[];
}

export default function AdminListeningPage() {
    const { user, isAdmin, logout, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [tests, setTests] = useState<ListeningTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin) {
            fetchTests();
        }
    }, [isAdmin]);

    const fetchTests = async () => {
        try {
            const res = await fetch('/api/ielts/admin/tests/?module_type=listening');
            if (!res.ok) throw new Error('Failed to fetch tests');
            const data = await res.json();
            let loadedTests = data.results || data || [];
            // Sort by created_at descending (newest first)
            loadedTests.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setTests(loadedTests);
            setLoading(false);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        router.push('/admin/login');
    };

    const getQuestionCount = (test: ListeningTest): number => {
        let count = 0;
        test.modules?.forEach((m) => {
            m.question_groups?.forEach((g) => {
                count += g.questions?.length || 0;
            });
        });
        return count;
    };

    const handleDelete = async (testId: string, testTitle: string) => {
        if (!confirm(`Are you sure you want to delete "${testTitle}"? This cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/ielts/admin/tests/${testId}/`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                throw new Error('Failed to delete test');
            }

            // Remove from local state using functional update
            setTests(prevTests => prevTests.filter(t => t.id !== testId));
        } catch (err: any) {
            alert(`Error deleting test: ${err.message}`);
        }
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="Listening Tests"
            subtitle={`${tests.length} tests available (${loading ? '...' : tests.reduce((acc, t) => acc + getQuestionCount(t), 0)} questions)`}
            actions={
                <Link
                    href="/admin/listening/new"
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add New Test
                </Link>
            }
        >
            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                    <p className="text-red-600 font-medium">Error: {error}</p>
                    <p className="text-sm text-slate-500 mt-2">Make sure the backend is running on localhost:8000</p>
                </div>
            )}

            {/* Tests List */}
            {!loading && tests.length > 0 && (
                <div className="space-y-4">
                    {tests.map((test) => (
                        <div
                            key={test.id}
                            className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-slate-300 hover:shadow-md transition-all"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                        <Headphones className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900">{test.title}</h3>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {test.description || 'IELTS Listening Test'}
                                        </p>
                                        <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                                            <span className="flex items-center gap-1.5">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                30 min
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                                {getQuestionCount(test)} questions
                                            </span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${test.active ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                {test.active ? 'Active' : 'Draft'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link
                                        href={`/tests/listening/${test.id}`}
                                        target="_blank"
                                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                        title="Preview"
                                    >
                                        <Play className="w-4 h-4" />
                                    </Link>
                                    <Link
                                        href={`/admin/listening/${test.id}`}
                                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                        title="Edit"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(test.id, test.title)}
                                        className="p-2 rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && !error && tests.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                    <div className="inline-flex p-4 rounded-full bg-blue-50 mb-4">
                        <Headphones className="w-10 h-10 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Listening Tests Yet</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">
                        Run the import command to add listening tests from JSON files.
                    </p>
                    <div className="bg-slate-50 rounded-xl p-4 text-left max-w-md mx-auto border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">To import listening tests:</p>
                        <code className="text-sm text-blue-600 block bg-slate-100 rounded p-3 font-mono border border-slate-200">
                            py -3 manage.py import_listening_tests
                        </code>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}

