'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mic, Clock, Filter, Search, CheckCircle } from 'lucide-react';
import { SpeakingTestsData, SpeakingTest } from '@/types';
import AdminLayout from '@/components/AdminLayout';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const difficultyColors = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    hard: 'bg-red-100 text-red-700',
};

export default function SpeakingTestsPage() {
    const [tests, setTests] = useState<SpeakingTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [completedTestIds, setCompletedTestIds] = useState<string[]>([]);

    // Fetch speaking tests
    useEffect(() => {
        fetch('/data/speaking_tests.json')
            .then((res) => res.json())
            .then((data: SpeakingTestsData) => {
                setTests(data.tests);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to load speaking tests:', err);
                setLoading(false);
            });
    }, []);

    // Fetch completed tests to block repeat attempts
    useEffect(() => {
        const fetchCompletedTests = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/ielts/sessions/`, {
                    credentials: 'include',
                });
                if (response.ok) {
                    const sessions = await response.json();
                    // Extract test IDs from completed speaking sessions
                    const completedIds = sessions
                        .filter((s: any) => {
                            // Check if session has speaking module attempts that are completed
                            const hasSpeakingModule = s.module_attempts?.some((m: any) =>
                                m.module_type?.toLowerCase() === 'speaking' && m.is_completed
                            );
                            // Also check if the test title contains 'speaking'
                            const isSpeakingTest = s.test_title?.toLowerCase().includes('speaking');
                            return (hasSpeakingModule || isSpeakingTest) && s.is_completed;
                        })
                        .map((s: any) => {
                            // Extract the numeric test ID from the title (e.g., "Speaking Test 1" -> "1")
                            const match = s.test_title?.match(/Test\s*(\d+)/i);
                            return match ? match[1] : s.test?.toString();
                        })
                        .filter(Boolean);
                    setCompletedTestIds([...new Set(completedIds)] as string[]);
                }
            } catch (err) {
                console.warn('Could not fetch completed tests:', err);
            }
        };
        fetchCompletedTests();
    }, []);

    const filteredTests = tests.filter((test) => {
        const matchesDifficulty = filter === 'all' || test.difficulty === filter;
        const matchesSearch =
            searchQuery === '' ||
            test.part_1.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
            test.part_2.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesDifficulty && matchesSearch;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="Speaking Tests"
            subtitle={`${tests.length} AI Interview Tests`}
        >
            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by topic..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    {(['all', 'easy', 'medium', 'hard'] as const).map((level) => (
                        <button
                            key={level}
                            onClick={() => setFilter(level)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === level
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300'
                                }`}
                        >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Test Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTests.map((test) => {
                    const isCompleted = completedTestIds.includes(test.test_id.toString());

                    if (isCompleted) {
                        // Completed test - non-clickable card
                        return (
                            <div
                                key={test.test_id}
                                className="relative bg-white p-6 rounded-xl border border-slate-200 opacity-75 cursor-not-allowed"
                            >
                                {/* Completed Badge */}
                                <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Completed
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-slate-100 p-2.5 rounded-lg text-slate-400">
                                        <Mic className="w-5 h-5" />
                                    </div>
                                    <span
                                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${difficultyColors[test.difficulty]}`}
                                    >
                                        {test.difficulty.charAt(0).toUpperCase() + test.difficulty.slice(1)}
                                    </span>
                                </div>

                                <h3 className="font-semibold text-slate-500 mb-2">
                                    Test {test.test_id}: {test.part_1.topic}
                                </h3>

                                <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                                    {test.part_2.title}
                                </p>

                                <div className="flex items-center gap-4 text-xs text-slate-400 border-t border-slate-100 pt-4">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        11-14 min
                                    </div>
                                    <div className="text-slate-400 font-medium">
                                        3 Parts
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // Available test - clickable link
                    return (
                        <Link
                            key={test.test_id}
                            href={`/tests/speaking/${test.test_id}`}
                            className="group bg-white p-6 rounded-xl border border-slate-200 hover:border-emerald-500 transition-all hover:shadow-lg"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-emerald-50 p-2.5 rounded-lg text-emerald-600">
                                    <Mic className="w-5 h-5" />
                                </div>
                                <span
                                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${difficultyColors[test.difficulty]
                                        }`}
                                >
                                    {test.difficulty.charAt(0).toUpperCase() + test.difficulty.slice(1)}
                                </span>
                            </div>

                            <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors">
                                Test {test.test_id}: {test.part_1.topic}
                            </h3>

                            <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                                {test.part_2.title}
                            </p>

                            <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-4">
                                <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    11-14 min
                                </div>
                                <div className="text-emerald-600 font-medium">
                                    3 Parts
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {filteredTests.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-slate-500">No tests found matching your criteria.</p>
                </div>
            )}
        </AdminLayout>
    );
}
