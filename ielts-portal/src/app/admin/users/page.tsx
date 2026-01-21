'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    Shield,
    PenTool,
    Mic,
    Users,
    Settings,
    LogOut,
    Home,
    ChevronRight,
    Plus,
    Edit,
    Trash2,
    Search,
    Image as ImageIcon,
} from 'lucide-react';

interface CRMStudent {
    id: number;
    username: string;
    email: string;
    account_type: string;
    subscription_status: string;
    password?: string; // Only present on creation response
}

export default function AdminUsersPage() {
    const { isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [students, setStudents] = useState<CRMStudent[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState<CRMStudent | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<number | null>(null);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        fetch('/api/ielts/admin/students/', { credentials: 'include' })
            .then((r) => r.json())
            .then((data) => {
                // API returns array directly, not { students: [...] }
                setStudents(Array.isArray(data) ? data : (data.students || []));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const filtered = students.filter(
        (s) =>
            s.username.toLowerCase().includes(search.toLowerCase()) ||
            s.email.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const payload = {
            email: formData.get('email') as string,
            name: formData.get('name') as string,
        };
        try {
            const res = await fetch('/api/ielts/admin/students/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include',
            });
            const data = await res.json();

            if (res.ok) {
                setShowModal(data);
                // refresh list
                const refreshed = await fetch('/api/ielts/admin/students/', { credentials: 'include' }).then((r) => r.json());
                setStudents(Array.isArray(refreshed) ? refreshed : (refreshed.students || []));
                form.reset();
            } else {
                alert(`Failed to create student: ${data.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Error creating student: Network or server error');
        }
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await fetch(`/api/ielts/admin/students/${id}/`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) {
                setStudents((prev) => prev.filter((s) => s.id !== id));
            } else {
                alert('Failed to delete');
            }
        } catch (e) {
            alert('Error deleting');
        }
        setShowDeleteModal(null);
    };

    const [editStudent, setEditStudent] = useState<CRMStudent | null>(null);
    const [editPassword, setEditPassword] = useState('');

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editStudent) return;

        try {
            const payload: any = {
                username: editStudent.username,
                email: editStudent.email,
            };
            if (editPassword) {
                payload.password = editPassword;
            }

            const res = await fetch(`/api/ielts/admin/students/${editStudent.id}/`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                credentials: 'include',
            });

            if (res.ok) {
                // Refresh list
                const refreshed = await fetch('/api/ielts/admin/students/', { credentials: 'include' }).then((r) => r.json());
                setStudents(Array.isArray(refreshed) ? refreshed : (refreshed.students || []));
                setEditStudent(null);
                setEditPassword('');
                alert('Student updated successfully');
            } else {
                const data = await res.json();
                alert(`Failed to update: ${data.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Error updating student');
        }
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="Manage Users"
            subtitle="CRM student accounts"
            actions={
                <form onSubmit={handleCreate} className="flex items-center gap-3">
                    <input
                        type="email"
                        name="email"
                        required
                        placeholder="Email"
                        className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6FB63A] shadow-sm"
                    />
                    <input
                        type="text"
                        name="name"
                        required
                        placeholder="Full Name"
                        className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6FB63A] shadow-sm"
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-[#6FB63A] hover:bg-[#5fa030] rounded-xl text-white font-medium shadow-sm transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Create
                    </button>
                </form>
            }
        >
            {/* Search */}
            <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by username or email"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none transition-all shadow-sm"
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Subscription</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-900 font-medium">{s.id}</td>
                                    <td className="px-6 py-4 text-sm text-slate-700">{s.username}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{s.email}</td>
                                    <td className="px-6 py-4 text-sm text-slate-700 capitalize">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.account_type === 'crm' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                                            }`}>
                                            {s.account_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700 capitalize">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.subscription_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                                            }`}>
                                            {s.subscription_status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditStudent(s);
                                                    setEditPassword('');
                                                }}
                                                className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteModal(s.id)}
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
                </div>
            )}

            {/* Edit Modal */}
            {editStudent && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 w-[480px] border border-slate-200 shadow-xl">
                        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-gray-500" />
                            Edit Student
                        </h3>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
                                <input
                                    type="text"
                                    value={editStudent.username}
                                    onChange={(e) => setEditStudent({ ...editStudent, username: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={editStudent.email}
                                    onChange={(e) => setEditStudent({ ...editStudent, email: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    New Password <span className="text-slate-400 font-normal">(Leave blank to keep current)</span>
                                </label>
                                <input
                                    type="password"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    placeholder="Set new password..."
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-amber-600 mt-2">
                                    Note: Existing password cannot be viewed for security reasons. Entering a value here will override it.
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setEditStudent(null)}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-[#6FB63A] text-white hover:bg-[#5fa030] rounded-xl font-medium transition-colors shadow-sm"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-96 border border-slate-200 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Student</h3>
                        <p className="text-slate-500 mb-6">Are you sure you want to delete this student? This action cannot be undone.</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(null)}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(showDeleteModal!)}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-xl font-medium transition-colors shadow-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Creation Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-96 border border-slate-200 shadow-xl">
                        <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4 mx-auto">
                            <Shield className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2 text-center">Student Created</h3>
                        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200 space-y-2">
                            <p className="text-sm text-slate-500 flex justify-between">
                                Username: <span className="font-mono text-slate-900 font-medium">{showModal.username}</span>
                            </p>
                            <p className="text-sm text-slate-500 flex justify-between">
                                Password: <span className="font-mono text-slate-900 font-medium">{showModal.password}</span>
                            </p>
                        </div>
                        <button
                            onClick={() => setShowModal(null)}
                            className="w-full px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 font-medium transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
