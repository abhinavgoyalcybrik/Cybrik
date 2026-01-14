'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { BookOpen, CheckCircle, ArrowLeft, FileText } from 'lucide-react';

interface Answer {
    questionNumber: number;
    answer: string;
    type: string;
}

interface QuestionGroup {
    type: string;
    instructions: string;
    answers: Answer[];
}

interface Passage {
    id: string;
    title: string;
    groups: QuestionGroup[];
}

// Helper function to render text with highlighted answers
function renderHighlightedText(text: string, withHighlights: Array<{ start: number, end: number, questionNumber: number, answer: string }>) {
    if (!withHighlights || !withHighlights.length) return <p className="text-slate-700 leading-relaxed">{text}</p>;

    // 1. Sort highlights by start index
    const sortedHighlights = [...withHighlights].sort((a, b) => a.start - b.start);

    // 2. Filter out invalid or completely contained highlights (simple overlap handling)
    // For a production app, we might want to merge overlaps, but for now we'll just skip
    // highlights that start before the previous one ends (nested/overlapped) to prevent crashes.
    const validHighlights: typeof sortedHighlights = [];
    let lastEnd = -1;

    sortedHighlights.forEach(h => {
        if (h.start >= lastEnd) {
            validHighlights.push(h);
            lastEnd = h.end;
        } else {
            // Handle overlap: if this one ends after the last one, maybe we can show partial? 
            // For simplicity in this fix, we prioritize the first one to avoid UI breakage.
            // Or, we could try to just render it if it starts strictly after the previous start?
            // Let's stick to non-overlapping for safety as React doesn't like nested marks easily without parsing.
            if (h.start > lastEnd) { // Should be covered by >= check, but just to be sure
                validHighlights.push(h);
                lastEnd = h.end;
            }
        }
    });

    const parts = [];
    let lastIndex = 0;

    validHighlights.forEach((highlight, i) => {
        // Safety check for bounds
        const start = Math.max(0, Math.min(highlight.start, text.length));
        const end = Math.max(start, Math.min(highlight.end, text.length));

        // Add text before highlight
        if (lastIndex < start) {
            parts.push(
                <span key={`text-${i}`} className="text-slate-700">
                    {text.slice(lastIndex, start)}
                </span>
            );
        }

        // Add highlighted text
        parts.push(
            <mark
                key={`highlight-${i}`}
                className="bg-yellow-200 text-slate-900 px-1 py-0.5 rounded font-medium relative group cursor-help"
                title={`Q${highlight.questionNumber}: ${highlight.answer}`}
            >
                {text.slice(start, end)}
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    Q{highlight.questionNumber}
                </span>
            </mark>
        );

        lastIndex = end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(
            <span key="text-end" className="text-slate-700">
                {text.slice(lastIndex)}
            </span>
        );
    }

    return <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{parts}</p>;
}

export default function AnswerKeyPage() {
    const params = useParams();
    const router = useRouter();
    const { testId } = params;

    const [test, setTest] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadTest = async () => {
            try {
                const response = await fetch('/data/reading_tests.json');
                const data = await response.json();
                const foundTest = data.tests.find((t: any) => t.id === parseInt(testId as string));
                setTest(foundTest);
            } catch (error) {
                console.error('Failed to load test:', error);
            } finally {
                setLoading(false);
            }
        };

        if (testId) loadTest();
    }, [testId]);

    if (loading) {
        return (
            <AdminLayout title="Answer Key">
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
                </div>
            </AdminLayout>
        );
    }

    if (!test) {
        return (
            <AdminLayout title="Answer Key">
                <div className="text-center py-12">
                    <p className="text-slate-600">Test not found</p>
                    <button
                        onClick={() => router.back()}
                        className="mt-4 text-emerald-600 hover:underline"
                    >
                        Go Back
                    </button>
                </div>
            </AdminLayout>
        );
    }

    // Group questions by passage
    const passagesWithAnswers = test.passages.map((passage: any) => {
        const answers: Answer[] = [];
        const highlights: Array<{ start: number, end: number, questionNumber: number, answer: string }> = [];

        passage.groups?.forEach((group: any) => {
            group.items?.forEach((item: any) => {
                answers.push({
                    questionNumber: item.number,
                    answer: item.answer.value,
                    type: item.answer.type
                });

                // Collect highlights for text-based answers
                if (item.answer.start_index !== undefined && item.answer.end_index !== undefined) {
                    highlights.push({
                        start: item.answer.start_index,
                        end: item.answer.end_index,
                        questionNumber: item.number,
                        answer: item.answer.value
                    });
                }
            });
        });

        return {
            id: passage.passage_id,
            title: passage.title,
            text: passage.text,
            answers: answers.sort((a, b) => a.questionNumber - b.questionNumber),
            highlights: highlights
        };
    });

    return (
        <AdminLayout
            title="Answer Key"
            subtitle={test.title}
        >
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                </button>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-emerald-500 rounded-lg p-2">
                            <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Answer Key</h1>
                            <p className="text-slate-600 text-sm mt-1">{test.title}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Answer Key by Passage */}
            <div className="space-y-6">
                {passagesWithAnswers.map((passage: any, index: number) => (
                    <div key={passage.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Passage Header */}
                        <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold text-emerald-600">
                                    {index + 1}
                                </span>
                                <div>
                                    <h3 className="font-semibold text-slate-900">{passage.title}</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Questions {passage.answers[0]?.questionNumber} - {passage.answers[passage.answers.length - 1]?.questionNumber}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Answers Grid */}
                        <div className="p-6 border-b border-slate-100">
                            <h4 className="text-sm font-semibold text-slate-700 mb-4">Answer List</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {passage.answers.map((answer: Answer) => (
                                    <div
                                        key={answer.questionNumber}
                                        className="group relative bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl p-4 transition-all duration-200 cursor-default"
                                    >
                                        {/* Question Number */}
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-slate-500 group-hover:text-emerald-700 transition-colors">
                                                Q{answer.questionNumber}
                                            </span>
                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>

                                        {/* Answer */}
                                        <div className="bg-white border border-slate-200 group-hover:border-emerald-300 rounded-lg px-3 py-2 transition-colors">
                                            <p className="text-sm font-bold text-slate-900 text-center truncate" title={answer.answer}>
                                                {answer.answer}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Passage with Highlighted Answers */}
                        {passage.highlights.length > 0 && (
                            <div className="p-6 bg-slate-50/50">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                    <h4 className="text-sm font-semibold text-slate-700">
                                        Passage with Highlighted Answers
                                    </h4>
                                    <span className="text-xs text-slate-500">
                                        (Hover over highlights to see question number)
                                    </span>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-xl p-6">
                                    {renderHighlightedText(passage.text, passage.highlights)}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Quick Reference Table */}
            <div className="mt-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Reference - All Answers</h3>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                    {test.passages.flatMap((passage: any) =>
                        passage.groups?.flatMap((group: any) =>
                            group.items?.map((item: any) => (
                                <div key={item.number} className="text-center">
                                    <div className="text-xs text-slate-500 mb-1">{item.number}</div>
                                    <div className="bg-emerald-100 text-emerald-800 font-bold text-sm py-1.5 px-2 rounded-lg">
                                        {item.answer.value}
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
