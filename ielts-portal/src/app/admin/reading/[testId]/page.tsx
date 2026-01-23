'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    ArrowLeft,
    Upload,
    Download,
    FileJson,
    Check,
    AlertCircle,
    Loader2,
    Eye,
} from 'lucide-react';

interface PageProps {
    params: Promise<{ testId: string }>;
}

export default function AdminReadingEditPage({ params }: PageProps) {
    const { testId } = use(params);
    const { isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();

    const isNew = testId === 'new';

    // States
    const [title, setTitle] = useState('');
    const [jsonContent, setJsonContent] = useState('');
    const [originalJson, setOriginalJson] = useState<any>(null);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    // Load test data from local JSON
    useEffect(() => {
        if (!isNew && isAdmin) {
            loadTestFromLocalJson();
        }
    }, [isNew, isAdmin, testId]);

    const loadTestFromLocalJson = async () => {
        try {
            const res = await fetch('/data/reading_tests.json');
            if (!res.ok) throw new Error('Failed to load tests');
            const data = await res.json();

            // Find the test by ID
            const test = data.tests?.find((t: any) => String(t.id) === String(testId));

            if (test) {
                setTitle(test.title || `Reading Test ${testId}`);
                setOriginalJson(test);
                setJsonContent(JSON.stringify(test, null, 2));
            } else {
                setError(`Test "${testId}" not found in local data`);
            }
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
                JSON.parse(content); // Validate JSON
                setJsonContent(content);
                setError(null);
            } catch {
                setError('Invalid JSON file. Please check the file format.');
            }
        };
        reader.readAsText(file);
    };

    const handleDownload = () => {
        try {
            const parsed = JSON.parse(jsonContent);
            const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${testId}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setSuccess('JSON downloaded!');
            setTimeout(() => setSuccess(null), 2000);
        } catch {
            setError('Invalid JSON. Cannot download.');
        }
    };

    const validateJson = () => {
        try {
            JSON.parse(jsonContent);
            setError(null);
            setSuccess('JSON is valid!');
            setTimeout(() => setSuccess(null), 2000);
        } catch (e: any) {
            setError(`Invalid JSON: ${e.message}`);
        }
    };

    const handleSave = async () => {
        try {
            const parsed = JSON.parse(jsonContent);
            setSaving(true);
            setError(null);

            const res = await fetch('/api/admin/reading', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    testId: testId,
                    testData: parsed
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to save');
            }

            setSuccess('Saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (e: any) {
            setError(`Save failed: ${e.message}`);
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

    return (
        <AdminLayout
            title={isNew ? 'Create Reading Test' : `Edit: ${title}`}
            subtitle={isNew ? 'Import from JSON' : 'View and edit test JSON'}
            actions={
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/reading"
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Link>
                    {!isNew && (
                        <Link
                            href={`/tests/reading/answer-key/${testId}`}
                            target="_blank"
                            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-medium transition-colors border border-blue-200"
                        >
                            <Eye className="w-4 h-4" />
                            Preview
                        </Link>
                    )}
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

            <div className="max-w-5xl mx-auto space-y-6">
                {/* Title */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Test ID / Title
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent focus:outline-none transition-all"
                        placeholder="e.g. Reading Test 01RT01"
                    />
                </div>

                {/* JSON Editor */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700">
                                Test JSON Content
                            </label>
                            <p className="text-xs text-slate-500 mt-1">
                                Edit the JSON directly or upload a new file
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-medium cursor-pointer transition-colors border border-blue-200 text-sm">
                                <Upload className="w-4 h-4" />
                                Upload
                                <input
                                    type="file"
                                    accept=".json,application/json"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                            <button
                                onClick={validateJson}
                                className="flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg font-medium transition-colors border border-amber-200 text-sm"
                            >
                                <Check className="w-4 h-4" />
                                Validate
                            </button>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg font-medium transition-colors border border-slate-200 text-sm"
                            >
                                <Download className="w-4 h-4" />
                                Download
                            </button>
                            {!isNew && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#6FB63A] hover:bg-[#5fa030] text-white rounded-lg font-medium transition-colors shadow-sm text-sm disabled:opacity-50"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Save
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    <textarea
                        value={jsonContent}
                        onChange={(e) => setJsonContent(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-green-400 font-mono text-sm h-[500px] focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent focus:outline-none resize-none"
                        placeholder='{"passages": [...]}'
                        spellCheck={false}
                    />

                    {jsonContent && (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                            <FileJson className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500">
                                {(jsonContent.length / 1024).toFixed(1)} KB
                            </span>
                        </div>
                    )}
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <h3 className="font-semibold text-blue-800 mb-2">How to Edit Tests</h3>
                    <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Edit the JSON directly in the editor above</li>
                        <li>• Click &quot;Validate&quot; to check for JSON errors</li>
                        <li>• Click &quot;Download&quot; to save your changes as a JSON file</li>
                        <li>• Replace the corresponding file in <code className="bg-blue-100 px-1 rounded">public/data/reading_tests.json</code></li>
                        <li>• Deploy changes to see updates on production</li>
                    </ul>
                </div>
            </div>
        </AdminLayout>
    );
}
