'use client';

import React, { useState, useEffect } from 'react';
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
    Clock,
} from 'lucide-react';

const API_URL = '/api/ielts';

export default function AdminListeningNewPage() {
    const { isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [jsonContent, setJsonContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

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

    const handleSubmit = async () => {
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

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/admin/import-test/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: title.trim(),
                    module_type: 'listening',
                    json_data: parsedJson,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create test');
            }

            setSuccess(`Test "${title}" created! Redirecting to set timestamps...`);

            // Redirect to timestamp editor after creation
            setTimeout(() => {
                router.push(`/admin/listening/${data.test_id}`);
            }, 1500);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
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
            title="Create Listening Test"
            subtitle="Import from JSON"
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
                        onClick={handleSubmit}
                        disabled={loading || !title.trim() || !jsonContent.trim()}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[#6FB63A] hover:bg-[#5fa030] text-white rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
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
                        placeholder="e.g. Cambridge 15 Listening Test 1"
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
                        placeholder='{"sections": [{"section": 1, "questions": [...]}], "answer_key": {...}}'
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

                {/* Timestamp Info */}
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-amber-800">Timestamps Setup</h3>
                        <p className="text-sm text-amber-700 mt-1">
                            After creating the test, you'll be redirected to set audio timestamps for each section.
                            This allows the audio to auto-switch between Part 1, Part 2, etc.
                        </p>
                    </div>
                </div>

                {/* Help */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <h3 className="font-semibold text-blue-800 mb-2">Expected JSON Format</h3>
                    <pre className="text-xs text-blue-700 bg-blue-100/50 p-3 rounded-lg overflow-x-auto">
                        {`{
  "sections": [
    {
      "section": 1,
      "question_type": "Completion",
      "questions": [
        {"q": 1, "type": "text", "question": "What is the..."},
        {"q": 2, "type": "mcq", "question": "...", "options": ["A", "B", "C"]}
      ]
    }
  ],
  "answer_key": {
    "1": ["answer1"],
    "2": ["B"]
  }
}`}
                    </pre>
                </div>
            </div>
        </AdminLayout>
    );
}
