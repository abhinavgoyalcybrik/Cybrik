'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    Save,
    Code,
    Copy,
    Check,
} from 'lucide-react';

const sampleTest = {
    test_id: 49,
    difficulty: "medium",
    part_1: {
        topic: "Your Topic Here",
        questions: [
            "First question about the topic?",
            "Second question about the topic?",
            "Third question about the topic?",
            "Fourth question about the topic?"
        ]
    },
    part_2: {
        title: "Describe something related to the topic",
        prompts: [
            "what it is",
            "when you experienced it",
            "why it was important",
            "how it made you feel"
        ]
    },
    part_3: {
        discussion_topics: [
            {
                topic: "Related Discussion Topic",
                questions: [
                    "Discussion question 1?",
                    "Discussion question 2?",
                    "Discussion question 3?"
                ]
            }
        ]
    }
};

export default function NewSpeakingTestPage() {
    const { user, isAdmin, logout, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [jsonContent, setJsonContent] = useState(JSON.stringify(sampleTest, null, 2));
    const [jsonError, setJsonError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    const handleLogout = () => {
        logout();
        router.push('/admin/login');
    };

    const validateJson = (content: string) => {
        try {
            const parsed = JSON.parse(content);
            if (!parsed.test_id || !parsed.part_1 || !parsed.part_2 || !parsed.part_3) {
                setJsonError('Missing required fields: test_id, part_1, part_2, part_3');
                return false;
            }
            setJsonError('');
            return true;
        } catch (e) {
            setJsonError('Invalid JSON format');
            return false;
        }
    };

    const handleJsonChange = (value: string) => {
        setJsonContent(value);
        validateJson(value);
    };

    const handleCopyJson = () => {
        navigator.clipboard.writeText(jsonContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const [testName, setTestName] = useState('');

    const handleSave = async () => {
        if (!testName.trim()) {
            alert('Please enter a test name');
            return;
        }

        if (!validateJson(jsonContent)) {
            alert('Please fix the JSON errors before saving');
            return;
        }

        try {
            const parsedTest = JSON.parse(jsonContent);
            parsedTest.title = testName;

            // Save to speaking_tests.json via API
            const response = await fetch('/api/admin/speaking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedTest),
            });

            if (response.ok) {
                alert('Test saved successfully!');
                router.push('/admin/speaking');
            } else {
                const error = await response.json();
                alert(`Error saving: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            // Fallback: copy to clipboard
            const instructions = `To add this test:
1. Copy the JSON below
2. Open: public/data/speaking_tests.json
3. Add this object to the "tests" array (ensure "title": "${testName}" is included)

The JSON has been copied to your clipboard!`;

            const parsedTest = JSON.parse(jsonContent);
            parsedTest.title = testName;
            navigator.clipboard.writeText(JSON.stringify(parsedTest, null, 2));
            alert(instructions);
        }
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
            title="Add New Speaking Test"
            subtitle="Upload JSON and Name"
        >
            <div className="max-w-4xl mx-auto">
                <div className="grid grid-cols-1 gap-6">
                    {/* JSON Editor */}
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Code className="w-5 h-5 text-emerald-500" />
                                <h3 className="text-lg font-bold text-slate-900">Test JSON</h3>
                            </div>
                            <button
                                onClick={handleCopyJson}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 text-green-500" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4" />
                                        Copy
                                    </>
                                )}
                            </button>
                        </div>

                        <textarea
                            value={jsonContent}
                            onChange={(e) => handleJsonChange(e.target.value)}
                            className="w-full h-[500px] p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                            spellCheck={false}
                            placeholder="Paste test JSON here..."
                        />

                        {jsonError && (
                            <p className="mt-2 text-sm text-red-500">⚠️ {jsonError}</p>
                        )}
                    </div>

                    {/* Name Input */}
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <label className="block text-sm font-medium text-slate-500 mb-2">
                            Test Name
                        </label>
                        <input
                            type="text"
                            value={testName}
                            onChange={(e) => setTestName(e.target.value)}
                            placeholder="e.g. Cambridge 18 Test 1"
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Link
                            href="/admin/speaking"
                            className="flex-1 px-4 py-3 text-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            onClick={handleSave}
                            disabled={!!jsonError}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Save className="w-5 h-5" />
                            Save Test
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
