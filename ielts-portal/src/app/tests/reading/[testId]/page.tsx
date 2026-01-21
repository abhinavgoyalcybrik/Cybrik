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
    AlertCircle,
    Target,
    Lightbulb,
    BookOpen,
} from 'lucide-react';
import { evaluateReading, ReadingEvaluationResult } from '@/services/evaluatorApi';

interface Question {
    id: string;
    question_text: string;
    question_type: string;
    options: string[];
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
    const [test, setTest] = useState<ReadingTest | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPartIndex, setCurrentPartIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState(60 * 60);
    const [testCompleted, setTestCompleted] = useState(false);
    const [score, setScore] = useState(0);

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
                                        options: item.options?.map((o: any) => o.text || o.key || o) || group.options?.map((o: any) => o.text || o.key) || ['TRUE', 'FALSE', 'NOT GIVEN'],
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
            setTest(data);
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

    const getCurrentPart = () => {
        const parts = getParts();
        return parts[currentPartIndex];
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

    const getPartAnsweredCount = (partIndex: number) => {
        const parts = getParts();
        const part = parts[partIndex];
        if (!part) return 0;
        let count = 0;
        part.groups.forEach(group => {
            group.questions.forEach(q => {
                if (answers[q.id]) count++;
            });
        });
        return count;
    };

    // Get question by slot_id
    const getQuestionBySlotId = (slotId: string, questions: Question[]): Question | undefined => {
        return questions.find(q => {
            // Match by item_id format like P1-G1-Q1
            const match = slotId.match(/Q(\d+)$/);
            if (match) {
                return q.order === parseInt(match[1]);
            }
            return false;
        });
    };

    // Render rich text container with inline inputs
    const renderRichTextContainer = (container: Container, questions: Question[]) => {
        if (!container?.rich) return null;

        return (
            <div className="text-gray-800 text-lg leading-loose font-medium">
                {container.rich.map((element, idx) => {
                    if (element.t === 'text') {
                        // Render text inline - replace newlines with spaces for flow
                        const text = element.v?.replace(/\n+/g, ' ') || '';
                        return <span key={idx}>{text}</span>;
                    } else if (element.t === 'slot' && element.slot_id) {
                        const question = getQuestionBySlotId(element.slot_id, questions);
                        if (!question) return null;

                        return (
                            <span key={idx} className="inline-flex items-baseline mx-1">
                                <span className="text-xs text-gray-500 mr-1">({question.order})</span>
                                <input
                                    type="text"
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    className="w-28 h-7 px-2 border-b-2 border-gray-400 bg-transparent text-center font-medium text-[#0B1F3A] focus:outline-none focus:border-[#6FB63A]"
                                />
                            </span>
                        );
                    }
                    return null;
                })}
            </div>
        );
    };

    // Safe render helper
    const safeRender = (val: any) => {
        if (typeof val === 'object' && val !== null) {
            return (val as any).text || (val as any).key || JSON.stringify(val);
        }
        return val;
    };

    // Render word bank
    const renderWordBank = (options: OptionItem[]) => {
        if (!options || options.length === 0) return null;

        return (
            <div className="mt-6 border border-gray-300 rounded-lg p-4 bg-gray-50">
                <h4 className="font-bold text-gray-900 text-center mb-3">List of Words</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {options.map((opt, idx) => (
                        <span key={idx} className="text-gray-700 py-1">
                            {safeRender(opt.text) || safeRender(opt.key)}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    // Render table cell content with inline inputs
    const renderCellContent = (rich: RichTextElement[], questions: Question[]) => {
        return rich.map((element, idx) => {
            if (element.t === 'text') {
                return <span key={idx}>{element.v}</span>;
            } else if (element.t === 'slot' && element.slot_id) {
                const question = getQuestionBySlotId(element.slot_id, questions);
                if (!question) return <span key={idx}>...</span>;

                return (
                    <span key={idx} className="inline-flex items-center">
                        <span className="text-gray-400 mr-1">...</span>
                        <span className="relative inline-block">
                            <input
                                type="text"
                                value={answers[question.id] || ''}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                className="w-24 h-7 px-1 border-b-2 border-gray-400 bg-white text-center text-sm font-medium text-[#0B1F3A] focus:outline-none focus:border-[#6FB63A]"
                                placeholder={`(${question.order})`}
                            />
                        </span>
                        <span className="text-gray-400 ml-1">...</span>
                    </span>
                );
            }
            return null;
        });
    };

    // Render table container for table completion questions
    const renderTableContainer = (container: Container, questions: Question[]) => {
        if (container?.kind !== 'table' || !container.cols || !container.rows) return null;

        return (
            <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-400 text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            {container.cols.map((col, idx) => (
                                <th key={idx} className="border border-gray-400 px-3 py-2 font-bold text-gray-800 text-center">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {container.rows.map((row: any, rowIdx: number) => (
                            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {row.cells.map((cell: any, cellIdx: number) => (
                                    <td key={cellIdx} className="border border-gray-400 px-3 py-2 text-gray-700 text-center">
                                        {cell.rich && cell.rich.length > 0 ? (
                                            renderCellContent(cell.rich, questions)
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };


    const renderQuestionGroupContent = (group: QuestionGroup) => {
        // 1. TRUE/FALSE/NOT GIVEN or YES/NO/NOT GIVEN
        if (group.group_type === 'true_false' || group.group_type === 'yes_no' || group.group_type === 'true_false_not_given' || group.group_type === 'yes_no_not_given') {
            return (
                <div className="space-y-4">
                    {group.questions.map((question) => (
                        <div key={question.id} className="mb-6 pl-2">
                            <div className="flex gap-4">
                                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold text-sm">
                                    {question.order}
                                </span>
                                <div className="flex-1">
                                    <p className="mb-3 text-lg font-medium text-slate-800 leading-relaxed">
                                        {question.question_text}
                                    </p>
                                    <div className="flex gap-4">
                                        {question.options.map((option, optIdx) => (
                                            <label key={optIdx} className="flex items-center gap-2 cursor-pointer group">
                                                <div className="relative flex items-center">
                                                    <input
                                                        type="radio"
                                                        name={question.id}
                                                        value={option}
                                                        checked={answers[question.id] === option}
                                                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                        className="peer h-4 w-4 appearance-none rounded-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 checked:border-emerald-500 checked:bg-emerald-500 hover:border-emerald-500 transition-all"
                                                    />
                                                </div>
                                                <span className={`text-sm font-medium transition-colors ${answers[question.id] === option ? 'text-emerald-700' : 'text-slate-600 group-hover:text-slate-800'}`}>
                                                    {option}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // 2. Multiple Choice
        if (group.group_type === 'multiple_choice') {
            const isChooseN = group.options && group.options.length > 0 && group.questions.some(q => !q.question_text || q.question_text.startsWith('Question'));

            if (isChooseN) {
                return (
                    <div className="space-y-6">
                        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                            <h4 className="font-bold text-slate-700 text-center mb-4 text-xs uppercase tracking-wider">
                                {group.instructions.includes('factors') ? 'List of Factors' :
                                    group.instructions.includes('statements') ? 'List of Statements' :
                                        'Options'}
                            </h4>
                            <div className="space-y-3">
                                {group.options.map((opt, idx) => (
                                    <div key={idx} className="flex gap-3 text-sm">
                                        <span className="font-bold text-slate-900 w-5">{safeRender(opt.key)}</span>
                                        <span className="text-slate-600 leading-relaxed">{safeRender(opt.text)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            {group.questions.map((question) => (
                                <div key={question.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-colors">
                                    <span className="font-bold text-slate-500 w-6">{question.order}</span>
                                    <div className="flex gap-2 flex-wrap">
                                        {group.options.map((opt) => (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    handleAnswerChange(question.id, opt.key);
                                                }}
                                                className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 font-bold transition-all ${answers[question.id] === opt.key
                                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200'
                                                    : 'border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'
                                                    }`}
                                            >
                                                {opt.key}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            } else {
                return (
                    <div className="space-y-8">
                        {group.questions.map((question) => (
                            <div key={question.id} className="pl-2">
                                <div className="flex gap-4">
                                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold text-sm">
                                        {question.order}
                                    </span>
                                    <div className="flex-1">
                                        <p className="mb-4 text-lg font-medium text-slate-800 leading-relaxed">
                                            {question.question_text}
                                        </p>
                                        <div className="space-y-3">
                                            {question.options && question.options.map((option, optIdx) => {
                                                const isObject = typeof option === 'object' && option !== null;
                                                const optKey = isObject ? (option as any).key : option;
                                                const optText = isObject ? (option as any).text : option;
                                                const isSelected = answers[question.id] === String(optKey);

                                                return (
                                                    <label key={optIdx} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isSelected
                                                        ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                                                        : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}>
                                                        <div className="relative flex items-center mt-1">
                                                            <input
                                                                type="radio"
                                                                name={question.id}
                                                                value={String(optKey)}
                                                                checked={isSelected}
                                                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                                className="peer h-4 w-4 appearance-none rounded-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 checked:border-emerald-500 checked:bg-emerald-500 transition-all"
                                                            />
                                                        </div>
                                                        <div className={`text-base leading-relaxed ${isSelected ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                                                            {isObject ? (
                                                                <span className="flex gap-2">
                                                                    <span className="font-bold min-w-[20px]">{optKey}</span>
                                                                    <span>{optText}</span>
                                                                </span>
                                                            ) : (
                                                                <span>{optText}</span>
                                                            )}
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            }
        }

        // 3. Table Completion
        if (group.group_type === 'table_completion' && group.container?.kind === 'table') {
            return (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden">
                    {renderTableContainer(group.container, group.questions)}
                </div>
            );
        }

        // 4. Default: Text Input
        return (
            <div className="space-y-6">
                {group.questions.map((question) => (
                    <div key={question.id} className="flex gap-4 items-baseline bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <span className="font-bold text-slate-500 w-6 text-right">{question.order}</span>
                        <div className="flex-1">
                            <p className="text-slate-800 font-medium mb-3">{question.question_text}</p>
                            <input
                                type="text"
                                value={answers[question.id] || ''}
                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                placeholder="Answer..."
                                className="w-full max-w-sm h-10 px-4 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            />
                        </div>
                    </div>
                ))}
            </div>
        );
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

    const currentPart = getCurrentPart();
    const parts = getParts();
    const totalQuestions = parts.reduce((acc, p) => acc + p.questionsCount, 0);

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
                    {/* Header */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800">Reading Test Results</h1>
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
                                    <span className="text-2xl font-bold text-emerald-600">{score} / {totalQuestions}</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${(score / totalQuestions) * 100}%` }}
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

                    {/* Improvement Suggestions - Enhanced UI */}
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
                    <div className="flex gap-3 justify-center mb-10">
                        <Link
                            href="/tests/reading"
                            className="px-6 py-3 rounded-xl bg-white text-slate-600 font-medium hover:bg-slate-50 transition-colors shadow"
                        >
                            Back to Tests
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
        );
    }

    const getQuestionRange = (partIndex: number) => {
        const parts = getParts();
        let start = 1;
        for (let i = 0; i < partIndex; i++) {
            start += parts[i].questionsCount;
        }
        return { start, end: start + parts[partIndex].questionsCount - 1 };
    };

    const currentRange = getQuestionRange(currentPartIndex);

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden font-sans text-slate-800">
            {/* Unified Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm relative">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-sm">R</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-800 font-bold leading-none">IELTS Reading</span>
                        <span className="text-slate-500 text-xs mt-0.5">Test #{testId}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border content-center ${timeLeft < 300
                        ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                        : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        <Clock className="w-4 h-4" />
                        <span className="font-mono text-base font-bold">{formatTime(timeLeft)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Menu className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Part Navigation Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-[0_2px_4px_rgba(0,0,0,0.02)] z-20">
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-500 uppercase tracking-wider shadow-sm">
                        Part {currentPartIndex + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-600">
                        Read the text and answer questions <span className="text-slate-900 font-bold">{currentRange.start}–{currentRange.end}</span>
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {parts.map((p, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentPartIndex(idx)}
                            className={`h-2 w-12 rounded-full transition-all ${currentPartIndex === idx ? 'bg-emerald-500' : 'bg-slate-200 hover:bg-slate-300'
                                }`}
                        />
                    ))}
                </div>
            </div>





            {/* Main Content - Two Columns */}
            <div className="flex-1 flex overflow-hidden bg-slate-50/50">
                {/* Left Column: Passage Text - Enhanced Typography */}
                <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
                    <div ref={passagePanelRef} className="flex-1 overflow-y-auto px-8 py-8 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
                        <div className="max-w-2xl mx-auto">
                            <h2 className="font-bold text-slate-900 text-3xl mb-8 leading-tight tracking-tight border-b-2 border-emerald-500 inline-block pb-2">
                                {currentPart?.title}
                            </h2>
                            <div className="text-slate-700 leading-loose text-justify font-serif text-lg">
                                {currentPart?.content?.split('\n').map((para, idx) => {
                                    const trimmed = para.trim();
                                    if (!trimmed) return null;
                                    // Heuristic: Short lines without end punctuation might be headings
                                    const isHeading = trimmed.length < 80 && !trimmed.endsWith('.') && !trimmed.endsWith(',') && !trimmed.endsWith(';');

                                    if (isHeading) {
                                        return (
                                            <h3 key={idx} className="font-sans font-bold text-slate-800 text-xl mt-8 mb-4">
                                                {trimmed}
                                            </h3>
                                        );
                                    }

                                    return (
                                        <p key={idx} className="mb-6 indent-8">
                                            {trimmed}
                                        </p>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resizer Bar Enhancement */}
                <div className="w-1 bg-slate-100 hover:bg-emerald-400 cursor-col-resize flex-shrink-0 transition-colors" />

                {/* Right Column: Questions - Modern Cards */}
                <div className="w-1/2 flex flex-col bg-slate-50/50">
                    <div ref={questionsPanelRef} className="flex-1 overflow-y-auto px-8 py-8 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
                        <div className="max-w-2xl mx-auto pb-20">
                            {currentPart?.groups.map((group, gIdx) => (
                                <div key={group.id} className="mb-12">
                                    {/* Instructions Section */}
                                    <div className="mb-8">
                                        <div className="flex items-baseline justify-between border-b border-slate-200 pb-2 mb-4">
                                            <h3 className="text-lg font-bold text-slate-900">
                                                Questions {group.questions[0]?.order}–{group.questions[group.questions.length - 1]?.order}
                                            </h3>
                                        </div>

                                        {group.instructions && (
                                            <div className="mb-6 p-5 bg-blue-50/50 rounded-xl border border-blue-100/50 text-blue-900">
                                                <p className="text-base font-semibold whitespace-pre-wrap leading-relaxed">
                                                    {group.instructions}
                                                </p>
                                            </div>
                                        )}
                                        {/* Display image if present (for diagram/flowchart questions) */}
                                        {group.image && (
                                            <div className="mb-8 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                                <img
                                                    src={group.image}
                                                    alt={`Question ${group.questions[0]?.order}-${group.questions[group.questions.length - 1]?.order} Diagram`}
                                                    className="max-w-full h-auto mx-auto rounded-lg"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Render based on group type */}
                                    {(group.group_type === 'summary_completion' || group.group_type === 'sentence_completion') && group.container?.rich ? (
                                        // Summary/Sentence Completion with inline blanks
                                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                            {/* Example box */}
                                            {group.container.rich[0]?.v?.includes('EARLY') && (
                                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-sm text-slate-600">
                                                    <span className="font-bold text-slate-800">Example:</span> Primitive societies saw fire as a ... <span className="italic text-slate-400 mx-1">(Example)</span> ... gift. <span className="font-bold text-slate-800 ml-2">Answer:</span> <span className="font-mono text-emerald-600">heavenly</span>
                                                </div>
                                            )}
                                            {renderRichTextContainer(group.container, group.questions)}
                                            {renderWordBank(group.options)}
                                        </div>
                                    ) : (group.group_type === 'true_false_ng' || group.group_type === 'yes_no_ng') ? (
                                        // TRUE/FALSE/NOT GIVEN or YES/NO/NOT GIVEN
                                        <div className="space-y-4">
                                            {group.questions.map((question) => (
                                                <div key={question.id} className="pl-2">
                                                    <div className="flex gap-4">
                                                        <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold text-sm">
                                                            {question.order}
                                                        </span>
                                                        <div className="flex-1">
                                                            <p className="mb-3 text-lg font-medium text-slate-800 leading-relaxed">
                                                                {question.question_text}
                                                            </p>
                                                            <div className="flex gap-3">
                                                                {question.options.map((option, optIdx) => (
                                                                    <label key={optIdx} className="flex items-center gap-2 cursor-pointer group">
                                                                        <div className="relative flex items-center">
                                                                            <input
                                                                                type="radio"
                                                                                name={question.id}
                                                                                value={option}
                                                                                checked={answers[question.id] === option}
                                                                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                                                className="peer h-4 w-4 appearance-none rounded-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 checked:border-emerald-500 checked:bg-emerald-500 hover:border-emerald-500 transition-all"
                                                                            />
                                                                        </div>
                                                                        <span className={`text-sm font-medium transition-colors ${answers[question.id] === option ? 'text-emerald-700' : 'text-slate-600 group-hover:text-slate-800'}`}>
                                                                            {option}
                                                                        </span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (group.group_type === 'matching_features' || group.group_type === 'matching_headings') ? (
                                        // Matching questions
                                        <div className="space-y-6">
                                            {/* Options list */}
                                            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
                                                <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3">Options</h4>
                                                <div className="grid grid-cols-1 gap-2 text-sm">
                                                    {group.options.map((opt, idx) => {
                                                        const optText = typeof opt.text === 'object' ? (opt.text as any).text || JSON.stringify(opt.text) : opt.text;
                                                        const optKey = typeof opt.key === 'object' ? (opt.key as any).key || JSON.stringify(opt.key) : opt.key;
                                                        return (
                                                            <div key={idx} className="text-slate-700 flex gap-3">
                                                                <span className="font-bold text-slate-900 min-w-[20px]">{optKey}</span>
                                                                <span className="text-slate-600 italic">{optText}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            {/* Questions */}
                                            {group.questions.map((question) => (
                                                <div key={question.id} className="flex gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-colors">
                                                    <span className="font-bold text-slate-500 w-8 text-right">{question.order}</span>
                                                    <div className="flex-1">
                                                        <p className="text-slate-800 font-medium mb-2">{question.question_text}</p>
                                                        <div className="relative w-32">
                                                            <select
                                                                value={answers[question.id] || ''}
                                                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                                className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 appearance-none cursor-pointer"
                                                            >
                                                                <option value="">Select</option>
                                                                {group.options.map((opt) => (
                                                                    <option key={opt.key} value={opt.key}>{opt.key}</option>
                                                                ))}
                                                            </select>
                                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : renderQuestionGroupContent(group)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Controls */}
            <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40">
                <button
                    onClick={() => setCurrentPartIndex(Math.max(0, currentPartIndex - 1))}
                    disabled={currentPartIndex === 0}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Previous Passage
                </button>

                <button
                    onClick={() => {
                        if (currentPartIndex < parts.length - 1) {
                            setCurrentPartIndex(currentPartIndex + 1);
                        } else {
                            handleSubmit();
                        }
                    }}
                    className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${currentPartIndex < parts.length - 1
                        ? 'bg-slate-800 hover:bg-slate-700 shadow-slate-200'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200'
                        }`}
                >
                    {currentPartIndex < parts.length - 1 ? 'Next Passage' : 'Submit Test'}
                    {currentPartIndex < parts.length - 1 ? <ChevronRight className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
}
