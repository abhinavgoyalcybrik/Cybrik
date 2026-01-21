'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    ArrowLeft,
    Share2,
    Download,
    CheckCircle,
    XCircle,
    Clock,
    Calendar,
    Award,
    MessageSquare,
    Mic,
    Play,
    ChevronDown,
    TrendingUp,
    BookOpen,
    Check,
    Lightbulb,
    AlertCircle
} from 'lucide-react';
import AITutorCard from '@/components/AITutorCard';

interface QuestionResult {
    question_number: number;
    user_answer: string;
    correct_answer: string;
    is_correct: boolean;
}

interface PassageHighlight {
    questionNumber: number;
    passageText: string;
    startIndex: number;
    endIndex: number;
    passageTitle: string;
    isCorrect: boolean;
}

interface ReportDetail {
    id: string;
    testName: string;
    testType: 'reading' | 'listening' | 'writing' | 'speaking';
    dateTaken: string;
    timeTaken: string;
    bandScore: number;
    feedback?: string;
    questionBreakdown?: QuestionResult[];
    transcript?: string;
    audioUrl?: string;
    answerHighlights?: PassageHighlight[];
    improvementAreas?: string[];
}

function AnswerHighlightCard({
    questionNumber,
    passageText,
    startIndex,
    endIndex,
    passageTitle,
    isCorrect
}: PassageHighlight) {
    const [isExpanded, setIsExpanded] = useState(false);
    const contextStart = Math.max(0, startIndex - 150);
    const contextEnd = Math.min(passageText.length, endIndex + 150);
    const beforeText = passageText.slice(contextStart, startIndex);
    const highlightedText = passageText.slice(startIndex, endIndex);
    const afterText = passageText.slice(endIndex, contextEnd);

    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-md text-sm font-semibold ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        Q{questionNumber}
                    </span>
                    <span className="text-sm font-medium text-slate-700 truncate">{passageTitle}</span>
                    {isCorrect ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="p-4 bg-white border-t border-slate-100">
                    <p className="text-slate-600 leading-relaxed text-[15px]">
                        {contextStart > 0 && <span className="text-slate-400">...</span>}
                        <span className="text-slate-500">{beforeText}</span>
                        <mark className="bg-yellow-200 text-slate-900 px-1 py-0.5 rounded font-medium">{highlightedText}</mark>
                        <span className="text-slate-500">{afterText}</span>
                        {contextEnd < passageText.length && <span className="text-slate-400">...</span>}
                    </p>
                </div>
            )}
        </div>
    );
}

export default function ReportDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { id } = params;
    const { user, isLoading: authLoading } = useAuth();
    const [report, setReport] = useState<ReportDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
    }, [authLoading, user, router]);

    useEffect(() => {
        const fetchReportDetail = async () => {
            if (!id || !user) return;
            try {
                const response = await fetch(`/api/ielts/sessions/${id}/`, { credentials: 'include' });
                if (!response.ok) {
                    setError('Report unavailable');
                    setLoading(false);
                    return;
                }
                const session = await response.json();
                const attempt = session.module_attempts?.[0];
                if (!attempt) {
                    setError('No test data found');
                    setLoading(false);
                    return;
                }

                const moduleType = attempt.module_type || 'reading';
                if (moduleType === 'writing') {
                    router.replace(`/reports/writing/${id}`);
                    return;
                }

                const feedback = attempt.feedback || attempt.data?.feedback || {};

                setReport({
                    id: session.id,
                    testName: session.test_title || `${moduleType.charAt(0).toUpperCase() + moduleType.slice(1)} Test`,
                    testType: moduleType,
                    dateTaken: session.created_at || session.start_time,
                    timeTaken: attempt.duration_minutes ? `${attempt.duration_minutes} min` : '0 min',
                    bandScore: attempt.band_score || feedback.overall_band || 0,
                    feedback: typeof feedback === 'string' ? feedback : feedback.summary || feedback.feedback || '',
                    questionBreakdown: (attempt.answers && Object.keys(attempt.answers).length > 0)
                        ? (Array.isArray(attempt.answers)
                            ? attempt.answers.map((ans: any, idx: number) => ({
                                question_number: ans.question_number || idx + 1,
                                user_answer: ans.user_answer || '-',
                                correct_answer: ans.correct_answer || '-',
                                is_correct: ans.is_correct ?? false,
                            }))
                            : Object.entries(attempt.answers).map(([key, value]: [string, any], idx: number) => ({
                                question_number: parseInt(key) || idx + 1, // Try to use key as question number
                                user_answer: typeof value === 'string' ? value : (value?.user_answer || '-'),
                                correct_answer: value?.correct_answer || '-',
                                is_correct: value?.is_correct ?? false
                            }))
                        )
                        : (feedback.breakdown || []).map((item: any) => ({
                            question_number: item.question_number,
                            user_answer: item.user_answer,
                            correct_answer: item.correct_answer,
                            is_correct: item.is_correct
                        })),
                    transcript: feedback.transcript,
                    audioUrl: attempt.audio_url,
                    improvementAreas: feedback.improvements || []
                });
            } catch (err) {
                console.error(err);
                setError('Failed to load report');
            } finally {
                setLoading(false);
            }
        };
        fetchReportDetail();
    }, [id, user]);

    if (loading || authLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;
    if (!report) return <AdminLayout title="Report Not Found"><div className="text-center py-20">Report details unavailable.</div></AdminLayout>;

    const isObjective = ['reading', 'listening'].includes(report.testType);

    return (
        <AdminLayout title="Test Report" subtitle={`Detailed analysis for ${report.testName}`}>
            <div className="mb-6">
                <div className="mb-4">
                    <img src="/logo.png" alt="Cybrik Logo" className="h-10 w-auto object-contain" />
                </div>
                <button onClick={() => router.back()} className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to all reports
                </button>

                {/* Header Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${report.testType === 'reading' ? 'bg-emerald-100 text-emerald-700' :
                                report.testType === 'listening' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>{report.testType}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 text-sm font-medium flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(report.dateTaken).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{report.testName}</h1>
                        <div className="flex gap-3 mt-4">
                            <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-100 transition">
                                <Download className="w-4 h-4" /> Download PDF
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium hover:bg-slate-100 transition">
                                <Share2 className="w-4 h-4" /> Share Result
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="text-right">
                            <div className="text-5xl font-extrabold text-emerald-500">{report.bandScore}</div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1 text-center">Band Score</div>
                        </div>
                        <div className="h-12 w-px bg-slate-100 hidden md:block"></div>
                        <div className="hidden md:block text-right">
                            <div className="text-3xl font-bold text-slate-800 text-center">
                                {report.bandScore >= 8.5 ? 'C2' : report.bandScore >= 7 ? 'C1' : report.bandScore >= 5.5 ? 'B2' : 'B1'}
                            </div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1 text-center">CEFR Level</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {isObjective && report.questionBreakdown && (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h3 className="font-bold text-slate-900 mb-6">Question Analysis</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">#</th>
                                                <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Your Answer</th>
                                                <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Correct Answer</th>
                                                <th className="text-center py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Result</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {report.questionBreakdown.map((q, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 px-4 text-sm font-medium text-slate-500">{q.question_number}</td>
                                                    <td className="py-4 px-4 text-sm font-medium text-slate-800 font-mono">
                                                        {q.user_answer !== '-' ? q.user_answer : <span className="text-red-300">-</span>}
                                                    </td>
                                                    <td className="py-4 px-4 text-sm font-medium text-slate-500 font-mono text-xs uppercase">
                                                        {Array.isArray(q.correct_answer) ? q.correct_answer.join(' / ') : q.correct_answer}
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        {q.is_correct ?
                                                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600"><Check className="w-3.5 h-3.5" /></div> :
                                                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600"><span className="text-xs font-bold">✕</span></div>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {!isObjective && report.feedback && (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h3 className="font-bold text-slate-900 mb-4">Examiner Feedback</h3>
                                <div className="prose prose-slate max-w-none text-slate-600 bg-slate-50 p-6 rounded-xl border border-slate-100">
                                    {report.feedback}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Stats */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-600" /> Performance Summary
                            </h3>
                            <div className="space-y-4">
                                <div className="p-5 rounded-xl bg-indigo-50/50 border border-indigo-50">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-2">Correct Answers</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-bold text-indigo-600">{report.questionBreakdown?.filter(q => q.is_correct).length || 0}</span>
                                        <span className="text-md font-medium text-indigo-300">/ 40</span>
                                    </div>
                                </div>
                                <div className="p-5 rounded-xl bg-orange-50/50 border border-orange-50">
                                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block mb-2">Time Taken</span>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-orange-500" />
                                        <span className="text-2xl font-bold text-orange-600">{report.timeTaken}</span>
                                    </div>
                                </div>
                                <div className="p-5 rounded-xl bg-purple-50/50 border border-purple-50">
                                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-2">Percentile</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-bold text-purple-600">Top 15%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
