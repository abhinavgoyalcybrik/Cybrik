'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    accessMode: 'standalone' | 'crm_managed';
    subscriptionPlan?: 'free' | 'basic' | 'premium';
    subscriptionExpiry?: string;
    testsThisMonth: number;
    testsLimit: number;
    joinedDate: string;
}

export default function AccountPage() {
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(true);

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    useEffect(() => {
        if (!isAuthenticated) return;

        fetch('/api/account/profile')
            .then(res => {
                if (res.status === 401) {
                    router.push('/login');
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (data) {
                    setProfile(data);
                    setName(data.name);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load profile:', err);
                setLoading(false);
            });
    }, [isAuthenticated, router]);

    const handleSave = async () => {
        await fetch('/api/account/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });

        setProfile(prev => prev ? { ...prev, name } : null);
        setIsEditing(false);
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg text-gray-600">Loading...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg text-gray-600">Unable to load profile. Please try again.</div>
            </div>
        );
    }

    const planColors = {
        free: 'bg-gray-100 text-gray-800 border-gray-300',
        basic: 'bg-blue-100 text-blue-800 border-blue-300',
        premium: 'bg-blue-100 text-blue-800 border-blue-300',
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
                    <p className="text-gray-600 mt-2">Manage your profile and subscription</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Profile Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6 border border-gray-200"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
                            {!isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                    Edit Profile
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            {/* Avatar */}
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white text-2xl font-bold">
                                    {profile.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Member since</p>
                                    <p className="font-medium text-gray-900">
                                        {new Date(profile.joinedDate).toLocaleDateString('en-US', {
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Full Name
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                ) : (
                                    <p className="text-gray-900 px-4 py-2 bg-gray-50 rounded-lg">{profile.name}</p>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email Address
                                </label>
                                <p className="text-gray-900 px-4 py-2 bg-gray-50 rounded-lg">{profile.email}</p>
                                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                            </div>

                            {/* Save/Cancel buttons */}
                            {isEditing && (
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleSave}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                    >
                                        Save Changes
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setName(profile.name);
                                        }}
                                        className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Subscription Card */}
                    {profile.accessMode === 'standalone' && profile.subscriptionPlan && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200"
                        >
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription</h2>

                            <div className={`inline-flex px-4 py-2 rounded-full text-sm font-semibold border-2 mb-4 ${planColors[profile.subscriptionPlan]}`}>
                                {profile.subscriptionPlan.charAt(0).toUpperCase() + profile.subscriptionPlan.slice(1)} Plan
                            </div>

                            <div className="space-y-3">
                                {profile.subscriptionPlan === 'free' && (
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-sm font-medium text-blue-900 mb-1">Tests Usage</p>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-blue-200 rounded-full h-2">
                                                <div
                                                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                                    style={{ width: `${(profile.testsThisMonth / profile.testsLimit) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-sm font-semibold text-blue-900">
                                                {profile.testsThisMonth}/{profile.testsLimit}
                                            </span>
                                        </div>
                                        <p className="text-xs text-blue-700 mt-2">
                                            Upgrade for unlimited tests
                                        </p>
                                    </div>
                                )}

                                {profile.subscriptionExpiry && (
                                    <div>
                                        <p className="text-sm text-gray-500">Expires on</p>
                                        <p className="font-medium text-gray-900">
                                            {new Date(profile.subscriptionExpiry).toLocaleDateString('en-US', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                )}

                                <a
                                    href="/account/subscription"
                                    className="block w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white text-center rounded-lg hover:from-blue-700 hover:to-green-700 transition-all font-medium mt-4"
                                >
                                    Manage Subscription
                                </a>
                            </div>
                        </motion.div>
                    )}

                    {/* CRM Managed Notice */}
                    {profile.accessMode === 'crm_managed' && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl shadow-lg p-6 border-2 border-blue-200"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <h2 className="text-xl font-semibold text-gray-900">Managed Access</h2>
                            </div>

                            <p className="text-gray-700 mb-4">
                                Your account is managed by your institution. Contact your administrator for subscription details.
                            </p>

                            {profile.subscriptionExpiry && (
                                <div className="p-3 bg-white rounded-lg border border-blue-200">
                                    <p className="text-sm text-gray-600">Access expires on</p>
                                    <p className="font-semibold text-gray-900">
                                        {new Date(profile.subscriptionExpiry).toLocaleDateString('en-US', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* Usage Statistics */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-6 bg-white rounded-2xl shadow-lg p-6 border border-gray-200"
                >
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage Statistics</h2>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                            <p className="text-sm font-medium text-blue-700 mb-1">Tests Completed</p>
                            <p className="text-3xl font-bold text-blue-900">{profile.testsThisMonth}</p>
                            <p className="text-xs text-blue-600 mt-1">This month</p>
                        </div>

                        <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                            <p className="text-sm font-medium text-green-700 mb-1">Average Score</p>
                            <p className="text-3xl font-bold text-green-900">7.5</p>
                            <p className="text-xs text-green-600 mt-1">Overall band</p>
                        </div>

                        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                            <p className="text-sm font-medium text-blue-700 mb-1">Study Streak</p>
                            <p className="text-3xl font-bold text-blue-900">12</p>
                            <p className="text-xs text-blue-600 mt-1">Days in a row</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

