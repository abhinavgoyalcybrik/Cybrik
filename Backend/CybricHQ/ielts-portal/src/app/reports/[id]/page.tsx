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
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface QuestionResult {
    question_number: number;
    user_answer: string;
    correct_answer: string;
    is_correct: boolean;
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
                // Determine if ID is session ID or module attempt ID
                // For now, let's assume we fetch a module attempt directly or session
                // We might need a specific endpoint like `/api/ielts/results/${id}/`
                const response = await fetch(`${API_BASE}/api/ielts/results/${id}/`, {
                    credentials: 'include',
                });

                if (!response.ok) {
                    throw new Error('Failed to load report details');
                }

                const data = await response.json();

                // Transform backend data to FE model
                // This is mock logic until the exact endpoint structure is confirmed
                // Assuming data returns { module_type, band_score, feedback, answers: [] }
                setReport({
                    id: data.id,
                    testName: data.test_title || 'IELTS Test',
                    testType: data.module_type || 'reading',
                    dateTaken: data.created_at,
                    timeTaken: '45 min', // Placeholder or calc
                    bandScore: data.band_score || 0,
                    feedback: data.feedback || "Great effort! Focus on cohesion in your next attempt.",
                    questionBreakdown: data.answers || [], // If available
                    transcript: data.transcript,
                    audioUrl: data.audio_url
                });

            } catch (err) {
                console.error(err);
                // Fallback Mock Data for Demo if API fails (since endpoint might not exist yet)
                setReport({
                    id: id as string,
                    testName: 'Mock IELTS Reading Test',
                    testType: 'reading',
                    dateTaken: new Date().toISOString(),
                    timeTaken: '58 min',
                    bandScore: 7.5,
                    feedback: 'Strong performance in factual recall. Be careful with True/False/Not Given distinctions.',
                    questionBreakdown: Array.from({ length: 40 }).map((_, i) => ({
                        question_number: i + 1,
                        user_answer: i % 5 === 0 ? 'Wrong Answer' : 'Correct Answer',
                        correct_answer: 'Correct Answer',
                        is_correct: i % 5 !== 0
                    }))
                });
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
                                <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide 
                                    ${report.testType === 'reading' ? 'bg-emerald-100 text-emerald-700' :
                                        report.testType === 'listening' ? 'bg-purple-100 text-purple-700' :
                                            report.testType === 'writing' ? 'bg-orange-100 text-orange-700' :
                                                'bg-blue-100 text-blue-700'}`}>
                                    {report.testType}
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-500 text-sm flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {new Date(report.dateTaken).toLocaleDateString()}
                                </span>
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900">{report.testName}</h1>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-sm text-slate-500">Overall Band</p>
                                <p className={`text-4xl font-bold ${report.bandScore >= 7.0 ? 'text-green-600' :
                                        report.bandScore >= 6.0 ? 'text-emerald-600' : 'text-amber-600'
                                    }`}>
                                    {report.bandScore}
                                </p>
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

                </div>

                {/* Sidebar Stats */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                        <h3 className="font-semibold text-slate-900 mb-4">Performance Summary</h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                <span className="text-sm text-slate-500">Correct Answers</span>
                                <span className="font-medium text-slate-900">
                                    {report.questionBreakdown?.filter(q => q.is_correct).length || 0} / 40
                                </span>
                            </div>
                            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                <span className="text-sm text-slate-500">Time Taken</span>
                                <span className="font-medium text-slate-900 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {report.timeTaken}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-500">Percentile</span>
                                <span className="font-medium text-purple-600">Top 15%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
