'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    Save,
    Upload,
    Code,
    FileImage,
    Copy,
    Check,
} from 'lucide-react';

const sampleTest = {
    test_id: 44,
    difficulty: "medium",
    task_1: {
        type: "chart",
        question: "The chart below shows the percentage of households...",
        word_limit: 150,
        image_url: "/images/writing/test44_chart.png"
    },
    task_2: {
        question: "Some people believe that...",
        word_limit: 250
    }
};

export default function NewWritingTestPage() {
    const { user, isAdmin, logout, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [jsonContent, setJsonContent] = useState(JSON.stringify(sampleTest, null, 2));
    const [jsonError, setJsonError] = useState('');
    const [copied, setCopied] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

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
            if (!parsed.test_id || !parsed.task_1 || !parsed.task_2) {
                setJsonError('Missing required fields: test_id, task_1, task_2');
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

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);

            // Auto-upload the image
            try {
                const formData = new FormData();
                formData.append('file', file);

                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    // Update JSON with the actual uploaded image path
                    try {
                        const parsed = JSON.parse(jsonContent);
                        parsed.task_1.image_url = uploadData.imageUrl;
                        setJsonContent(JSON.stringify(parsed, null, 2));
                    } catch (e) {
                        console.error('Failed to update JSON with image URL');
                    }
                } else {
                    alert('Failed to upload image. Please try again.');
                }
            } catch (error) {
                console.error('Upload error:', error);
                // Fallback: just set filename in JSON
                try {
                    const parsed = JSON.parse(jsonContent);
                    parsed.task_1.image_url = `/images/writing/${file.name}`;
                    setJsonContent(JSON.stringify(parsed, null, 2));
                } catch (e) { }
            }
        }
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
            parsedTest.title = testName; // Add title to the test object based on input

            // Save to writing_tests.json via API
            const response = await fetch('/api/admin/writing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedTest),
            });

            if (response.ok) {
                alert('Test saved successfully!');
                router.push('/admin/writing');
            } else {
                const error = await response.json();
                alert(`Error saving: ${error.error || 'Unknown error'}`);
            }
        } catch (error) {
            // Fallback: copy to clipboard
            const instructions = `To add this test:
1. Copy the JSON below
2. Open: public/data/writing_tests.json
3. Add this object to the "tests" array (ensure "title": "${testName}" is included)
4. ${selectedImage ? `Image uploaded` : 'No image'}

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
            title="Add New Writing Test"
            subtitle="Upload JSON and Chart Image"
        >
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* JSON Editor */}
                    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Code className="w-5 h-5 text-amber-500" />
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
                            className="w-full h-96 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                            spellCheck={false}
                            placeholder="Paste test JSON here..."
                        />

                        {jsonError && (
                            <p className="mt-2 text-sm text-red-500">⚠️ {jsonError}</p>
                        )}
                    </div>

                    {/* Settings & Upload */}
                    <div className="space-y-6">
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
                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                            />
                        </div>

                        {/* Image Upload */}
                        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <FileImage className="w-5 h-5 text-blue-500" />
                                <h3 className="text-lg font-bold text-slate-900">Task 1 Chart/Image</h3>
                            </div>

                            <div
                                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer bg-slate-50"
                                onClick={() => document.getElementById('imageInput')?.click()}
                            >
                                {imagePreview ? (
                                    <div>
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="max-h-48 mx-auto rounded-lg mb-4 shadow-sm"
                                        />
                                        <p className="text-sm text-slate-500">{selectedImage?.name}</p>
                                    </div>
                                ) : (
                                    <div>
                                        <Upload className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                                        <p className="text-slate-600 mb-2 font-medium">Click to upload chart image</p>
                                        <p className="text-xs text-slate-400">PNG, JPG, or WebP</p>
                                    </div>
                                )}
                            </div>
                            <input
                                id="imageInput"
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                            />

                            {selectedImage && (
                                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <p className="text-sm text-green-600 font-medium">
                                        ✅ Image uploaded! JSON updated with path.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Link
                                href="/admin/writing"
                                className="flex-1 px-4 py-3 text-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </Link>
                            <button
                                onClick={handleSave}
                                disabled={!!jsonError}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                <Save className="w-5 h-5" />
                                Save Test
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
