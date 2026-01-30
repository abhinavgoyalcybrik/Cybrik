'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft,
    CheckCircle,
    BookOpen,
    ArrowLeft,
    ChevronRight,
    XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Updated import for username

interface OptionItem {
    key: string;
    text: string;
}

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
    image?: string;
    highlights?: any[]; // Added for answer key highlighting
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

// Reuse the highlight renderer from previous version
function renderHighlightedText(text: string, withHighlights: Array<{ start: number, end: number, questionNumber: number, answer: string }>) {
    if (!withHighlights || !withHighlights.length) {
        // Just return paragraphs if no highlights
        return (
            <div className="text-slate-700 leading-relaxed text-justify font-serif text-[15px]">
                {text.split('\n').map((para, idx) => {
                    const trimmed = para.trim();
                    if (!trimmed) return <div key={idx} className="h-4" />;
                    const isHeading = trimmed.length < 80 && !trimmed.endsWith('.') && !trimmed.endsWith(',') && !trimmed.endsWith(';');
                    if (isHeading) {
                        return <h3 key={idx} className="font-sans font-bold text-slate-800 text-sm mt-5 mb-2">{trimmed}</h3>;
                    }
                    return <p key={idx} className="mb-3 indent-8">{trimmed}</p>;
                })}
            </div>
        );
    }

    // 1. Sort highlights by start index
    const sortedHighlights = [...withHighlights].sort((a, b) => a.start - b.start);

    // 2. Filter out invalid/overlaps
    const validHighlights: typeof sortedHighlights = [];
    let lastEnd = -1;
    sortedHighlights.forEach(h => {
        if (h.start >= lastEnd) {
            validHighlights.push(h);
            lastEnd = h.end;
        } else if (h.start > lastEnd) {
            validHighlights.push(h);
            lastEnd = h.end;
        }
    });

    const parts = [];
    let lastIndex = 0;

    validHighlights.forEach((highlight, i) => {
        const start = Math.max(0, Math.min(highlight.start, text.length));
        const end = Math.max(start, Math.min(highlight.end, text.length));

        // Add text before highlight, respecting newlines
        if (lastIndex < start) {
            const segment = text.slice(lastIndex, start);
            parts.push(<span key={`text-${i}`} className="whitespace-pre-line">{segment}</span>);
        }

        // Add highlighted text
        parts.push(
            <mark
                key={`highlight-${i}`}
                className="bg-yellow-200 text-slate-900 px-1 rounded font-medium relative group cursor-help mx-0.5"
                title={`Q${highlight.questionNumber}: ${highlight.answer}`}
            >
                {text.slice(start, end)}
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                    Q{highlight.questionNumber}
                </span>
            </mark>
        );

        lastIndex = end;
    });

    // Add remaining text with newline support
    if (lastIndex < text.length) {
        parts.push(<span key="text-end" className="whitespace-pre-line">{text.slice(lastIndex)}</span>);
    }

    // Wrap in typographical container with proper line handling
    return (
        <div className="text-slate-700 leading-relaxed text-justify font-serif text-[15px] whitespace-pre-line">
            {parts}
        </div>
    );
}

export default function AnswerKeyPage({ params }: PageProps) {
    const { testId } = use(params);
    const router = useRouter();
    const { user } = useAuth(); // Get user for logic if needed, user name display handled in layout usually but here requested inline

    const [test, setTest] = useState<ReadingTest | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentPartIndex, setCurrentPartIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

    const passagePanelRef = React.useRef<HTMLDivElement>(null);
    const questionsPanelRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (passagePanelRef.current) passagePanelRef.current.scrollTop = 0;
        if (questionsPanelRef.current) questionsPanelRef.current.scrollTop = 0;
    }, [currentPartIndex]);

    useEffect(() => {
        const fetchTest = async () => {
            // Try local JSON first (consistent with test page)
            try {
                const localRes = await fetch('/data/reading_tests.json');
                const localData = await localRes.json();
                if (localData.tests && localData.tests.length > 0) {
                    const foundTest = localData.tests.find((t: any) =>
                        String(t.id) === String(testId) ||
                        String(t.test_id) === String(testId)
                    );
                    if (foundTest) {
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
                                    // Extract highlights for this passage
                                    const passageHighlights: any[] = [];
                                    passage.groups?.forEach((g: any) => {
                                        g.items?.forEach((item: any) => {
                                            const startIdx = item.answer.start_index;
                                            const endIdx = item.answer.end_index || item.answer.stop_index;
                                            if (startIdx !== undefined && endIdx !== undefined) {
                                                passageHighlights.push({
                                                    start: startIdx,
                                                    end: endIdx,
                                                    questionNumber: item.number,
                                                    answer: item.answer.value
                                                });
                                            }
                                        });
                                    });

                                    return passage.groups?.map((group: any, gIdx: number) => ({
                                        id: group.group_id || `${passage.passage_id}-G${gIdx + 1}`,
                                        title: passage.title || `Passage ${pIdx + 1}`,
                                        instructions: group.instructions || '',
                                        group_type: group.type?.toLowerCase() || 'text_input',
                                        content: passage.text || '',
                                        container: group.container,
                                        options: group.options || [],
                                        order: gIdx + 1,
                                        image: group.image,
                                        highlights: passageHighlights, // Attach to group (will be same for all groups in passage)
                                        questions: group.items?.map((item: any) => ({
                                            id: item.item_id,
                                            question_text: item.prompt || '',
                                            question_type: group.type,
                                            options: (item.options || group.options || ['TRUE', 'FALSE', 'NOT GIVEN']).map((o: any) => {
                                                if (typeof o === 'string') return { key: o, text: o };
                                                return { key: o.key || o.text, text: o.text || o.key };
                                            }),
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
                console.log('Local JSON load failed');
            }
            setLoading(false);
        };

        if (testId) fetchTest();
    }, [testId]);

    // Fetch user's submitted answers for this test
    useEffect(() => {
        const fetchUserAnswers = async () => {
            try {
                const res = await fetch('/api/ielts/sessions/', { credentials: 'include' });
                if (res.ok) {
                    const sessions = await res.json();
                    // Find the session matching this test (reading module)
                    const matchingSession = sessions.find((s: any) =>
                        s.module_type === 'reading' && String(s.test_id) === String(testId)
                    );
                    if (matchingSession?.answers) {
                        setUserAnswers(matchingSession.answers);
                    }
                }
            } catch (e) {
                console.log('Failed to load user answers:', e);
            }
        };
        if (testId) fetchUserAnswers();
    }, [testId]);

    const getReadingModule = () => test?.modules.find(m => m.module_type === 'reading');

    const getParts = () => {
        const module = getReadingModule();
        if (!module) return [];
        const passageMap = new Map<string, QuestionGroup[]>();
        module.question_groups.forEach(group => {
            const title = group.title;
            if (!passageMap.has(title)) passageMap.set(title, []);
            passageMap.get(title)!.push(group);
        });
        return Array.from(passageMap.entries()).map(([title, groups]) => ({
            title,
            groups,
            content: groups[0]?.content || '',
            highlights: groups[0]?.highlights || []
        }));
    };

    const parts = getParts();
    const currentPart = parts[currentPartIndex];
    const currentHighlights = currentPart?.highlights || [];

    const getQuestionBySlotId = (slotId: string, questions: Question[]): Question | undefined => {
        return questions.find(q => {
            const match = slotId.match(/Q(\d+)$/);
            return match ? q.order === parseInt(match[1]) : false;
        });
    };

    // Component Renders
    const safeRender = (val: any) => {
        if (typeof val === 'object' && val !== null) return (val as any).text || (val as any).key || JSON.stringify(val);
        return val;
    };

    // Render word bank
    const renderWordBank = (options: OptionItem[]) => {
        if (!options || options.length === 0) return null;

        return (
            <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-slate-50">
                <h4 className="font-bold text-slate-900 text-center mb-3 text-[15px]">List of Words</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {options.map((opt, idx) => (
                        <span key={idx} className="text-slate-700 py-1 text-[15px]">
                            {safeRender(opt.text) || safeRender(opt.key)}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    // Render rich text container with inline filled answers
    const renderRichTextContainer = (container: Container, questions: Question[]) => {
        if (!container?.rich) return null;

        return (
            <div className="text-slate-800 text-[15px] leading-relaxed font-medium">
                {container.rich.map((element, idx) => {
                    if (element.t === 'text') {
                        const text = element.v || '';
                        return (
                            <span key={idx} className="whitespace-pre-line">
                                {text.split('\n').map((line, lineIdx) => (
                                    <span key={lineIdx}>
                                        {line}
                                        {lineIdx < text.split('\n').length - 1 && <br />}
                                    </span>
                                ))}
                            </span>
                        );
                    } else if (element.t === 'slot' && element.slot_id) {
                        const question = getQuestionBySlotId(element.slot_id, questions);
                        if (!question) return null;

                        const userAnswer = userAnswers[question.id] || '';
                        const correctAnswer = question.correct_answer || '';
                        const isUserCorrect = userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase();

                        return (
                            <span key={idx} className="inline-flex items-center mx-1 relative group cursor-help">
                                <span className="text-xs text-slate-400 mr-1 select-none">({question.order})</span>
                                {/* Show user's answer if they provided one */}
                                {userAnswer ? (
                                    <span className={`px-2 py-0.5 border-b-2 font-bold rounded-t mx-0.5 ${isUserCorrect ? 'bg-emerald-100 border-emerald-500 text-emerald-900' : 'bg-red-100 border-red-500 text-red-900'}`}>
                                        {userAnswer}
                                        {isUserCorrect ? (
                                            <CheckCircle className="w-3 h-3 ml-1 inline text-emerald-600" />
                                        ) : (
                                            <XCircle className="w-3 h-3 ml-1 inline text-red-600" />
                                        )}
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 bg-slate-100 border-b-2 border-slate-300 text-slate-400 font-bold rounded-t mx-0.5 italic">
                                        (no answer)
                                    </span>
                                )}
                                {/* Tooltip showing correct answer if user was wrong */}
                                {(!isUserCorrect || !userAnswer) && (
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-emerald-700 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">
                                        Correct: <b>{correctAnswer}</b>
                                    </span>
                                )}
                            </span>
                        );
                    }
                    return null;
                })}
            </div>
        );
    };

    const renderCellContent = (rich: RichTextElement[], questions: Question[]) => {
        return rich.map((element, idx) => {
            if (element.t === 'text') return <span key={idx}>{element.v}</span>;
            if (element.t === 'slot' && element.slot_id) {
                const question = getQuestionBySlotId(element.slot_id, questions);
                if (!question) return <span key={idx}>...</span>;
                return (
                    <span key={idx} className="inline-flex items-center mx-1">
                        <span className="text-[10px] text-gray-500 mr-1">({question.order})</span>
                        <span className="px-2 py-1 bg-emerald-100 border border-emerald-300 rounded text-emerald-800 font-bold text-[10px] min-w-[60px] text-center">
                            {question.correct_answer}
                        </span>
                    </span>
                );
            }
            return null;
        });
    };

    const renderQuestionGroupContent = (group: QuestionGroup) => {
        // 1. Summary/Sentence Completion (Rich Text)
        if ((group.group_type === 'summary_completion' || group.group_type === 'sentence_completion') && group.container?.rich) {
            return (
                <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm">

                    {renderRichTextContainer(group.container, group.questions)}
                    {renderWordBank(group.options)}
                </div>
            );
        }

        // 2. Boolean / Choice
        if (['true_false', 'yes_no', 'true_false_not_given', 'yes_no_not_given'].includes(group.group_type) || ['TRUE_FALSE_NOT_GIVEN', 'YES_NO_NOT_GIVEN'].includes(group.questions[0]?.question_type)) {
            return (
                <div className="space-y-4">
                    {group.questions.map((question) => {
                        const userAnswer = userAnswers[question.id]?.toUpperCase() || '';
                        const correctAnswer = question.correct_answer?.toUpperCase() || '';
                        const isUserCorrect = userAnswer === correctAnswer ||
                            (userAnswer === 'YES' && correctAnswer === 'TRUE') ||
                            (userAnswer === 'TRUE' && correctAnswer === 'YES') ||
                            (userAnswer === 'NO' && correctAnswer === 'FALSE') ||
                            (userAnswer === 'FALSE' && correctAnswer === 'NO');

                        return (
                            <div key={question.id} className={`mb-6 pl-2 border-l-4 ${isUserCorrect ? 'border-emerald-400' : userAnswer ? 'border-red-400' : 'border-slate-200'}`}>
                                <div className="flex gap-4">
                                    <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${isUserCorrect ? 'bg-emerald-100 text-emerald-700' : userAnswer ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {question.order}
                                    </span>
                                    <div className="flex-1">
                                        <p className="mb-3 font-medium text-slate-800 leading-relaxed" style={{fontSize: '18px'}}>{question.question_text}</p>
                                        <div className="flex gap-3 flex-wrap">
                                            {question.options.map((option, optIdx) => {
                                                let optKey = option.key;
                                                let optText = option.text;

                                                // Dynamic label fix
                                                const isYesNoGroup = group.group_type.includes('yes_no') || correctAnswer === 'YES' || correctAnswer === 'NO';
                                                if (isYesNoGroup) {
                                                    if (optKey === 'TRUE') { optKey = 'YES'; optText = 'YES'; }
                                                    if (optKey === 'FALSE') { optKey = 'NO'; optText = 'NO'; }
                                                }

                                                const k = optKey?.toUpperCase() || '';
                                                const isCorrectOption = correctAnswer === k ||
                                                    (correctAnswer === 'NOT GIVEN' && k === 'NOT GIVEN') ||
                                                    ((correctAnswer === 'YES' || correctAnswer === 'TRUE') && (k === 'YES' || k === 'TRUE')) ||
                                                    ((correctAnswer === 'NO' || correctAnswer === 'FALSE') && (k === 'NO' || k === 'FALSE'));

                                                const isUserChoice = userAnswer === k ||
                                                    ((userAnswer === 'YES' || userAnswer === 'TRUE') && (k === 'YES' || k === 'TRUE')) ||
                                                    ((userAnswer === 'NO' || userAnswer === 'FALSE') && (k === 'NO' || k === 'FALSE')) ||
                                                    (userAnswer === 'NOT GIVEN' && k === 'NOT GIVEN');

                                                const isWrongChoice = isUserChoice && !isCorrectOption;

                                                let bgClass = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                                                if (isCorrectOption) {
                                                    bgClass = 'bg-emerald-500 border-emerald-500 text-white shadow-md';
                                                } else if (isWrongChoice) {
                                                    bgClass = 'bg-red-500 border-red-500 text-white shadow-md';
                                                }

                                                return (
                                                    <div key={optIdx} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bgClass}`}>
                                                        <span className="text-[15px] font-bold">{optText}</span>
                                                        {isCorrectOption && <CheckCircle className="w-3 h-3 text-white" />}
                                                        {isWrongChoice && <XCircle className="w-3 h-3 text-white" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-2 flex gap-4 text-[15px] font-bold">
                                            <span className="text-emerald-600">Correct: {question.correct_answer}</span>
                                            {userAnswer && !isUserCorrect && (
                                                <span className="text-red-600">Your Answer: {userAnswers[question.id]}</span>
                                            )}
                                            {isUserCorrect && <span className="text-emerald-600">✓ You got it right!</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // 3. Multiple Choice & Matching Features
        if (group.group_type === 'multiple_choice' || group.group_type === 'matching_features' || group.questions[0]?.question_type === 'MULTIPLE_CHOICE') {
            const isChooseN = group.options && group.options.length > 0 && group.questions.some(q => !q.question_text || q.question_text.startsWith('Question') || group.group_type === 'matching_features');

            if (isChooseN) {
                // List selection style
                return (
                    <div className="space-y-6">
                        <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                            <h4 className="font-bold text-slate-700 text-center mb-4 text-[15px] uppercase tracking-wider">Options</h4>
                            {group.options.map((opt, idx) => (
                                <div key={idx} className="flex gap-3 text-[15px] mb-2">
                                    <span className="font-bold text-slate-900 w-5">{safeRender(opt.key)}</span>
                                    <span className="text-slate-600">{safeRender(opt.text)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            {group.questions.map((question) => (
                                <div key={question.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                                    <span className="font-bold text-slate-500 w-6">{question.order}</span>
                                    <div className="flex gap-2 flex-wrap">
                                        {group.options.map((opt) => {
                                            const isCorrect = question.correct_answer === opt.key;
                                            return (
                                                <div key={opt.key} className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 font-bold text-[8px] ${isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-100 text-slate-300'}`}>
                                                    {opt.key}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="ml-auto text-[15px] font-bold text-emerald-600">Ans: {question.correct_answer}</div>
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
                                <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded mb-2">Q{question.order}</span>
                                <p className="mb-4 font-medium text-slate-800" style={{fontSize: '18px'}}>{question.question_text}</p>
                                <div className="space-y-2">
                                    {question.options?.map((option, optIdx) => {
                                        const optKey = option.key;
                                        const optText = option.text;
                                        const isCorrect = question.correct_answer === String(optKey);

                                        return (
                                            <div key={optIdx} className={`flex items-start gap-3 p-3 rounded-xl border ${isCorrect ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-slate-100 opacity-50'}`}>
                                                <div className={`w-4 h-4 rounded-full border mt-1 flex-shrink-0 ${isCorrect ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`} />
                                                <div className={`text-[15px] ${isCorrect ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                                                    {optKey !== optText ? (
                                                        <span><span className="font-bold mr-2 text-slate-700">{optKey}</span>{optText}</span>
                                                    ) : (
                                                        <span>{optText}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            }
        }

        // 4. Table
        if (group.group_type === 'table_completion' && group.container?.kind === 'table') {
            return (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-400 text-[10px]">
                            <thead>
                                <tr className="bg-gray-100">
                                    {group.container.cols?.map((col, idx) => <th key={idx} className="border border-gray-400 px-3 py-2 font-bold">{col}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {group.container.rows?.map((row: any, rowIdx: number) => (
                                    <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        {row.cells.map((cell: any, cellIdx: number) => (
                                            <td key={cellIdx} className="border border-gray-400 px-3 py-2 text-center">
                                                {cell.rich && cell.rich.length > 0 ? renderCellContent(cell.rich, group.questions) : <span className="text-gray-400">—</span>}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        // 5. Default Text
        return (
            <div className="space-y-6">
                {group.questions.map((question) => (
                    <div key={question.id} className="flex gap-4 items-baseline bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <span className="font-bold text-slate-500 w-6 text-right">{question.order}</span>
                        <div className="flex-1">
                            <p className="text-slate-800 font-medium mb-3" style={{fontSize: '18px'}}>{question.question_text}</p>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={question.correct_answer}
                                    readOnly
                                    className="w-full max-w-sm h-10 px-4 border border-emerald-300 bg-emerald-50 rounded-lg text-sm font-bold text-emerald-900 focus:outline-none"
                                />
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 mr-3 pointer-events-none">
                                    <span className="text-emerald-600 text-xs font-bold bg-emerald-100 px-2 py-1 rounded">ANSWER</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (loading) return <div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;
    if (!test) return <div className="p-10 text-center">Test not found</div>;

    return (
        <div className="flex flex-col h-screen bg-slate-100 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shadow-sm z-30 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Result
                    </button>
                    <div className="h-6 w-px bg-slate-200 mx-2" />
                    <div className="flex items-center gap-2">
                        <div className="bg-emerald-500 rounded p-1"><BookOpen className="w-4 h-4 text-white" /></div>
                        <div className="flex flex-col">
                            <h1 className="font-bold text-lg text-slate-800 leading-tight">Answer Key: {test.title}</h1>
                            {user?.name ? (
                                <span className="text-xs text-slate-500">Welcome back, {user.name}</span>
                            ) : (
                                <span className="text-xs text-slate-500">Review Mode</span>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Part Nav */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-[0_2px_4px_rgba(0,0,0,0.02)] z-20 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-500 uppercase tracking-wider shadow-sm">
                        Passage {currentPartIndex + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-600">{currentPart?.title}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setCurrentPartIndex(Math.max(0, currentPartIndex - 1))}
                            disabled={currentPartIndex === 0}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            aria-label="Previous Passage"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <span className="text-xs font-bold text-slate-300 tracking-wider">
                            PASSAGE {currentPartIndex + 1} OF {parts.length}
                        </span>

                        <button
                            onClick={() => {
                                if (currentPartIndex < parts.length - 1) {
                                    setCurrentPartIndex(currentPartIndex + 1);
                                }
                            }}
                            disabled={currentPartIndex === parts.length - 1}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-bold rounded-lg shadow-sm transition-all"
                        >
                            Next Passage
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Split View */}
            <div className="flex-1 flex overflow-hidden bg-slate-50/50">
                {/* Left: Passage */}
                <div className="w-1/2 flex flex-col border-r border-slate-200 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
                    <div ref={passagePanelRef} className="flex-1 overflow-y-auto px-8 py-8 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
                        <div className="max-w-4xl mx-auto">
                            <h2 className="font-bold text-slate-900 text-xl mb-5 border-b-2 border-emerald-500 inline-block pb-2">{currentPart?.title}</h2>
                            {renderHighlightedText(currentPart?.content, currentHighlights)}
                        </div>
                    </div>
                </div>

                {/* Right: Answer Key */}
                <div className="w-1/2 flex flex-col bg-slate-50/50">
                    <div ref={questionsPanelRef} className="flex-1 overflow-y-auto px-8 py-8 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
                        <div className="max-w-4xl mx-auto pb-20">
                            {currentPart?.groups.map((group, gIdx) => (
                                <div key={group.id} className="mb-12">
                                    <div className="mb-6">
                                        <div className="flex items-baseline justify-between border-b border-slate-200 pb-2 mb-4">
                                            <h3 className="text-base font-bold text-slate-900">
                                                Questions {group.questions[0]?.order}–{group.questions[group.questions.length - 1]?.order}
                                            </h3>
                                        </div>
                                        {group.instructions && (
                                            <div className="mb-6 p-5 bg-blue-50/50 rounded-xl border border-blue-100/50 text-blue-900">
                                                {group.instructions.split('\n').map((line, idx) => (
                                                    <p key={idx} className="text-[15px] font-semibold leading-relaxed mb-1 whitespace-pre-line">
                                                        {line}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                        {group.image && (
                                            <div className="mb-8 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                <img src={group.image} alt="Question Diagram" className="max-w-full h-auto rounded-lg mx-auto" />
                                            </div>
                                        )}
                                    </div>
                                    {renderQuestionGroupContent(group)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
