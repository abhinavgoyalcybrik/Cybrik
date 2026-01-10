'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
} from 'recharts';
import { BookOpen, Headphones, PenTool, Mic, ArrowRight, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- Data Types ---
interface RadarDataPoint {
    subject: string;
    A: number;
    fullMark: number;
}

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

interface SectionStats {
    averageScore: number;
    testsCompleted: number;
    totalTests: number;
    scores: number[];
}

interface SectionCardProps {
    title: string;
    bandScore: number;
    data: RadarDataPoint[];
    color: string;
    bgColor: string;
    icon: React.ReactNode;
    href: string;
    testsCompleted: number;
    totalTests: number;
    loading?: boolean;
}

function SectionCard({ title, bandScore, data, color, bgColor, icon, href, testsCompleted, totalTests, loading }: SectionCardProps) {
    const strokeColor = color.replace('text-', '');
    const colorMap: Record<string, string> = {
        'emerald-600': '#059669',
        'purple-600': '#9333ea',
        'orange-600': '#ea580c',
        'blue-600': '#2563eb',
    };
    const chartColor = colorMap[strokeColor] || '#6FB63A';

    // Empty state logic
    const isEmpty = data.length === 0;
    const displayData = isEmpty ? [
        { subject: 'Crit 1', A: 4, fullMark: 9 },
        { subject: 'Crit 2', A: 6, fullMark: 9 },
        { subject: 'Crit 3', A: 5, fullMark: 9 },
        { subject: 'Crit 4', A: 7, fullMark: 9 },
        { subject: 'Crit 5', A: 4, fullMark: 9 },
    ] : data;

    const chartId = `radar-${title.toLowerCase()}`;

    return (
        <Link href={href} className="group">
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${bgColor} transition-colors group-hover:bg-opacity-80`}>
                            {icon}
                        </div>
                        <div>
                            <h3 className={`font-bold text-lg ${color}`}>{title}</h3>
                            <p className="text-sm text-slate-500">
                                {loading ? 'Loading...' : `${testsCompleted} test${testsCompleted !== 1 ? 's' : ''} completed`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Radar Chart */}
                <div className="flex-1 min-h-[220px] w-full relative">
                    {isEmpty && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 backdrop-blur-[1px]">
                            <div className="bg-white/90 px-4 py-2 rounded-full shadow-sm border border-slate-100 text-sm font-medium text-slate-500">
                                No data yet
                            </div>
                        </div>
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={displayData}>
                            <defs>
                                <linearGradient id={`gradient-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={isEmpty ? '#94a3b8' : chartColor} stopOpacity={0.5} />
                                    <stop offset="95%" stopColor={isEmpty ? '#94a3b8' : chartColor} stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <PolarGrid stroke="#f1f5f9" />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={({ payload, x, y, textAnchor, stroke, radius }) => (
                                    <text
                                        x={x}
                                        y={y}
                                        textAnchor={textAnchor}
                                        fill={isEmpty ? '#cbd5e1' : '#64748b'}
                                        fontSize={10}
                                        fontWeight={500}
                                    >
                                        {payload.value}
                                    </text>
                                )}
                            />
                            <PolarRadiusAxis angle={30} domain={[0, 9]} tick={false} axisLine={false} />
                            <Radar
                                name="Score"
                                dataKey="A"
                                stroke={isEmpty ? '#cbd5e1' : chartColor}
                                strokeWidth={isEmpty ? 1 : 2}
                                strokeDasharray={isEmpty ? "4 4" : ""}
                                fill={`url(#gradient-${chartId})`}
                                fillOpacity={isEmpty ? 0.2 : 1}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-50 mt-2 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Avg Band</p>
                            <p className={`text-xl font-bold ${bandScore > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                                {loading ? '-' : (bandScore > 0 ? bandScore.toFixed(1) : '-')}
                            </p>
                        </div>
                    </div>
                    <div className={`flex items-center gap-1 ${color} opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-300`}>
                        <span className="text-sm font-medium">View History</span>
                        <ArrowRight className="w-4 h-4" />
                    </div>
                </div>
            </div>
        </Link>
    );
}

// Generate radar data from scores
function generateRadarData(sectionType: string, avgScore: number): RadarDataPoint[] {
    if (avgScore === 0) return [];

    // Simulate sub-criteria based on section type
    const criteriaMap: Record<string, string[]> = {
        reading: ['Comprehension', 'Vocabulary', 'Speed', 'Accuracy', 'Inference'],
        listening: ['Main Ideas', 'Details', 'Spelling', 'Note Taking', 'Following'],
        writing: ['Task Achievement', 'Coherence', 'Vocabulary', 'Grammar'],
        speaking: ['Fluency', 'Vocabulary', 'Grammar', 'Pronunciation'],
    };

    const criteria = criteriaMap[sectionType] || [];

    // Generate slight variations around the average score for visual effect
    return criteria.map((subject, index) => ({
        subject,
        A: Math.min(9, Math.max(0, avgScore + (Math.random() - 0.5) * 1.5)),
        fullMark: 9,
    }));
}

export default function DashboardAnalytics() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sectionStats, setSectionStats] = useState<Record<string, SectionStats>>({
        reading: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [] },
        listening: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [] },
        writing: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [] },
        speaking: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [] },
    });
    const [overallScore, setOverallScore] = useState<number>(0);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Fetch test sessions
                const response = await fetch(`${API_BASE}/api/ielts/sessions/`, {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        // Not authenticated - show empty state silently
                        setLoading(false);
                        return;
                    }
                    // For other errors, just log and show empty state
                    console.warn('Failed to fetch test data:', response.status);
                    setLoading(false);
                    return;
                }

                const sessions: TestSession[] = await response.json();

                // Process sessions to calculate statistics
                const stats: Record<string, SectionStats> = {
                    reading: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [] },
                    listening: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [] },
                    writing: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [] },
                    speaking: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [] },
                };

                sessions.forEach((session) => {
                    if (session.module_attempts && session.module_attempts.length > 0) {
                        session.module_attempts.forEach((attempt) => {
                            const moduleType = (attempt as any).module_type ||
                                guessModuleType(session.test_title);

                            if (stats[moduleType]) {
                                stats[moduleType].totalTests++;
                                if (attempt.is_completed && attempt.band_score !== null) {
                                    stats[moduleType].testsCompleted++;
                                    stats[moduleType].scores.push(Number(attempt.band_score));
                                }
                            }
                        });
                    } else {
                        const moduleType = guessModuleType(session.test_title);
                        if (stats[moduleType]) {
                            stats[moduleType].totalTests++;
                            if (session.is_completed && session.overall_band_score !== null) {
                                stats[moduleType].testsCompleted++;
                                stats[moduleType].scores.push(Number(session.overall_band_score));
                            }
                        }
                    }
                });

                // Calculate averages
                let totalAvg = 0;
                let sectionsWithScores = 0;

                Object.keys(stats).forEach((key) => {
                    if (stats[key].scores.length > 0) {
                        stats[key].averageScore =
                            stats[key].scores.reduce((a, b) => a + b, 0) / stats[key].scores.length;
                        totalAvg += stats[key].averageScore;
                        sectionsWithScores++;
                    }
                });

                setSectionStats(stats);
                setOverallScore(sectionsWithScores > 0 ? totalAvg / sectionsWithScores : 0);

            } catch (err) {
                // Silently handle network errors - just log and show empty state
                console.warn('Error fetching analytics:', err);
                // Don't set error state - just show empty state
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Helper function to guess module type from title
    function guessModuleType(title: string | null | undefined): string {
        if (!title) return 'reading'; // Default fallback
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('read') || lowerTitle.includes('rt')) return 'reading';
        if (lowerTitle.includes('listen') || lowerTitle.includes('lt')) return 'listening';
        if (lowerTitle.includes('writ')) return 'writing';
        if (lowerTitle.includes('speak')) return 'speaking';
        return 'reading';
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Your IELTS Performance</h2>
                    <p className="text-slate-500 text-sm">Track your progress across all four sections</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className={`text-3xl font-bold ${overallScore > 0 ? 'text-purple-600' : 'text-slate-400'}`}>
                            {loading ? '-' : (overallScore > 0 ? overallScore.toFixed(1) : '-')}
                        </p>
                        <p className="text-xs text-slate-500">Overall Band</p>
                    </div>
                    <select className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#6FB63A]">
                        <option>All Time</option>
                        <option>Last 30 Days</option>
                        <option>Last 7 Days</option>
                    </select>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {/* Four Main Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Reading */}
                <SectionCard
                    title="Reading"
                    bandScore={sectionStats.reading.averageScore}
                    data={generateRadarData('reading', sectionStats.reading.averageScore)}
                    color="text-emerald-600"
                    bgColor="bg-emerald-50"
                    icon={<BookOpen className="w-6 h-6 text-emerald-600" />}
                    href="/tests/reading"
                    testsCompleted={sectionStats.reading.testsCompleted}
                    totalTests={sectionStats.reading.totalTests}
                    loading={loading}
                />

                {/* Listening */}
                <SectionCard
                    title="Listening"
                    bandScore={sectionStats.listening.averageScore}
                    data={generateRadarData('listening', sectionStats.listening.averageScore)}
                    color="text-purple-600"
                    bgColor="bg-purple-50"
                    icon={<Headphones className="w-6 h-6 text-purple-600" />}
                    href="/tests/listening"
                    testsCompleted={sectionStats.listening.testsCompleted}
                    totalTests={sectionStats.listening.totalTests}
                    loading={loading}
                />

                {/* Writing */}
                <SectionCard
                    title="Writing"
                    bandScore={sectionStats.writing.averageScore}
                    data={generateRadarData('writing', sectionStats.writing.averageScore)}
                    color="text-orange-600"
                    bgColor="bg-orange-50"
                    icon={<PenTool className="w-6 h-6 text-orange-600" />}
                    href="/tests/writing"
                    testsCompleted={sectionStats.writing.testsCompleted}
                    totalTests={sectionStats.writing.totalTests}
                    loading={loading}
                />

                {/* Speaking */}
                <SectionCard
                    title="Speaking"
                    bandScore={sectionStats.speaking.averageScore}
                    data={generateRadarData('speaking', sectionStats.speaking.averageScore)}
                    color="text-blue-600"
                    bgColor="bg-blue-50"
                    icon={<Mic className="w-6 h-6 text-blue-600" />}
                    href="/tests/speaking"
                    testsCompleted={sectionStats.speaking.testsCompleted}
                    totalTests={sectionStats.speaking.totalTests}
                    loading={loading}
                />
            </div>

            {/* Quick Summary */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-[#6FB63A] rounded-full"></span>
                    Performance Summary
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {/* Reading */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                            <span className="text-emerald-700">Reading</span>
                            <span className="text-emerald-900">{sectionStats.reading.averageScore > 0 ? sectionStats.reading.averageScore.toFixed(1) : '-'}</span>
                        </div>
                        <div className="w-full bg-emerald-50 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                style={{ width: `${(sectionStats.reading.averageScore / 9) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Listening */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                            <span className="text-purple-700">Listening</span>
                            <span className="text-purple-900">{sectionStats.listening.averageScore > 0 ? sectionStats.listening.averageScore.toFixed(1) : '-'}</span>
                        </div>
                        <div className="w-full bg-purple-50 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-purple-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(147,51,234,0.3)]"
                                style={{ width: `${(sectionStats.listening.averageScore / 9) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Writing */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                            <span className="text-orange-700">Writing</span>
                            <span className="text-orange-900">{sectionStats.writing.averageScore > 0 ? sectionStats.writing.averageScore.toFixed(1) : '-'}</span>
                        </div>
                        <div className="w-full bg-orange-50 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-orange-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                                style={{ width: `${(sectionStats.writing.averageScore / 9) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Speaking */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                            <span className="text-blue-700">Speaking</span>
                            <span className="text-blue-900">{sectionStats.speaking.averageScore > 0 ? sectionStats.speaking.averageScore.toFixed(1) : '-'}</span>
                        </div>
                        <div className="w-full bg-blue-50 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-blue-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                style={{ width: `${(sectionStats.speaking.averageScore / 9) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
