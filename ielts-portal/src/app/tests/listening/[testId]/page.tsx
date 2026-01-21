'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    ArrowRight,
    Headphones,
    Clock,
    Play,
    Pause,
    Volume2,
    VolumeX,
    CheckCircle,
    SkipForward,
    Loader2,
    AlertCircle,
    Target,
    Lightbulb,
    BookOpen,
} from 'lucide-react';
import { evaluateListening, ListeningEvaluationResult } from '@/services/evaluatorApi';

interface Question {
    id: string;
    question_text: string;
    question_type: string;
    options: string[];
    correct_answer: string;
    order: number;
}

interface QuestionGroup {
    id: string;
    title: string;
    instructions: string;
    content: string;
    media_file: string | null;
    audio_start_time: number; // in seconds - when this part starts in the audio
    order: number;
    questions: Question[];
}

interface TestModule {
    id: string;
    module_type: string;
    duration_minutes: number;
    question_groups: QuestionGroup[];
}

interface ListeningTest {
    id: string;
    title: string;
    description: string;
    test_type: string;
    audio_file?: string;
    modules: TestModule[];
}

interface PageProps {
    params: Promise<{ testId: string }>;
}

// Use relative path - Next.js rewrites handle proxying to Django
const MEDIA_BASE_URL = '/media/';

export default function ListeningTestPage({ params }: PageProps) {
    const { testId } = use(params);
    const searchParams = useSearchParams();

    const [test, setTest] = useState<ListeningTest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPart, setCurrentPart] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState(30 * 60);
    const [showAudioModal, setShowAudioModal] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [testCompleted, setTestCompleted] = useState(false);
    const [score, setScore] = useState(0);

    // AI Evaluation state
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [evaluationResult, setEvaluationResult] = useState<ListeningEvaluationResult | null>(null);
    const [evaluationError, setEvaluationError] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement>(null);


    // Check completion status and redirect to result view if done
    useEffect(() => {
        const view = searchParams.get('view');
        if (view === 'result') return; // Already viewing result

        const checkCompletion = async () => {
            try {
                const res = await fetch(`/api/ielts/check-completion/listening/${testId}/`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.is_completed && data.session_id) {
                        // Redirect to result view
                        window.location.href = `/tests/listening/${testId}?view=result&sessionId=${data.session_id}`;
                    }
                }
            } catch (e) {
                console.error('Error checking completion:', e);
            }
        };
        checkCompletion();
    }, [testId, searchParams]);

    // Load session result if viewed from history
    useEffect(() => {
        const view = searchParams.get('view');
        const sessionId = searchParams.get('sessionId');
        const attemptId = searchParams.get('attemptId');

        if (view === 'result' && sessionId) {
            const loadResult = async () => {
                // Don't set loading=true here if test is already loading, to avoid flicker? 
                // Actually we want to show loading while fetching result.
                // But fetchTest might be running.

                try {
                    const res = await fetch(`/api/ielts/sessions/${sessionId}/`, { credentials: 'include' });
                    if (res.ok) {
                        const session = await res.json();
                        // Find attempt
                        let attempt = null;
                        if (attemptId) {
                            attempt = session.module_attempts?.find((a: any) => a.id === attemptId);
                        } else {
                            attempt = session.module_attempts?.find((a: any) => a.module_type === 'listening');
                        }

                        if (attempt) {
                            setScore(attempt.raw_score || 0);
                            // Reconstruct evaluation result
                            // If feedback is stored in attempt.feedback (json field)
                            const feedback = attempt.data?.feedback || attempt.feedback || {};

                            if (feedback.examiner_feedback || feedback.analysis) {
                                setEvaluationResult({
                                    overall_band: attempt.band_score,
                                    module: 'listening',
                                    examiner_feedback: feedback.examiner_feedback || feedback.analysis || "Feedback retrieved from history.",
                                    improvements: feedback.improvements || [],
                                    accuracy: feedback.accuracy || (attempt.raw_score ? Math.round((attempt.raw_score / 40) * 100) + '%' : '0%')
                                });
                            } else {
                                // Minimal result if no detailed AI feedback stored
                                setEvaluationResult({
                                    overall_band: attempt.band_score,
                                    module: 'listening',
                                    examiner_feedback: "Detailed feedback not available for this session.",
                                    improvements: [],
                                    accuracy: attempt.raw_score ? Math.round((attempt.raw_score / 40) * 100) + '%' : '0%'
                                });
                            }
                            setTestCompleted(true);
                        }
                    }
                } catch (e) {
                    console.error('Failed to load result:', e);
                }
            };
            // Delay slightly to ensure test structure might be initiating? No, parallel is fine.
            loadResult();
        }
    }, [searchParams]);

    useEffect(() => {
        fetchTest();
    }, [testId]);

    // Timer
    useEffect(() => {
        if (loading || testCompleted || showAudioModal) return;
        const interval = setInterval(() => {
            setTimeLeft((t) => {
                if (t <= 0) {
                    handleSubmit();
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [loading, testCompleted, showAudioModal]);

    // Audio time update with auto-part switching based on timestamps
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !test) return;

        const sections = getSections();

        const updateProgress = () => {
            const currentTime = audio.currentTime;
            setAudioProgress(currentTime);
            setAudioDuration(audio.duration || 0);

            // Auto-switch to correct part based on audio_start_time timestamps
            // Only apply auto-switching if sections have distinct start times configured
            const hasTimestamps = sections.some((s, idx) => (s.audio_start_time || 0) > 0);
            if (sections.length > 0 && hasTimestamps) {
                // Find which part the current audio time falls into
                // Iterate forwards and find the last section whose start time is <= current time
                let targetPart = 0;
                for (let i = 0; i < sections.length; i++) {
                    const startTime = sections[i].audio_start_time || 0;
                    if (currentTime >= startTime) {
                        targetPart = i;
                    } else {
                        break; // Stop once we pass the current time
                    }
                }

                // Only update if different (use callback to get current state)
                setCurrentPart(prev => {
                    if (prev !== targetPart) {
                        return targetPart;
                    }
                    return prev;
                });
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadedmetadata', updateProgress);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('loadedmetadata', updateProgress);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [test]); // Remove currentPart from dependencies

    const fetchTest = async () => {
        // Try local JSON first
        try {
            const localRes = await fetch('/data/listening_tests.json');
            const localData = await localRes.json();
            if (localData.tests && localData.tests.length > 0) {
                const foundTest = localData.tests.find((t: any) => String(t.id) === String(testId));
                if (foundTest) {
                    // Transform local JSON format to match expected structure
                    const transformedTest: ListeningTest = {
                        id: String(foundTest.id),
                        title: foundTest.title || `Listening Test ${foundTest.id}`,
                        description: 'IELTS Listening Test',
                        test_type: 'academic',
                        audio_file: foundTest.audio_file || null,
                        modules: [{
                            id: `listening-${foundTest.id}`,
                            module_type: 'listening',
                            duration_minutes: 30,
                            question_groups: foundTest.sections?.map((section: any, sIdx: number) => ({
                                id: `section-${sIdx + 1}`,
                                title: `Section ${section.section || sIdx + 1}`,
                                instructions: section.question_type || 'Answer the questions',
                                content: '',
                                media_file: null,
                                audio_start_time: 0,
                                order: sIdx + 1,
                                questions: section.questions?.map((q: any, qIdx: number) => ({
                                    id: `q-${section.section}-${q.q || qIdx + 1}`,
                                    question_text: q.question || '',
                                    question_type: q.type === 'mcq' ? 'multiple_choice' : 'text',
                                    options: q.options || [],
                                    correct_answer: JSON.stringify(foundTest.answer_key?.[String(q.q)] || []),
                                    order: q.q || qIdx + 1
                                })) || []
                            })) || []
                        }]
                    };
                    setTest(transformedTest);
                    setLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.log('Local JSON load failed, trying API');
        }

        // Fallback to API
        try {
            const res = await fetch(`/api/ielts/tests/${testId}/`);
            if (!res.ok) throw new Error('Failed to fetch test');
            const data = await res.json();
            setTest(data);
        } catch (err: any) {
            setError(err.message);
        }
        setLoading(false);
    };

    const getListeningModule = (): TestModule | null => {
        if (!test) return null;
        return test.modules.find((m) => m.module_type === 'listening') || null;
    };

    const getSections = (): QuestionGroup[] => {
        const module = getListeningModule();
        return module?.question_groups || [];
    };

    const getCurrentSection = (): QuestionGroup | null => {
        const sections = getSections();
        return sections[currentPart] || null;
    };

    const getAllQuestions = (): Question[] => {
        const sections = getSections();
        return sections.flatMap((s) => s.questions);
    };

    const getQuestionsForPart = (partIndex: number): Question[] => {
        const sections = getSections();
        return sections[partIndex]?.questions || [];
    };

    const getQuestionCountBefore = (partIndex: number): number => {
        const sections = getSections();
        let count = 0;
        for (let i = 0; i < partIndex; i++) {
            count += sections[i]?.questions.length || 0;
        }
        return count;
    };

    const getAudioUrl = (): string | null => {
        // First check for test-level audio file
        if (test?.audio_file) {
            return test.audio_file;
        }
        // Fallback to section-level media file
        const section = getCurrentSection();
        if (section?.media_file) {
            if (section.media_file.startsWith('http')) {
                return section.media_file;
            }
            return MEDIA_BASE_URL + section.media_file;
        }
        return null;
    };

    const handleAnswerChange = (questionId: string, value: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    };

    const handleStartTest = () => {
        setShowAudioModal(false);
        const audio = audioRef.current;
        if (audio) {
            audio.play().then(() => setIsPlaying(true)).catch(() => { });
        }
    };

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().then(() => setIsPlaying(true)).catch(() => { });
        }
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (audio) {
            audio.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handlePartChange = (partIndex: number) => {
        // Only change the part view - do NOT touch the audio
        setCurrentPart(partIndex);
    };

    const handleSubmit = async () => {
        if (!test) return;
        setIsEvaluating(true);
        setEvaluationError(null);

        const questions = getAllQuestions();
        let correct = 0;

        // Build answer key from questions' correct_answer field
        const answerKey: Record<string, string> = {};
        questions.forEach((q) => {
            const qNum = q.order.toString();
            let correctAnswers: string[] = [];
            try {
                correctAnswers = JSON.parse(q.correct_answer);
            } catch {
                correctAnswers = [q.correct_answer];
            }
            // Take first acceptable answer as the primary answer
            answerKey[qNum] = correctAnswers[0] || '';

            // Also count correct for local score display
            const userAnswer = answers[q.id]?.trim().toLowerCase();
            if (correctAnswers.some((ca: string) => ca.toLowerCase() === userAnswer)) {
                correct++;
            }
        });

        setScore(correct);

        // Build user answers keyed by question number
        const userAnswersMap: Record<string, string> = {};
        questions.forEach((q) => {
            const qNum = q.order.toString();
            userAnswersMap[qNum] = answers[q.id] || '';
        });

        try {
            const result = await evaluateListening(answerKey, userAnswersMap);
            setEvaluationResult(result);

            // Create detailed breakdown for report
            const detailedAnswers = questions.map((q) => {
                const qNum = q.order.toString();
                const uAnswer = (userAnswersMap[qNum] || '').trim();

                let correctAnswers: string[] = [];
                try {
                    correctAnswers = JSON.parse(q.correct_answer);
                } catch {
                    correctAnswers = [q.correct_answer];
                }

                const isCorrect = correctAnswers.some((ca: string) => ca.toLowerCase() === uAnswer.toLowerCase());

                return {
                    question_number: q.order,
                    user_answer: uAnswer || '-',
                    correct_answer: correctAnswers[0] || '-',
                    is_correct: isCorrect
                };
            });

            // Save result to backend for Reports
            try {
                const saveRes = await fetch('/api/ielts/sessions/save_module_result/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        test_id: test.id,
                        module_type: 'listening',
                        band_score: result?.overall_band || 0,
                        raw_score: correct,
                        answers: userAnswersMap,
                        feedback: {
                            ...result,
                            breakdown: detailedAnswers
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
            console.error('Listening evaluation failed:', error);
            setEvaluationError(error instanceof Error ? error.message : 'Evaluation failed');
        } finally {
            setIsEvaluating(false);
            setTestCompleted(true);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const calculateBandScore = (rawScore: number, total: number) => {
        const percentage = (rawScore / total) * 100;
        if (percentage >= 90) return 9.0;
        if (percentage >= 85) return 8.5;
        if (percentage >= 80) return 8.0;
        if (percentage >= 75) return 7.5;
        if (percentage >= 65) return 7.0;
        if (percentage >= 55) return 6.5;
        if (percentage >= 45) return 6.0;
        if (percentage >= 35) return 5.5;
        return 5.0;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
        );
    }

    if (error || !test) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600 mb-4">{error || 'Test not found'}</p>
                    <Link href="/tests/listening" className="text-blue-600 hover:underline">
                        Back to Listening Tests
                    </Link>
                </div>
            </div>
        );
    }

    const sections = getSections();
    const currentSection = getCurrentSection();
    const allQuestions = getAllQuestions();
    const currentQuestions = getQuestionsForPart(currentPart);
    const questionOffset = getQuestionCountBefore(currentPart);
    const audioUrl = getAudioUrl();

    // Loading screen for evaluation
    if (isEvaluating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Evaluating Your Answers</h2>
                    <p className="text-slate-500 mb-4">Our AI examiner is analyzing your listening test...</p>
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
            </div>
        );
    }

    if (testCompleted) {
        const bandScore = evaluationResult?.overall_band || calculateBandScore(score, allQuestions.length);
        const getBandColor = (band: number) => {
            if (band >= 7) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            if (band >= 5) return 'text-amber-600 bg-amber-50 border-amber-200';
            return 'text-red-600 bg-red-50 border-red-200';
        };

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Listening Test Results</h1>
                                <p className="text-slate-500">Test #{test.id} - AI Evaluation Report</p>
                            </div>
                            <div className={`px-6 py-4 rounded-2xl border-2 ${getBandColor(bandScore)}`}>
                                <div className="text-sm font-medium opacity-75">Overall Band</div>
                                <div className="text-4xl font-bold">{bandScore.toFixed(1)}</div>
                            </div>
                        </div>
                    </div>

                    {evaluationError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <p className="text-red-700">{evaluationError}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Score Breakdown */}
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Target className="w-5 h-5 text-blue-600" />
                                <h3 className="font-bold text-slate-800">Score Breakdown</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Correct Answers</span>
                                    <span className="text-2xl font-bold text-emerald-600">{score} / {allQuestions.length}</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${(score / allQuestions.length) * 100}%` }}
                                    />
                                </div>
                                {evaluationResult?.accuracy && (
                                    <div className="flex justify-between items-center pt-2">
                                        <span className="text-slate-600">Accuracy</span>
                                        <span className="font-bold text-slate-800">{evaluationResult.accuracy}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Examiner Feedback */}
                        {evaluationResult?.examiner_feedback && (
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <BookOpen className="w-5 h-5 text-purple-600" />
                                    <h3 className="font-bold text-slate-800">Examiner Feedback</h3>
                                </div>
                                <p className="text-slate-600 leading-relaxed">{evaluationResult.examiner_feedback}</p>
                            </div>
                        )}
                    </div>

                    {/* Improvement Suggestions */}
                    {evaluationResult?.improvements && evaluationResult.improvements.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-8 mb-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                            <div className="relative">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center rotate-3 border border-indigo-100 shadow-sm">
                                        <Lightbulb className="w-7 h-7 text-indigo-600" />
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
                                    {evaluationResult.improvements.map((tip, i) => (
                                        <div key={i} className="group flex items-start gap-4 p-5 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all duration-300">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all">
                                                <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600">{i + 1}</span>
                                            </div>
                                            <p className="text-slate-600 font-medium leading-relaxed group-hover:text-slate-800 transition-colors pt-1">{tip}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex gap-3 justify-center">
                        <Link
                            href="/tests/listening"
                            className="px-6 py-3 rounded-xl bg-white text-slate-600 font-medium hover:bg-slate-50 transition-colors shadow"
                        >
                            Back to Tests
                        </Link>
                        <Link
                            href="/dashboard"
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg"
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
            {/* Hidden Audio Element */}
            {audioUrl && (
                <audio ref={audioRef} src={audioUrl} preload="metadata" />
            )}

            {/* Audio Modal Overlay */}
            {showAudioModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Headphones className="w-10 h-10 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Audio Check</h3>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            You will be listening to an audio clip during this test.
                            {audioUrl ? '' : ' Audio not available for this test.'}
                        </p>

                        <button
                            onClick={handleStartTest}
                            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200"
                        >
                            <Play className="w-5 h-5 fill-current" />
                            {audioUrl ? 'Start Test' : 'Start Practice'}
                        </button>
                    </div>
                </div>
            )}

            {/* Modern Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Logo */}
                        <Link href="/tests/listening" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                                <Headphones className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-slate-800 font-bold text-sm leading-tight">Listening</span>
                                <span className="text-slate-500 text-xs">Test #{test.id}</span>
                            </div>
                        </Link>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Timer */}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold transition-colors ${timeLeft < 300
                            ? 'bg-red-50 text-red-600 border border-red-100'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                            }`}>
                            <Clock className="w-5 h-5" />
                            {formatTime(timeLeft)}
                        </div>
                    </div>
                </div>
            </header>

            {/* Audio Player Bar */}
            {audioUrl && !showAudioModal && (
                <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
                    <div className="max-w-4xl mx-auto flex items-center gap-6">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-blue-200 shrink-0">
                            {isPlaying ? (
                                <div className="flex gap-0.5">
                                    <div className="w-1 h-4 bg-white rounded-full animate-pulse"></div>
                                    <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            ) : (
                                <Volume2 className="w-5 h-5" />
                            )}
                        </div>

                        <div className="flex-1">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                                <span>PART {currentPart + 1}</span>
                                <span className="font-mono">{formatTime(audioProgress)} / {formatTime(audioDuration)}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all"
                                    style={{ width: `${audioDuration > 0 ? (audioProgress / audioDuration) * 100 : 0}%` }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={toggleMute}
                            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            )}

            {/* Part Title */}
            <div className="bg-white/50 backdrop-blur px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">
                        Part {currentPart + 1}
                    </span>
                    <span className="text-slate-600 text-sm font-medium">
                        Questions {questionOffset + 1}-{questionOffset + currentQuestions.length}
                    </span>
                </div>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto px-6 py-4">
                <div className="max-w-4xl mx-auto pb-20">
                    {/* Instructions Card */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6">
                        <h3 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Instructions</h3>
                        <p className="text-lg text-slate-800 font-medium">
                            {currentSection?.instructions || 'Complete the notes. Write ONE WORD AND/OR A NUMBER for each answer'}
                        </p>
                    </div>

                    {/* Questions */}
                    <div className="space-y-4">
                        {currentQuestions.map((question) => (
                            <div key={question.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-blue-300 transition-colors">
                                <div className="flex items-start gap-4">
                                    <span className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">
                                        {question.order}
                                    </span>
                                    <div className="flex-1 space-y-3">
                                        <p className="text-slate-700 font-medium leading-relaxed">{question.question_text}</p>

                                        {question.question_type === 'multiple_choice' && question.options.length > 0 ? (
                                            <div className="max-w-xs">
                                                <select
                                                    value={answers[question.id] || ''}
                                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                                                >
                                                    <option value="">Select Answer...</option>
                                                    {question.options.map((opt, i) => (
                                                        <option key={i} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                value={answers[question.id] || ''}
                                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                className="w-full max-w-sm px-4 py-2 bg-slate-50 border-b-2 border-slate-200 focus:border-blue-500 focus:bg-blue-50/30 focus:outline-none transition-colors text-slate-800 font-medium"
                                                placeholder="Type your answer here..."
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Bottom Navigation Bar */}
            <footer className="bg-white border-t border-slate-200 sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl mx-auto">
                    {/* Navigation Arrows */}
                    <div className="flex justify-between items-center px-6 py-3 border-b border-slate-100">
                        <button
                            onClick={() => handlePartChange(Math.max(0, currentPart - 1))}
                            disabled={currentPart === 0}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${currentPart === 0
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Previous Part
                        </button>

                        {currentPart < sections.length - 1 ? (
                            <button
                                onClick={() => handlePartChange(currentPart + 1)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors"
                            >
                                Next Part
                                <SkipForward className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 font-medium shadow-lg shadow-emerald-200 transition-all"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Submit Test
                            </button>
                        )}
                    </div>

                    {/* Part Tabs */}
                    <div className="flex bg-slate-50 overflow-x-auto">
                        {sections.map((section, idx) => {
                            const partQuestions = getQuestionsForPart(idx);
                            const answeredCount = partQuestions.filter((q) => answers[q.id]).length;
                            const isActive = currentPart === idx;

                            return (
                                <button
                                    key={section.id}
                                    onClick={() => handlePartChange(idx)}
                                    className={`flex-1 min-w-[120px] py-3 px-4 text-sm font-medium border-r border-slate-200 last:border-r-0 transition-all relative ${isActive
                                        ? 'bg-white text-blue-700 shadow-[inset_0_2px_0_0_#3b82f6]'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                        }`}
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        <span>Part {idx + 1}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                            {answeredCount}/{partQuestions.length}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Question Numbers (Scrollable) */}
                    <div className="flex items-center gap-2 px-6 py-3 overflow-x-auto whitespace-nowrap bg-white border-t border-slate-100">
                        {currentQuestions.map((q, idx) => {
                            const isAnswered = !!answers[q.id];
                            return (
                                <button
                                    key={q.id}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex-shrink-0 flex items-center justify-center ${isAnswered
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                >
                                    {questionOffset + idx + 1}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </footer>
        </div>
    );
}
