'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Check,
    CheckCircle,
    XCircle,
    Maximize2,
    Minimize2
} from 'lucide-react';

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

interface ReadingTestRendererProps {
    test: ReadingTest;
    initialAnswers?: Record<string, string>;
    onAnswersChange?: (answers: Record<string, string>) => void;
    onSubmit?: (answers: Record<string, string>) => void;
    previewMode?: boolean;
}

export default function ReadingTestRenderer({
    test,
    initialAnswers = {},
    onAnswersChange,
    onSubmit,
    previewMode = false
}: ReadingTestRendererProps) {
    const [currentPartIndex, setCurrentPartIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const passagePanelRef = useRef<HTMLDivElement>(null);
    const questionsPanelRef = useRef<HTMLDivElement>(null);

    // Update parent when answers change
    useEffect(() => {
        if (onAnswersChange) {
            onAnswersChange(answers);
        }
    }, [answers, onAnswersChange]);

    // Reset scroll when changing passage
    useEffect(() => {
        if (passagePanelRef.current) passagePanelRef.current.scrollTop = 0;
        if (questionsPanelRef.current) questionsPanelRef.current.scrollTop = 0;
    }, [currentPartIndex]);

    const getReadingModule = () => test.modules.find(m => m.module_type === 'reading');

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
            questionsCount: groups.reduce((acc, g) => acc + g.questions.length, 0)
        }));
    };

    const parts = getParts();
    const currentPart = parts[currentPartIndex];

    const handleAnswerChange = (questionId: string, value: string) => {
        if (previewMode && !onAnswersChange) return; // Allow interactive preview only if tracked or local state updates
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const getQuestionBySlotId = (slotId: string, questions: Question[]): Question | undefined => {
        return questions.find(q => {
            const match = slotId.match(/Q(\d+)$/);
            return match ? q.order === parseInt(match[1]) : false;
        });
    };

    // --- Render Helpers ---

    const safeRender = (val: any) => {
        if (typeof val === 'object' && val !== null) return (val as any).text || (val as any).key || JSON.stringify(val);
        return val;
    };

    const renderWordBank = (options: OptionItem[]) => {
        if (!options || options.length === 0) return null;
        return (
            <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-slate-50">
                <h4 className="font-bold text-slate-900 text-center mb-3">List of Words</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {options.map((opt, idx) => (
                        <div key={idx} className="flex flex-col">
                            <span className="text-xs font-bold text-slate-400 mb-1">{safeRender(opt.key)}</span>
                            <span className="text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded px-2 py-1">
                                {safeRender(opt.text)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderRichTextContainer = (container: Container, questions: Question[]) => {
        if (!container?.rich) return null;

        return (
            <div className="text-slate-800 text-[13px] leading-relaxed font-medium">
                {container.rich.map((element, idx) => {
                    if (element.t === 'text') {
                        const text = element.v?.replace(/\n+/g, ' ') || '';
                        return <span key={idx}>{text}</span>;
                    } else if (element.t === 'slot' && element.slot_id) {
                        const question = getQuestionBySlotId(element.slot_id!, questions);
                        if (!question) return null;

                        return (
                            <span key={idx} className="inline-flex items-center mx-1 relative">
                                <span className="absolute -top-3 left-0 text-[10px] font-bold text-slate-400 bg-slate-50 px-1 rounded border border-slate-100">
                                    {question.order}
                                </span>
                                <input
                                    type="text"
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    className="h-8 min-w-[120px] px-2 text-sm border-b-2 border-slate-300 bg-slate-50 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all text-center font-bold text-emerald-700"
                                    placeholder="..."
                                />
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
                    <div key={idx} className="inline-flex flex-col items-center min-w-[80px]">
                        <span className="text-[10px] text-slate-400 font-bold mb-1">Q{question.order}</span>
                        <input
                            type="text"
                            value={answers[question.id] || ''}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            className="w-full h-8 px-2 text-sm border border-slate-200 rounded focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none text-center font-medium"
                        />
                    </div>
                );
            }
            return null;
        });
    };

    const renderQuestionGroupContent = (group: QuestionGroup) => {
        // 1. Summary/Sentence Completion (Rich Text)
        if ((group.group_type === 'summary_completion' || group.group_type === 'sentence_completion') && group.container?.rich) {
            return (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    {group.container.rich[0]?.v?.includes('EARLY') && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-sm text-slate-600">
                            <span className="font-bold text-slate-800">Example:</span> Primitive societies saw fire as a ... <span className="italic text-slate-400 mx-1">(Example)</span> ... gift. <span className="font-bold text-slate-800 ml-2">Answer:</span> <span className="font-mono text-emerald-600">heavenly</span>
                        </div>
                    )}
                    {renderRichTextContainer(group.container, group.questions)}
                    {renderWordBank(group.options)}
                </div>
            );
        }

        // 2. Boolean / Choice
        if (['true_false', 'yes_no', 'true_false_not_given', 'yes_no_not_given'].includes(group.group_type) || ['TRUE_FALSE_NOT_GIVEN', 'YES_NO_NOT_GIVEN'].includes(group.questions[0]?.question_type)) {
            return (
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
                                                        value={safeRender(option.key)}
                                                        checked={answers[question.id] === safeRender(option.key)}
                                                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                        className="peer h-4 w-4 appearance-none rounded-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 checked:border-emerald-500 checked:bg-emerald-500 hover:border-emerald-500 transition-all"
                                                    />
                                                </div>
                                                <span className={`text-sm font-medium transition-colors ${answers[question.id] === safeRender(option.key) ? 'text-emerald-700' : 'text-slate-600 group-hover:text-slate-800'}`}>
                                                    {safeRender(option.text)}
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

        // 3. Multiple Choice & Matching Features
        if (group.group_type === 'multiple_choice' || group.group_type === 'matching_features' || group.questions[0]?.question_type === 'MULTIPLE_CHOICE') {
            const isChooseN = group.options && group.options.length > 0 && group.questions.some(q => !q.question_text || q.question_text.startsWith('Question') || group.group_type === 'matching_features');

            if (isChooseN) {
                // List selection style
                return (
                    <div className="space-y-6">
                        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
                            <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3">Options</h4>
                            <div className="grid grid-cols-1 gap-2 text-sm">
                                {group.options.map((opt, idx) => (
                                    <div key={idx} className="text-slate-700 flex gap-3">
                                        <span className="font-bold text-slate-900 min-w-[20px]">{safeRender(opt.key)}</span>
                                        <span className="text-slate-600 italic">{safeRender(opt.text)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
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
                                                    <option key={safeRender(opt.key)} value={safeRender(opt.key)}>{safeRender(opt.key)}</option>
                                                ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                                <ChevronRight className="w-4 h-4 rotate-90" />
                                            </div>
                                        </div>
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
                                <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded mb-2">Q{question.order}</span>
                                <p className="mb-4 text-sm font-medium text-slate-800">{question.question_text}</p>
                                <div className="space-y-2">
                                    {question.options?.map((option, optIdx) => (
                                        <label key={optIdx} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 cursor-pointer transition-all group">
                                            <div className="relative flex items-center mt-1">
                                                <input
                                                    type="radio"
                                                    name={question.id}
                                                    value={safeRender(option.key)}
                                                    checked={answers[question.id] === safeRender(option.key)}
                                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                    className="peer h-4 w-4 appearance-none rounded-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 checked:border-emerald-500 checked:bg-emerald-500 transition-all"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <span className="font-bold mr-2 text-slate-900 group-hover:text-emerald-700">{safeRender(option.key)}</span>
                                                <span className="text-slate-600 group-hover:text-slate-800">{safeRender(option.text)}</span>
                                            </div>
                                        </label>
                                    ))}
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
                        <table className="w-full border-collapse border border-slate-300 text-sm">
                            <thead>
                                <tr className="bg-slate-100">
                                    {group.container.cols?.map((col, idx) => <th key={idx} className="border border-slate-300 px-3 py-2 font-bold text-slate-700">{col}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {group.container.rows?.map((row: any, rowIdx: number) => (
                                    <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        {row.cells.map((cell: any, cellIdx: number) => (
                                            <td key={cellIdx} className="border border-slate-300 px-3 py-2 text-center">
                                                {cell.rich && cell.rich.length > 0 ? renderCellContent(cell.rich, group.questions) : <span className="text-slate-400">—</span>}
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

        // 5. Default: Input
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
                                className="w-full max-w-sm h-10 px-4 border border-slate-300 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all"
                                placeholder="Type answer here..."
                            />
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    if (!currentPart) return null;

    return (
        <div className={`flex flex-col bg-slate-100 font-sans ${isFullScreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
            {/* Toolbar (Preview mode only mostly) */}
            {previewMode && (
                <div className="bg-slate-800 text-white px-4 py-2 flex justify-between items-center text-xs">
                    <span className="font-mono opacity-70">PREVIEW MODE — {test.id}</span>
                    <button
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
                    >
                        {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        {isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    </button>
                </div>
            )}

            {/* Main Split View */}
            <div className="flex-1 flex overflow-hidden bg-slate-50/50">
                {/* Left Column: Passage */}
                <div className="w-[55%] flex flex-col border-r border-slate-200 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10">
                    <div ref={passagePanelRef} className="flex-1 overflow-y-auto px-12 py-8 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
                        <div className="max-w-full">
                            <h2 className="font-bold text-slate-900 text-xl mb-5 leading-tight tracking-tight border-b-2 border-emerald-500 inline-block pb-2">
                                {currentPart.title}
                            </h2>
                            <div className="text-slate-700 leading-relaxed text-justify font-serif text-[13px] whitespace-pre-wrap">
                                {currentPart.content.split('\n').map((para, idx) => {
                                    const trimmed = para.trim();
                                    if (!trimmed) return <div key={idx} className="h-4" />;
                                    const isHeading = trimmed.length < 80 && !trimmed.endsWith('.') && !trimmed.endsWith(',') && !trimmed.endsWith(';');

                                    if (isHeading) {
                                        return <h3 key={idx} className="font-sans font-bold text-slate-800 text-sm mt-5 mb-2">{trimmed}</h3>;
                                    }
                                    return <p key={idx} className="mb-3 indent-8">{trimmed}</p>;
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resizer Mock (Visual only for now) */}
                <div className="w-1 bg-slate-100 hover:bg-emerald-400 cursor-col-resize flex-shrink-0 transition-colors" />

                {/* Right Column: Questions */}
                <div className="w-[45%] flex flex-col bg-slate-50/50">
                    <div ref={questionsPanelRef} className="flex-1 overflow-y-auto px-10 py-8 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
                        <div className="max-w-full pb-20">
                            {currentPart.groups.map((group) => (
                                <div key={group.id} className="mb-12">
                                    <div className="mb-8">
                                        <div className="flex items-baseline justify-between border-b border-slate-200 pb-2 mb-4">
                                            <h3 className="text-base font-bold text-slate-900">
                                                Questions {group.questions[0]?.order}–{group.questions[group.questions.length - 1]?.order}
                                            </h3>
                                        </div>

                                        {group.instructions && (
                                            <div className="mb-6 p-5 bg-blue-50/50 rounded-xl border border-blue-100/50 text-blue-900">
                                                <p className="text-sm font-semibold whitespace-pre-wrap leading-relaxed">
                                                    {group.instructions}
                                                </p>
                                            </div>
                                        )}

                                        {group.image && (
                                            <div className="mb-8 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                                <img
                                                    src={group.image}
                                                    alt="Diagram"
                                                    className="max-w-full h-auto mx-auto rounded-lg"
                                                />
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

                <div className="flex gap-2">
                    {/* Part indicators */}
                    {parts.map((_, idx) => (
                        <div
                            key={idx}
                            className={`w-3 h-3 rounded-full ${idx === currentPartIndex ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        />
                    ))}
                </div>

                <button
                    onClick={() => {
                        if (currentPartIndex < parts.length - 1) {
                            setCurrentPartIndex(currentPartIndex + 1);
                        } else if (onSubmit) {
                            onSubmit(answers);
                        }
                    }}
                    className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${currentPartIndex < parts.length - 1
                        ? 'bg-slate-800 hover:bg-slate-700 shadow-slate-200'
                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200'
                        }`}
                >
                    {currentPartIndex < parts.length - 1 ? 'Next Passage' : (previewMode ? 'Submit (Preview)' : 'Submit Test')}
                    {currentPartIndex < parts.length - 1 ? <ChevronRight className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
}
