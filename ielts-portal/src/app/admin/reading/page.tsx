'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
    BookOpen,
    Plus,
    Trash2,
    Edit,
    Play,
} from 'lucide-react';

import AdminLayout from '@/components/AdminLayout';

export default function AdminReadingPage() {
    const { user, isAdmin, logout, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [tests, setTests] = useState<any[]>([]);
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
        // Load from LOCAL JSON file (same source as student view)
        try {
            const res = await fetch('/data/reading_tests.json');
            if (!res.ok) throw new Error('Failed to fetch tests');
            const data = await res.json();

            let loadedTests = (data.tests || []).map((t: any) => ({
                id: t.id,
                title: t.title || `Reading Test ${t.id}`,
                description: t.description || 'IELTS Academic Reading Test',
                active: true,
                created_at: new Date().toISOString(),
            }));

            // Sort by title
            loadedTests.sort((a: any, b: any) => a.title.localeCompare(b.title));
            setTests(loadedTests);
            setLoading(false);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleDelete = async (testId: string, testTitle: string) => {
        if (!confirm(`Are you sure you want to delete "${testTitle}"? This cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/ielts/admin/tests/${testId}/`, {
                method: 'DELETE',
                credentials: 'include',
            });

            if (!res.ok) {
                throw new Error('Failed to delete test');
            }

            // Remove from local state
            setTests(prev => prev.filter((t: any) => t.id !== testId));
        } catch (err: any) {
            alert(`Error deleting test: ${err.message}`);
        }
    };

    const handleLogout = () => {
        logout();
        router.push('/admin/login');
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="Reading Tests"
            subtitle={`${loading ? '...' : tests.length} tests available`}
            actions={
                <Link
                    href="/admin/reading/new"
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add New Test
                </Link>
            }
        >
            <div className="max-w-6xl mx-auto">
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
                        {tests.map((test: any) => (
                            <div
                                key={test.id}
                                className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-200 hover:shadow-md transition-all group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                            <BookOpen className="w-6 h-6 text-blue-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-900">{test.title}</h3>
                                            <p className="text-sm text-slate-500 mt-1">
                                                {test.description || 'IELTS Reading Test'}
                                            </p>
                                            <div className="flex items-center gap-4 mt-3 text-sm text-slate-400">
                                                <span className="flex items-center gap-1.5">
                                                    <BookOpen className="w-4 h-4 text-slate-400" />
                                                    60 min
                                                </span>
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${test.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                    }`}>
                                                    {test.active ? 'Active' : 'Draft'}
                                                </span>
                                                {test.description?.includes('Auto-created') && (
                                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                        Placeholder
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Preview Button */}
                                        <Link
                                            href={`/tests/reading/answer-key/${test.id}`}
                                            target="_blank"
                                            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                            title="Preview Answer Key"
                                        >
                                            <Play className="w-4 h-4" />
                                        </Link>
                                        {/* Edit Button */}
                                        <Link
                                            href={`/admin/reading/${test.id}`}
                                            className="p-2 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                            title="Edit"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Link>
                                        {/* Delete Button */}
                                        <button
                                            onClick={() => handleDelete(test.id, test.title)}
                                            className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
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
                            <BookOpen className="w-10 h-10 text-blue-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No Reading Tests Yet</h3>
                        <p className="text-slate-500 max-w-md mx-auto mb-6">
                            Click "Add New Test" above to import a reading test from JSON.
                        </p>
                        <Link
                            href="/admin/reading/new"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Add New Test
                        </Link>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
