'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    ArrowLeft,
    Save,
    Check,
    AlertCircle,
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/ielts';

export default function AdminReadingEditPage({ params }: PageProps) {
    const { testId } = use(params);
    const { isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [test, setTest] = useState<ReadingTest | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'settings' | 'content'>('content');

    // Local state for edits
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [groups, setGroups] = useState<QuestionGroup[]>([]);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin && testId !== 'new') {
            fetchTest();
        } else if (testId === 'new') {
            setLoading(false);
            setTest({ id: 'new', title: '', description: '', active: false, modules: [] });
            setActiveTab('settings');
        }
    }, [isAdmin, testId]);

    const fetchTest = async () => {
        try {
            const res = await fetch(`${API_URL}/tests/${testId}/`);
            if (!res.ok) throw new Error('Failed to fetch test');
            const data = await res.json();
            setTest(data);
            setTitle(data.title);
            setDescription(data.description);
            setIsActive(data.active);

            // Extract reading module groups
            const module = data.modules?.find((m: any) => m.module_type === 'reading');
            setGroups(module?.question_groups || []);

            setLoading(false);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const method = testId === 'new' ? 'POST' : 'PATCH';
            const url = testId === 'new' ? `${API_URL}/admin/tests/` : `${API_URL}/admin/tests/${testId}/`;

            const payload: any = {
                title,
                description,
                active: isActive,
            };

            // If new, add reading module default
            if (testId === 'new') {
                payload.test_type = 'academic';
                payload.modules = [{ module_type: 'reading', duration_minutes: 60 }];
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('Failed to save test');

            const savedTest = await res.json();
            setSuccess('Settings saved successfully');

            if (testId === 'new') {
                router.push(`/admin/reading/${savedTest.id}`);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateGroup = async (groupId: string, updates: Partial<QuestionGroup>) => {
        // Optimistic update
        setGroups(current =>
            current.map(g => g.id === groupId ? { ...g, ...updates } : g)
        );

        // API update
        try {
            const res = await fetch(`${API_URL}/admin/question-groups/${groupId}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error('Failed to update section');
        } catch (err) {
            console.error(err);
            // Revert on error would go here
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title={testId === 'new' ? 'Create New Test' : title}
            subtitle={testId === 'new' ? 'New Reading Test' : 'Edit Reading Test'}
            actions={
                <div className="flex items-center gap-3">
                    {success && <span className="text-green-600 text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
                    {error && <span className="text-red-600 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</span>}
                    <Link
                        href="/admin/reading"
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Link>
                    <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#6FB63A] hover:bg-[#5fa030] text-white rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Saving...' : 'Save Meta'}
                    </button>
                </div>
            }
        >
            {/* Tabs */}
            {testId !== 'new' && (
                <div className="flex border-b border-slate-200 mb-8">
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'settings' ? 'border-[#6FB63A] text-[#6FB63A]' : 'border-transparent text-slate-500 hover:text-slate-900'
                            }`}
                    >
                        Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('content')}
                        className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'content' ? 'border-[#6FB63A] text-[#6FB63A]' : 'border-transparent text-slate-500 hover:text-slate-900'
                            }`}
                    >
                        Passages & Questions
                    </button>
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="space-y-6 max-w-2xl">
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Test Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent focus:outline-none transition-all"
                                placeholder="e.g. Cambridge 13 Reading Test 3"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-600">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 h-24 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent focus:outline-none resize-none transition-all"
                                placeholder="Optional description..."
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="active"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 bg-slate-50 text-[#6FB63A] focus:ring-[#6FB63A]"
                            />
                            <label htmlFor="active" className="text-sm font-medium text-slate-700">
                                Make this test active (visible to students)
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Tab */}
            {activeTab === 'content' && (
                <div className="space-y-8">
                    {groups.map((group, index) => (
                        <div key={group.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-slate-900">Part {index + 1}: {group.title}</h3>
                                <span className="text-xs text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded">Passage {index + 1}</span>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Passage Content */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Passage Text</label>
                                    <textarea
                                        value={group.content}
                                        onChange={(e) => handleUpdateGroup(group.id, { content: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 font-serif leading-relaxed h-96 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent focus:outline-none resize-none"
                                    />
                                </div>

                                {/* Questions */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Questions ({group.questions.length})</label>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2">
                                        {group.questions.map(q => (
                                            <div key={q.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-mono text-slate-600">{q.order}</span>
                                                    <span className="text-sm text-slate-700 line-clamp-1 w-96">{q.question_text || '(No question text)'}</span>
                                                    <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded">{q.question_type}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                                                        {q.correct_answer}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 italic">
                                        Note: Question editing is limited in this simplified view. Use the API or import JSON for structural changes.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {groups.length === 0 && (
                        <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-200">
                            No content found. This might be a new test.
                            <br />Import content via JSON or backend management commands.
                        </div>
                    )}
                </div>
            )}
        </AdminLayout>
    );
}
