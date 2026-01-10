'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Headphones, Clock, PlayCircle, CheckCircle2 } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

interface ListeningTest {
    id: string;
    title: string;
    description: string;
    test_type: string;
    active: boolean;
}

export default function ListeningTestsPage() {
    const [tests, setTests] = useState<ListeningTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        // Try local JSON first (most reliable for static data)
        try {
            const localRes = await fetch('/data/listening_tests.json');
            const localData = await localRes.json();
            if (localData.tests && localData.tests.length > 0) {
                setTests(localData.tests);
                setLoading(false);
                return;
            }
        } catch {
            // Continue to API fallback
        }

        // Fallback to backend API
        try {
            const res = await fetch('/api/ielts/tests/?module_type=listening');
            if (!res.ok) throw new Error('Failed to fetch tests');
            const data = await res.json();
            setTests(data.results || data || []);
        } catch (err: any) {
            setError(err.message);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="Listening Tests"
            subtitle="Practice with authentic IELTS listening tests"
        >
            {/* Stats */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 mb-8 border border-blue-100 dark:border-blue-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                            {tests.length} Listening Tests Available
                        </h2>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Each test contains 4 sections with 40 questions
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                        <Clock className="w-4 h-4" />
                        <span>~30 minutes per test</span>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
                    <p className="text-amber-700 dark:text-amber-300 text-sm">
                        Note: Unable to connect to backend. Error: {error}
                        <br />Showing local data.
                    </p>
                </div>
            )}

            {/* Tests Grid */}
            {tests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tests.map((test, index) => (
                        <Link
                            key={test.id}
                            href={`/tests/listening/${test.id}`}
                            className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                    <Headphones className="w-6 h-6 text-blue-600" />
                                </div>
                                <span className="text-xs px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 font-medium">
                                    {test.test_type || 'Academic'}
                                </span>
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                                {test.title}
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-2">
                                {test.description || `IELTS Listening Practice Test`}
                            </p>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                    <Clock className="w-3 h-3" />
                                    <span>30 mins</span>
                                    <span className="text-zinc-300">•</span>
                                    <span>40 questions</span>
                                </div>
                                <div className="flex items-center gap-1 text-blue-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                                    <PlayCircle className="w-4 h-4" />
                                    <span>Start</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Headphones className="w-8 h-8 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                        No Listening Tests Available
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        Tests will appear here once they are uploaded.
                    </p>
                </div>
            )}
        </AdminLayout>
    );
}

