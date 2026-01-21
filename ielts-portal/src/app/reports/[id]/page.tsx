'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
    ArrowLeft,
    Share2,
    Download,
    CheckCircle,
    XCircle,
    MinusCircle,
    Clock,
    Calendar,
    Award,
    MessageSquare,
    Mic,
    Play,
    ChevronDown,
    TrendingUp,
    BookOpen,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
    questionBreakdown?: QuestionResult[]; // For Reading/Listening
    transcript?: string; // For Speaking/Writing (if we have audio transcript)
    audioUrl?: string; // For Speaking/Listening playback
    answerHighlights?: PassageHighlight[]; // For Reading - passage text highlights
}

// Answer Highlight Card Component
function AnswerHighlightCard({
    questionNumber,
    passageText,
    startIndex,
    endIndex,
    passageTitle,
    isCorrect
}: PassageHighlight) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Extract context: 150 chars before and after for better context
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
                    <span className={`px-2.5 py-1 rounded-md text-sm font-semibold ${isCorrect
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                        }`}>
                        Q{questionNumber}
                    </span>
                    <span className="text-sm font-medium text-slate-700 truncate">
                        {passageTitle}
                    </span>
                    {isCorrect && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {!isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''
                    }`} />
            </button>

            {isExpanded && (
                <div className="p-4 bg-white border-t border-slate-100">
                    <p className="text-slate-600 leading-relaxed text-[15px]">
                        {contextStart > 0 && <span className="text-slate-400">...</span>}
                        <span className="text-slate-500">{beforeText}</span>
                        <mark className="bg-yellow-200 text-slate-900 px-1 py-0.5 rounded font-medium">
                            {highlightedText}
                        </mark>
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
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        const fetchReportDetail = async () => {
            if (!id || !user) return;

            try {
                // Use relative path to go through Next.js proxy (ensures cookies are sent)
                const response = await fetch(`/api/ielts/sessions/${id}/`, {
                    credentials: 'include',
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        setError('Test session not found');
                    } else if (response.status === 403) {
                        setError('Please log in to view this report');
                    } else {
                        setError('Failed to load report details');
                    }
                    setLoading(false);
                    return;
                }

                const session = await response.json();

                // Find the first module attempt (the test data)
                const attempt = session.module_attempts?.[0];
                if (!attempt) {
                    setError('No test data found for this session');
                    setLoading(false);
                    return;
                }

                // Map session data to report format
                const moduleType = attempt.module_type || 'reading';

                // Redirect to Premium Writing Report if applicable
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
                    questionBreakdown: (attempt.answers && attempt.answers.length > 0)
                        ? attempt.answers.map((ans: any, idx: number) => ({
                            question_number: idx + 1,
                            user_answer: ans.user_answer || ans.answer_text || '-',
                            correct_answer: ans.correct_answer || '-',
                            is_correct: ans.is_correct ?? false,
                        }))
                        : (feedback.breakdown || []).map((item: any) => ({
                            question_number: item.question_number,
                            user_answer: item.user_answer,
                            correct_answer: item.correct_answer,
                            is_correct: item.is_correct
                        })),
                    transcript: feedback.transcript,
                    audioUrl: attempt.audio_url
                });

            } catch (err) {
                console.error('Error loading report:', err);
                setError('Failed to load report details');
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchReportDetail();
    }, [id, user]);

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    if (!report) {
        return (
            <AdminLayout title="Report Not Found">
                <div className="text-center py-20">
                    <h2 className="text-xl font-semibold text-gray-700">Report details unavailable.</h2>
                    <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">Go Back</button>
                </div>
            </AdminLayout>
        );
    }

    const isObjective = ['reading', 'listening'].includes(report.testType);

    return (
        <AdminLayout
            title="Test Report"
            subtitle={`Detailed analysis for ${report.testName}`}
        >
            <div className="mb-6">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to all reports
                </button>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide 
                                    ${report.testType === 'reading' ? 'bg-emerald-100 text-emerald-700' :
                                        report.testType === 'listening' ? 'bg-purple-100 text-purple-700' :
                                            report.testType === 'writing' ? 'bg-orange-100 text-orange-700' :
                                                'bg-blue-100 text-blue-700'}`}>
                                    {report.testType}
                                </span>
                                <span className="text-slate-300">|</span>
                                <span className="text-slate-500 text-sm font-medium flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {new Date(report.dateTaken).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">{report.testName}</h1>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <div className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
                                    {report.bandScore}
                                </div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Band Score</div>
                            </div>
                            <div className="h-12 w-px bg-slate-100 hidden md:block"></div>
                            <div className="hidden md:block text-right">
                                <div className="text-3xl font-bold text-slate-700">
                                    {report.bandScore >= 8.5 ? 'C2' : report.bandScore >= 7 ? 'C1' : report.bandScore >= 5.5 ? 'B2' : 'B1'}
                                </div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">CEFR Level</div>
                            </div>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-8 pt-6 border-t border-slate-100 flex gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                            <Download className="w-4 h-4" /> Download PDF
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
                            <Share2 className="w-4 h-4" /> Share Result
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Feedback Section */}
                    {report.feedback && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <MessageSquare className="w-24 h-24 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                <Award className="w-5 h-5 text-blue-600" />
                                Examiner Feedback
                            </h3>
                            <div className="prose prose-slate max-w-none text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                {report.feedback}
                            </div>
                        </div>
                    )}

                    {/* Question Breakdown (Reading/Listening) */}
                    {isObjective && report.questionBreakdown && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="text-lg font-semibold text-slate-900">Question Analysis</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3 w-16">#</th>
                                            <th className="px-6 py-3">Your Answer</th>
                                            <th className="px-6 py-3">Correct Answer</th>
                                            <th className="px-6 py-3 w-24 text-center">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.questionBreakdown.map((q) => (
                                            <tr key={q.question_number} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                                <td className="px-6 py-4 font-medium text-slate-500">{q.question_number}</td>
                                                <td className={`px-6 py-4 ${q.is_correct ? 'text-green-700 font-medium' : 'text-red-600 line-through decoration-red-300'}`}>
                                                    {q.user_answer}
                                                </td>
                                                <td className="px-6 py-4 text-slate-700">
                                                    {q.correct_answer}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {q.is_correct ? (
                                                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                                                    ) : (
                                                        <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Speaking/Writing Transcript or Audio */}
                    {!isObjective && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                {report.testType === 'speaking' ? <Mic className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                                Response Review
                            </h3>

                            {report.audioUrl && (
                                <div className="bg-slate-50 p-4 rounded-xl mb-4 flex items-center gap-3">
                                    <button className="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200">
                                        <Play className="w-4 h-4 text-slate-700 ml-0.5" />
                                    </button>
                                    <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="w-1/3 h-full bg-blue-500 rounded-full"></div>
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium font-mono">12:34</span>
                                </div>
                            )}

                            {report.transcript ? (
                                <div className="space-y-4 text-slate-600 leading-relaxed">
                                    <p className="italic text-sm text-slate-400 mb-2">Transcript:</p>
                                    {report.transcript}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400 italic">
                                    No transcript available for this session.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Answer Highlights Section (Reading) */}
                    {report.testType === 'reading' && report.answerHighlights && report.answerHighlights.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-indigo-600" />
                                    Answer Review - Passage Highlights
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Click on each question to see where the answer appears in the passage
                                </p>
                            </div>

                            <div className="p-6 space-y-3">
                                {report.answerHighlights.map((highlight, index) => (
                                    <AnswerHighlightCard key={index} {...highlight} />
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Sidebar Stats */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                            Performance Summary
                        </h3>

                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Correct Answers</span>
                                <div className="mt-1 flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-indigo-700">
                                        {report.questionBreakdown?.filter(q => q.is_correct).length || 0}
                                    </span>
                                    <span className="text-sm font-medium text-indigo-400">/ 40</span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                                <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">Time Taken</span>
                                <div className="mt-1 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-orange-600" />
                                    <span className="text-xl font-bold text-orange-700">{report.timeTaken}</span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-purple-50 border border-purple-100">
                                <span className="text-xs font-bold text-purple-400 uppercase tracking-wide">Percentile</span>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="text-xl font-bold text-purple-700">Top 15%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
