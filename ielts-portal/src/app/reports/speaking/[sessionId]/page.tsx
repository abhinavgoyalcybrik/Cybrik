'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    FileText,
    TrendingUp,
    Volume2,
    MessageCircle,
    ChevronRight,
    Play,
    Pause,
    Lock,
    Loader2,
    CheckCircle,
} from 'lucide-react';

interface PageProps {
    params: Promise<{ sessionId: string }>;
}

interface EvaluationResult {
    success: boolean;
    session_id: string;
    test_id: string;
    overall_band: number;
    criterion_scores: {
        fluency_coherence: number;
        lexical_resource: number;
        grammatical_range: number;
        pronunciation: number;
    };
    detailed_results: Array<{
        label: string;
        transcript: string;
        evaluation?: {
            fluency: number;
            lexical: number;
            grammar: number;
            pronunciation: number;
            grammar_analysis?: Array<{ error: string; correction: string; explanation: string; type: string }>;
            vocabulary_analysis?: Array<{ word: string; cefr: string; enhancement?: string }>;
            pronunciation_analysis?: Array<{ word: string; status: string; score: number }>;
            fluency_analysis?: { wpm: number; pauses: Array<{ start: number; end: number; duration: number }>; pause_count: number };
            feedback: {
                strengths: string;
                improvements: string;
            };
        };
        error?: string;
    }>;
    total_evaluated: number;
}

// CEFR level mapping
function getCEFRLevel(band: number): string {
    if (band >= 8.5) return 'C2';
    if (band >= 7) return 'C1';
    if (band >= 5.5) return 'B2';
    if (band >= 4) return 'B1';
    if (band >= 2.5) return 'A2';
    return 'A1';
}

// Criterion config with colors
const criterionConfig = {
    fluency_coherence: {
        label: 'Fluency and Coherence',
        icon: TrendingUp,
        color: 'bg-blue-500',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-600',
    },
    lexical_resource: {
        label: 'Lexical Resource',
        icon: MessageCircle,
        color: 'bg-orange-500',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-600',
    },
    grammatical_range: {
        label: 'Grammar, Errors and Corrections',
        icon: FileText,
        color: 'bg-red-500',
        bgColor: 'bg-red-100',
        textColor: 'text-red-600',
    },
    pronunciation: {
        label: 'Pronunciation',
        icon: Volume2,
        color: 'bg-emerald-500',
        bgColor: 'bg-emerald-100',
        textColor: 'text-emerald-600',
    },
};

export default function SpeakingReportPage({ params }: PageProps) {
    const { sessionId } = use(params);
    const router = useRouter();

    const [status, setStatus] = useState<'processing' | 'ready' | 'error'>('processing');
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeQuestion, setActiveQuestion] = useState(0);
    const [detailTab, setDetailTab] = useState<'fluency' | 'vocabulary' | 'pronunciation' | 'grammar'>('fluency');
    const [playingAudio, setPlayingAudio] = useState<number | null>(null);

    // Fetch saved session data instead of re-evaluating
    useEffect(() => {
        const fetchSession = async () => {
            // Check if session ID looks valid (UUID format)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(sessionId) && !sessionId.match(/^\d+$/)) {
                // Frontend-generated ID like "session-1234567" - not a database session
                setError('This is not a valid saved session. Please complete a speaking test first to view reports.');
                setStatus('error');
                return;
            }

            // Simulate progress for UX
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 95) return prev;
                    return prev + Math.random() * 25;
                });
            }, 200);

            try {
                const response = await fetch(`/api/ielts/sessions/${sessionId}/`, {
                    credentials: 'include',
                });

                clearInterval(progressInterval);
                setProgress(100);

                if (response.status === 403) {
                    setError('Please log in to view your test results.');
                    setStatus('error');
                    return;
                }

                if (response.status === 404) {
                    setError('Session not found. The test may not have been saved properly.');
                    setStatus('error');
                    return;
                }

                if (response.ok) {
                    const session = await response.json();
                    const speakingAttempt = session.module_attempts?.find(
                        (a: any) => a.module_type === 'speaking'
                    );

                    if (speakingAttempt && speakingAttempt.feedback) {
                        const feedback = speakingAttempt.feedback;
                        // Map the saved feedback to the expected format
                        const mappedResult: EvaluationResult = {
                            success: true,
                            session_id: sessionId,
                            test_id: session.test_id || '',
                            overall_band: feedback.overall_band || speakingAttempt.band_score || 0,
                            criterion_scores: {
                                fluency_coherence: feedback.fluency || 0,
                                lexical_resource: feedback.lexical || 0,
                                grammatical_range: feedback.grammar || 0,
                                pronunciation: feedback.pronunciation || 0,
                            },
                            detailed_results: feedback.parts?.map((p: any) => ({
                                label: `Part ${p.part}`,
                                transcript: p.score.transcript || '',
                                evaluation: p.score,
                            })) || [],
                            total_evaluated: feedback.parts?.length || 0,
                        };
                        await new Promise(r => setTimeout(r, 300));
                        setResult(mappedResult);
                        setStatus('ready');
                    } else {
                        setError('Speaking evaluation not found for this session');
                        setStatus('error');
                    }
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    setError(errorData.error || 'Failed to load session');
                    setStatus('error');
                }
            } catch (err) {
                clearInterval(progressInterval);
                setError('Failed to load session data');
                setStatus('error');
            }
        };

        fetchSession();
    }, [sessionId]);

    // Processing State
    if (status === 'processing') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 flex items-center justify-center p-8">
                <div className="bg-white rounded-3xl shadow-xl shadow-purple-100/50 p-12 max-w-lg w-full text-center">
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-3">
                        Processing...
                    </h1>
                    <p className="text-slate-600 mb-10">
                        Your report will be ready in a few minutes...
                    </p>

                    {/* Central Icon Animation */}
                    <div className="relative w-40 h-40 mx-auto mb-10">
                        {/* Outer orbiting dots */}
                        <div className="absolute inset-0 animate-spin-slow">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="absolute top-1/4 right-0 translate-x-2 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="absolute bottom-1/4 right-0 translate-x-2 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-orange-500" />
                            </div>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <MessageCircle className="w-5 h-5 text-red-400" />
                            </div>
                        </div>

                        {/* Central document icon */}
                        <div className="absolute inset-8 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center shadow-inner">
                            <FileText className="w-14 h-14 text-purple-500" />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-slate-600">Analysis Progress</span>
                            <span className="text-purple-600 font-semibold">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    <button
                        disabled
                        className="w-full py-4 bg-slate-200 text-slate-400 rounded-xl font-medium cursor-not-allowed"
                    >
                        Processing...
                    </button>
                </div>
            </div>
        );
    }

    // Error State
    if (status === 'error') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-orange-50 flex items-center justify-center p-8">
                <div className="bg-white rounded-3xl shadow-xl p-12 max-w-lg w-full text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FileText className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-3">Evaluation Unavailable</h1>
                    <p className="text-slate-600 mb-8">{error}</p>
                    <Link
                        href="/reports"
                        className="inline-block px-8 py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
                    >
                        Back to Reports
                    </Link>
                </div>
            </div>
        );
    }

    // Results Ready
    if (!result) return null;

    const overallBand = result.overall_band;
    const cefrLevel = getCEFRLevel(overallBand);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header with Score */}
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-6">
                            <div>
                                <div className="text-5xl font-bold text-purple-600">
                                    {overallBand}<span className="text-slate-300">/9.0</span>
                                </div>
                                <div className="text-slate-500 text-sm">Overall Band Score</div>
                            </div>
                            <div className="h-16 w-px bg-slate-200" />
                            <div>
                                <div className="text-3xl font-bold text-slate-900">{cefrLevel}</div>
                                <div className="text-slate-500 text-sm">CEFR Level</div>
                            </div>
                        </div>
                        <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity">
                            <MessageCircle className="w-5 h-5" />
                            Chat with your personal AI tutor
                        </button>
                    </div>
                </div>

                {/* Free Report Banner */}
                <div className="bg-white rounded-2xl shadow-sm p-8 mb-6 text-center border border-purple-100">
                    <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-7 h-7 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">You are viewing a free report</h3>
                    <p className="text-slate-500 mb-6">Go Premium to get detailed feedback and improve your scores!</p>
                    <button className="w-full max-w-sm mx-auto py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity">
                        View Premium Plans
                    </button>
                    <button className="block mx-auto mt-4 text-purple-600 font-medium hover:underline">
                        View Premium Report
                    </button>
                </div>

                {/* Criteria Breakdown */}
                <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-6">Criteria Breakdown</h3>
                    <div className="space-y-4">
                        {Object.entries(criterionConfig).map(([key, config]) => {
                            const score = result.criterion_scores[key as keyof typeof result.criterion_scores] || 0;
                            const Icon = config.icon;
                            const percentage = (score / 9) * 100;

                            return (
                                <div
                                    key={key}
                                    className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    <div className={`p-3 rounded-xl ${config.bgColor}`}>
                                        <Icon className={`w-5 h-5 ${config.textColor}`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-900">{config.label}</div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-lg font-bold text-slate-900">{score}</span>
                                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${config.color} rounded-full transition-all duration-500`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-400" />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Detailed Feedback Section */}
                {result.detailed_results.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-6">
                        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-purple-600" />
                            Detailed Feedback
                        </h3>

                        {/* Speaking Task Header */}
                        <div className="mb-6">
                            <h4 className="text-lg font-semibold text-slate-900 mb-4">Speaking Task</h4>

                            {/* Question Tabs */}
                            <div className="flex gap-2 mb-6">
                                {result.detailed_results.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveQuestion(idx)}
                                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeQuestion === idx
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        Q {idx + 1}
                                    </button>
                                ))}
                            </div>

                            {/* Question Display */}
                            {result.detailed_results[activeQuestion] && (
                                <div className="space-y-4">
                                    <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                                            <span className="text-purple-800 font-medium">
                                                {result.detailed_results[activeQuestion].label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Audio Player (placeholder) */}
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-slate-700 font-medium">My Answer</span>
                                            <span className="text-slate-400 text-sm">🔊 0:03</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setPlayingAudio(playingAudio === activeQuestion ? null : activeQuestion)}
                                                className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 transition-colors"
                                            >
                                                {playingAudio === activeQuestion ? (
                                                    <Pause className="w-5 h-5" />
                                                ) : (
                                                    <Play className="w-5 h-5 ml-0.5" />
                                                )}
                                            </button>
                                            <div className="flex-1 h-1 bg-slate-200 rounded-full">
                                                <div className="h-full w-0 bg-emerald-500 rounded-full" />
                                            </div>
                                            <span className="text-sm text-slate-500">0:00 / 0:03</span>
                                        </div>
                                    </div>

                                    {/* Analysis Tabs */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {(['fluency', 'vocabulary', 'pronunciation', 'grammar'] as const).map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setDetailTab(tab)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${detailTab === tab
                                                    ? 'bg-white border-purple-200 text-purple-700 shadow-sm'
                                                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Left Panel: Highlighted Transcript */}
                                        <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
                                            <div className="flex justify-between items-center mb-6">
                                                <h5 className="font-semibold text-slate-900">Your Answer</h5>
                                                {/* Legends */}
                                                {detailTab === 'pronunciation' && (
                                                    <div className="flex gap-2 text-xs font-medium">
                                                        <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Good {'>'}80%</span>
                                                        <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded">Fair</span>
                                                        <span className="text-red-600 bg-red-50 px-2 py-1 rounded">Needs Imp.</span>
                                                    </div>
                                                )}
                                                {detailTab === 'vocabulary' && (
                                                    <div className="flex gap-1 text-xs font-medium">
                                                        <span className="w-2 h-2 rounded-full bg-slate-200 inline-block mr-1"></span>A1-A2
                                                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block ml-2 mr-1"></span>B1-B2
                                                        <span className="w-2 h-2 rounded-full bg-orange-400 inline-block ml-2 mr-1"></span>C1-C2
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-lg leading-relaxed text-slate-700 font-medium">
                                                {detailTab === 'pronunciation' && result.detailed_results[activeQuestion].evaluation?.pronunciation_analysis ? (
                                                    // Reconstruct from pronunciation words
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {result.detailed_results[activeQuestion].evaluation?.pronunciation_analysis?.map((w, i) => {
                                                            const color = w.status === 'Good' ? 'text-slate-700' :
                                                                w.status === 'Fair' ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
                                                            return (
                                                                <span key={i} className={`px-0.5 rounded ${color}`} title={`${w.status} (${w.score}%)`}>
                                                                    {w.word}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                ) : detailTab === 'grammar' ? (
                                                    // Highlight grammar errors
                                                    <div>
                                                        {(() => {
                                                            let text = result.detailed_results[activeQuestion].transcript || '';
                                                            const errors = result.detailed_results[activeQuestion].evaluation?.grammar_analysis || [];
                                                            if (errors.length === 0) return text;

                                                            // Very basic replacement (MVP) - loops through errors and highlights first occurrence specific string
                                                            // In production, we need exact indices from backend
                                                            const parts: React.ReactNode[] = [];
                                                            let lastIdx = 0;

                                                            // Sort by appearance? We don't have indices. Use simple replacement or render logic
                                                            // Fallback: Just display text with list on right for now if no indices
                                                            return text;
                                                        })()}
                                                    </div>
                                                ) : (
                                                    // Default text
                                                    result.detailed_results[activeQuestion].transcript
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Panel: Analysis Details */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 h-full overflow-y-auto max-h-[600px]">
                                            {detailTab === 'fluency' && (
                                                <div className="space-y-6">
                                                    <h6 className="font-semibold text-slate-900 border-b pb-2">Fluency Analysis</h6>

                                                    <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                                        <div className="text-sm text-slate-500 mb-1">Speaking Speed</div>
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-3xl font-bold text-purple-600">
                                                                {result.detailed_results[activeQuestion].evaluation?.fluency_analysis?.wpm || 0}
                                                            </span>
                                                            <span className="text-slate-600">words/min</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 h-2 mt-3 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-500"
                                                                style={{ width: '100%' }} // Gradient bar
                                                            />
                                                            {/* Indicator pointer could act here */}
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-2">Target: 120-150 wpm</p>
                                                    </div>

                                                    <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                                                        <div className="text-sm text-slate-500 mb-1">Pauses</div>
                                                        <div className="text-xl font-semibold text-slate-800">
                                                            {result.detailed_results[activeQuestion].evaluation?.fluency_analysis?.pause_count || 0} <span className="text-sm font-normal text-slate-500">detected</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {detailTab === 'pronunciation' && (
                                                <div className="space-y-4">
                                                    <h6 className="font-semibold text-slate-900 border-b pb-2">Pronunciation Mistakes</h6>
                                                    {result.detailed_results[activeQuestion].evaluation?.pronunciation_analysis?.filter(w => w.status !== 'Good').map((w, i) => (
                                                        <div key={i} className="flex items-center justify-between bg-white p-3 rounded border border-slate-100">
                                                            <span className="font-medium text-slate-800">{w.word}</span>
                                                            <span className={`text-xs px-2 py-1 rounded font-medium ${w.status === 'Fair' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                                {w.status}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {result.detailed_results[activeQuestion].evaluation?.pronunciation_analysis?.every(w => w.status === 'Good') && (
                                                        <div className="text-slate-500 text-center py-8">No significant pronunciation issues detected. Great job!</div>
                                                    )}
                                                </div>
                                            )}

                                            {detailTab === 'grammar' && (
                                                <div className="space-y-4">
                                                    <h6 className="font-semibold text-slate-900 border-b pb-2">Grammar & Corrections</h6>
                                                    {result.detailed_results[activeQuestion].evaluation?.grammar_analysis?.map((item, i) => (
                                                        <div key={i} className="bg-white p-4 rounded-lg border border-red-50 shadow-sm">
                                                            <div className="flex gap-2 items-start mb-2">
                                                                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold uppercase shrink-0 mt-0.5">Error</span>
                                                                <span className="text-red-600 line-through decoration-red-300">{item.error}</span>
                                                            </div>
                                                            <div className="flex gap-2 items-start mb-2">
                                                                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded font-bold uppercase shrink-0 mt-0.5">Fix</span>
                                                                <span className="text-emerald-700 font-medium">{item.correction}</span>
                                                            </div>
                                                            <p className="text-slate-500 text-xs italic mt-2">{item.explanation}</p>
                                                        </div>
                                                    ))}
                                                    {(!result.detailed_results[activeQuestion].evaluation?.grammar_analysis?.length) && (
                                                        <div className="text-slate-500 text-center py-8">No grammar errors found.</div>
                                                    )}
                                                </div>
                                            )}

                                            {detailTab === 'vocabulary' && (
                                                <div className="space-y-4">
                                                    <h6 className="font-semibold text-slate-900 border-b pb-2">Vocabulary Analysis</h6>
                                                    {result.detailed_results[activeQuestion].evaluation?.vocabulary_analysis?.map((item, i) => (
                                                        <div key={i} className="bg-white p-3 rounded-lg border border-slate-100 flex items-center justify-between">
                                                            <span className="font-medium text-slate-800">{item.word}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-slate-400 uppercase">{item.cefr}</span>
                                                                {item.enhancement && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Try: {item.enhancement}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(!result.detailed_results[activeQuestion].evaluation?.vocabulary_analysis?.length) && (
                                                        <div className="text-slate-500 text-center py-8">Vocabulary analysis unavailable.</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex gap-4 justify-center mt-8">
                    <Link
                        href="/tests/speaking"
                        className="px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                        Take Another Test
                    </Link>
                    <Link
                        href="/reports"
                        className="px-8 py-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
                    >
                        View All Reports
                    </Link>
                </div>
            </div>
        </div>
    );
}
