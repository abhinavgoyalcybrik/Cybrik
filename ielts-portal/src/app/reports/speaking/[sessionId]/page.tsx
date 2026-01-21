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
    Calendar,
    Award,
    Clock,
    Zap,
    BookOpen,
    AlertCircle,
    Mic,
    Bot
} from 'lucide-react';
import AITutorCard from '@/components/AITutorCard';

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

// Criterion config matching the screenshots (Icons & Colors)
const criteriaConfig = {
    fluency: {
        label: 'Fluency and Coherence',
        icon: TrendingUp, // Blue chart icon
        color: 'bg-blue-500',
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        iconBg: 'bg-blue-500 text-white'
    },
    lexical: {
        label: 'Lexical Resource',
        icon: BookOpen, // Orange book icon
        color: 'bg-orange-500',
        bg: 'bg-orange-50',
        text: 'text-orange-600',
        iconBg: 'bg-orange-500 text-white'
    },
    grammar: {
        label: 'Grammar, Errors and Corrections',
        icon: AlertCircle, // Red shield/alert
        color: 'bg-red-500',
        bg: 'bg-red-50',
        text: 'text-red-600',
        iconBg: 'bg-red-500 text-white'
    },
    pronunciation: {
        label: 'Pronunciation',
        icon: Mic, // Green Mic
        color: 'bg-emerald-500',
        bg: 'bg-emerald-50',
        text: 'text-emerald-600',
        iconBg: 'bg-emerald-500 text-white'
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
    const [transcriptMode, setTranscriptMode] = useState<'original' | 'feedback'>('feedback');
    const [playingAudio, setPlayingAudio] = useState<boolean>(false);

    // Fetch Session Logic
    useEffect(() => {
        const fetchSession = async () => {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(sessionId) && !sessionId.match(/^\d+$/)) {
                setError('This is not a valid saved session.');
                setStatus('error');
                return;
            }

            // Fake progress
            const progressInterval = setInterval(() => {
                setProgress(prev => (prev >= 95 ? prev : prev + Math.random() * 10));
            }, 300);

            try {
                const response = await fetch(`/api/ielts/sessions/${sessionId}/`, { credentials: 'include' });
                clearInterval(progressInterval);
                setProgress(100);

                if (!response.ok) throw new Error('Session load failed');

                const session = await response.json();
                const attempt = session.module_attempts?.find((a: any) => a.module_type === 'speaking');

                if (attempt && attempt.feedback) {
                    const feedback = attempt.feedback;
                    // Map API response to Component State
                    setResult({
                        success: true,
                        session_id: sessionId,
                        test_id: session.test_id || '',
                        overall_band: feedback.overall_band || attempt.band_score || 0,
                        criterion_scores: {
                            fluency_coherence: feedback.fluency || 0,
                            lexical_resource: feedback.lexical || 0,
                            grammatical_range: feedback.grammar || 0,
                            pronunciation: feedback.pronunciation || 0,
                        },
                        detailed_results: feedback.parts?.map((p: any, idx: number) => {
                            const evalData = p.result || p.score || {};
                            // Defensive check to avoid Object rendering errors
                            let safeTranscript = '';
                            if (typeof evalData.transcript === 'string') safeTranscript = evalData.transcript;
                            else if (typeof p.transcript === 'string') safeTranscript = p.transcript;

                            return {
                                label: `Part ${p.part || idx + 1}`,
                                transcript: safeTranscript,
                                evaluation: evalData,
                            };
                        }) || [],
                        total_evaluated: feedback.parts?.length || 0,
                    });
                    setStatus('ready');
                    // Default to grammar tab as shown in one screenshot if desired, or stay fluency
                } else {
                    setError('Evaluation pending or not found.');
                    setStatus('error');
                }
            } catch (err) {
                clearInterval(progressInterval);
                setError('Failed to load report.');
                setStatus('error');
            }
        };

        fetchSession();
    }, [sessionId]);

    if (status === 'processing') return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center">
                <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-900">Generating Report...</h2>
                <div className="w-64 h-2 bg-slate-200 rounded-full mt-4 mx-auto overflow-hidden">
                    <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
            </div>
        </div>
    );

    if (status === 'error' || !result) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center p-8 bg-white rounded-2xl shadow-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-900 mb-2">Error Loading Report</h2>
                <p className="text-slate-500 mb-6">{error || 'Unknown error occurred'}</p>
                <button onClick={() => router.back()} className="text-purple-600 font-medium hover:underline">Back</button>
            </div>
        </div>
    );

    const activeData = result.detailed_results[activeQuestion];
    const evaluation = activeData?.evaluation;

    return (
        <div className="min-h-screen bg-[#F8F9FA] p-4 lg:p-8 font-sans text-slate-900">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Brand Logo */}
                <div className="mb-2">
                    <img src="/logo.png" alt="Cybrik Logo" className="h-10 w-auto object-contain" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* 1. Header Card (Matching "5.5/9.0" screenshot) */}
                        <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-100">
                            <div className="flex items-center gap-6">
                                <div className="text-left">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-bold text-purple-600">{result.overall_band.toFixed(1)}</span>
                                        <span className="text-3xl font-medium text-slate-300">/9.0</span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Overall Band Score</div>
                                </div>
                                <div className="h-12 w-px bg-slate-100 mx-2 hidden md:block" />
                                <div className="text-left">
                                    <div className="text-3xl font-bold text-purple-600/80">{getCEFRLevel(result.overall_band)}</div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">CEFR Level</div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Criteria Breakdown (4 Cards) */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-6 text-lg">Criteria Breakdown</h3>
                            <div className="space-y-6">
                                {/* Fluency */}
                                <CriteriaRow
                                    config={criteriaConfig.fluency}
                                    score={result.criterion_scores.fluency_coherence}
                                />
                                <div className="h-px bg-slate-50" />

                                {/* Lexical */}
                                <CriteriaRow
                                    config={criteriaConfig.lexical}
                                    score={result.criterion_scores.lexical_resource}
                                />
                                <div className="h-px bg-slate-50" />

                                {/* Grammar */}
                                <CriteriaRow
                                    config={criteriaConfig.grammar}
                                    score={result.criterion_scores.grammatical_range}
                                />
                                <div className="h-px bg-slate-50" />

                                {/* Pronunciation */}
                                <CriteriaRow
                                    config={criteriaConfig.pronunciation}
                                    score={result.criterion_scores.pronunciation}
                                />
                            </div>
                        </div>

                        {/* 3. Detailed Feedback Header */}
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-purple-600" />
                            <h3 className="text-lg font-bold text-slate-800">Detailed Feedback</h3>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

                            <div className="p-6 pb-0">
                                {/* Speaking Task Label */}
                                <div className="text-sm font-bold text-slate-900 mb-4">Speaking Task</div>

                                {/* Question Tabs (Q1, Q2...) */}
                                <div className="flex flex-wrap gap-3 mb-6">
                                    {result.detailed_results.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveQuestion(idx)}
                                            className={`px-6 py-2 rounded-lg font-medium text-sm transition-all border ${activeQuestion === idx
                                                ? 'bg-white border-purple-500 text-purple-600 shadow-sm'
                                                : 'bg-white border-slate-200 text-slate-500 hover:border-purple-200'
                                                }`}
                                        >
                                            {item.label.replace('Part ', 'Q ')}
                                        </button>
                                    ))}
                                </div>

                                {/* Question Prompt Box */}
                                <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 mb-6">
                                    <p className="text-sm font-medium text-slate-700">
                                        {activeData?.label === 'Part 1' ? "What do you usually do at the weekends?" : "Describe a memorable event in your life."}
                                        {/* ^ Placeholder if prompt is missing from response, ideally fetch from test data */}
                                    </p>
                                </div>

                                {/* Audio Player Strip */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-4 mb-8">
                                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0 cursor-pointer shadow-lg hover:bg-purple-700 transition" onClick={() => setPlayingAudio(!playingAudio)}>
                                        {playingAudio ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                                            <span>My answer</span>
                                            <span>0:04</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-slate-400 w-1/3 rounded-full" />
                                        </div>
                                    </div>
                                    <div className="text-xs font-medium text-slate-400">0:00 / 0:04</div>
                                </div>
                            </div>


                            {/* Two Column Layout: Transcript & Analysis */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-slate-100">
                                {/* LEFT: Transcript */}
                                <div className="p-6 border-r border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-bold text-slate-800">Your Answer</h4>
                                        <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-medium">
                                            <button
                                                onClick={() => setTranscriptMode('original')}
                                                className={`px-3 py-1 rounded-md transition-all ${transcriptMode === 'original' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Original
                                            </button>
                                            <button
                                                onClick={() => setTranscriptMode('feedback')}
                                                className={`px-3 py-1 rounded-md transition-all ${transcriptMode === 'feedback' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Feedback
                                            </button>
                                        </div>
                                    </div>

                                    {/* Legend for Vocabulary/Grammar */}
                                    <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400"></span> A1</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> A2</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> B1</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> B2</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> C1</span>
                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> C2</span>
                                    </div>

                                    <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 min-h-[300px]">
                                        <p className="leading-loose text-slate-700 text-lg">
                                            {transcriptMode === 'original' ? (
                                                activeData?.transcript || "No transcript available."
                                            ) : (
                                                // Feedback View (Highlights)
                                                renderFeedbackText(activeData?.transcript, evaluation, detailTab)
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* RIGHT: Analysis Tabs */}
                                <div className="p-6 bg-white">
                                    {/* Tabs Header */}
                                    <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
                                        {(['fluency', 'vocabulary', 'pronunciation', 'grammar'] as const).map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => setDetailTab(tab)}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all whitespace-nowrap ${detailTab === tab
                                                    ? 'border-purple-600 text-purple-700 bg-purple-50'
                                                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                    }`}
                                            >
                                                {tab === 'grammar' ? 'Grammar & Corrections' : tab}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Tab Content */}
                                    <div className="min-h-[400px]">
                                        {detailTab === 'fluency' && (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <h5 className="font-bold text-slate-800 flex items-center gap-2">
                                                    <TrendingUp className="w-5 h-5 text-purple-500" /> Fluency Analysis
                                                </h5>

                                                {/* Speed Card */}
                                                <div className="bg-purple-50 rounded-xl p-6 border border-purple-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-white p-3 rounded-full shadow-sm">
                                                            <Zap className="w-6 h-6 text-purple-600" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-purple-900">Speaking Speed</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-3xl font-bold text-purple-700">{evaluation?.fluency_analysis?.wpm || 127}</div>
                                                        <div className="text-xs text-purple-500 font-medium">words/min</div>
                                                    </div>
                                                </div>

                                                {/* Speed Gauge Visualization */}
                                                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Clock className="w-4 h-4 text-slate-400" />
                                                        <span className="text-sm font-bold text-slate-700">Speech Pace</span>
                                                    </div>
                                                    <div className="relative h-4 bg-gradient-to-r from-red-400 via-green-400 to-red-400 rounded-full w-full">
                                                        <div className="absolute top-0 bottom-0 w-1 bg-slate-800 -mt-1 -mb-1" style={{ left: '50%' }}></div> {/* Indicator */}
                                                        <div className="absolute -bottom-6 w-full flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                                                            <span>Too Slow</span>
                                                            <span>Normal</span>
                                                            <span>Too Fast</span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-8 bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800 leading-relaxed">
                                                        <span className="font-bold">✨ Great job!</span> Examiners imply most likely enjoy your speaking if you speak around 120-150 words per minute.
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {detailTab === 'vocabulary' && (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <h5 className="font-bold text-slate-800 flex items-center gap-2">
                                                    <BookOpen className="w-5 h-5 text-orange-500" /> Vocabulary Mistakes
                                                </h5>

                                                {/* CEFR Distribution Bars */}
                                                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
                                                    {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
                                                        <div key={lvl} className="flex items-center gap-3">
                                                            <div className={`w-8 h-6 rounded flex items-center justify-center text-xs font-bold text-white ${getCEFRColor(lvl)}`}>
                                                                {lvl}
                                                            </div>
                                                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className={`h-full ${getCEFRColor(lvl)}`} style={{ width: lvl === 'A1' ? '10%' : '0%' }}></div>
                                                            </div>
                                                            <div className="text-xs font-bold text-slate-400 w-8 text-right">{lvl === 'A1' ? '10%' : '0%'}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                                    <h6 className="text-sm font-bold text-amber-800 mb-2">Paraphrasing Tips</h6>
                                                    <p className="text-xs text-amber-700 leading-relaxed">
                                                        Use the recommended words to achieve a higher score. Try replacing basic words with more precise synonyms (e.g., use "challenging" instead of "hard").
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {detailTab === 'grammar' && (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <h5 className="font-bold text-slate-800 flex items-center gap-2">
                                                    <AlertCircle className="w-5 h-5 text-red-500" /> Grammar Mistakes
                                                </h5>

                                                {evaluation?.grammar_analysis?.map((mistake, i) => (
                                                    <div key={i} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm relative overflow-hidden">
                                                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-400"></div>
                                                        <div className="pl-3">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Error #{i + 1}</span>
                                                            </div>
                                                            <div className="text-sm line-through text-red-400 mb-1 font-medium">
                                                                {typeof mistake.error === 'string' ? mistake.error : JSON.stringify(mistake.error)}
                                                            </div>
                                                            <div className="text-sm text-emerald-600 font-bold flex items-center gap-1">
                                                                <ChevronRight className="w-3 h-3" /> {mistake.correction}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) || (
                                                        <EmptyState />
                                                    )}
                                            </div>
                                        )}

                                        {detailTab === 'pronunciation' && (
                                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <h5 className="font-bold text-slate-800 flex items-center gap-2">
                                                    <Mic className="w-5 h-5 text-emerald-500" /> Pronunciation Mistakes
                                                </h5>
                                                <div className="text-center py-10">
                                                    <EmptyState message="Your response is too short to generate valuable pronunciation feedback." />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column Sidebar */}
                    <div className="lg:col-span-1 space-y-6 sticky top-24 h-fit">
                        {/* AITutorCard moved to footer */}

                        {/* Motivation Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-3">Speaking Tips</h3>
                            <ul className="text-sm text-slate-500 space-y-3 list-disc pl-4">
                                <li>Speak naturally and don't rush.</li>
                                <li>Use a range of connecting words.</li>
                                <li>Don't worry about accent, focus on clarity.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Footer Nav */}
                <div className="flex justify-center mt-8 gap-4 flex-wrap pb-10">
                    <Link href="/reports" className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                        Back to All Reports
                    </Link>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2"
                    >
                        <MessageCircle className="w-5 h-5" />
                        Chat with AI Tutor
                    </button>
                    <Link href="/dashboard" className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 shadow-md transition-all">
                        Go to Dashboard
                    </Link>
                </div>

            </div>
        </div>
    );
}

// --- Subcomponents ---

function CriteriaRow({ config, score }: { config: any, score: number }) {
    const percentage = (score / 9) * 100;
    return (
        <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.iconBg} shadow-sm`}>
                <config.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
                <div className="flex justify-between mb-2">
                    <span className="font-bold text-slate-700 text-sm">{config.label}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${config.color} rounded-full transition-all duration-1000`} style={{ width: `${percentage}%` }}></div>
                </div>
            </div>
            <div className="text-lg font-bold text-slate-900 w-8 text-right">{score.toFixed(1)}</div>
        </div>
    );
}

function EmptyState({ message }: { message?: string }) {
    return (
        <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-2xl">
                🐶
            </div>
            <p className="text-sm font-medium text-slate-500 italic">
                {message || "No mistakes found! Your response is too short or clear."}
            </p>
        </div>
    );
}

function getCEFRColor(level: string) {
    switch (level) {
        case 'A1': return 'bg-slate-500';
        case 'A2': return 'bg-emerald-500';
        case 'B1': return 'bg-blue-500';
        case 'B2': return 'bg-indigo-500';
        case 'C1': return 'bg-amber-500';
        case 'C2': return 'bg-red-500';
        default: return 'bg-slate-300';
    }
}

// Logic to highlight text based on tab
function renderFeedbackText(text: string = '', evaluation: any, tab: string) {
    if (!text) return "No transcript.";

    if (tab === 'grammar' && evaluation?.grammar_analysis) {
        // Simple highlight logic - identifying errors in text is hard without indices.
        // We will try to bold/red highlight words that appear in "error" field.
        // For MVP, just show text. Real impl needs offset indices from backend.
        return (
            <span>
                {text.split(' ').map((word, i) => {
                    // Very naive matching
                    const isError = evaluation.grammar_analysis.some((e: any) => typeof e.error === 'string' && e.error.includes(word));
                    return isError ? <span key={i} className="bg-red-100 text-red-600 px-0.5 rounded mx-0.5 font-medium border-b border-red-200">{word}</span> : word + ' ';
                })}
            </span>
        );
    }

    // Default highlights for vocabulary (randomly assigning colors for demo effect if data missing)
    return (
        <span>
            {text.split(' ').map((word, i) => {
                // Random highlighting for demo match
                const rnd = Math.random();
                let colorClass = "";
                if (word.length > 5 && rnd > 0.7) colorClass = "bg-red-100 text-red-600"; // C2
                else if (word.length > 4 && rnd > 0.5) colorClass = "bg-amber-100 text-amber-700"; // C1

                return colorClass !== "" ? <span key={i} className={`rounded px-1 mx-0.5 ${colorClass}`}>{word}</span> : word + ' '
            })}
        </span>
    );
}
