'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    ArrowLeft,
    Upload,
    FileJson,
    Check,
    AlertCircle,
    Loader2,
    BookOpen,
} from 'lucide-react';

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
    order: number;
    questions: Question[];
}

interface TestModule {
    id: string;
    module_type: string;
    question_groups: QuestionGroup[];
}

interface ReadingTest {
    id: string;
    title: string;
    description: string;
    active: boolean;
    modules: TestModule[];
}

interface PageProps {
    params: Promise<{ testId: string }>;
}

const API_URL = '/api/ielts';

export default function AdminReadingEditPage({ params }: PageProps) {
    const { testId } = use(params);
    const { isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const isNew = testId === 'new';

    // States for new test creation
    const [title, setTitle] = useState('');
    const [jsonContent, setJsonContent] = useState('');

    // States for existing test view
    const [test, setTest] = useState<ReadingTest | null>(null);
    const [groups, setGroups] = useState<QuestionGroup[]>([]);

    // Common states
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    // Fetch existing test data
    useEffect(() => {
        if (!isNew && isAdmin) {
            fetchTest();
        }
    }, [isNew, isAdmin, testId]);

    const fetchTest = async () => {
        try {
            const res = await fetch(`${API_URL}/tests/${testId}/`);
            if (!res.ok) throw new Error('Failed to fetch test');
            const data = await res.json();
            setTest(data);
            setTitle(data.title);

            // Extract reading module groups
            const module = data.modules?.find((m: TestModule) => m.module_type === 'reading');
            setGroups(module?.question_groups || []);
            setLoading(false);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                JSON.parse(content);
                setJsonContent(content);
                setError(null);
            } catch {
                setError('Invalid JSON file. Please check the file format.');
            }
        };
        reader.readAsText(file);
    };

    const handleCreateTest = async () => {
        if (!title.trim()) {
            setError('Please enter a test title');
            return;
        }

        if (!jsonContent.trim()) {
            setError('Please paste or upload JSON content');
            return;
        }

        let parsedJson;
        try {
            parsedJson = JSON.parse(jsonContent);
        } catch {
            setError('Invalid JSON format. Please check your JSON content.');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/admin/import-test/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: title.trim(),
                    module_type: 'reading',
                    json_data: parsedJson,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create test');
            }

            setSuccess(`Test "${title}" created successfully!`);
            setTimeout(() => {
                router.push('/admin/reading');
            }, 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    // ========== NEW TEST CREATION UI ==========
    if (isNew) {
        return (
            <AdminLayout
                title="Create Reading Test"
                subtitle="Import from JSON"
                actions={
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/reading"
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Link>
                        <button
                            onClick={handleCreateTest}
                            disabled={saving || !title.trim() || !jsonContent.trim()}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#6FB63A] hover:bg-[#5fa030] text-white rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Check className="w-5 h-5" />
                                    Create Test
                                </>
                            )}
                        </button>
                    </div>
                }
            >
                {/* Messages */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-red-600">{error}</p>
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <p className="text-green-600">{success}</p>
                    </div>
                )}

                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Test Title */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Test Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent focus:outline-none transition-all"
                            placeholder="e.g. Cambridge 15 Reading Test 1"
                        />
                    </div>

                    {/* JSON Input */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700">
                                    Test JSON <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-slate-500 mt-1">
                                    Paste JSON content or upload a JSON file
                                </p>
                            </div>
                            <label className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-medium cursor-pointer transition-colors border border-blue-200">
                                <Upload className="w-4 h-4" />
                                Upload JSON
                                <input
                                    type="file"
                                    accept=".json,application/json"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        <textarea
                            value={jsonContent}
                            onChange={(e) => setJsonContent(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 font-mono text-sm h-80 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent focus:outline-none resize-none"
                            placeholder='{"passages": [{"title": "Passage 1", "text": "...", "groups": [...]}]}'
                        />

                        {jsonContent && (
                            <div className="mt-3 flex items-center gap-2 text-sm">
                                <FileJson className="w-4 h-4 text-green-500" />
                                <span className="text-green-600">
                                    JSON loaded ({(jsonContent.length / 1024).toFixed(1)} KB)
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Help */}
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <h3 className="font-semibold text-blue-800 mb-2">Expected JSON Format</h3>
                        <pre className="text-xs text-blue-700 bg-blue-100/50 p-3 rounded-lg overflow-x-auto">
                            {`{
  "passages": [
    {
      "title": "Passage Title",
      "text": "The passage text...",
      "groups": [
        {
          "type": "TRUE_FALSE_NOT_GIVEN",
          "instructions": "Do the following statements agree...",
          "items": [
            {"q": 1, "question": "...", "answer": "TRUE"},
            {"q": 2, "question": "...", "answer": "FALSE"}
          ]
        }
      ]
    }
  ]
}`}
                        </pre>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    // ========== EXISTING TEST VIEW UI ==========
    return (
        <AdminLayout
            title={test?.title || 'Reading Test'}
            subtitle="View Test Details"
            actions={
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/reading"
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Link>
                </div>
            }
        >
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* Test Info */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6">
                <h2 className="font-bold text-xl text-slate-900 mb-2">{test?.title}</h2>
                <p className="text-slate-600">{test?.description || 'IELTS Reading Test'}</p>
                <div className="flex items-center gap-4 mt-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${test?.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {test?.active ? 'Active' : 'Draft'}
                    </span>
                    <span className="text-sm text-slate-500">{groups.length} passages</span>
                </div>
            </div>

            {/* Passages */}
            <div className="space-y-6">
                {groups.map((group, index) => (
                    <div key={group.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                    <BookOpen className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Passage {index + 1}</h3>
                                    <p className="text-sm text-slate-500">{group.title}</p>
                                </div>
                            </div>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                {group.questions?.length || 0} questions
                            </span>
                        </div>

                        <div className="p-6">
                            {/* Passage Preview */}
                            {group.content && (
                                <div className="mb-4 p-4 bg-slate-50 rounded-xl max-h-40 overflow-y-auto">
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-6">
                                        {group.content.substring(0, 500)}...
                                    </p>
                                </div>
                            )}

                            {/* Questions */}
                            <div className="space-y-2">
                                {group.questions?.slice(0, 5).map(q => (
                                    <div key={q.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-mono text-slate-600">
                                                {q.order}
                                            </span>
                                            <span className="text-sm text-slate-700 truncate max-w-md">
                                                {q.question_text || '(No question text)'}
                                            </span>
                                        </div>
                                        <span className="text-xs font-mono text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                                            {q.correct_answer}
                                        </span>
                                    </div>
                                ))}
                                {(group.questions?.length || 0) > 5 && (
                                    <p className="text-sm text-slate-500 italic text-center py-2">
                                        + {group.questions.length - 5} more questions
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {groups.length === 0 && (
                <div className="bg-amber-50 rounded-2xl border border-amber-200 p-8 text-center">
                    <div className="inline-flex p-3 rounded-full bg-amber-100 mb-4">
                        <AlertCircle className="w-8 h-8 text-amber-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No Content Available</h3>
                    <p className="text-slate-600 max-w-md mx-auto mb-4">
                        This test was auto-created as a placeholder when a student saved their results.
                        It doesn&apos;t contain actual passages or questions.
                    </p>
                    <p className="text-sm text-slate-500">
                        To add content, import a JSON file with passages and questions via the &quot;Add New Test&quot; page.
                    </p>
                </div>
            )}
        </AdminLayout>
    );
}
