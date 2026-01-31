'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Headphones, Clock, PlayCircle, CheckCircle2, Check } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';

interface ListeningTest {
    id: string;
    title: string;
    description: string;
    test_type: string;
    active: boolean;
}

export default function ListeningTestsPage() {
    const { user } = useAuth();
    const hasFullAccess = user?.is_superuser || user?.has_full_access ?? false;
    const [tests, setTests] = useState<ListeningTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [completedTests, setCompletedTests] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const loadData = async () => {
            let fetchedTests: ListeningTest[] = [];
            // 1. Fetch Tests
            try {
                // Try local JSON first
                try {
                    const localRes = await fetch('/data/listening_tests.json');
                    const localData = await localRes.json();
                    if (localData.tests && localData.tests.length > 0) {
                        fetchedTests = localData.tests;
                    }
                } catch {
                    // Continue to API fallback
                }

                if (fetchedTests.length === 0) {
                    // Fallback to backend API
                    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                    const res = await fetch(`${API_BASE}/api/ielts/tests/?module_type=listening`);
                    if (!res.ok) throw new Error('Failed to fetch tests');
                    const data = await res.json();
                    fetchedTests = data.results || data || [];
                }
                setTests(fetchedTests);
            } catch (err: any) {
                setError(err.message);
                setLoading(false);
                return;
            }

            // 2. Fetch Sessions for Blocking
            try {
                const res = await fetch('/api/ielts/sessions/', { credentials: 'include' });
                if (res.ok) {
                    const sessions = await res.json();
                    const completed: Record<string, boolean> = {};

                    fetchedTests.forEach(test => {
                        // Match completed sessions
                        const isCompleted = sessions.some((s: any) =>
                            s.is_completed && (
                                String(s.test_id) === String(test.id) ||
                                (s.test_title && s.test_title.toLowerCase().includes(test.title.toLowerCase())) ||
                                (s.test_title && s.test_title.toLowerCase().includes(`listening test ${test.id}`))
                            )
                        );
                        if (isCompleted) {
                            completed[test.id] = true;
                        }
                    });
                    setCompletedTests(completed);
                }
            } catch (e) {
                console.error('Failed to load sessions:', e);
            }

            setLoading(false);
        };
        loadData();
    }, []);

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
                    {tests.map((test, index) => {
                        const isCompleted = completedTests[test.id];
                        const isLocked = !hasFullAccess && index >= 1; // Only first test free for non-premium users

                        if (isLocked) {
                            return (
                                <div key={test.id} className="relative group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 overflow-hidden">
                                    {/* Blur Content */}
                                    <div className="blur-[2px] opacity-60 select-none pointer-events-none">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-zinc-100 text-zinc-400`}>
                                                <Headphones className="w-6 h-6" />
                                            </div>
                                            <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 text-zinc-500 font-medium"> Premium </span>
                                        </div>
                                        <h3 className="text-lg font-semibold mb-2 text-zinc-500"> {test.title} </h3>
                                        <p className="text-sm text-zinc-500 mb-4"> {test.description || `IELTS Listening Practice Test`} </p>
                                    </div>

                                    {/* Lock Overlay */}
                                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-sm p-4 text-center transition-opacity hover:bg-white/50 dark:hover:bg-black/50">
                                        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mb-3 shadow-sm">
                                            <svg className="w-6 h-6 text-amber-600 dark:text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        </div>
                                        <h3 className="text-gray-900 dark:text-gray-100 font-bold mb-1">Premium Only</h3>
                                        <Link href="/account/subscription" className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105">
                                            Unlock Now
                                        </Link>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={test.id} className="relative group">
                                {/* Block overlay if completed */}
                                {isCompleted && (
                                    <div className="absolute inset-0 z-10 bg-white/60 dark:bg-black/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                                        <div className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-full font-bold shadow-sm flex items-center gap-2">
                                            <Check className="w-5 h-5" />
                                            Completed
                                        </div>
                                    </div>
                                )}

                                <Link
                                    href={isCompleted ? '#' : `/tests/listening/${test.id}`}
                                    className={`block bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 transition-all ${isCompleted
                                        ? 'opacity-50 cursor-default'
                                        : 'hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg'}`}
                                    aria-disabled={isCompleted}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isCompleted ? 'bg-zinc-100 text-zinc-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600'}`}>
                                            <Headphones className="w-6 h-6" />
                                        </div>
                                        <span className="text-xs px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 font-medium">
                                            {test.test_type || 'Academic'}
                                        </span>
                                    </div>
                                    <h3 className={`text-lg font-semibold mb-2 transition-colors ${isCompleted ? 'text-zinc-500' : 'text-zinc-900 dark:text-white group-hover:text-blue-600'}`}>
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
                                        <div className={`flex items-center gap-1 text-sm font-medium transition-transform ${isCompleted ? 'text-zinc-400' : 'text-blue-600 group-hover:translate-x-1'}`}>
                                            {isCompleted ? 'Completed' : 'Start'}
                                            {!isCompleted && <PlayCircle className="w-4 h-4" />}
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
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
