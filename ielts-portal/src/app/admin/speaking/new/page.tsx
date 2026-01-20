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
    Code,
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
                        const isActive = item.href === '/admin/speaking';
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
                <div className="max-w-4xl">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8">
                        <Link
                            href="/admin/speaking"
                            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h2 className="text-3xl font-bold">Add New Speaking Test</h2>
                            <p className="text-zinc-400 mt-1">Upload JSON and Name</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {/* JSON Editor */}
                        <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Code className="w-5 h-5 text-emerald-500" />
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
                                className="w-full h-[500px] p-4 bg-zinc-900 border border-zinc-600 rounded-lg text-sm font-mono text-green-400 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                spellCheck={false}
                                placeholder="Paste test JSON here..."
                            />

                            {jsonError && (
                                <p className="mt-2 text-sm text-red-400">⚠️ {jsonError}</p>
                            )}
                        </div>

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
                                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <Link
                                href="/admin/speaking"
                                className="flex-1 px-4 py-3 text-center bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </Link>
                            <button
                                onClick={handleSave}
                                disabled={!!jsonError}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-5 h-5" />
                                Save Test
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

