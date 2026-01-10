'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    Plus,
    Edit,
    Trash2,
    Search,
    Image as ImageIcon,
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

export default function AdminWritingPage() {
    const { isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [tests, setTests] = useState<WritingTest[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState<number | null>(null);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        fetch('/data/writing_tests.json')
            .then((r) => r.json())
            .then((data) => {
                setTests(data.tests || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const filteredTests = tests.filter(
        (test) =>
            test.task_1.question.toLowerCase().includes(search.toLowerCase()) ||
            test.task_2.question.toLowerCase().includes(search.toLowerCase()) ||
            test.task_1.type.toLowerCase().includes(search.toLowerCase())
    );

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="Writing Tests"
            subtitle="Manage all writing practice tests"
            actions={
                <Link
                    href="/admin/writing/new"
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#6FB63A] hover:bg-[#5fa030] text-white rounded-xl font-medium shadow-sm transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add New Test
                </Link>
            }
        >
            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tests by question or type..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all shadow-sm"
                />
            </div>

            {/* Tests Table */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A] mx-auto"></div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Difficulty</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Task 1 Preview</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Image</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredTests.map((test) => (
                                <tr key={test.test_id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{test.test_id}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 capitalize border border-blue-100">
                                            {test.task_1.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-2.5 py-0.5 text-xs font-medium rounded-full capitalize border ${test.difficulty === 'hard'
                                                ? 'bg-red-50 text-red-700 border-red-100'
                                                : test.difficulty === 'medium'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                    : 'bg-green-50 text-green-700 border-green-100'
                                                }`}
                                        >
                                            {test.difficulty}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                                        {test.task_1.question.slice(0, 60)}...
                                    </td>
                                    <td className="px-6 py-4">
                                        {test.task_1.image_url ? (
                                            <ImageIcon className="w-5 h-5 text-[#6FB63A]" />
                                        ) : (
                                            <ImageIcon className="w-5 h-5 text-slate-300" />
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                href={`/admin/writing/${test.test_id}`}
                                                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Link>
                                            <button
                                                onClick={() => setShowDeleteModal(test.test_id)}
                                                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredTests.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            No tests found
                        </div>
                    )}
                </div>
            )}

            <p className="mt-4 text-sm text-slate-500">
                Total: {filteredTests.length} tests
            </p>

            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Test</h3>
                        <p className="text-slate-500 mb-6">
                            Are you sure you want to delete Test #{showDeleteModal}? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteModal(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        const response = await fetch(`/api/admin/writing?id=${showDeleteModal}`, {
                                            method: 'DELETE',
                                        });
                                        if (response.ok) {
                                            setTests(tests.filter(t => t.test_id !== showDeleteModal));
                                            setShowDeleteModal(null);
                                            alert('Test deleted successfully!');
                                        } else {
                                            const error = await response.json();
                                            alert(`Error: ${error.error || 'Failed to delete'}`);
                                        }
                                    } catch (error) {
                                        alert('Failed to delete test. Please try again.');
                                    }
                                }}
                                className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 font-medium transition-colors shadow-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
