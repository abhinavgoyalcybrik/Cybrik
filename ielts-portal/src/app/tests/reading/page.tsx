'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, PlayCircle, CheckCircle2, Check } from 'lucide-react';
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
    const [completedTests, setCompletedTests] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const loadData = async () => {
            // 1. Fetch Tests (API ONLY - Simplified source of truth)
            try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
                const res = await fetch(`${API_BASE}/api/ielts/tests/?module_type=reading`);

                if (res.ok) {
                    const data = await res.json();
                    let apiTests: ReadingTest[] = (data.results || data || []).map((t: any) => ({
                        id: String(t.id),
                        title: t.title || 'Untitled Test',
                        description: t.description || '',
                        test_type: t.test_type || 'academic',
                        active: t.active ?? true
                    }));

                    // Filter out placeholders and invalid tests logic
                    apiTests = apiTests.filter(t => {
                        const title = (t.title || '').trim().toLowerCase();
                        const desc = (t.description || '').trim().toLowerCase();

                        // Filter out empty titles or 'Untitled'
                        if (!title || title === 'untitled test') return false;

                        // Filter out explicit placeholders
                        if (title.includes('placeholder') || desc.includes('placeholder')) return false;

                        return true;
                    });

                    // Sort by Title
                    apiTests.sort((a, b) => a.title.localeCompare(b.title));

                    setTests(apiTests);

                    // 2. Fetch Sessions for Blocking (Only if tests loaded successfully)
                    try {
                        const sessionRes = await fetch('/api/ielts/sessions/', { credentials: 'include' });
                        if (sessionRes.ok) {
                            const sessions = await sessionRes.json();
                            const completed: Record<string, boolean> = {};

                            apiTests.forEach(test => {
                                // Match completed sessions - STRICT MATCHING
                                const isCompleted = sessions.some((s: any) =>
                                    s.is_completed && (
                                        // Exact ID match
                                        String(s.test_id) === String(test.id) ||
                                        // Exact Title match (fallback for legacy sessions)
                                        (s.test_title && s.test_title.trim() === test.title.trim())
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

                } else {
                    console.error('Failed to fetch tests:', res.statusText);
                    setError('Failed to load tests from server');
                }
            } catch (err: any) {
                console.error('API Error:', err);
                setError('Could not connect to server');
            } finally {
                setLoading(false);
            }
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
                    {tests.map((test) => {
                        const isCompleted = completedTests[test.id];

                        return (
                            <div key={test.id} className="relative group">
                                {/* Block overlay if completed */}
                                {isCompleted && (
                                    <div className="absolute inset-0 z-10 bg-white/60 dark:bg-black/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                                        <div className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 px-4 py-2 rounded-full font-bold shadow-sm flex items-center gap-2">
                                            <Check className="w-5 h-5" />
                                            Completed
                                        </div>
                                    </div>
                                )}

                                <Link
                                    href={isCompleted ? '#' : `/tests/reading/${test.id}`}
                                    className={`block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 transition-all ${isCompleted
                                        ? 'opacity-50 cursor-default'
                                        : 'hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg dark:hover:shadow-blue-900/20'}`}
                                    aria-disabled={isCompleted}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`p-3 rounded-lg transition-colors ${isCompleted ? 'bg-zinc-100 text-zinc-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                                            <BookOpen className="w-6 h-6" />
                                        </div>
                                        {test.active && !isCompleted && (
                                            <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Active
                                            </span>
                                        )}
                                    </div>

                                    <h3 className={`text-lg font-bold mb-2 transition-colors ${isCompleted ? 'text-zinc-500' : 'text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                                        {test.title}
                                    </h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4">
                                        {test.description || 'Practice your reading skills with this full-length academic reading test.'}
                                    </p>

                                    <div className={`flex items-center text-sm font-medium transition-transform ${isCompleted ? 'text-zinc-400' : 'text-blue-600 dark:text-blue-400 group-hover:translate-x-1'}`}>
                                        {isCompleted ? 'Test Completed' : 'Start Test'}
                                        {!isCompleted && <PlayCircle className="w-4 h-4 ml-2" />}
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
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
