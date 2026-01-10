'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    ArrowLeft,
    Save,
    Plus,
    Trash2,
    User,
    Info,
} from 'lucide-react';

interface SpeakingTestIntro {
    greeting: string;
    examiners_intro: string;
    identity_check: string[];
    seating_and_recording: string[];
    test_structure: {
        overview: string;
        part_1: string;
        part_2: string;
        part_3: string;
    };
    instructions: string[];
    confirmation: string;
    start: string;
}

interface SpeakingTest {
    test_id: number;
    difficulty: string;
    part_1: {
        topic: string;
        questions: string[];
    };
    part_2: {
        title: string;
        prompts: string[];
    };
    part_3: {
        discussion_topics: Array<{
            topic: string;
            questions: string[];
        }>;
    };
}

interface PageProps {
    params: Promise<{ testId: string }>;
}

export default function EditSpeakingTestPage({ params }: PageProps) {
    const { testId } = use(params);
    const { user, isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [test, setTest] = useState<SpeakingTest | null>(null);
    const [intro, setIntro] = useState<SpeakingTestIntro | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showIntroDetails, setShowIntroDetails] = useState(false);

    // Form state
    const [difficulty, setDifficulty] = useState('easy');
    const [part1Topic, setPart1Topic] = useState('');
    const [part1Questions, setPart1Questions] = useState<string[]>(['']);
    const [part2Title, setPart2Title] = useState('');
    const [part2Prompts, setPart2Prompts] = useState<string[]>(['']);
    const [part3Topic, setPart3Topic] = useState('');
    const [part3Questions, setPart3Questions] = useState<string[]>(['']);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const token = localStorage.getItem('ielts_token');

        // Try Django API first
        fetch(`${API_BASE}/api/ielts/admin/modules/?module_type=speaking`, {
            headers: token ? { 'Authorization': `Token ${token}` } : {},
            credentials: 'include',
        })
            .then(r => {
                if (!r.ok) throw new Error('Django API failed');
                return r.json();
            })
            .then(data => {
                const module = data.find((m: any) => m.id === testId || m.order === parseInt(testId));
                if (module) {
                    setLoading(false);
                }
                throw new Error('Test not found in Django, try local');
            })
            .catch(() => {
                // Fallback to local JSON
                fetch('/data/speaking_tests.json')
                    .then((r) => r.json())
                    .then((data) => {
                        // Load the standard introduction
                        if (data.speaking_test_intro) {
                            setIntro(data.speaking_test_intro);
                        }

                        const foundTest = data.tests.find((t: SpeakingTest) => t.test_id === parseInt(testId));
                        if (foundTest) {
                            setTest(foundTest);
                            setDifficulty(foundTest.difficulty);
                            setPart1Topic(foundTest.part_1.topic);
                            setPart1Questions(foundTest.part_1.questions);
                            setPart2Title(foundTest.part_2.title);
                            setPart2Prompts(foundTest.part_2.prompts);
                            if (foundTest.part_3.discussion_topics[0]) {
                                setPart3Topic(foundTest.part_3.discussion_topics[0].topic);
                                setPart3Questions(foundTest.part_3.discussion_topics[0].questions);
                            }
                        }
                        setLoading(false);
                    })
                    .catch(() => setLoading(false));
            });
    }, [testId]);

    const handleSave = async () => {
        setSaving(true);
        const updatedTest = {
            test_id: parseInt(testId),
            difficulty,
            part_1: {
                topic: part1Topic,
                questions: part1Questions.filter(q => q.trim()),
            },
            part_2: {
                title: part2Title,
                prompts: part2Prompts.filter(p => p.trim()),
            },
            part_3: {
                discussion_topics: [{
                    topic: part3Topic,
                    questions: part3Questions.filter(q => q.trim()),
                }]
            }
        };

        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const token = localStorage.getItem('ielts_token');

        try {
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
                router.push('/admin/speaking');
                return;
            }
        } catch (e) {
            console.log('Django API failed, trying local fallback');
        }

        try {
            const response = await fetch('/api/admin/speaking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTest),
            });

            if (response.ok) {
                alert('Test saved successfully!');
                router.push('/admin/speaking');
            } else {
                const error = await response.json();
                alert(`Error saving: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            alert('Failed to save test. Please try again.');
        }
        setSaving(false);
    };

    const addQuestion = (setter: React.Dispatch<React.SetStateAction<string[]>>, list: string[]) => {
        setter([...list, '']);
    };

    const removeQuestion = (setter: React.Dispatch<React.SetStateAction<string[]>>, list: string[], index: number) => {
        setter(list.filter((_, i) => i !== index));
    };

    const updateQuestion = (setter: React.Dispatch<React.SetStateAction<string[]>>, list: string[], index: number, value: string) => {
        const newList = [...list];
        newList[index] = value;
        setter(newList);
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
            title={`Edit Speaking Test #${testId}`}
            subtitle="Modify test questions and prompts"
            actions={
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/speaking"
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
                    </div>

                    {/* Standard Introduction Section (Read-only) */}
                    {intro && (
                        <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                        <User className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Standard Introduction</h3>
                                        <p className="text-sm text-slate-500">This introduction is used for all speaking tests</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowIntroDetails(!showIntroDetails)}
                                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    <Info className="w-4 h-4" />
                                    {showIntroDetails ? 'Hide Details' : 'View Details'}
                                </button>
                            </div>

                            {showIntroDetails && (
                                <div className="mt-4 space-y-4 bg-white rounded-xl p-4 border border-blue-100">
                                    {/* Greeting */}
                                    <div>
                                        <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Greeting</label>
                                        <p className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">{intro.greeting}</p>
                                    </div>

                                    {/* Examiner's Intro */}
                                    <div>
                                        <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Examiner's Introduction</label>
                                        <p className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">{intro.examiners_intro}</p>
                                    </div>

                                    {/* Identity Check */}
                                    <div>
                                        <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Identity Check</label>
                                        <ul className="space-y-1">
                                            {intro.identity_check.map((item, idx) => (
                                                <li key={idx} className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">{item}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Seating & Recording */}
                                    <div>
                                        <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Seating & Recording</label>
                                        <ul className="space-y-1">
                                            {intro.seating_and_recording.map((item, idx) => (
                                                <li key={idx} className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">{item}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Test Structure */}
                                    <div>
                                        <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Test Structure Overview</label>
                                        <div className="space-y-1">
                                            <p className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg font-medium">{intro.test_structure.overview}</p>
                                            <p className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg"><span className="font-medium text-blue-600">Part 1:</span> {intro.test_structure.part_1}</p>
                                            <p className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg"><span className="font-medium text-blue-600">Part 2:</span> {intro.test_structure.part_2}</p>
                                            <p className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg"><span className="font-medium text-blue-600">Part 3:</span> {intro.test_structure.part_3}</p>
                                        </div>
                                    </div>

                                    {/* Instructions */}
                                    <div>
                                        <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Instructions</label>
                                        <ul className="space-y-1">
                                            {intro.instructions.map((item, idx) => (
                                                <li key={idx} className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">{item}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Confirmation & Start */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Confirmation</label>
                                            <p className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">{intro.confirmation}</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-blue-600 uppercase mb-1">Start</label>
                                            <p className="text-slate-700 bg-slate-50 px-3 py-2 rounded-lg">{intro.start}</p>
                                        </div>
                                    </div>

                                    <p className="text-xs text-blue-500 italic mt-2">
                                        ℹ️ This introduction is shared across all speaking tests. To edit it, modify the speaking_tests.json file.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Part 1 */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Part 1 - Introduction & Interview</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">
                                    Topic
                                </label>
                                <input
                                    type="text"
                                    value={part1Topic}
                                    onChange={(e) => setPart1Topic(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">
                                    Questions
                                </label>
                                {part1Questions.map((q, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={q}
                                            onChange={(e) => updateQuestion(setPart1Questions, part1Questions, idx, e.target.value)}
                                            placeholder={`Question ${idx + 1}`}
                                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all"
                                        />
                                        <button
                                            onClick={() => removeQuestion(setPart1Questions, part1Questions, idx)}
                                            className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => addQuestion(setPart1Questions, part1Questions)}
                                    className="flex items-center gap-1 text-sm text-[#6FB63A] hover:text-[#5fa030] font-medium"
                                >
                                    <Plus className="w-4 h-4" /> Add Question
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Part 2 */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Part 2 - Long Turn</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">
                                    Title
                                </label>
                                <input
                                    type="text"
                                    value={part2Title}
                                    onChange={(e) => setPart2Title(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">
                                    Prompts
                                </label>
                                {part2Prompts.map((p, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={p}
                                            onChange={(e) => updateQuestion(setPart2Prompts, part2Prompts, idx, e.target.value)}
                                            placeholder={`Prompt ${idx + 1}`}
                                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all"
                                        />
                                        <button
                                            onClick={() => removeQuestion(setPart2Prompts, part2Prompts, idx)}
                                            className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => addQuestion(setPart2Prompts, part2Prompts)}
                                    className="flex items-center gap-1 text-sm text-[#6FB63A] hover:text-[#5fa030] font-medium"
                                >
                                    <Plus className="w-4 h-4" /> Add Prompt
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Part 3 */}
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Part 3 - Discussion</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">
                                    Discussion Topic
                                </label>
                                <input
                                    type="text"
                                    value={part3Topic}
                                    onChange={(e) => setPart3Topic(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-2">
                                    Discussion Questions
                                </label>
                                {part3Questions.map((q, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={q}
                                            onChange={(e) => updateQuestion(setPart3Questions, part3Questions, idx, e.target.value)}
                                            placeholder={`Question ${idx + 1}`}
                                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all"
                                        />
                                        <button
                                            onClick={() => removeQuestion(setPart3Questions, part3Questions, idx)}
                                            className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => addQuestion(setPart3Questions, part3Questions)}
                                    className="flex items-center gap-1 text-sm text-[#6FB63A] hover:text-[#5fa030] font-medium"
                                >
                                    <Plus className="w-4 h-4" /> Add Question
                                </button>
                            </div>
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
