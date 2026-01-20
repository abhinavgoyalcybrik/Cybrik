'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, User, Lock, ArrowRight, Mail } from 'lucide-react';
import Link from 'next/link';

function LoginPageContent() {
    const [loginMethod, setLoginMethod] = useState<'google' | 'credentials'>('google');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Check if already logged in (skip if just logged out)
    useEffect(() => {
        const justLoggedOut = searchParams.get('logout') === 'true';

        // Skip auto-login check if user just logged out
        if (justLoggedOut) {
            // Clear the logout param from URL without triggering navigation
            window.history.replaceState({}, '', '/login');
            return;
        }

        const checkAuth = async () => {
            try {
                const res = await fetch('/api/ielts/auth/me/', {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.user) {
                        localStorage.setItem('ielts_user', JSON.stringify(data.user));
                        if (data.user.onboarding_completed) {
                            router.push('/dashboard');
                        } else {
                            router.push('/onboarding');
                        }
                    }
                }
            } catch (err) {
                // Not authenticated
            }
        };
        checkAuth();
    }, [router, searchParams]);

    const handleCredentialsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/ielts/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Login failed');
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
            setError('Network error. Please try again.');
            setIsLoading(false);
        }
    };

    // Load Google Sign-In on page load
    useEffect(() => {
        // Load the Google Identity Services library
        if (typeof window !== 'undefined' && !(window as any).google) {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => renderGoogleButton();
            document.body.appendChild(script);
        } else {
            renderGoogleButton();
        }
    }, []);

    const renderGoogleButton = () => {
        const google = (window as any).google;
        if (!google?.accounts?.id) return;

        google.accounts.id.initialize({
            client_id: '280708411866-aikji0349e6vqbeh66t7bujiaq9itpfe.apps.googleusercontent.com',
            callback: handleGoogleCallback,
        });

        // Render the Google button
        const googleBtnDiv = document.getElementById('google-signin-btn');
        if (googleBtnDiv) {
            googleBtnDiv.innerHTML = ''; // Clear any existing button
            google.accounts.id.renderButton(googleBtnDiv, {
                theme: 'outline',
                size: 'large',
                text: 'continue_with',
                shape: 'rectangular',
                width: 360,
            });
        }
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
                setError(data.error || 'Google sign-in failed');
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            {/* Background decorations - Subtle blobs for light theme */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-[#6FB63A]/10 blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/">
                        <img src="/logo.png" alt="Cybrik IELTS" className="h-16 w-auto object-contain mx-auto mb-6" />
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to IELTS Prep</h1>
                    <p className="text-slate-500">
                        Sign in to continue your journey
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center border border-red-100 font-medium mb-6">
                            {error}
                        </div>
                    )}


                    {/* Google Sign In - Rendered by Google API */}
                    <div id="google-signin-btn" className="flex justify-center mb-6">
                        {/* Loading placeholder while Google button loads */}
                        <div className="w-full max-w-[360px] h-[44px] bg-slate-100 rounded-md animate-pulse flex items-center justify-center">
                            <span className="text-sm text-slate-400">Loading Google Sign-In...</span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-sm text-slate-400">or</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Toggle for credentials */}
                    {loginMethod === 'google' ? (
                        <button
                            type="button"
                            onClick={() => setLoginMethod('credentials')}
                            className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors py-2"
                        >
                            Already have credentials? <span className="underline">Sign in with username</span>
                        </button>
                    ) : (
                        <>
                            {/* Username/Password Form */}
                            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Username
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Enter your username"
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
                                            placeholder="Enter your password"
                                            className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-[#6FB63A] hover:bg-[#5FA030] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <LogIn className="w-5 h-5" />
                                            Sign In
                                        </>
                                    )}
                                </button>
                            </form>

                            <button
                                type="button"
                                onClick={() => setLoginMethod('google')}
                                className="w-full text-center text-sm text-slate-500 hover:text-slate-700 transition-colors py-2 mt-4 flex items-center justify-center gap-1"
                            >
                                <ArrowRight className="w-4 h-4 rotate-180" />
                                Back to Google sign in
                            </button>
                        </>
                    )}

                    {/* Register Link */}
                    <p className="text-center text-sm text-slate-500 mt-6">
                        New here?{' '}
                        <Link href="/register" className="text-[#6FB63A] hover:text-[#5FA030] font-bold hover:underline">
                            Create an account
                        </Link>
                    </p>

                    <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                        <Link href="/admin/login" className="text-xs text-slate-400 hover:text-blue-500 transition-colors">
                            Admin Login
                        </Link>
                    </div>
                </div>

                {/* Back to Home */}
                <div className="mt-8 text-center">
                    <Link href="/" className="text-sm text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-2 font-medium">
                        <ArrowRight className="w-4 h-4 rotate-180" />
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#6FB63A] border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <LoginPageContent />
        </Suspense>
    );
}
