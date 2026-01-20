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
    data?: {
        feedback?: any; // Writing/Speaking evaluation
        answers?: Record<string, any>; // Reading/Listening answers
    };
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
    criteriaScores: Record<string, { total: number; count: number }>;
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
    const isEmpty = data.length === 0 || data.every(d => d.A === 0);

    // Default placeholder data for empty state
    const placeholderData = title === 'Reading' ? [
        { subject: 'Part 1', A: 0, fullMark: 9 }, { subject: 'Part 2', A: 0, fullMark: 9 }, { subject: 'Part 3', A: 0, fullMark: 9 }
    ] : title === 'Listening' ? [
        { subject: 'Part 1', A: 0, fullMark: 9 }, { subject: 'Part 2', A: 0, fullMark: 9 }, { subject: 'Part 3', A: 0, fullMark: 9 }, { subject: 'Part 4', A: 0, fullMark: 9 }
    ] : title === 'Writing' ? [
        { subject: 'Task Response', A: 0, fullMark: 9 }, { subject: 'Coherence', A: 0, fullMark: 9 }, { subject: 'Grammar', A: 0, fullMark: 9 }, { subject: 'Lexical', A: 0, fullMark: 9 }
    ] : [
        { subject: 'Fluency', A: 0, fullMark: 9 }, { subject: 'Lexical', A: 0, fullMark: 9 }, { subject: 'Grammar', A: 0, fullMark: 9 }, { subject: 'Pronunciation', A: 0, fullMark: 9 }
    ];

    const displayData = isEmpty ? placeholderData : data;
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
                <div className="h-[220px] w-full relative min-w-[1px]">
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

export default function DashboardAnalytics() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sectionStats, setSectionStats] = useState<Record<string, SectionStats>>({
        reading: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [], criteriaScores: {} },
        listening: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [], criteriaScores: {} },
        writing: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [], criteriaScores: {} },
        speaking: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [], criteriaScores: {} },
    });
    const [overallScore, setOverallScore] = useState<number>(0);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Use relative path to avoid block/CORS issues
                const response = await fetch('/api/ielts/sessions/', {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 403) {
                        setLoading(false);
                        return;
                    }
                    console.warn('Failed to fetch test data:', response.status);
                    setLoading(false);
                    return;
                }

                const sessions: TestSession[] = await response.json();

                // Initialize stats
                const stats: Record<string, SectionStats> = {
                    reading: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [], criteriaScores: {} },
                    listening: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [], criteriaScores: {} },
                    writing: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [], criteriaScores: {} },
                    speaking: { averageScore: 0, testsCompleted: 0, totalTests: 0, scores: [], criteriaScores: {} },
                };

                // Helper to safely add to criteria scores
                const addCriteriaScore = (module: string, criteriaName: string, score: number) => {
                    if (!stats[module].criteriaScores[criteriaName]) {
                        stats[module].criteriaScores[criteriaName] = { total: 0, count: 0 };
                    }
                    stats[module].criteriaScores[criteriaName].total += score;
                    stats[module].criteriaScores[criteriaName].count++;
                };

                sessions.forEach((session) => {
                    const attempts = session.module_attempts || [];

                    // If no attempts but session is completed (legacy support or direct session)
                    if (attempts.length === 0 && session.is_completed) {
                        const moduleType = guessModuleType(session.test_title);
                        if (stats[moduleType]) {
                            stats[moduleType].totalTests++;
                            if (session.overall_band_score) {
                                stats[moduleType].testsCompleted++;
                                stats[moduleType].scores.push(Number(session.overall_band_score));
                                // Cannot guess criteria for legacy sessions
                            }
                        }
                    }

                    attempts.forEach((attempt) => {
                        const moduleType = (attempt.module_type || guessModuleType(session.test_title)).toLowerCase();

                        if (stats[moduleType]) {
                            stats[moduleType].totalTests++;

                            if (attempt.is_completed && attempt.band_score !== null) {
                                stats[moduleType].testsCompleted++;
                                const band = Number(attempt.band_score);
                                stats[moduleType].scores.push(band);

                                // --- Parse Criteria Scores ---
                                const data = attempt.data;

                                if (moduleType === 'writing' && data?.feedback) {
                                    // Writing Criteria: Task Response, Cohesion/Coherence, Grammar, Lexical
                                    const fb = data.feedback;

                                    // Handle new nested structure (tasks.task_1.criteria_scores...)
                                    if (fb.tasks) {
                                        const t1 = fb.tasks.task_1?.criteria_scores;
                                        const t2 = fb.tasks.task_2?.criteria_scores;

                                        // Calculate averages across available tasks
                                        // Task 2 usually weighs more in IELTS (2/3), but for analytics simple average represents performance well enough
                                        // or we can do weighted. Let's do simple average of the band scores presented.

                                        const getAvg = (key: string) => {
                                            let sum = 0;
                                            let count = 0;
                                            if (t1?.[key]) { sum += t1[key]; count++; }
                                            if (t2?.[key]) { sum += t2[key]; count++; }
                                            return count > 0 ? sum / count : 0;
                                        };

                                        addCriteriaScore('writing', 'Task Response', getAvg('task_response'));
                                        addCriteriaScore('writing', 'Coherence', getAvg('coherence_cohesion'));
                                        addCriteriaScore('writing', 'Grammar', getAvg('grammar_accuracy'));
                                        addCriteriaScore('writing', 'Lexical', getAvg('lexical_resource'));
                                    } else {
                                        // Legacy / Fallback Flat Structure
                                        const tr = fb?.task_response?.band || fb?.['Task Response']?.band || band;
                                        const cc = fb?.coherence_cohesion?.band || fb?.['Coherence and Cohesion']?.band || band;
                                        const gra = fb?.grammatical_range?.band || fb?.['Grammatical Range and Accuracy']?.band || band;
                                        const lr = fb?.lexical_resource?.band || fb?.['Lexical Resource']?.band || band;

                                        addCriteriaScore('writing', 'Task Response', Number(tr));
                                        addCriteriaScore('writing', 'Coherence', Number(cc));
                                        addCriteriaScore('writing', 'Grammar', Number(gra));
                                        addCriteriaScore('writing', 'Lexical', Number(lr));
                                    }
                                }
                                else if (moduleType === 'speaking' && data?.feedback) {
                                    // Speaking Criteria: Fluency, Lexical, Grammar, Pronunciation
                                    const fb = data.feedback;

                                    // Check for direct numeric values (from CombinedSpeakingResult)
                                    // or object-based values (legacy/alternative structure)
                                    // or defined aliases

                                    const getVal = (keys: string[]) => {
                                        for (const k of keys) {
                                            if (typeof fb[k] === 'number') return fb[k];
                                            if (fb[k]?.band) return fb[k].band;
                                        }
                                        return band; // Fallback to overall score
                                    };

                                    const fc = getVal(['fluency', 'fluency_coherence', 'Fluency and Coherence']);
                                    const lr = getVal(['lexical', 'lexical_resource', 'Lexical Resource']);
                                    const gra = getVal(['grammar', 'grammatical_range', 'Grammatical Range and Accuracy']);
                                    const pro = getVal(['pronunciation', 'Pronunciation']);

                                    addCriteriaScore('speaking', 'Fluency', Number(fc));
                                    addCriteriaScore('speaking', 'Lexical', Number(lr));
                                    addCriteriaScore('speaking', 'Grammar', Number(gra));
                                    addCriteriaScore('speaking', 'Pronunciation', Number(pro));
                                }
                                else if ((moduleType === 'reading' || moduleType === 'listening') && data?.answers) {
                                    // Reading/Listening: Calculate Part-wise usage
                                    // Assuming keys are Question IDs (integers). 
                                    // Reading: Part 1 (1-13), Part 2 (14-26), Part 3 (27-40)
                                    // Listening: Part 1 (1-10), Part 2 (11-20), Part 3 (21-30), Part 4 (31-40)

                                    const scoresByPart: Record<string, { correct: number; total: number }> = {};

                                    Object.entries(data.answers).forEach(([qId, val]: [string, any]) => {
                                        // Robust ID extraction:
                                        // 1. "Q1" or "P1-Q1" -> matches Q(\d+)
                                        // 2. "Part1-q1" -> matches q(\d+)
                                        // 3. "1" -> matches ^(\d+)$

                                        let qNum = NaN;
                                        const matchQ = qId.match(/Q(\d+)/i);
                                        if (matchQ) {
                                            qNum = parseInt(matchQ[1]);
                                        } else {
                                            // Fallback: try to find any digits at the end
                                            const matchEnd = qId.match(/(\d+)$/);
                                            if (matchEnd) {
                                                qNum = parseInt(matchEnd[1]);
                                            } else {
                                                // Fallback: strip simple non-digits if string is short
                                                qNum = parseInt(qId.replace(/\D/g, ''));
                                            }
                                        }

                                        if (isNaN(qNum)) return;

                                        let partName = '';
                                        if (moduleType === 'reading') {
                                            if (qNum <= 13) partName = 'Part 1';
                                            else if (qNum <= 26) partName = 'Part 2';
                                            else partName = 'Part 3';
                                        } else {
                                            if (qNum <= 10) partName = 'Part 1';
                                            else if (qNum <= 20) partName = 'Part 2';
                                            else if (qNum <= 30) partName = 'Part 3';
                                            else partName = 'Part 4';
                                        }

                                        if (!scoresByPart[partName]) scoresByPart[partName] = { correct: 0, total: 0 };
                                        scoresByPart[partName].total++;
                                        if (val?.is_correct || val === true) {
                                            scoresByPart[partName].correct++;
                                        }
                                    });

                                    // Convert Part raw scores to pseudo-bands (approximate scale 0-9)
                                    Object.entries(scoresByPart).forEach(([part, score]) => {
                                        const percentage = score.total > 0 ? (score.correct / score.total) : 0;
                                        // Rough IELTS Band approximation: 50% ~ 5.0, 70% ~ 6.0, 85% ~ 7.0, etc.
                                        // Using simple 9 * percentage for granular visual feedback
                                        addCriteriaScore(moduleType, part, percentage * 9);
                                    });
                                }
                            }
                        }
                    });
                });

                // Finalize Averages
                let totalAvg = 0;
                let sectionsWithScores = 0;

                Object.keys(stats).forEach((key) => {
                    const stat = stats[key];
                    if (stat.scores.length > 0) {
                        stat.averageScore = stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length;
                        totalAvg += stat.averageScore;
                        sectionsWithScores++;
                    }
                });

                setSectionStats(stats);
                setOverallScore(sectionsWithScores > 0 ? totalAvg / sectionsWithScores : 0);

            } catch (err) {
                console.warn('Error fetching analytics:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Helper function to guess module type
    function guessModuleType(title: string | null | undefined): string {
        if (!title) return 'reading';
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('read') || lowerTitle.includes('rt')) return 'reading';
        if (lowerTitle.includes('listen') || lowerTitle.includes('lt')) return 'listening';
        if (lowerTitle.includes('writ')) return 'writing';
        if (lowerTitle.includes('speak')) return 'speaking';
        return 'reading';
    }

    // Generate Chart Data from Accumulated Criteria
    const getChartData = (module: string) => {
        const criteria = sectionStats[module].criteriaScores;
        const keys = Object.keys(criteria);

        // Define standard ordering
        let order: string[] = [];
        if (module === 'reading') order = ['Part 1', 'Part 2', 'Part 3'];
        else if (module === 'listening') order = ['Part 1', 'Part 2', 'Part 3', 'Part 4'];
        else if (module === 'writing') order = ['Task Response', 'Coherence', 'Grammar', 'Lexical'];
        else if (module === 'speaking') order = ['Fluency', 'Lexical', 'Grammar', 'Pronunciation'];

        if (keys.length === 0) return [];

        // Map and sort based on standard order
        return order.map(subject => {
            const data = criteria[subject];
            const rawAvg = data ? (data.total / data.count) : 0;
            const avg = typeof rawAvg === 'number' && !isNaN(rawAvg) ? rawAvg : 0;
            return {
                subject,
                A: Number(avg.toFixed(1)),
                fullMark: 9
            };
        });
    };

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
                    data={getChartData('reading')}
                    color="text-emerald-600"
                    bgColor="bg-emerald-50"
                    icon={<BookOpen className="w-6 h-6 text-emerald-600" />}
                    href="/reports?type=reading"
                    testsCompleted={sectionStats.reading.testsCompleted}
                    totalTests={sectionStats.reading.totalTests}
                    loading={loading}
                />

                {/* Listening */}
                <SectionCard
                    title="Listening"
                    bandScore={sectionStats.listening.averageScore}
                    data={getChartData('listening')}
                    color="text-purple-600"
                    bgColor="bg-purple-50"
                    icon={<Headphones className="w-6 h-6 text-purple-600" />}
                    href="/reports?type=listening"
                    testsCompleted={sectionStats.listening.testsCompleted}
                    totalTests={sectionStats.listening.totalTests}
                    loading={loading}
                />

                {/* Writing */}
                <SectionCard
                    title="Writing"
                    bandScore={sectionStats.writing.averageScore}
                    data={getChartData('writing')}
                    color="text-orange-600"
                    bgColor="bg-orange-50"
                    icon={<PenTool className="w-6 h-6 text-orange-600" />}
                    href="/reports?type=writing"
                    testsCompleted={sectionStats.writing.testsCompleted}
                    totalTests={sectionStats.writing.totalTests}
                    loading={loading}
                />

                {/* Speaking */}
                <SectionCard
                    title="Speaking"
                    bandScore={sectionStats.speaking.averageScore}
                    data={getChartData('speaking')}
                    color="text-blue-600"
                    bgColor="bg-blue-50"
                    icon={<Mic className="w-6 h-6 text-blue-600" />}
                    href="/reports?type=speaking"
                    testsCompleted={sectionStats.speaking.testsCompleted}
                    totalTests={sectionStats.speaking.totalTests}
                    loading={loading}
                />
            </div>
        </div>
    );
}
