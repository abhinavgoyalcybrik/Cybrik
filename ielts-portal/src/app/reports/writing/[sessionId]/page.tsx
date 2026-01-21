'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FileText,
    TrendingUp,
    MessageCircle,
    CheckCircle,
    AlertCircle,
    BookOpen,
    Lightbulb,
    ChevronRight,
    Target,
    Clock,
    Check,
    Lock,
    ArrowLeft
} from 'lucide-react';
import { WritingEvaluationResult } from '@/services/evaluatorApi';

interface PageProps {
    params: Promise<{ sessionId: string }>;
}

// CEFR mapping
function getCEFRLevel(band: number): string {
    if (band >= 8.5) return 'C2';
    if (band >= 7) return 'C1';
    if (band >= 5.5) return 'B2';
    if (band >= 4) return 'B1';
    if (band >= 2.5) return 'A2';
    return 'A1';
}

export default function WritingReportPage({ params }: PageProps) {
    const { sessionId } = use(params);
    const router = useRouter();

    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [result, setResult] = useState<WritingEvaluationResult | null>(null);
    const [activeTab, setActiveTab] = useState<'task1' | 'task2'>('task1');
    const [analysisTab, setAnalysisTab] = useState<'task_response' | 'coherence_cohesion' | 'lexical_resource' | 'grammar_accuracy'>('task_response');
    const [userAnswers, setUserAnswers] = useState<{ task_1?: string, task_2?: string }>({});
    const [evalData, setEvalData] = useState<any>(null); // Full raw data

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const response = await fetch(`/api/ielts/sessions/${sessionId}/`, {
                    credentials: 'include',
                });

                if (!response.ok) {
                    throw new Error('Session not found');
                }

                const session = await response.json();
                const attempt = session.module_attempts?.find((a: any) => a.module_type === 'writing');

                if (attempt) {
                    // Extract data
                    const feedback = attempt.feedback || attempt.data?.feedback;
                    const answers = attempt.answers || attempt.data?.answers || {};

                    if (feedback) {
                        setResult(feedback as WritingEvaluationResult);
                        setEvalData(feedback);
                        setUserAnswers(answers);
                        setStatus('ready');

                        // Default to Task 2 if Task 1 is missing/empty
                        if (!feedback.tasks?.task_1 && feedback.tasks?.task_2) {
                            setActiveTab('task2');
                        }
                    } else {
                        setStatus('error'); // No detailed feedback found
                    }
                } else {
                    setStatus('error');
                }
            } catch (err) {
                console.error(err);
                setStatus('error');
            }
        };

        fetchSession();
    }, [sessionId]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    if (status === 'error' || !result) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-slate-800 mb-2">Report Unavailable</h1>
                <p className="text-slate-500 mb-6">Detailed analysis could not be loaded for this test.</p>
                <Link href="/reports" className="px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition">
                    Back to Reports
                </Link>
            </div>
        );
    }

    const overallBand = result.overall_writing_band || 0;
    const cefrLevel = getCEFRLevel(overallBand);

    // Check which task is active and get its data
    const taskData = activeTab === 'task1' ? result.tasks?.task_1 : result.tasks?.task_2;
    const currentAnswer = activeTab === 'task1' ? userAnswers.task_1 : userAnswers.task_2;

    // Helper to get formatted criteria name
    const getCriteriaLabel = (key: string) => {
        const labels: Record<string, string> = {
            task_response: 'Task Response',
            coherence_cohesion: 'Coherence & Cohesion',
            lexical_resource: 'Lexical Resource',
            grammar_accuracy: 'Grammar Accuracy'
        };
        return labels[key] || key;
    };

    // Helper to get criterion color
    const getCriteriaColor = (key: string) => {
        const colors: Record<string, string> = {
            task_response: 'text-purple-600 bg-purple-100',
            coherence_cohesion: 'text-blue-600 bg-blue-100',
            lexical_resource: 'text-orange-600 bg-orange-100',
            grammar_accuracy: 'text-emerald-600 bg-emerald-100'
        };
        return colors[key] || 'text-slate-600 bg-slate-100';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50">
            {/* Top Navigation */}
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <button onClick={() => router.back()} className="flex items-center text-slate-500 hover:text-slate-800 transition">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Reports
                    </button>
                    <div className="font-bold text-slate-800">Writing Test Report</div>
                    <div className="w-20"></div> {/* Spacer */}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Score Header */}
                <div className="bg-white rounded-3xl shadow-lg border border-purple-100 p-8 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50" />

                    <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-8">
                            <div className="text-center md:text-left">
                                <div className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 leading-none mb-2">
                                    {overallBand.toFixed(1)}<span className="text-3xl text-slate-300 font-normal">/9.0</span>
                                </div>
                                <div className="text-slate-500 font-medium">Overall Band Score</div>
                            </div>
                            <div className="hidden md:block w-px h-20 bg-slate-200" />
                            <div className="text-center md:text-left">
                                <div className="text-4xl font-bold text-slate-800 mb-1">{cefrLevel}</div>
                                <div className="text-slate-500 font-medium">CEFR Level</div>
                            </div>
                        </div>

                        <button className="flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-purple-200 hover:shadow-xl hover:-translate-y-0.5">
                            <MessageCircle className="w-5 h-5" />
                            Chat with AI Tutor
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-250px)] min-h-[600px]">

                    {/* Left Panel: User Answer */}
                    <div className="lg:col-span-7 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* Task Toggles */}
                        <div className="flex border-b border-slate-100 p-2 bg-slate-50/50">
                            {result.tasks?.task_1 && (
                                <button
                                    onClick={() => setActiveTab('task1')}
                                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'task1'
                                        ? 'bg-white text-purple-700 shadow-sm border border-slate-100'
                                        : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
                                >
                                    Task 1
                                </button>
                            )}
                            <button
                                onClick={() => setActiveTab('task2')}
                                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'task2'
                                    ? 'bg-white text-purple-700 shadow-sm border border-slate-100'
                                    : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'}`}
                            >
                                Task 2
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {!taskData ? (
                                <div className="text-center text-slate-400 py-20">Task not attempted</div>
                            ) : (
                                <>
                                    <div className="mb-6 bg-purple-50 rounded-xl p-5 border border-purple-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <BookOpen className="w-4 h-4 text-purple-600" />
                                            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Question Prompt</span>
                                        </div>
                                        <p className="text-slate-700 font-medium leading-relaxed">
                                            {/* We might not have the question text in result... check if passed? 
                                                Actually API result structure doesn't always echo question. 
                                                Ideally we fetched test data? But for now generic or passed in 'mistakes' sentence context? 
                                                If unavailable, generic text or skip. */}
                                            Writing Task {activeTab === 'task1' ? '1' : '2'}
                                        </p>
                                    </div>

                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800">Your Answer</h3>
                                        <span className={`text-xs px-2 py-1 rounded font-medium ${taskData.word_count < (activeTab === 'task1' ? 150 : 250) ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {taskData.word_count} words
                                        </span>
                                    </div>

                                    <div className="prose prose-slate max-w-none text-slate-600 leading-loose whitespace-pre-wrap font-serif text-lg bg-slate-50 p-6 rounded-xl border border-slate-100">
                                        {currentAnswer || "No answer text available."}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Analysis */}
                    <div className="lg:col-span-5 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        {taskData ? (
                            <>
                                {/* Criteria Tabs */}
                                <div className="flex overflow-x-auto border-b border-slate-100 p-2 gap-1 hide-scrollbar">
                                    {(['task_response', 'coherence_cohesion', 'lexical_resource', 'grammar_accuracy'] as const).map((key) => {
                                        const shortLabels: any = { task_response: 'TR', coherence_cohesion: 'CC', lexical_resource: 'LR', grammar_accuracy: 'GRA' };
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setAnalysisTab(key)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${analysisTab === key
                                                        ? 'bg-slate-900 text-white'
                                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                                    }`}
                                                title={getCriteriaLabel(key)}
                                            >
                                                {shortLabels[key]} {taskData.criteria_scores[key]?.toFixed(1)}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                                    {/* Score Card */}
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-bold text-slate-800">{getCriteriaLabel(analysisTab)}</h3>
                                                <div className="text-sm text-slate-500 mt-1">Band Score</div>
                                            </div>
                                            <div className="text-4xl font-bold text-slate-900">{taskData.criteria_scores[analysisTab]}</div>
                                        </div>

                                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${analysisTab === 'task_response' ? 'bg-purple-500' :
                                                        analysisTab === 'coherence_cohesion' ? 'bg-blue-500' :
                                                            analysisTab === 'lexical_resource' ? 'bg-orange-500' : 'bg-emerald-500'
                                                    }`}
                                                style={{ width: `${(taskData.criteria_scores[analysisTab] / 9) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Feedback Items for this Criteria */}
                                    {analysisTab === 'grammar_accuracy' ? (
                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-slate-800 text-sm uppercase tracking-wide opacity-70">Mistakes detected</h4>

                                            {taskData.mistakes?.filter(m => m.correction).length === 0 && (
                                                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-center text-sm border border-emerald-100">
                                                    No major grammar errors found. Great job!
                                                </div>
                                            )}

                                            {taskData.mistakes?.map((mistake, i) => (
                                                <div key={i} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm group hover:border-red-200 transition-all">
                                                    <div className="text-red-500 text-xs font-bold uppercase mb-2">{mistake.error_type}</div>
                                                    <div className="text-slate-500 line-through text-sm mb-1 opacity-70">{mistake.sentence}</div>
                                                    <div className="text-emerald-700 font-medium text-sm flex items-start gap-2">
                                                        <Check className="w-4 h-4 mt-0.5 shrink-0" />
                                                        {mistake.correction}
                                                    </div>
                                                    <div className="mt-3 pt-3 border-t border-slate-50 text-xs text-slate-500">
                                                        {mistake.explanation}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <h4 className="font-semibold text-slate-800 text-sm uppercase tracking-wide opacity-70">Improvement Tips</h4>
                                            {/* Generate heuristic tips since API doesn't return per-criteria text highlights yet */}
                                            {taskData.criteria_scores[analysisTab] < 7 ? (
                                                <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm">
                                                    <div className="flex gap-3">
                                                        <Lightbulb className="w-5 h-5 text-amber-500 shrink-0" />
                                                        <div>
                                                            <p className="text-slate-700 text-sm leading-relaxed">
                                                                Your score indicates room for improvement.
                                                                {analysisTab === 'task_response' && " Try to develop your main ideas more fully and ensure all parts of the prompt are covered in depth."}
                                                                {analysisTab === 'coherence_cohesion' && " Focus on using a wider range of linking words and ensure logical paragraph progression."}
                                                                {analysisTab === 'lexical_resource' && " Try to use less common vocabulary. Avoid repetition by using synonyms."}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm">
                                                    <div className="flex gap-3">
                                                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                                                        <div>
                                                            <p className="text-slate-700 text-sm leading-relaxed">
                                                                Excellent performance in this area. You demonstrated sophisticated control.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Model Answer (always visible at bottom or separate tab? Let's keep it here) */}
                                    <div className="mt-8 pt-8 border-t border-slate-200">
                                        <button className="w-full py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-50 hover:text-purple-600 transition-colors flex items-center justify-center gap-2">
                                            <Lock className="w-4 h-4" />
                                            View Band 9 Model Answer
                                        </button>
                                        <p className="text-center text-xs text-slate-400 mt-2">Available for Premium users</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">Analysis unavailable</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
