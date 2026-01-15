'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PenTool, Clock, Filter, ArrowLeft, Search, FileText, BarChart2, Map, Workflow, Check } from 'lucide-react';
import { WritingTestsData, WritingTest } from '@/types';
import AdminLayout from '@/components/AdminLayout';

const difficultyColors = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    hard: 'bg-red-100 text-red-700',
};

const taskTypeIcons: Record<string, any> = {
    chart: BarChart2,
    process: Workflow,
    map: Map,
    table: FileText,
    diagram: FileText,
};

export default function WritingTestsPage() {
    const [tests, setTests] = useState<WritingTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [completedTests, setCompletedTests] = useState<Record<number, any>>({});

    useEffect(() => {
        Promise.all([
            fetch('/data/writing_tests.json').then(res => res.json()),
            fetch('/api/ielts/sessions/', { credentials: 'include' }).then(res => res.ok ? res.json() : [])
        ]).then(([data, sessions]) => {
            setTests((data as WritingTestsData).tests);

            // Map completed tests
            const completed: Record<number, any> = {};

            // For each test, check if there's a matching completed session
            // Logic: Title = "Writing Test {id}"
            (data as WritingTestsData).tests.forEach(test => {
                const expectedTitle = `Writing Test ${test.test_id}`;
                // Find matching session
                const matchingSession = sessions.find((s: any) =>
                    s.is_completed &&
                    s.test_title &&
                    s.test_title.toLowerCase().includes(expectedTitle.toLowerCase())
                );

                if (matchingSession) {
                    completed[test.test_id] = matchingSession;
                }
            });

            setCompletedTests(completed);
            setLoading(false);
        }).catch(err => {
            console.error('Failed to load data:', err);
            setLoading(false);
        });
    }, []);

    const taskTypes = Array.from(new Set(tests.map((t) => t.task_1.type))).sort();

    const filteredTests = tests.filter((test) => {
        const matchesDifficulty = difficultyFilter === 'all' || test.difficulty === difficultyFilter;
        const matchesType = typeFilter === 'all' || test.task_1.type === typeFilter;
        const matchesSearch =
            searchQuery === '' ||
            test.task_1.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            test.task_2.question.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesDifficulty && matchesType && matchesSearch;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="Writing Tests"
            subtitle={`${tests.length} Academic Writing Tests`}
        >
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl mb-6 border border-amber-200">
                <div className="flex items-center gap-3 text-amber-800">
                    <Clock className="w-5 h-5" />
                    <span className="text-sm font-medium">
                        Total Time: 60 minutes • Task 1: ~20 min (150+ words) • Task 2: ~40 min (250+ words)
                    </span>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="space-y-4 mb-8">
                {/* Search Bar */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by topic..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>

                {/* Filters - Split into aligned groups */}
                <div className="flex flex-col md:flex-row items-start gap-3 md:gap-4">
                    {/* Difficulty Group */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2">
                        <Filter className="w-4 h-4 text-slate-500" />
                        {(['all', 'easy', 'medium', 'hard'] as const).map((level) => (
                            <button
                                key={level}
                                onClick={() => setDifficultyFilter(level)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${difficultyFilter === level
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-amber-300'
                                    }`}
                            >
                                {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Separator */}
                    <div className="hidden md:block text-slate-300 text-xl font-light pt-1">|</div>

                    {/* Type Group */}
                    <div className="flex items-start gap-2 flex-1">
                        <span className="text-sm text-slate-500 whitespace-nowrap mt-3">Type:</span>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setTypeFilter('all')}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${typeFilter === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-slate-600 border border-slate-200'
                                    }`}
                            >
                                All
                            </button>
                            {taskTypes.map((type) => {
                                const Icon = taskTypeIcons[type] || FileText;
                                const label = type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setTypeFilter(type)}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${typeFilter === type
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-600 border border-slate-200'
                                            }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Test Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredTests.map((test) => {
                    const TypeIcon = taskTypeIcons[test.task_1.type] || FileText;
                    const isCompleted = !!completedTests[test.test_id];

                    return (
                        <div key={test.test_id} className="relative group">
                            {/* Block overlay if completed */}
                            {isCompleted && (
                                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] rounded-xl flex items-center justify-center border border-slate-200">
                                    <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full font-bold shadow-sm flex items-center gap-2">
                                        <Check className="w-5 h-5" />
                                        Completed
                                    </div>
                                </div>
                            )}

                            <Link
                                href={isCompleted ? '#' : `/tests/writing/${test.test_id}`}
                                className={`block h-full bg-white p-6 rounded-xl border border-slate-200 transition-all ${isCompleted
                                    ? 'opacity-50 cursor-default'
                                    : 'hover:border-amber-500 hover:shadow-lg'
                                    }`}
                                aria-disabled={isCompleted}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg ${isCompleted ? 'bg-slate-100 text-slate-400' : 'bg-amber-50 text-amber-600'}`}>
                                            <PenTool className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
                                            <TypeIcon className="w-3 h-3" />
                                            {test.task_1.type}
                                        </span>
                                    </div>
                                    <span
                                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${difficultyColors[test.difficulty]
                                            }`}
                                    >
                                        {test.difficulty.charAt(0).toUpperCase() + test.difficulty.slice(1)}
                                    </span>
                                </div>

                                <h3 className={`font-semibold mb-2 transition-colors ${isCompleted ? 'text-slate-500' : 'text-slate-900 group-hover:text-amber-600'
                                    }`}>
                                    Writing Test {test.test_id}
                                </h3>

                                <p className="text-sm text-slate-500 mb-2 line-clamp-2">
                                    <strong>Task 1:</strong> {test.task_1.question}
                                </p>

                                <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                                    <strong>Task 2:</strong> {test.task_2.question}
                                </p>

                                <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-4">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        60 min
                                    </div>
                                    <div>Task 1: 150+ words</div>
                                    <div>Task 2: 250+ words</div>
                                </div>
                            </Link>
                        </div>
                    );
                })}
            </div>
        </AdminLayout>
    );
}
