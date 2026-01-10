'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import {
    User,
    Calendar,
    Target,
    Mail,
    Save,
    Loader2
} from 'lucide-react';

export default function ProfilePage() {
    const { user, isLoading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        target_score: '',
        exam_date: '',
        test_type: 'academic',
        purpose: 'study_abroad',
    });

    // Load data from Auth Context or fetch fresh
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await fetch('/api/ielts/auth/me/', { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.user?.profile) {
                        setFormData({
                            target_score: data.user.profile.target_score?.toString() || '',
                            exam_date: data.user.profile.exam_date || '',
                            test_type: data.user.profile.test_type || 'academic',
                            purpose: data.user.profile.purpose || 'study_abroad',
                        });
                    }
                }
            } catch (e) {
                console.error("Failed to load profile", e);
            }
        };
        fetchProfile();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/ielts/auth/onboarding/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include',
            });

            if (!res.ok) throw new Error('Failed to update profile');

            setSuccess('Profile updated successfully!');
            // Reload page to reflect changes in auth context if needed? 
            // Better to update local state or re-fetch me

        } catch (err) {
            setError('Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#0B1F3A] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6FB63A]"></div>
            </div>
        );
    }

    return (
        <AdminLayout
            title="My Profile"
            subtitle="Manage your personal information and study goals"
        >
            <div className="max-w-4xl mx-auto space-y-8">

                {/* User Info Card */}
                <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm flex items-start gap-6">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-3xl">
                        👑
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-slate-900">{user?.name}</h2>
                        <div className="flex items-center gap-2 text-slate-500 mt-1">
                            <Mail className="w-4 h-4" />
                            <span>{user?.email}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${user?.account_type === 'crm' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                {user?.account_type === 'crm' ? 'CRM Student' : 'Standard Account'}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${user?.subscription_status === 'premium' || user?.subscription_status === 'crm_full'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                {user?.subscription_status?.replace('_', ' ').toUpperCase()} Plan
                            </span>
                        </div>
                    </div>
                </div>

                {/* Goals & Settings Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Target className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Study Goals</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Target Band Score</label>
                            <div className="relative">
                                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="number"
                                    step="0.5"
                                    max="9"
                                    min="0"
                                    value={formData.target_score}
                                    onChange={(e) => setFormData({ ...formData, target_score: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="e.g. 7.5"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Exam Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="date"
                                    value={formData.exam_date}
                                    onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Test Type</label>
                            <select
                                value={formData.test_type}
                                onChange={(e) => setFormData({ ...formData, test_type: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            >
                                <option value="academic">Academic</option>
                                <option value="general">General Training</option>
                            </select>
                        </div>
                    </div>

                    {success && (
                        <div className="mt-6 p-3 bg-green-50 text-green-700 rounded-xl text-sm font-medium flex items-center gap-2">
                            <Save className="w-4 h-4" />
                            {success}
                        </div>
                    )}

                    {error && (
                        <div className="mt-6 p-3 bg-red-50 text-red-700 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="mt-8 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-[#6FB63A] text-white px-6 py-2.5 rounded-xl font-medium shadow-sm hover:bg-[#5fa030] transition-colors flex items-center gap-2 disabled:opacity-70"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
}
