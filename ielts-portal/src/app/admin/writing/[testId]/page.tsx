'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    ArrowLeft,
    Save,
    Upload,
} from 'lucide-react';

interface WritingTest {
    test_id: number;
    difficulty: string;
    task_1: {
        type: string;
        question: string;
        word_limit: number;
        image_url?: string;
    };
    task_2: {
        question: string;
        word_limit: number;
    };
}

interface PageProps {
    params: Promise<{ testId: string }>;
}

export default function EditWritingTestPage({ params }: PageProps) {
    const { testId } = use(params);
    const { user, isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [test, setTest] = useState<WritingTest | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [difficulty, setDifficulty] = useState('easy');
    const [task1Type, setTask1Type] = useState('chart');
    const [task1Question, setTask1Question] = useState('');
    const [task1ImageUrl, setTask1ImageUrl] = useState('');
    const [task2Question, setTask2Question] = useState('');

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        fetch('/data/writing_tests.json')
            .then((r) => r.json())
            .then((data) => {
                const foundTest = data.tests.find((t: WritingTest) => t.test_id === parseInt(testId));
                if (foundTest) {
                    setTest(foundTest);
                    setDifficulty(foundTest.difficulty);
                    setTask1Type(foundTest.task_1.type);
                    setTask1Question(foundTest.task_1.question);
                    setTask1ImageUrl(foundTest.task_1.image_url || '');
                    setTask2Question(foundTest.task_2.question);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [testId]);

    const handleSave = async () => {
        setSaving(true);
        const updatedTest = {
            test_id: parseInt(testId),
            difficulty,
            task_1: {
                type: task1Type,
                question: task1Question,
                word_limit: 150,
                image_url: task1ImageUrl || undefined,
            },
            task_2: {
                question: task2Question,
                word_limit: 250,
            },
        };

        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const token = localStorage.getItem('ielts_token');

        try {
            // Try Django API first
            const djangoResponse = await fetch(`${API_BASE}/api/ielts/admin/modules/${testId}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Token ${token}` } : {}),
                },
                credentials: 'include',
                body: JSON.stringify(updatedTest),
            });

            if (djangoResponse.ok) {
                alert('Test saved successfully!');
                router.push('/admin/writing');
                return;
            }
        } catch (e) {
            console.log('Django API failed, trying local fallback');
        }

        // Fallback to local Next.js API
        try {
            const response = await fetch('/api/admin/writing', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTest),
            });

            if (response.ok) {
                alert('Test saved successfully!');
                router.push('/admin/writing');
            } else {
                const error = await response.json();
                alert(`Error saving: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            alert('Failed to save test. Please try again.');
        }
        setSaving(false);
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title={`Edit Test #${testId}`}
            subtitle="Modify test details and content"
            actions={
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/writing"
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Link>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#6FB63A] hover:bg-[#5fa030] text-white rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
                    >
                        <Save className="w-5 h-5" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            }
        >
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A] mx-auto"></div>
                </div>
            ) : !test ? (
                <div className="text-center py-12 text-slate-500">
                    Test not found
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">
                                    Difficulty
                                </label>
                                <select
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all"
                                >
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">
                                    Task 1 Type
                                </label>
                                <select
                                    value={task1Type}
                                    onChange={(e) => setTask1Type(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all"
                                >
                                    <option value="chart">Chart</option>
                                    <option value="map">Map</option>
                                    <option value="process">Process</option>
                                    <option value="table">Table</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Task 1 */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Task 1</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">
                                    Question
                                </label>
                                <textarea
                                    value={task1Question}
                                    onChange={(e) => setTask1Question(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none resize-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">
                                    Image URL (optional)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={task1ImageUrl}
                                        onChange={(e) => setTask1ImageUrl(e.target.value)}
                                        placeholder="/images/writing/test1_chart.png"
                                        className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all"
                                    />
                                    <label className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                        <Upload className="w-4 h-4" />
                                        Upload
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    try {
                                                        const formData = new FormData();
                                                        formData.append('file', file);
                                                        const response = await fetch('/api/upload', {
                                                            method: 'POST',
                                                            body: formData,
                                                        });
                                                        if (response.ok) {
                                                            const data = await response.json();
                                                            setTask1ImageUrl(data.imageUrl);
                                                            alert('Image uploaded successfully!');
                                                        } else {
                                                            alert('Failed to upload image');
                                                        }
                                                    } catch (error) {
                                                        alert('Upload error');
                                                    }
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                                {task1ImageUrl && (
                                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                        <img
                                            src={task1ImageUrl}
                                            alt="Preview"
                                            className="max-h-40 object-contain rounded-lg"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Task 2 */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Task 2</h3>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">
                                Question
                            </label>
                            <textarea
                                value={task2Question}
                                onChange={(e) => setTask2Question(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none resize-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Info Note */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
                        <p className="text-green-700">
                            <strong>✓ Auto-save enabled:</strong> Changes will be saved directly to the database.
                        </p>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
