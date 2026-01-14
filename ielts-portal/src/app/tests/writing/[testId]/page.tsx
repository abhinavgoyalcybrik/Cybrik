'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Loader2,
    AlertCircle,
    BookOpen,
    Target,
    Lightbulb,
    ArrowRight,
} from 'lucide-react';
import { WritingTestsData, WritingTest } from '@/types';
import HandwritingUpload from '@/components/HandwritingUpload';
import { evaluateWriting, WritingEvaluationResult } from '@/services/evaluatorApi';

type PartNumber = 1 | 2;

interface PageProps {
    params: Promise<{ testId: string }>;
}

export default function WritingTestPage({ params }: PageProps) {
    const { testId } = use(params);
    const searchParams = useSearchParams();
    const [test, setTest] = useState<WritingTest | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPart, setCurrentPart] = useState<PartNumber>(1);
    const [part1Response, setPart1Response] = useState('');
    const [part2Response, setPart2Response] = useState('');
    const [testCompleted, setTestCompleted] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(60 * 60); // 60 minutes total
    const [timerRunning, setTimerRunning] = useState(false);
    const [showTimeWarning, setShowTimeWarning] = useState(false);
    const [imageZoom, setImageZoom] = useState(100);
    const [showFullscreen, setShowFullscreen] = useState(false);

    // AI Evaluation state
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [evaluationResult, setEvaluationResult] = useState<WritingEvaluationResult | null>(null);
    const [evaluationError, setEvaluationError] = useState<string | null>(null);
    const [activeResultTab, setActiveResultTab] = useState<'task1' | 'task2'>('task1');

    // Load test data
    useEffect(() => {
        const view = searchParams.get('view');
        // If viewing result, we still need test data for context if possible, but mainly result.
        // Let's load test data first anyway.
        fetch('/data/writing_tests.json')
            .then((res) => res.json())
            .then((data: WritingTestsData) => {
                const foundTest = data.tests.find((t) => t.test_id === parseInt(testId));
                setTest(foundTest || null);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [testId, searchParams]);

    // Load session result if view=result
    useEffect(() => {
        const view = searchParams.get('view');
        const sessionId = searchParams.get('sessionId');
        const attemptId = searchParams.get('attemptId');

        if (view === 'result' && sessionId) {
            const loadResult = async () => {
                try {
                    const res = await fetch(`/api/ielts/sessions/${sessionId}/`, { credentials: 'include' });
                    if (res.ok) {
                        const session = await res.json();
                        // Find attempt
                        let attempt = null;
                        if (attemptId) {
                            attempt = session.module_attempts?.find((a: any) => a.id === attemptId);
                        } else {
                            attempt = session.module_attempts?.find((a: any) => a.module_type === 'writing');
                        }

                        if (attempt && attempt.feedback) {
                            // Assuming feedback contains the evaluation result structure directly
                            // or we reconstruct it. safely.
                            const result = attempt.feedback as WritingEvaluationResult;

                            // Fill responses if stored (backend might usually store user_answers too?)
                            // If not in feedback, we might check attempt.user_answers
                            const userAnswers = attempt.user_answers || {};
                            if (userAnswers.task_1) setPart1Response(userAnswers.task_1);
                            if (userAnswers.task_2) setPart2Response(userAnswers.task_2);

                            setEvaluationResult(result);
                            setTestCompleted(true);
                        }
                    }
                } catch (e) {
                    console.error('Failed to load result:', e);
                }
            };
            // Slight delay to ensure test loaded? Not strictly needed but safer.
            loadResult();
        }
    }, [searchParams]);

    // Load saved responses from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedPart1 = localStorage.getItem(`writing-${testId}-part1`);
            const savedPart2 = localStorage.getItem(`writing-${testId}-part2`);
            if (savedPart1) setPart1Response(savedPart1);
            if (savedPart2) setPart2Response(savedPart2);
        }
    }, [testId]);

    // Auto-save responses
    const saveResponses = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(`writing-${testId}-part1`, part1Response);
            localStorage.setItem(`writing-${testId}-part2`, part2Response);
        }
    }, [testId, part1Response, part2Response]);

    // Auto-save on change (debounced)
    useEffect(() => {
        const timeout = setTimeout(saveResponses, 2000);
        return () => clearTimeout(timeout);
    }, [part1Response, part2Response, saveResponses]);

    // Auto-start timer after 2 seconds when test loads
    useEffect(() => {
        if (test && !testCompleted && !timerRunning) {
            const timeout = setTimeout(() => {
                setTimerRunning(true);
            }, 2000);
            return () => clearTimeout(timeout);
        }
    }, [test, testCompleted, timerRunning]);

    // Single 60-minute timer (runs continuously, just for guidance)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timerRunning && !testCompleted && timeRemaining > 0) {
            interval = setInterval(() => {
                setTimeRemaining((t) => t - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerRunning, timeRemaining, testCompleted]);

    // Show warning when time is up (but don't force anything)
    useEffect(() => {
        if (timeRemaining === 0 && !showTimeWarning) {
            setShowTimeWarning(true);
        }
    }, [timeRemaining, showTimeWarning]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const countWords = (text: string) => {
        return text
            .trim()
            .split(/\s+/)
            .filter((word) => word.length > 0).length;
    };

    const handleSubmit = async () => {
        saveResponses();
        setTimerRunning(false);
        setIsEvaluating(true);
        setEvaluationError(null);

        try {
            const result = await evaluateWriting(
                test ? { question: test.task_1.question, answer: part1Response } : null,
                { question: test?.task_2.question || '', answer: part2Response }
            );
            setEvaluationResult(result);
            setTestCompleted(true);

            // Save result to backend for Reports
            try {
                const saveRes = await fetch('/api/ielts/sessions/save_module_result/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        test_id: test?.test_id ? String(test.test_id) : testId,
                        module_type: 'writing',
                        band_score: result?.overall_writing_band || 0,
                        raw_score: 0, // Writing doesn't have a raw score implies band
                        answers: {
                            task_1: part1Response,
                            task_2: part2Response
                        }
                    })
                });

                if (saveRes.ok) {
                    console.log('Result saved successfully');
                } else {
                    console.warn('Failed to save result:', await saveRes.text());
                }
            } catch (saveError) {
                console.error('Error saving result:', saveError);
            }

        } catch (error) {
            console.error('Evaluation failed:', error);
            setEvaluationError(error instanceof Error ? error.message : 'Evaluation failed');
            setTestCompleted(true);
        } finally {
            setIsEvaluating(false);
        }
    };

    const part1WordCount = countWords(part1Response);
    const part2WordCount = countWords(part2Response);
    const part1MinWords = 150;
    const part2MinWords = 250;

    const currentResponse = currentPart === 1 ? part1Response : part2Response;
    const setCurrentResponse = currentPart === 1 ? setPart1Response : setPart2Response;
    const currentWordCount = currentPart === 1 ? part1WordCount : part2WordCount;
    const currentMinWords = currentPart === 1 ? part1MinWords : part2MinWords;

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (!test) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex items-center justify-center">
                <div className="text-center bg-white rounded-2xl p-8 shadow-xl">
                    <p className="text-slate-500 mb-4">Test not found</p>
                    <Link href="/tests/writing" className="text-emerald-600 hover:underline font-medium">
                        Back to Writing Tests
                    </Link>
                </div>
            </div>
        );
    }

    // Evaluating loading screen
    if (isEvaluating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Evaluating Your Work</h2>
                    <p className="text-slate-500 mb-4">Our AI examiner is analyzing your writing...</p>
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
            </div>
        );
    }

    if (testCompleted) {
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

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 p-6">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Writing Test Results</h1>
                                <p className="text-slate-500">Test #{test.test_id} - AI Evaluation Report</p>
                            </div>
                            {evaluationResult && (
                                <div className={`px-6 py-4 rounded-2xl border-2 ${getBandColor(evaluationResult.overall_writing_band)}`}>
                                    <div className="text-sm font-medium opacity-75">Overall Band</div>
                                    <div className="text-4xl font-bold">{evaluationResult.overall_writing_band.toFixed(1)}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {evaluationError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <p className="text-red-700">{evaluationError}</p>
                        </div>
                    )}

                    {evaluationResult && (
                        <>
                            {/* Task Tabs */}
                            <div className="flex gap-3 mb-6">
                                <button
                                    onClick={() => setActiveResultTab('task1')}
                                    className={`px-5 py-3 rounded-xl font-medium transition-all ${activeResultTab === 'task1'
                                        ? 'bg-emerald-600 text-white shadow-lg'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    Task 1 (Band {evaluationResult.tasks.task_1?.overall_band?.toFixed(1) || 'N/A'})
                                </button>
                                <button
                                    onClick={() => setActiveResultTab('task2')}
                                    className={`px-5 py-3 rounded-xl font-medium transition-all ${activeResultTab === 'task2'
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    Task 2 (Band {evaluationResult.tasks.task_2?.overall_band?.toFixed(1) || 'N/A'})
                                </button>
                            </div>

                            {/* Task Results */}
                            {(() => {
                                const taskData = activeResultTab === 'task1'
                                    ? evaluationResult.tasks.task_1
                                    : evaluationResult.tasks.task_2;
                                if (!taskData) return <p className="text-slate-500">No data for this task.</p>;

                                // Generate improvement suggestions based on low scores
                                const getImprovementSuggestions = () => {
                                    const suggestions: string[] = [];
                                    const scores = taskData.criteria_scores;

                                    if (scores.task_response < 6) {
                                        suggestions.push("Focus on fully addressing all parts of the question. Make sure your response directly answers what is asked.");
                                    }
                                    if (scores.coherence_cohesion < 6) {
                                        suggestions.push("Improve paragraph organization. Use linking words like 'However', 'Moreover', 'In contrast' to connect ideas smoothly.");
                                    }
                                    if (scores.lexical_resource < 6) {
                                        suggestions.push("Expand your vocabulary. Avoid repeating the same words - use synonyms and more sophisticated terms.");
                                    }
                                    if (scores.grammar_accuracy < 6) {
                                        suggestions.push("Practice complex sentence structures. Review common grammar rules for articles, tenses, and subject-verb agreement.");
                                    }
                                    if (scores.task_response >= 6 && scores.coherence_cohesion >= 6 && scores.lexical_resource >= 6 && scores.grammar_accuracy >= 6) {
                                        suggestions.push("Excellent work! To reach Band 9, focus on using more sophisticated vocabulary and complex grammatical structures naturally.");
                                    }
                                    return suggestions;
                                };

                                const yourAnswer = activeResultTab === 'task1' ? part1Response : part2Response;

                                return (
                                    <div className="space-y-6">
                                        {/* Row 1: Criteria Scores + Mistakes */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Criteria Scores */}
                                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Target className="w-5 h-5 text-emerald-600" />
                                                    <h3 className="font-bold text-slate-800">IELTS Criteria Breakdown</h3>
                                                </div>
                                                <div className="space-y-4">
                                                    {Object.entries(taskData.criteria_scores).map(([key, score]) => (
                                                        <div key={key}>
                                                            <div className="flex justify-between mb-1">
                                                                <span className="text-sm text-slate-600">{getCriteriaLabel(key)}</span>
                                                                <span className={`text-sm font-bold ${score >= 7 ? 'text-emerald-600' : score >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                                                                    {score.toFixed(1)} / 9.0
                                                                </span>
                                                            </div>
                                                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                                    style={{ width: `${(score / 9) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                                    <span className="text-slate-600">Word Count</span>
                                                    <span className={`font-bold ${taskData.word_count >= (activeResultTab === 'task1' ? 150 : 250) ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {taskData.word_count} / {activeResultTab === 'task1' ? '150' : '250'}+ words
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Mistakes & Corrections */}
                                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <AlertCircle className="w-5 h-5 text-amber-600" />
                                                    <h3 className="font-bold text-slate-800">Errors Found ({taskData.mistakes.length})</h3>
                                                </div>
                                                {taskData.mistakes.length === 0 ? (
                                                    <div className="text-center py-8">
                                                        <Check className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                                                        <p className="text-slate-500">No significant errors detected!</p>
                                                        <p className="text-sm text-slate-400">Great attention to grammar and vocabulary.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                                        {taskData.mistakes.map((m, i) => (
                                                            <div key={i} className="p-3 bg-gradient-to-r from-red-50 to-amber-50 rounded-xl border border-red-100">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded uppercase">
                                                                        {m.error_type}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-red-600 line-through mb-1">❌ "{m.sentence}"</p>
                                                                <p className="text-sm text-emerald-700 font-medium mb-2">
                                                                    ✅ "{m.correction}"
                                                                </p>
                                                                <p className="text-xs text-slate-600 bg-white/50 p-2 rounded">
                                                                    💡 {m.explanation}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Row 2: Improvement Suggestions */}
                                        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                                            <div className="relative">
                                                <div className="flex items-center gap-4 mb-8">
                                                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center rotate-3 border border-indigo-100 shadow-sm">
                                                        <BookOpen className="w-7 h-7 text-indigo-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">How to Improve</h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            <p className="text-slate-500 text-sm font-medium">Personalized tips from your AI examiner</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 gap-4">
                                                    {getImprovementSuggestions().map((suggestion, i) => (
                                                        <div key={i} className="group flex items-start gap-4 p-5 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all duration-300">
                                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all">
                                                                <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600">{i + 1}</span>
                                                            </div>
                                                            <p className="text-slate-600 font-medium leading-relaxed group-hover:text-slate-800 transition-colors pt-1">{suggestion}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 3: Your Answer vs Model Answer */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            {/* Your Original Answer */}
                                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <span className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">Y</span>
                                                    <h3 className="font-bold text-slate-800">Your Original Answer</h3>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-64 overflow-y-auto">
                                                    <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                                                        {yourAnswer || 'No answer submitted'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Band 9 Model Answer */}
                                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Lightbulb className="w-5 h-5 text-amber-500" />
                                                    <h3 className="font-bold text-slate-800">Band 9 Model Answer</h3>
                                                    <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded">AI Generated</span>
                                                </div>
                                                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4 max-h-64 overflow-y-auto">
                                                    <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                                                        {taskData.refined_answer}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Row 4: Quick IELTS Tips */}
                                        <div className="bg-white rounded-2xl shadow-lg p-6">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Target className="w-5 h-5 text-purple-600" />
                                                <h3 className="font-bold text-slate-800">IELTS Writing Checklist</h3>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {[
                                                    { label: 'Word Count Met', check: taskData.word_count >= (activeResultTab === 'task1' ? 150 : 250) },
                                                    { label: 'Task Addressed', check: taskData.criteria_scores.task_response >= 6 },
                                                    { label: 'Well Organized', check: taskData.criteria_scores.coherence_cohesion >= 6 },
                                                    { label: 'Good Vocabulary', check: taskData.criteria_scores.lexical_resource >= 6 },
                                                ].map((item, i) => (
                                                    <div key={i} className={`p-3 rounded-xl border-2 flex items-center gap-2 ${item.check ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${item.check ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                                            {item.check ? (
                                                                <Check className="w-3 h-3 text-white" />
                                                            ) : (
                                                                <span className="text-white text-xs font-bold">!</span>
                                                            )}
                                                        </div>
                                                        <span className={`text-sm font-medium ${item.check ? 'text-emerald-700' : 'text-red-700'}`}>
                                                            {item.label}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </>
                    )}

                    {/* Navigation */}
                    <div className="flex gap-3 justify-center mt-8">
                        <Link
                            href="/tests/writing"
                            className="px-6 py-3 rounded-xl bg-white text-slate-600 font-medium hover:bg-slate-50 transition-colors shadow"
                        >
                            Back to Tests
                        </Link>
                        <Link
                            href="/dashboard"
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg"
                        >
                            Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex flex-col">
            {/* Fullscreen Image Modal */}
            {showFullscreen && currentPart === 1 && test.task_1.image_url && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-8"
                    onClick={() => setShowFullscreen(false)}
                >
                    <img
                        src={test.task_1.image_url}
                        alt="Task 1 visual (fullscreen)"
                        className="max-w-full max-h-full object-contain"
                    />
                    <button
                        className="absolute top-4 right-4 text-white bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700"
                        onClick={() => setShowFullscreen(false)}
                    >
                        Close (ESC)
                    </button>
                </div>
            )}

            {/* Modern Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">W</span>
                            </div>
                            <span className="text-slate-800 font-bold text-lg">Writing Test</span>
                        </div>
                        <div className="h-5 w-px bg-slate-300" />
                        <span className="text-slate-500 text-sm">Test #{test.test_id}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Timer */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold ${timeRemaining === 0
                            ? 'bg-slate-100 text-slate-400'
                            : timeRemaining < 600
                                ? 'bg-red-100 text-red-600 border border-red-200'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}>
                            <Clock className="w-5 h-5" />
                            {timeRemaining === 0 ? "Time's up!" : formatTime(timeRemaining)}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex">
                {/* Left Panel - Question & Image */}
                <div className="w-1/2 border-r border-slate-200 flex flex-col bg-white/50">
                    {/* Question Text */}
                    <div className="p-6 border-b border-slate-100">
                        <p className="text-slate-700 font-medium text-lg leading-relaxed">
                            {currentPart === 1
                                ? test.task_1.question
                                : test.task_2.question}
                        </p>
                        {currentPart === 1 && (
                            <p className="text-slate-600 mt-4 text-base leading-relaxed">
                                Summarise the information by selecting and reporting the main features, and make comparisons where relevant.
                            </p>
                        )}
                    </div>

                    {/* Chart/Image Area - Only show if image exists */}
                    {currentPart === 1 && test.task_1.image_url && (
                        <div className="flex-1 p-4 overflow-auto">
                            {/* Image Controls */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-slate-500 font-medium">Visual Reference</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setImageZoom(z => Math.max(50, z - 25))}
                                        className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm text-slate-500 min-w-[50px] text-center">{imageZoom}%</span>
                                    <button
                                        onClick={() => setImageZoom(z => Math.min(200, z + 25))}
                                        className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setShowFullscreen(true)}
                                        className="p-2 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                                        title="View Fullscreen"
                                    >
                                        <Maximize2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Image Container */}
                            <div className="border border-slate-200 rounded-xl p-4 bg-white overflow-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                                <img
                                    src={test.task_1.image_url}
                                    alt="Task 1 visual"
                                    className="mx-auto transition-transform duration-200"
                                    style={{
                                        width: `${imageZoom}%`,
                                        maxWidth: 'none',
                                        height: 'auto'
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Resizable Divider */}
                <div className="w-1 bg-slate-200 hover:bg-emerald-400 cursor-col-resize transition-colors" />

                {/* Right Panel - Text Area */}
                <div className="w-1/2 flex flex-col bg-white/30">
                    {/* Word Count & Upload Button */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white/80">
                        <HandwritingUpload
                            currentTask={currentPart}
                            onTextExtracted={(text) => {
                                if (currentPart === 1) {
                                    setPart1Response((prev) => prev + (prev ? '\n\n' : '') + text);
                                } else {
                                    setPart2Response((prev) => prev + (prev ? '\n\n' : '') + text);
                                }
                            }}
                        />
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${currentWordCount >= currentMinWords ? 'text-emerald-600' : 'text-slate-500'
                                }`}>
                                {currentWordCount} words
                            </span>
                            <span className="text-slate-400">/</span>
                            <span className="text-sm text-slate-400">{currentMinWords}+ required</span>
                        </div>
                    </div>

                    {/* Text Area */}
                    <div className="flex-1 p-4 h-full">
                        <textarea
                            value={currentResponse}
                            onChange={(e) => setCurrentResponse(e.target.value)}
                            placeholder={`Write at least ${currentMinWords} words here...`}
                            disabled={timeRemaining === 0}
                            className={`w-full h-full p-5 border-2 rounded-xl resize-none focus:outline-none text-slate-800 text-lg leading-relaxed transition-colors font-medium ${timeRemaining === 0
                                ? 'border-slate-200 bg-slate-100 cursor-not-allowed'
                                : 'border-emerald-200 focus:border-emerald-400 bg-white'
                                }`}
                            style={{ minHeight: '100%' }}
                        />
                    </div>
                </div>
            </main>

            {/* Bottom Navigation */}
            <footer className="bg-white/80 backdrop-blur-md border-t border-slate-200 px-6 py-3">
                <div className="flex items-center justify-between">
                    {/* Part Tabs */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPart(1)}
                            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${currentPart === 1
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            Part 1
                        </button>
                        <button
                            onClick={() => setCurrentPart(2)}
                            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${currentPart === 2
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            Part 2
                        </button>
                    </div>

                    {/* Navigation & Submit */}
                    <div className="flex items-center gap-3">
                        {/* Navigation Arrows */}
                        <button
                            onClick={() => currentPart === 2 && setCurrentPart(1)}
                            disabled={currentPart === 1}
                            className={`p-2.5 rounded-xl transition-all ${currentPart === 1
                                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-slate-700 text-white hover:bg-slate-800'
                                }`}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => {
                                if (currentPart === 1) {
                                    setCurrentPart(2);
                                } else {
                                    handleSubmit();
                                }
                            }}
                            className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>

                        {/* Submit Button */}
                        {currentPart === 2 && (
                            <button
                                onClick={handleSubmit}
                                className="ml-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                                title="Submit Test"
                            >
                                <Check className="w-5 h-5" />
                                Submit
                            </button>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    );
}
