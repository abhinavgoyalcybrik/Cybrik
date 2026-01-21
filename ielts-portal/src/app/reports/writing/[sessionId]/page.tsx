'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Check,
    AlertCircle,
    BookOpen,
    Lightbulb,
    Target,
    ArrowLeft,
    Share2,
    Download,
    MessageCircle,
    Bot
} from 'lucide-react';
import { WritingEvaluationResult } from '@/services/evaluatorApi';
import AITutorCard from '@/components/AITutorCard';

interface PageProps {
    params: Promise<{ sessionId: string }>;
}

export default function WritingReportPage({ params }: PageProps) {
    const { sessionId } = use(params);
    const router = useRouter();

    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [result, setResult] = useState<WritingEvaluationResult | null>(null);
    const [activeTab, setActiveTab] = useState<'task_1' | 'task_2'>('task_1');
    const [userAnswers, setUserAnswers] = useState<any>({}); // Use any to be flexible with keys

    // Derived state for the active task
    const taskData = result?.tasks?.[activeTab];
    // Try both formats: task_1 and task1
    const userResponse = userAnswers[activeTab] || userAnswers[activeTab.replace('_', '')];

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const response = await fetch(`/api/ielts/sessions/${sessionId}/`, { credentials: 'include' });
                if (!response.ok) throw new Error('Session not found');

                const session = await response.json();
                const attempt = session.module_attempts?.find((a: any) => a.module_type === 'writing');

                if (attempt && (attempt.feedback || attempt.data?.feedback)) {
                    const feedback = attempt.feedback || attempt.data?.feedback;
                    setResult(feedback as WritingEvaluationResult);
                    setUserAnswers(attempt.answers || attempt.data?.answers || {});
                    setStatus('ready');

                    // Default to Task 2 if Task 1 is missing
                    if (!feedback.tasks?.task_1 && feedback.tasks?.task_2) {
                        setActiveTab('task_2');
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

    if (status === 'loading') return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;
    if (status === 'error' || !result) return <div className="min-h-screen flex items-center justify-center">Report unavailable</div>;

    const getBandColor = (band: number) => {
        if (band >= 7) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (band >= 5) return 'text-amber-600 bg-amber-50 border-amber-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    const getCriteriaLabel = (key: string) => {
        const labels: Record<string, string> = {
            task_response: 'Task Response',
            coherence_cohesion: 'Coherence & Cohesion',
            lexical_resource: 'Lexical Resource',
            grammar_accuracy: 'Grammar Accuracy'
        };
        return labels[key] || key;
    };

    // Helper to generate generic improvements if API doesn't provide them
    const getImprovementSuggestions = () => {
        const suggestions: string[] = [];
        const scores = taskData?.criteria_scores;
        if (!scores) return [];

        if (scores.task_response < 6) suggestions.push("Focus on fully addressing all parts of the question.");
        if (scores.coherence_cohesion < 6) suggestions.push("Use more linking words to connect your ideas logically.");
        if (scores.lexical_resource < 6) suggestions.push("Expand your vocabulary range and avoid repetition.");
        if (scores.grammar_accuracy < 6) suggestions.push("Review complex sentence structures and punctuation.");
        if (suggestions.length === 0) suggestions.push("Excellent work! To reach Band 9, focus on using more sophisticated vocabulary and complex grammatical structures naturally.");

        return suggestions;
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Brand Logo */}
                <div className="mb-2">
                    <img src="/logo.png" alt="Cybrik Logo" className="h-10 w-auto object-contain" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Test Results */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Header */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">Writing Test Results</h1>
                                <p className="text-slate-500">Test #{result.attempt_id?.split('_')[1] || 'Unknown'} - AI Evaluation Report</p>
                            </div>

                            <div className={`px-6 py-3 rounded-xl border-2 ${getBandColor(result.overall_writing_band)}`}>
                                <div className="text-xs font-bold uppercase opacity-70 mb-1">Overall Band</div>
                                <div className="text-4xl font-bold">{result.overall_writing_band.toFixed(1)}</div>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex gap-4">
                            {result.tasks?.task_1 && (
                                <button
                                    onClick={() => setActiveTab('task_1')}
                                    className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all ${activeTab === 'task_1' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                                >
                                    Task 1 (Band {result.tasks.task_1.overall_band?.toFixed(1)})
                                </button>
                            )}
                            {result.tasks?.task_2 && (
                                <button
                                    onClick={() => setActiveTab('task_2')}
                                    className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all ${activeTab === 'task_2' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                                >
                                    Task 2 (Band {result.tasks.task_2.overall_band?.toFixed(1)})
                                </button>
                            )}
                        </div>

                        {taskData ? (
                            <>
                                {/* Row 1: Criteria & Errors */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                    {/* Criteria Breakdown */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                                        <div className="flex items-center gap-2 mb-6">
                                            <Target className="w-5 h-5 text-emerald-600" />
                                            <h3 className="font-bold text-slate-800">IELTS Criteria Breakdown</h3>
                                        </div>
                                        <div className="space-y-5">
                                            {Object.entries(taskData.criteria_scores).map(([key, score]) => (
                                                <div key={key}>
                                                    <div className="flex justify-between mb-2">
                                                        <span className="text-sm font-medium text-slate-700">{getCriteriaLabel(key)}</span>
                                                        <span className={`text-sm font-bold ${score >= 7 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                            {score.toFixed(1)} / 9.0
                                                        </span>
                                                    </div>
                                                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${score >= 7 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                            style={{ width: `${(score / 9) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium">Word Count</span>
                                            <span className={`font-bold ${taskData.word_count >= (activeTab === 'task_1' ? 150 : 250) ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {taskData.word_count} / {activeTab === 'task_1' ? '150' : '250'}+ words
                                            </span>
                                        </div>
                                    </div>

                                    {/* Errors Found */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
                                        <div className="flex items-center gap-2 mb-4">
                                            <AlertCircle className="w-5 h-5 text-amber-500" />
                                            <h3 className="font-bold text-slate-800">Errors Found ({taskData.mistakes?.length || 0})</h3>
                                        </div>

                                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[400px]">
                                            {(!taskData.mistakes || taskData.mistakes.length === 0) ? (
                                                <div className="text-center py-10 text-slate-400">
                                                    <Check className="w-12 h-12 mx-auto mb-2 text-emerald-300" />
                                                    No major errors detected.
                                                </div>
                                            ) : (
                                                taskData.mistakes.map((mistake, idx) => (
                                                    <div key={idx} className="bg-red-50/50 rounded-xl p-4 border border-red-100">
                                                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-600 mb-2">
                                                            {mistake.error_type}
                                                        </span>
                                                        <div className="space-y-2">
                                                            <p className="text-sm text-red-500/80 line-through decoration-red-400">
                                                                "{mistake.sentence}"
                                                            </p>
                                                            <p className="text-sm font-medium text-emerald-700 flex items-start gap-1.5">
                                                                <span className="bg-emerald-100 text-emerald-600 p-0.5 rounded shadow-sm"><Check className="w-3 h-3" /></span>
                                                                "{mistake.correction}"
                                                            </p>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-2 pl-2 border-l-2 border-slate-200">
                                                            💡 {mistake.explanation}
                                                        </p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Improvements */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                            <BookOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">How to Improve</h3>
                                            <p className="text-xs text-slate-500">Personalized tips from your AI examiner</p>
                                        </div>
                                    </div>
                                    <div className="bg-indigo-50/30 rounded-xl p-5 border border-indigo-50">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">1</div>
                                            <p className="text-slate-700 font-medium leading-relaxed pt-1">
                                                {getImprovementSuggestions()[0]}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3: Answer vs Model */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Original Answer */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">Y</div>
                                            <h3 className="font-bold text-slate-800">Your Original Answer</h3>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 h-[400px] overflow-y-auto">
                                            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-serif">
                                                {userResponse || "No answer submitted."}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Model Answer */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full border-l-4 border-l-amber-400">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <Lightbulb className="w-5 h-5 text-amber-500" />
                                                <h3 className="font-bold text-slate-800">Band 9 Model Answer</h3>
                                            </div>
                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded">AI Generated</span>
                                        </div>
                                        <div className="bg-amber-50/50 rounded-xl p-5 border border-amber-100 h-[400px] overflow-y-auto relative">
                                            {/* Quote Icon Background */}
                                            <div className="absolute top-4 right-4 text-amber-200/50 pointer-events-none">
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 8.44772 14.017 9V11C14.017 11.5523 13.5693 12 13.017 12H12.017V5H22.017V15C22.017 18.3137 19.3307 21 16.017 21H14.017ZM5.0166 21L5.0166 18C5.0166 16.8954 5.91203 16 7.0166 16H10.0166C10.5689 16 11.0166 15.5523 11.0166 15V9C11.0166 8.44772 10.5689 8 10.0166 8H6.0166C5.46432 8 5.0166 8.44772 5.0166 9V11C5.0166 11.5523 4.56889 12 4.0166 12H3.0166V5H13.0166V15C13.0166 18.3137 10.3303 21 7.0166 21H5.0166Z" />
                                                </svg>
                                            </div>
                                            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-serif relative z-10">
                                                {taskData.refined_answer || "Model answer generating..."}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 4: Checklist */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Target className="w-5 h-5 text-purple-600" />
                                        <h3 className="font-bold text-slate-800">IELTS Writing Checklist</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        {[
                                            { label: 'Word Count Met', check: taskData.word_count >= (activeTab === 'task_1' ? 150 : 250) },
                                            { label: 'Task Addressed', check: taskData.criteria_scores.task_response >= 6 },
                                            { label: 'Well Organized', check: taskData.criteria_scores.coherence_cohesion >= 6 },
                                            { label: 'Good Vocabulary', check: taskData.criteria_scores.lexical_resource >= 6 },
                                        ].map((item, i) => (
                                            <div key={i} className={`p-4 rounded-xl border flex items-center gap-3 ${item.check ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${item.check ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                                    {item.check ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">!</span>}
                                                </div>
                                                <span className={`text-sm font-semibold ${item.check ? 'text-emerald-700' : 'text-red-700'}`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer Nav */}
                                <div className="flex justify-center mt-8 gap-4">
                                    <Link href="/reports" className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                                        Back to All Reports
                                    </Link>
                                    <Link href="/dashboard" className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 shadow-md transition-all">
                                        Go to Dashboard
                                    </Link>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-20 text-slate-400">Data not available for this task.</div>
                        )}
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="lg:col-span-1 space-y-6">
                        <AITutorCard type="writing" overallBand={result.overall_writing_band} />

                        {/* Additional Sidebar items could go here */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-4">Score Distribution</h3>
                            {/* Keep it simple for now or fetch other stats */}
                            <div className="text-center text-slate-500 py-4 text-sm">
                                Complete more tests to see your progress chart!
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
