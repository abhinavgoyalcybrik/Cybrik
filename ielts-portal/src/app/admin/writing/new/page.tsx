'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
    Shield,
    PenTool,
    Mic,
    Users,
    Settings,
    LogOut,
    Home,
    ChevronRight,
    Headphones,
    BookOpen,
    ArrowLeft,
    Save,
    Upload,
    Code,
    FileImage,
    Copy,
    Check,
} from 'lucide-react';

const navItems = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Writing Tests', href: '/admin/writing', icon: PenTool },
    { name: 'Speaking Tests', href: '/admin/speaking', icon: Mic },
    { name: 'Listening Tests', href: '/admin/listening', icon: Headphones },
    { name: 'Reading Tests', href: '/admin/reading', icon: BookOpen },
    { name: 'Manage Users', href: '/admin/users', icon: Users },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
];

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
            <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-900 text-white">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-800 border-r border-zinc-700 flex flex-col">
                <div className="p-6 border-b border-zinc-700">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-600 p-2 rounded-lg">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg">Admin Panel</h1>
                            <p className="text-xs text-zinc-400">IELTS Portal</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = item.href === '/admin/writing';
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-red-600 text-white'
                                    : 'text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.name}</span>
                                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-zinc-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-sm">{user?.name}</p>
                            <p className="text-xs text-zinc-400">Administrator</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 p-8">
                <div className="max-w-5xl">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <Link
                            href="/admin/writing"
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h2 className="text-3xl font-bold">Add New Writing Test</h2>
                            <p className="text-zinc-400 mt-1">Upload JSON and Image</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* JSON Editor */}
                        <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Code className="w-5 h-5 text-amber-500" />
                                    <h3 className="text-lg font-bold">Test JSON</h3>
                                </div>
                                <button
                                    onClick={handleCopyJson}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-4 h-4 text-green-400" />
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
                                className="w-full h-96 p-4 bg-zinc-900 border border-zinc-600 rounded-lg text-sm font-mono text-green-400 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                                spellCheck={false}
                                placeholder="Paste test JSON here..."
                            />

                            {jsonError && (
                                <p className="mt-2 text-sm text-red-400">⚠️ {jsonError}</p>
                            )}
                        </div>

                        {/* Settings & Upload */}
                        <div className="space-y-6">
                            {/* Name Input */}
                            <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Test Name
                                </label>
                                <input
                                    type="text"
                                    value={testName}
                                    onChange={(e) => setTestName(e.target.value)}
                                    placeholder="e.g. Cambridge 18 Test 1"
                                    className="w-full px-4 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                            </div>

                            {/* Image Upload */}
                            <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileImage className="w-5 h-5 text-blue-500" />
                                    <h3 className="text-lg font-bold">Chart/Image Upload</h3>
                                </div>

                                <div
                                    className="border-2 border-dashed border-zinc-600 rounded-lg p-8 text-center hover:border-zinc-500 transition-colors cursor-pointer"
                                    onClick={() => document.getElementById('imageInput')?.click()}
                                >
                                    {imagePreview ? (
                                        <div>
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="max-h-48 mx-auto rounded-lg mb-4"
                                            />
                                            <p className="text-sm text-zinc-400">{selectedImage?.name}</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <Upload className="w-12 h-12 mx-auto text-zinc-500 mb-4" />
                                            <p className="text-zinc-400 mb-2">Click to upload chart image</p>
                                            <p className="text-xs text-zinc-500">PNG, JPG, or WebP</p>
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
                                    <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                                        <p className="text-sm text-green-400">
                                            ✅ Image auto-uploaded! JSON updated.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Link
                                    href="/admin/writing"
                                    className="flex-1 px-4 py-3 text-center bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </Link>
                                <button
                                    onClick={handleSave}
                                    disabled={!!jsonError}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save className="w-5 h-5" />
                                    Save Test
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

