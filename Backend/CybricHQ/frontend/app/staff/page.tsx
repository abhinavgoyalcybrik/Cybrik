"use client";

import React, { useEffect, useState } from "react";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import DataGrid from "@/components/dashboard/DataGrid";
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/context/UserContext';

type User = {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_staff: boolean;
    is_superuser: boolean;
    date_joined: string;
    groups?: number[];
    roles?: string[];
};

export default function StaffPage() {
    const [staff, setStaff] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        role: 'counsellor',
        is_staff: true,
    });
    const [submitting, setSubmitting] = useState(false);

    // Permission Check
    const { user: currentUser, refreshUser } = useUser();
    const isAdmin = React.useMemo(() => {
        if (!currentUser) return false;

        // Check superuser first
        if (currentUser.is_superuser) return true;

        // Check role_name from custom RBAC system
        const roleName = (currentUser.role_name || '').toLowerCase();
        if (roleName === 'admin' || roleName === 'tenant admin') return true;

        // Legacy: check groups
        const groups = Array.isArray(currentUser.groups)
            ? currentUser.groups.map((g: any) => (typeof g === "string" ? g.toLowerCase() : (g.name || "").toLowerCase()))
            : [];
        return groups.includes("admin");
    }, [currentUser]);

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                const data = await apiFetch("/api/staff/");
                if (!mounted) return;
                setStaff(Array.isArray(data) ? data : data.results ?? []);
            } catch (err: any) {
                console.error(err);
                setError(err.message ?? "Failed to load staff");
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => {
            mounted = false;
        };
    }, []);

    const openCreateModal = () => {
        setEditingUser(null);
        setFormData({
            username: '',
            email: '',
            first_name: '',
            last_name: '',
            password: '',
            role: 'counsellor',
            is_staff: true,
        });
        setIsModalOpen(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        let role = 'counsellor';
        if (user.is_superuser) role = 'admin';

        setFormData({
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            password: '',
            role: role,
            is_staff: user.is_staff,
        });
        setIsModalOpen(true);
    };

    const handleDeleteStaff = async (id: number) => {
        if (!confirm("Are you sure you want to delete this staff member?")) return;
        try {
            await apiFetch(`/api/staff/${id}/`, { method: 'DELETE' });
            setStaff(prev => prev.filter(u => u.id !== id));
        } catch (err: any) {
            alert(err.message || "Failed to delete staff member");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const url = editingUser ? `/api/staff/${editingUser.id}/` : '/api/staff/';
            const method = editingUser ? 'PATCH' : 'POST';

            const payload: any = { ...formData };
            if (editingUser && !payload.password) {
                delete payload.password;
            }

            await apiFetch(url, {
                method: method,
                body: JSON.stringify(payload)
            });

            const data = await apiFetch("/api/staff/");
            setStaff(Array.isArray(data) ? data : data.results ?? []);

            // Refresh global user context if we updated ourselves
            if (editingUser && currentUser && editingUser.id === currentUser.id) {
                refreshUser();
            }

            setIsModalOpen(false);
        } catch (err: any) {
            alert(err.message || "Failed to save staff member");
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        {
            header: "Name",
            accessorKey: "username",
            cell: (user: User) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--cy-bg-page)] flex items-center justify-center text-[var(--cy-navy)] font-bold text-xs">
                        {user.first_name ? user.first_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-medium text-[var(--cy-navy)]">
                            {user.first_name} {user.last_name}
                        </div>
                        <div className="text-xs text-[var(--cy-text-muted)]">@{user.username}</div>
                    </div>
                </div>
            ),
        },
        {
            header: "Email",
            accessorKey: "email",
            cell: (user: User) => <span className="text-sm text-[var(--cy-text-secondary)]">{user.email}</span>,
        },
        {
            header: "Role",
            accessorKey: "is_staff",
            cell: (user: User) => {
                let roleBadge = <span className="badge badge-neutral">User</span>;

                if (user.is_superuser) {
                    roleBadge = <span className="badge badge-primary">Admin</span>;
                } else if (user.is_staff) {
                    roleBadge = <span className="badge badge-info">Staff</span>;
                }

                return (
                    <div className="flex gap-2">
                        {roleBadge}
                    </div>
                );
            },
        },
        {
            header: "Joined",
            accessorKey: "date_joined",
            cell: (user: User) => (
                <span className="text-xs text-[var(--cy-text-muted)]">
                    {new Date(user.date_joined).toLocaleDateString()}
                </span>
            ),
        },
        {
            header: "Actions",
            accessorKey: "id" as any,
            className: "text-right",
            cell: (user: User) => {
                if (!isAdmin) return null;
                return (
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => openEditModal(user)}
                            className="text-xs font-medium text-[var(--cy-lime-hover)] hover:text-[var(--cy-lime)] transition-colors"
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => handleDeleteStaff(user.id)}
                            className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                );
            }
        }
    ];

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-[calc(100vh-100px)]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--cy-lime)]"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <svg className="w-10 h-10 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Staff Management
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                Manage team members and their roles.
                            </p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={openCreateModal}
                                className="px-5 py-3 bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-xl font-bold hover:brightness-110 transition-all flex items-center gap-2"
                            >
                                Add New Staff
                            </button>
                        )}
                    </div>
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                        {error}
                    </div>
                )}

                <DataGrid
                    data={staff}
                    columns={columns as any}
                    title="Team Members"
                />

                {/* Add/Edit Staff Modal */}
                <AnimatePresence>
                    {isModalOpen && isAdmin && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
                            >
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-[var(--cy-navy)]">
                                        {editingUser ? 'Edit Staff Member' : 'Add New Staff Member'}
                                    </h3>
                                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.first_name}
                                                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.last_name}
                                                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.username}
                                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Password {editingUser && <span className="text-gray-400 font-normal">(Leave blank to keep current)</span>}
                                        </label>
                                        <input
                                            type="password"
                                            required={!editingUser}
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                        <select
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] outline-none bg-white"
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="counsellor">Counsellor</option>
                                            <option value="admissions">Admissions</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2">
                                        <input
                                            type="checkbox"
                                            id="is_staff"
                                            checked={formData.is_staff}
                                            onChange={e => setFormData({ ...formData, is_staff: e.target.checked })}
                                            className="rounded border-gray-300 text-[var(--cy-lime)] focus:ring-[var(--cy-lime)]"
                                        />
                                        <label htmlFor="is_staff" className="text-sm text-gray-700">Is Staff (Access to Dashboard)</label>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="flex-1 btn btn-primary flex justify-center"
                                        >
                                            {submitting ? 'Saving...' : (editingUser ? 'Update Staff' : 'Add Staff Member')}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}
