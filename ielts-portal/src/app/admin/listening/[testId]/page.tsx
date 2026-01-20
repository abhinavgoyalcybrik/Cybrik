'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    ArrowLeft,
    Save,
    Clock,
    Headphones,
} from 'lucide-react';

interface Question {
    id: string;
    question_text: string;
    order: number;
}

interface QuestionGroup {
    id: string;
    title: string;
    instructions: string;
    media_file: string | null;
    audio_start_time: number;
    order: number;
    questions: Question[];
}

interface TestModule {
    id: string;
    module_type: string;
    question_groups: QuestionGroup[];
}

interface ListeningTest {
    id: string;
    title: string;
    description: string;
    modules: TestModule[];
}

interface PageProps {
    params: Promise<{ testId: string }>;
}

// Use relative paths - Next.js rewrites handle proxying to Django
const MEDIA_BASE_URL = '/media/';
const API_URL = '/api/ielts';

export default function AdminListeningEditPage({ params }: PageProps) {
    const { testId } = use(params);
    const { isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [test, setTest] = useState<ListeningTest | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [timestamps, setTimestamps] = useState<Record<string, number>>({});
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (isAdmin) {
            fetchTest();
        }
    }, [isAdmin, testId]);

    const fetchTest = async () => {
        try {
            const res = await fetch(`${API_URL}/admin/tests/${testId}/`);
            if (!res.ok) throw new Error('Failed to fetch test');
            const data = await res.json();
            setTest(data);

            // Initialize timestamps from existing data
            const initialTimestamps: Record<string, number> = {};
            data.modules?.forEach((mod: TestModule) => {
                mod.question_groups?.forEach((qg: QuestionGroup) => {
                    initialTimestamps[qg.id] = qg.audio_start_time || 0;
                });
            });
            setTimestamps(initialTimestamps);
            setLoading(false);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            // Update each question group with its timestamp
            for (const [groupId, startTime] of Object.entries(timestamps)) {
                const res = await fetch(`${API_URL}/admin/question-groups/${groupId}/`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include', // Send auth cookies
                    body: JSON.stringify({ audio_start_time: startTime }),
                });

                if (!res.ok) {
                    throw new Error(`Failed to update group ${groupId}`);
                }
            }

            setSuccess('Timestamps saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const getListeningModule = (): TestModule | null => {
        if (!test) return null;
        return test.modules.find((m) => m.module_type === 'listening') || null;
    };

    const getAudioUrl = (): string | null => {
        const module = getListeningModule();
        const firstGroup = module?.question_groups?.[0];
        if (firstGroup?.media_file) {
            // API returns full URL, check if it already starts with http
            if (firstGroup.media_file.startsWith('http')) {
                return firstGroup.media_file;
            }
            return MEDIA_BASE_URL + firstGroup.media_file;
        }
        return null;
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

    const module = getListeningModule();
    const questionGroups = module?.question_groups || [];
    const audioUrl = getAudioUrl();

    return (
        <AdminLayout
            title="Edit Timestamps"
            subtitle={test?.title || 'Listening Test'}
            actions={
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/listening"
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
                        {saving ? 'Saving...' : 'Save Timestamps'}
                    </button>
                </div>
            }
        >
            {/* Messages */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <p className="text-red-600">{error}</p>
                </div>
            )}
            {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                    <p className="text-green-600">{success}</p>
                </div>
            )}

            {/* Instructions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
                <h2 className="font-bold text-lg text-slate-900 mb-2 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#6FB63A]" />
                    Audio Timestamp Configuration
                </h2>
                <p className="text-slate-600 text-sm">
                    Set the start time (in seconds) for each part of the listening test.
                    When students play the audio, the interface will automatically switch
                    to the corresponding part based on these timestamps.
                </p>
                {audioUrl && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-sm text-slate-500 mb-2">Test Audio:</p>
                        <audio controls className="w-full" src={audioUrl}>
                            Your browser does not support audio.
                        </audio>
                    </div>
                )}
            </div>

            {/* Timestamp Editor */}
            <div className="space-y-4">
                {questionGroups.map((group, idx) => {
                    const totalSeconds = timestamps[group.id] || 0;
                    const mins = Math.floor(totalSeconds / 60);
                    const secs = totalSeconds % 60;

                    const updateTime = (newMins: number, newSecs: number) => {
                        const clampedMins = Math.max(0, Math.min(99, newMins));
                        const clampedSecs = Math.max(0, Math.min(59, newSecs));
                        setTimestamps(prev => ({
                            ...prev,
                            [group.id]: clampedMins * 60 + clampedSecs
                        }));
                    };

                    return (
                        <div
                            key={group.id}
                            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-[#6FB63A]/10 rounded-xl flex items-center justify-center">
                                        <Headphones className="w-6 h-6 text-[#6FB63A]" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900">Part {idx + 1}</h3>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {group.title || `Section ${idx + 1}`}
                                            <span className="text-slate-400 ml-2">
                                                ({group.questions?.length || 0} questions)
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                {/* Clock-style time picker */}
                                <div className="flex items-center gap-1">
                                    <div className="text-xs text-slate-500 mr-2">Start at:</div>

                                    {/* Minutes */}
                                    <div className="flex flex-col items-center">
                                        <button
                                            onClick={() => updateTime(mins + 1, secs)}
                                            className="text-slate-400 hover:text-[#6FB63A] p-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            max="99"
                                            value={mins}
                                            onChange={(e) => updateTime(parseInt(e.target.value) || 0, secs)}
                                            className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-mono text-slate-900 focus:border-[#6FB63A] focus:ring-2 focus:ring-[#6FB63A]/20 focus:outline-none"
                                        />
                                        <button
                                            onClick={() => updateTime(mins - 1, secs)}
                                            className="text-slate-400 hover:text-[#6FB63A] p-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        <span className="text-xs text-slate-500">min</span>
                                    </div>

                                    <span className="text-2xl font-mono text-slate-400 mx-1">:</span>

                                    {/* Seconds */}
                                    <div className="flex flex-col items-center">
                                        <button
                                            onClick={() => updateTime(mins, secs + 1)}
                                            className="text-slate-400 hover:text-[#6FB63A] p-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            value={secs.toString().padStart(2, '0')}
                                            onChange={(e) => updateTime(mins, parseInt(e.target.value) || 0)}
                                            className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-mono text-slate-900 focus:border-[#6FB63A] focus:ring-2 focus:ring-[#6FB63A]/20 focus:outline-none"
                                        />
                                        <button
                                            onClick={() => updateTime(mins, secs - 1)}
                                            className="text-slate-400 hover:text-[#6FB63A] p-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        <span className="text-xs text-slate-500">sec</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {questionGroups.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    No question groups found for this test.
                </div>
            )}

            {/* Help */}
            <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h3 className="font-semibold mb-2 text-blue-700">Tips</h3>
                <ul className="text-sm text-blue-600 space-y-1 list-disc list-inside">
                    <li>Use the up/down arrows or type directly to set minutes and seconds</li>
                    <li>Part 1 usually starts at 00:00</li>
                    <li>Listen to the audio player above to find when each part begins</li>
                    <li>Click Save Timestamps when you're done</li>
                </ul>
            </div>
        </AdminLayout>
    );
}
