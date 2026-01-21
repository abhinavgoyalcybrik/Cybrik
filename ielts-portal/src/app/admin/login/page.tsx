'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, LogIn, User, Lock } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const success = await login(username, password, 'admin');

        if (success) {
            router.push('/admin');
        } else {
            setError('Invalid admin credentials');
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <img src="/logo.png" alt="Cybrick Solutions" className="h-20 w-auto object-contain mx-auto mb-6" />
                    <h1 className="text-3xl font-bold text-slate-900">
                        Admin Panel
                    </h1>
                    <p className="text-slate-500 mt-2">
                        IELTS Portal Administration
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-200">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center border border-red-100 font-medium">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Admin Username
                            </label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter admin username"
                                    className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter password"
                                    className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#6FB63A] hover:bg-[#5fa030] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    Admin Login
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors"
                        >
                            <span className="text-lg">←</span> Student Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
