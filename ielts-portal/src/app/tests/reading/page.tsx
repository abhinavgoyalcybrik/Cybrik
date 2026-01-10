'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, PlayCircle, CheckCircle2 } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

interface ReadingTest {
    id: string;
    title: string;
    description: string;
    test_type: string;
    active: boolean;
}

export default function ReadingTestsPage() {
    const [tests, setTests] = useState<ReadingTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchTests();
    }, []);

    const fetchTests = async () => {
        // Try local JSON first (most reliable for static data)
        try {
            const localRes = await fetch('/data/reading_tests.json');
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
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const res = await fetch(`${API_BASE}/api/ielts/tests/?module_type=reading`);
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
            title="Reading Tests"
            subtitle="Practice with authentic IELTS reading tests"
        >
            {/* Stats */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 mb-8 border border-blue-100 dark:border-blue-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                            {tests.length} Reading Tests Available
                        </h2>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Each test contains 3 long passages with 40 questions
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                        <Clock className="w-4 h-4" />
                        <span>60 minutes per test</span>
                    </div>
                </div>
            </div>

            {/* Tests Grid */}
            {tests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tests.map((test) => (
                        <Link
                            key={test.id}
                            href={`/tests/reading/${test.id}`}
                            className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-lg dark:hover:shadow-blue-900/20"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                {test.active && (
                                    <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Active
                                    </span>
                                )}
                            </div>

                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {test.title}
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4">
                                {test.description || 'Practice your reading skills with this full-length academic reading test.'}
                            </p>

                            <div className="flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                                Start Test
                                <PlayCircle className="w-4 h-4 ml-2" />
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <div className="inline-flex p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
                        <BookOpen className="w-8 h-8 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-white">No tests available</h3>
                    <p className="text-zinc-500 dark:text-zinc-400">Check back later for new reading tests.</p>
                </div>
            )}
        </AdminLayout>
    );
}

