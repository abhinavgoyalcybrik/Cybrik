'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
    FileText,
    BookOpen,
    Headphones,
    PenTool,
    Mic,
    Calendar,
    Clock,
    TrendingUp,
    TrendingDown,
    ChevronRight,
    Filter,
    Download,
    Search,
    Award,
    Target,
    BarChart2,
} from 'lucide-react';

// Types matching backend API response
interface ModuleAttempt {
    id: string;
    module: string;
    module_type?: string;
    start_time: string | null;
    end_time: string | null;
    is_completed: boolean;
    band_score: number | null;
    raw_score?: number | null;
}

interface TestSession {
    id: string;
    test: string;
    test_title: string;
    start_time: string;
    end_time: string | null;
    is_completed: boolean;
    overall_band_score: number | null;
    module_attempts: ModuleAttempt[];
}

// Transformed report type for display
interface TestReport {
    id: string;
    testType: 'reading' | 'listening' | 'writing' | 'speaking';
    testName: string;
    testId: string;
    sessionId: string;
    dateTaken: string;
    timeTaken: string;
    bandScore: number;
    maxScore: number;
    status: 'completed' | 'in-progress' | 'pending-review';
    correctAnswers?: number;
    totalQuestions?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const testTypeConfig = {
    reading: {
        icon: BookOpen,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        label: 'Reading',
    },
    listening: {
        icon: Headphones,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        label: 'Listening',
    },
    writing: {
        icon: PenTool,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        label: 'Writing',
    },
    speaking: {
        icon: Mic,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        label: 'Speaking',
    },
};

const statusConfig = {
    completed: {
        label: 'Completed',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
    },
    'in-progress': {
        label: 'In Progress',
        color: 'text-amber-700',
        bgColor: 'bg-amber-100',
    },
    'pending-review': {
        label: 'Pending Review',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
    },
};

function getBandScoreColor(score: number): string {
    if (score >= 7.5) return 'text-green-600';
    if (score >= 6.5) return 'text-emerald-600';
    if (score >= 5.5) return 'text-amber-600';
    return 'text-red-600';
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function calculateTimeTaken(startTime: string, endTime: string | null): string {
    if (!endTime) return '-';
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const minutes = Math.round((end - start) / (1000 * 60));
    return minutes.toString();
}

function getScoreTrend(current: number, previous: number | null): 'up' | 'down' | 'same' {
    if (previous === null) return 'same';
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'same';
}

function ReportsContent() {
    const router = useRouter();
    const searchParams = useSearchParams(); // Add this
    const { user, isLoading: authLoading } = useAuth();
    const [reports, setReports] = useState<TestReport[]>([]);
    const [filteredReports, setFilteredReports] = useState<TestReport[]>([]);
    const [loading, setLoading] = useState(true);
    // Initialize from URL param
    const [selectedType, setSelectedType] = useState<string>(searchParams.get('type') || 'all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'date' | 'score'>('date');

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    // Fetch test sessions from API
    useEffect(() => {
        const fetchReports = async () => {
            if (!user) return;

            setLoading(true);

            try {
                const response = await fetch('/api/ielts/sessions/', {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    // Silently handle auth issues and other errors
                    if (response.status === 401 || response.status === 403) {
                        // Not authenticated - show empty state
                        setLoading(false);
                        return;
                    }
                    // For other errors, just log and show empty state
                    console.warn('Failed to fetch test history:', response.status);
                    setLoading(false);
                    return;
                }

                const sessions: TestSession[] = await response.json();

                // Transform sessions into reports format
                const transformedReports: TestReport[] = [];

                sessions.forEach((session) => {
                    // If session has module attempts, create a report for each module
                    if (session.module_attempts && session.module_attempts.length > 0) {
                        session.module_attempts.forEach((attempt) => {
                            // Try to determine module type from module data
                            const moduleType = (attempt as any).module_type ||
                                guessModuleType(session.test_title);

                            transformedReports.push({
                                id: attempt.id,
                                testType: moduleType as 'reading' | 'listening' | 'writing' | 'speaking',
                                testId: session.test,
                                sessionId: session.id,
                                testName: session.test_title || 'IELTS Test',
                                dateTaken: session.start_time,
                                timeTaken: calculateTimeTaken(
                                    attempt.start_time || session.start_time,
                                    attempt.end_time || session.end_time
                                ),
                                bandScore: attempt.band_score || session.overall_band_score || 0,
                                maxScore: 9,
                                status: attempt.is_completed ? 'completed' :
                                    (attempt.band_score === null ? 'pending-review' : 'in-progress'),
                                correctAnswers: attempt.raw_score || undefined,
                                totalQuestions: 40, // Default for reading/listening
                            });
                        });
                    } else {
                        // Create a single report for the whole session
                        transformedReports.push({
                            id: session.id,
                            testType: guessModuleType(session.test_title),
                            testId: session.test,
                            sessionId: session.id,
                            testName: session.test_title || 'IELTS Test',
                            dateTaken: session.start_time,
                            timeTaken: calculateTimeTaken(session.start_time, session.end_time),
                            bandScore: session.overall_band_score || 0,
                            maxScore: 9,
                            status: session.is_completed ? 'completed' : 'in-progress',
                        });
                    }
                });

                setReports(transformedReports);
                setFilteredReports(transformedReports);
            } catch (err) {
                // Silently handle network errors
                console.warn('Error fetching reports:', err);
                setReports([]);
                setFilteredReports([]);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [user]);

    // Helper function to guess module type from title
    function guessModuleType(title: string): 'reading' | 'listening' | 'writing' | 'speaking' {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('read')) return 'reading';
        if (lowerTitle.includes('listen')) return 'listening';
        if (lowerTitle.includes('writ')) return 'writing';
        if (lowerTitle.includes('speak')) return 'speaking';
        return 'reading'; // Default
    }

    useEffect(() => {
        let filtered = [...reports];

        // Filter by type
        if (selectedType !== 'all') {
            filtered = filtered.filter((r) => r.testType === selectedType);
        }

        // Filter by search query
        if (searchQuery) {
            filtered = filtered.filter((r) =>
                r.testName.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Sort
        if (sortBy === 'date') {
            filtered.sort((a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime());
        } else {
            filtered.sort((a, b) => b.bandScore - a.bandScore);
        }

        setFilteredReports(filtered);
    }, [reports, selectedType, searchQuery, sortBy]);

    // Calculate statistics
    const completedReports = reports.filter(r => r.status === 'completed' && r.bandScore > 0);
    const stats = {
        totalTests: reports.length,
        averageScore: completedReports.length > 0
            ? (completedReports.reduce((sum, r) => sum + r.bandScore, 0) / completedReports.length).toFixed(1)
            : '-',
        highestScore: completedReports.length > 0
            ? Math.max(...completedReports.map((r) => r.bandScore))
            : '-',
        testsThisMonth: reports.filter((r) => {
            const testDate = new Date(r.dateTaken);
            const now = new Date();
            return testDate.getMonth() === now.getMonth() && testDate.getFullYear() === now.getFullYear();
        }).length,
    };

    // Calculate section-wise averages
    const calculateSectionAverage = (type: string) => {
        const sectionReports = completedReports.filter((r) => r.testType === type);
        if (sectionReports.length === 0) return { avg: '-', count: 0 };
        const avg = (sectionReports.reduce((sum, r) => sum + r.bandScore, 0) / sectionReports.length).toFixed(1);
        return { avg, count: sectionReports.length };
    };

    const sectionAverages = {
        reading: calculateSectionAverage('reading'),
        listening: calculateSectionAverage('listening'),
        writing: calculateSectionAverage('writing'),
        speaking: calculateSectionAverage('speaking'),
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="My Reports"
            subtitle="View your test history and performance"
        >
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                            <FileText className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-500">Total Tests</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-slate-900">{stats.totalTests}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                            <BarChart2 className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-500">Average Score</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-slate-900">{stats.averageScore}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="p-3 rounded-xl bg-green-50 text-green-600">
                            <Award className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-500">Highest Score</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-green-600">{stats.highestScore}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="p-3 rounded-xl bg-orange-50 text-orange-600">
                            <Target className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-500">This Month</span>
                    </div>
                    <p className="mt-4 text-3xl font-bold text-slate-900">{stats.testsThisMonth}</p>
                </div>
            </div>

            {/* Section-wise Performance */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-8">
                <h3 className="font-semibold text-slate-900 mb-4">Section-wise Average Scores</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(sectionAverages).map(([section, data]) => {
                        const config = testTypeConfig[section as keyof typeof testTypeConfig];
                        const Icon = config.icon;
                        return (
                            <div
                                key={section}
                                className={`p-4 rounded-xl ${config.bgColor} border ${config.borderColor}`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className={`w-4 h-4 ${config.color}`} />
                                    <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                                </div>
                                <p className={`text-2xl font-bold ${config.color}`}>{data.avg}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {data.count} test{data.count !== 1 ? 's' : ''}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search tests..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#6FB63A] outline-none"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    {['all', 'reading', 'listening', 'writing', 'speaking'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setSelectedType(type)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedType === type
                                ? 'bg-[#6FB63A] text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:border-[#6FB63A]'
                                }`}
                        >
                            {type === 'all' ? 'All' : testTypeConfig[type as keyof typeof testTypeConfig].label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Sort:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'date' | 'score')}
                        className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6FB63A]"
                    >
                        <option value="date">Most Recent</option>
                        <option value="score">Highest Score</option>
                    </select>
                </div>
            </div>

            {/* Test Reports List */}
            <div className="space-y-4">
                {filteredReports.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700">No tests found</h3>
                        <p className="text-slate-500 mt-1">
                            {searchQuery || selectedType !== 'all'
                                ? 'Try adjusting your filters'
                                : 'Start taking tests to see your reports here'}
                        </p>
                    </div>
                ) : (
                    filteredReports.map((report, index) => {
                        const config = testTypeConfig[report.testType];
                        const Icon = config.icon;
                        const statusConf = statusConfig[report.status];

                        // Get previous score for trend
                        const previousReport = reports
                            .filter((r) => r.testType === report.testType && r.dateTaken < report.dateTaken)
                            .sort((a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime())[0];
                        const trend = getScoreTrend(report.bandScore, previousReport?.bandScore || null);

                        return (
                            <div
                                key={report.id}
                                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6"
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                    {/* Test Type Icon & Info */}
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className={`p-3 rounded-xl ${config.bgColor}`}>
                                            <Icon className={`w-6 h-6 ${config.color}`} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold text-slate-900">{report.testName}</h3>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${statusConf.bgColor} ${statusConf.color}`}>
                                                    {statusConf.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {formatDate(report.dateTaken)}
                                                </span>
                                                {report.timeTaken !== '-' && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {report.timeTaken} min
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Score & Details */}
                                    <div className="flex items-center gap-6">
                                        {/* Score Details (if available) */}
                                        {report.correctAnswers !== undefined && (
                                            <div className="hidden md:flex items-center gap-3">
                                                <div className="text-center px-3 py-1 bg-slate-50 rounded-lg">
                                                    <p className="text-xs text-slate-500">Correct</p>
                                                    <p className="font-semibold text-slate-700">
                                                        {report.correctAnswers}/{report.totalQuestions}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Band Score with Trend */}
                                        <div className="flex items-center gap-2">
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500">Band Score</p>
                                                <p className={`text-2xl font-bold ${report.bandScore > 0 ? getBandScoreColor(report.bandScore) : 'text-slate-400'}`}>
                                                    {report.bandScore > 0 ? report.bandScore : '-'}
                                                </p>
                                            </div>
                                            {trend !== 'same' && report.bandScore > 0 && (
                                                <div className={`p-1 rounded ${trend === 'up' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                    {trend === 'up' ? (
                                                        <TrendingUp className="w-4 h-4" />
                                                    ) : (
                                                        <TrendingDown className="w-4 h-4" />
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* View Details Button */}
                                        <button
                                            onClick={() => router.push(`/tests/${report.testType}/${report.testId}?view=result&sessionId=${report.sessionId}&attemptId=${report.id}`)}
                                            className="flex items-center gap-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors"
                                        >
                                            View Details
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Export Button */}
            {filteredReports.length > 0 && (
                <div className="mt-8 flex justify-center">
                    <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors">
                        <Download className="w-4 h-4" />
                        Export Reports as PDF
                    </button>
                </div>
            )}
        </AdminLayout>
    );
}

export default function ReportsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6FB63A]"></div>
            </div>
        }>
            <ReportsContent />
        </Suspense>
    );
}
