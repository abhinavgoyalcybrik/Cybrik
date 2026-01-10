'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
    User,
    Save,
    Key,
} from 'lucide-react';

// navItems removed as AdminLayout handles navigation

import AdminLayout from '@/components/AdminLayout';

export default function AdminSettingsPage() {
    const { user, isAdmin, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [profileName, setProfileName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/admin/login');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (user) {
            setProfileName(user.name || '');
        }
    }, [user]);

    const handleProfileSave = () => {
        alert(
            `To update your profile name to "${profileName}":\n\n` +
            `Edit users.json and change the "name" field for your admin account.`
        );
    };

    const handlePasswordChange = () => {
        if (newPassword !== confirmPassword) {
            alert('New passwords do not match!');
            return;
        }
        if (newPassword.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }
        alert(
            `To change your password:\n\n` +
            `Edit users.json and update the "password" field for your admin account.`
        );
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="Settings"
            subtitle="Manage your preferences"
        >
            <div className="max-w-2xl">
                {/* Profile Settings */}
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm mb-6">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-600" />
                        Profile
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Display Name
                            </label>
                            <input
                                type="text"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={user?.username || ''}
                                disabled
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400 mt-2">
                                Username cannot be changed
                            </p>
                        </div>
                        <button
                            onClick={handleProfileSave}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#6FB63A] hover:bg-[#5fa030] text-white rounded-xl font-medium transition-colors shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            Save Profile
                        </button>
                    </div>
                </div>

                {/* Password Settings */}
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <Key className="w-5 h-5 text-amber-500" />
                        Change Password
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all shadow-sm"
                            />
                        </div>
                        <button
                            onClick={handlePasswordChange}
                            disabled={!currentPassword || !newPassword || !confirmPassword}
                            className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Key className="w-4 h-4" />
                            Change Password
                        </button>
                    </div>
                </div>

                {/* Info Note */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                    <p>
                        <strong>Note:</strong> Settings are stored locally. To permanently change profile or password,
                        edit <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-mono text-blue-800">public/data/users.json</code>.
                    </p>
                </div>
            </div>
        </AdminLayout>
    );
}

