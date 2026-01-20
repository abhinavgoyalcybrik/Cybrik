'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Check } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        // Clear any stale onboarding data
        localStorage.removeItem('ielts_onboarding_completed');
        localStorage.removeItem('ielts_onboarding_data');

        setIsLoading(true);

        try {
            const response = await fetch('/api/ielts/auth/register/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    account_type: 'self_signup',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Registration failed');
                return;
            }

            localStorage.setItem('ielts_user', JSON.stringify(data.user));
            router.push('/onboarding');
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignUp = () => {
        setIsLoading(true);
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            // @ts-ignore
            google.accounts.id.initialize({
                client_id: '280708411866-aikji0349e6vqbeh66t7bujiaq9itpfe.apps.googleusercontent.com',
                callback: handleGoogleCallback,
            });
            // @ts-ignore
            google.accounts.id.prompt();
        };
        document.body.appendChild(script);
    };

    const handleGoogleCallback = async (response: any) => {
        try {
            const res = await fetch('/api/ielts/auth/google/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token: response.credential }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Google sign-up failed');
                setIsLoading(false);
                return;
            }

            localStorage.setItem('ielts_user', JSON.stringify(data.user));

            if (data.user.onboarding_completed) {
                router.push('/dashboard');
            } else {
                router.push('/onboarding');
            }
        } catch (err) {
            setError('Google authentication failed');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            {/* Background decorations - Subtle */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[100px] rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-600/10 blur-[100px] rounded-full"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <Link href="/">
                        <img src="/logo.png" alt="Cybrik IELTS" className="h-12 w-auto object-contain mx-auto mb-6 opacity-90 hover:opacity-100 transition-opacity" />
                    </Link>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Start Your Journey</h1>
                    <p className="text-slate-400">Join thousands of students achieving their dream score</p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Benefits Banner inside card */}
                    <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-start gap-3">
                        <div className="bg-emerald-100 p-1.5 rounded-full mt-0.5">
                            <Check className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-emerald-900 font-semibold text-sm">Free to get started</p>
                            <p className="text-emerald-700 text-xs mt-0.5">3 AI evaluations per week, unlimited practice tests</p>
                        </div>
                    </div>

                    <div className="p-8">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 mb-6 flex items-center gap-2">
                                <span className="block w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                {error}
                            </div>
                        )}

                        {/* Google Sign Up - Primary */}
                        <button
                            type="button"
                            onClick={handleGoogleSignUp}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl border border-slate-200 transition-all disabled:opacity-50 shadow-sm mb-6"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>

                        {/* Divider */}
                        <div className="relative flex items-center gap-4 mb-6">
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-xs font-medium text-slate-400 uppercase bg-white px-2">or sign up with email</span>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        {!showEmailForm ? (
                            <button
                                type="button"
                                onClick={() => setShowEmailForm(true)}
                                className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium py-3 px-4 border border-slate-200 rounded-xl transition-all"
                            >
                                <Mail className="w-5 h-5 text-slate-500" />
                                Continue with Email
                            </button>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                {/* Name Row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                                            First Name
                                        </label>
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                                            placeholder="John"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                                            Last Name
                                        </label>
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                                            placeholder="Doe"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                                            placeholder="you@example.com"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                                            placeholder="Min 6 characters"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                                        Confirm Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="password"
                                            name="confirmPassword"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                                            placeholder="Re-enter password"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-[#6FB63A] hover:bg-[#5da030] text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform active:scale-[0.99] duration-200"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Create Account
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowEmailForm(false)}
                                    className="w-full text-center text-sm text-slate-500 hover:text-slate-800 transition-colors py-1"
                                >
                                    Cancel
                                </button>
                            </form>
                        )}

                        {/* Login Link */}
                        <div className="mt-8 text-center border-t border-slate-100 pt-6">
                            <p className="text-sm text-slate-600">
                                Already have an account?{' '}
                                <Link href="/login" className="text-[#6FB63A] hover:text-[#5da030] font-semibold hover:underline">
                                    Sign in here
                                </Link>
                            </p>

                            <div className="mt-3">
                                <Link href="/admin/login" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                                    Access Admin Portal
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Back to Home - Outside */}
                <div className="mt-8 text-center">
                    <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 group">
                        <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
