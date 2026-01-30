'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
    Clock,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Menu,
    Bell,
    Check,
    Wifi,
    Loader2,
} from 'lucide-react';
import { evaluateReading, ReadingEvaluationResult } from '@/services/evaluatorApi';
import ReadingTestRenderer from '@/components/ReadingTestRenderer';
import AIChatBot from '@/components/AIChatBot';
import { useAuth } from '@/contexts/AuthContext';

interface Question {
    id: string;
    question_text: string;
    question_type: string;
    options: OptionItem[];
    correct_answer: string;
    order: number;
}

interface RichTextElement {
    t: 'text' | 'slot';
    v?: string;
    slot_id?: string;
}

interface Container {
    kind: string;
    rich?: RichTextElement[];
    cols?: string[];
    rows?: any[];
}

interface OptionItem {
    key: string;
    text: string;
}

interface QuestionGroup {
    id: string;
    title: string;
    instructions: string;
    group_type: string;
    content: string;
    container: Container;
    options: OptionItem[];
    order: number;
    questions: Question[];
    image?: string;  // Optional image URL for diagram/flowchart questions
}

interface TestModule {
    id: string;
    module_type: string;
    duration_minutes: number;
    question_groups: QuestionGroup[];
}

interface ReadingTest {
    id: string;
    title: string;
    description: string;
    test_type: string;
    modules: TestModule[];
}

interface PageProps {
    params: Promise<{ testId: string }>;
}

export default function ReadingTestPage({ params }: PageProps) {
    const { testId } = use(params);
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const [test, setTest] = useState<ReadingTest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPartIndex, setCurrentPartIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState(60 * 60);
    const [testCompleted, setTestCompleted] = useState(false);
    const [score, setScore] = useState(0);
    const [savedSessionId, setSavedSessionId] = useState<string | null>(null);

    // AI Evaluation state
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [evaluationResult, setEvaluationResult] = useState<ReadingEvaluationResult | null>(null);
    const [evaluationError, setEvaluationError] = useState<string | null>(null);

    const passagePanelRef = React.useRef<HTMLDivElement>(null);
    const questionsPanelRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (passagePanelRef.current) passagePanelRef.current.scrollTop = 0;
        if (questionsPanelRef.current) questionsPanelRef.current.scrollTop = 0;
    }, [currentPartIndex]);

    // Check completion status and redirect to result view if done
    useEffect(() => {
        const view = searchParams.get('view');
        if (view === 'result') return; // Already viewing result

        const checkCompletion = async () => {
            try {
                const res = await fetch(`/api/ielts/check-completion/reading/${testId}/`, { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.is_completed && data.session_id) {
                        // Redirect to result view
                        window.location.href = `/tests/reading/${testId}?view=result&sessionId=${data.session_id}`;
                    }
                }
            } catch (e) {
                console.error('Error checking completion:', e);
            }
        };
        checkCompletion();
    }, [testId, searchParams]);

    useEffect(() => {
        const view = searchParams.get('view');
        const sessionId = searchParams.get('sessionId');
        const attemptId = searchParams.get('attemptId');
        const retake = searchParams.get('retake');

        // If retake=true parameter is present, reset test state and don't load results
        if (retake === 'true') {
            setTestCompleted(false);
            setEvaluationResult(null);
            setScore(0);
            setAnswers({});
            return;
        }

        // Only load results if explicitly requested with view=result AND sessionId parameters
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
                            attempt = session.module_attempts?.find((a: any) => a.module_type === 'reading');
                        }

                        if (attempt) {
                            setScore(attempt.raw_score || 0);
                            // Reconstruct evaluation result
                            // Check for feedback in 'data' field (new structure) or fallback to 'feedback' field if available
                            const feedback = attempt.data?.feedback || attempt.feedback || {};

                            if (feedback.examiner_feedback || feedback.analysis) {
                                setEvaluationResult({
                                    overall_band: attempt.band_score,
                                    module: 'reading',
                                    examiner_feedback: feedback.examiner_feedback || feedback.analysis || "Feedback retrieved from history.",
                                    improvements: feedback.improvements || [],
                                    accuracy: feedback.accuracy || (attempt.raw_score ? Math.round((attempt.raw_score / 40) * 100) + '%' : '0%')
                                });
                            } else {
                                setEvaluationResult({
                                    overall_band: attempt.band_score,
                                    module: 'reading',
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
            loadResult();
        }
    }, [searchParams]);

    useEffect(() => {
        fetchTest();
    }, [testId]);

    useEffect(() => {
        if (loading || testCompleted) return;
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
    }, [loading, testCompleted]);

    const fetchTest = async () => {
        // Try local JSON first
        try {
            const localRes = await fetch('/data/reading_tests.json');
            const localData = await localRes.json();
            if (localData.tests && localData.tests.length > 0) {
                const foundTest = localData.tests.find((t: any) => String(t.id) === String(testId));
                if (foundTest) {
                    // Transform local JSON format to match expected structure
                    const transformedTest: ReadingTest = {
                        id: String(foundTest.id),
                        title: foundTest.title || `Reading Test ${foundTest.id}`,
                        description: 'IELTS Academic Reading Test',
                        test_type: 'academic',
                        modules: [{
                            id: `reading-${foundTest.id}`,
                            module_type: 'reading',
                            duration_minutes: 60,
                            question_groups: foundTest.passages?.map((passage: any, pIdx: number) => {
                                // Flatten groups from each passage
                                return passage.groups?.map((group: any, gIdx: number) => ({
                                    id: group.group_id || `${passage.passage_id}-G${gIdx + 1}`,
                                    title: passage.title || `Passage ${pIdx + 1}`,
                                    instructions: group.instructions || '',
                                    group_type: mapGroupType(group.type),
                                    content: passage.text || '',
                                    container: group.container,
                                    options: group.options || [],
                                    order: gIdx + 1,
                                    image: group.image,
                                    questions: group.items?.map((item: any) => ({
                                        id: item.item_id,
                                        question_text: item.prompt || '',
                                        question_type: group.type,
                                        options: item.options?.map((o: any) => ({
                                            key: typeof o === 'object' ? (o.key || o.text || String(o)) : String(o),
                                            text: typeof o === 'object' ? (o.text || o.key || String(o)) : String(o)
                                        })) || group.options?.map((o: any) => ({
                                            key: typeof o === 'object' ? (o.key || o.text || String(o)) : String(o),
                                            text: typeof o === 'object' ? (o.text || o.key || String(o)) : String(o)
                                        })) || [{ key: 'TRUE', text: 'TRUE' }, { key: 'FALSE', text: 'FALSE' }, { key: 'NOT GIVEN', text: 'NOT GIVEN' }],
                                        correct_answer: item.answer?.value || '',
                                        order: item.number
                                    })) || []
                                }));
                            }).flat() || []
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

            // Adapt API response if needed
            if (!data.modules && data.question_groups) {
                // Construct a module wrapper if API returns flat question_groups
                const adaptedTest: ReadingTest = {
                    id: String(data.id),
                    title: data.title || `Reading Test ${data.id}`,
                    description: data.description || '',
                    test_type: data.test_type || 'academic',
                    modules: [{
                        id: `reading-${data.id}`,
                        module_type: 'reading',
                        duration_minutes: 60,
                        question_groups: data.question_groups.map((group: any) => ({
                            ...group,
                            id: String(group.id),
                            options: group.options || [],
                            questions: group.questions?.map((q: any) => ({
                                ...q,
                                id: String(q.id),
                                options: q.options || group.options || [] // Fallback options
                            })) || []
                        }))
                    }]
                };
                setTest(adaptedTest);
            } else {
                setTest(data);
            }
        } catch (err: any) {
            setError(err.message);
        }
        setLoading(false);
    };

    // Helper to map JSON group types to expected format
    const mapGroupType = (type: string): string => {
        const typeMap: Record<string, string> = {
            'SUMMARY_COMPLETION': 'summary_completion',
            'MATCHING_FEATURES': 'matching_features',
            'MATCHING_HEADINGS': 'matching_headings',
            'YES_NO_NOT_GIVEN': 'yes_no_ng',
            'TRUE_FALSE_NOT_GIVEN': 'true_false_ng',
            'MULTIPLE_CHOICE': 'multiple_choice',
            'TABLE_COMPLETION': 'table_completion',
            'SENTENCE_COMPLETION': 'sentence_completion',
            'FLOW_CHART_COMPLETION': 'sentence_completion',
            'DIAGRAM_LABELLING': 'sentence_completion',
            'PARAGRAPH_HEADINGS': 'matching_headings',
            'MATCHING_SENTENCE_ENDINGS': 'matching_features'
        };
        return typeMap[type] || type?.toLowerCase() || 'text_input';
    };

    const getReadingModule = () => {
        return test?.modules.find(m => m.module_type === 'reading');
    };

    // Group question groups by passage title to create "Parts"
    const getParts = () => {
        const module = getReadingModule();
        if (!module) return [];

        const passageMap = new Map<string, QuestionGroup[]>();
        module.question_groups.forEach(group => {
            const title = group.title;
            if (!passageMap.has(title)) {
                passageMap.set(title, []);
            }
            passageMap.get(title)!.push(group);
        });

        return Array.from(passageMap.entries()).map(([title, groups]) => ({
            title,
            groups,
            content: groups[0]?.content || '',
            questionsCount: groups.reduce((acc, g) => acc + g.questions.length, 0)
        }));
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAnswerChange = (questionId: string, value: string) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: value
        }));
    };

    const handleSubmit = async () => {
        if (!test) return;
        setIsEvaluating(true);
        setEvaluationError(null);

        let correctCount = 0;
        const parts = getParts();
        const questions: Array<{ question_id: string; answer_key: string; type: string }> = [];
        const userAnswersMap: Record<string, string> = {};

        parts.forEach(part => {
            part.groups.forEach(group => {
                group.questions.forEach(q => {
                    const userAnswer = answers[q.id]?.trim().toUpperCase();
                    const correctAnswer = q.correct_answer?.trim().toUpperCase();

                    questions.push({
                        question_id: q.id,
                        answer_key: correctAnswer || '',
                        type: q.question_type || 'text'
                    });
                    userAnswersMap[q.id] = userAnswer || '';

                    if (userAnswer === correctAnswer) {
                        correctCount++;
                    }
                });
            });
        });

        setScore(correctCount);

        try {
            const result = await evaluateReading(questions, userAnswersMap);
            setEvaluationResult(result);

            // Create detailed breakdown for report
            const detailedAnswers = questions.map((q, idx) => ({
                question_number: idx + 1,
                user_answer: userAnswersMap[q.question_id] || '-',
                correct_answer: q.answer_key,
                is_correct: (userAnswersMap[q.question_id] || '').trim().toUpperCase() === q.answer_key
            }));

            // Save result to backend for Reports
            try {
                const saveRes = await fetch('/api/ielts/sessions/save_module_result/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        test_id: test.id,
                        module_type: 'reading',
                        band_score: result?.overall_band || 0,
                        raw_score: correctCount,
                        answers: userAnswersMap,
                        feedback: {
                            ...result,
                            breakdown: detailedAnswers
                        }
                    })
                });

                if (saveRes.ok) {
                    const saveData = await saveRes.json();
                    if (saveData.session_id) {
                        setSavedSessionId(saveData.session_id);
                    }
                    console.log('Result saved successfully');
                } else {
                    console.warn('Failed to save result:', await saveRes.text());
                }
            } catch (saveError) {
                console.error('Error saving result:', saveError);
            }

        } catch (error) {
            console.error('Reading evaluation failed:', error);
            setEvaluationError(error instanceof Error ? error.message : 'Evaluation failed');
        } finally {
            setIsEvaluating(false);
            setTestCompleted(true);
        }
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
                    <p className="text-red-500 mb-4">{error || 'Test not found'}</p>
                    <Link href="/dashboard" className="text-blue-600 hover:underline">
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    // Loading screen for evaluation
    if (isEvaluating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Evaluating Your Answers</h2>
                    <p className="text-slate-500 mb-4">Our AI examiner is analyzing your reading test...</p>
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
        const parts = getParts();
        const rawBandScore = evaluationResult?.overall_band;
        const bandScore = typeof rawBandScore === 'number' ? rawBandScore : Number(rawBandScore) || 0;

        const getBandColor = (band: number) => {
            if (band >= 7) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            if (band >= 5) return 'text-amber-600 bg-amber-50 border-amber-200';
            return 'text-red-600 bg-red-50 border-red-200';
        };

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 p-6 overscroll-y-auto">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 relative flex-shrink-0">
                                    <img
                                        src="/cybrik-logo.png"
                                        alt="Cybrik Logo"
                                        className="object-contain w-full h-full"
                                    />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-800">Reading Test Results</h1>
                                    <p className="text-slate-500">Test #{test.id} - AI Evaluation Report</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {savedSessionId && (
                                    <a
                                        href={`/reports/${savedSessionId}`}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        View Full Report
                                    </a>
                                )}
                                <div className={`px-6 py-4 rounded-2xl border-2 ${getBandColor(bandScore)}`}>
                                    <div className="text-sm font-medium opacity-75">Overall Band</div>
                                    <div className="text-4xl font-bold">{bandScore.toFixed(1)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {evaluationError && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                            <p className="text-red-700">{evaluationError}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <h3 className="font-bold text-slate-800">Score Breakdown</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600">Correct Answers</span>
                                    <span className="text-2xl font-bold text-emerald-600">{score} / {parts.reduce((acc, p) => acc + p.questionsCount, 0)}</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${(score / parts.reduce((acc, p) => acc + p.questionsCount, 0)) * 100}%` }}
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

                        {evaluationResult?.examiner_feedback && (
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <h3 className="font-bold text-slate-800">Examiner Feedback</h3>
                                </div>
                                <p className="text-slate-600 leading-relaxed">{evaluationResult.examiner_feedback}</p>
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <div className="flex gap-3 justify-center mb-10">
                        <Link
                            href="/tests/reading"
                            className="px-6 py-3 rounded-xl bg-white text-slate-600 font-medium hover:bg-slate-50 transition-colors shadow"
                        >
                            Back to Tests
                        </Link>
                        <Link
                            href={`/tests/reading/${test.id}?retake=true`}
                            className="px-6 py-3 rounded-xl bg-white text-blue-600 font-medium border border-blue-200 hover:bg-blue-50 transition-colors shadow"
                        >
                            Retake Test
                        </Link>
                        <Link
                            href={`/tests/reading/answer-key/${test.id}`}
                            className="px-6 py-3 rounded-xl bg-white text-emerald-600 font-medium border border-emerald-200 hover:bg-emerald-50 transition-colors shadow"
                        >
                            View Answer Key
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
        )
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden font-sans text-slate-800">
            {/* Unified Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm relative">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-sm">R</span>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="font-bold text-lg text-slate-800 leading-tight">
                            {test.title}
                        </h1>
                        <span className="text-xs text-slate-500 font-medium tracking-wide uppercase">Reading Module</span>
                    </div>
                </div>

                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className={`px-6 py-1.5 rounded-full font-mono text-xl font-bold tracking-widest tabular-nums transition-all border ${timeLeft < 300 ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-slate-50 text-slate-700 border-slate-200 shadow-inner'}`}>
                        {formatTime(timeLeft)}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Candidate</div>
                        <div className="font-bold text-slate-700">{user?.name || 'Guest Candidate'}</div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-sm hover:shadow-emerald-200"
                    >
                        Submit Test
                    </button>
                    <AIChatBot />
                </div>
            </header>

            {/* Test Content */}
            <div className="flex-1 overflow-hidden relative">
                <ReadingTestRenderer
                    test={test}
                    initialAnswers={answers}
                    onAnswersChange={setAnswers}
                    onSubmit={handleSubmit}
                />
            </div>
        </div>
    );
}
