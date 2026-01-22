'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession, signOut } from "next-auth/react";

interface User {
    id: number;
    username: string;
    name: string;
    email?: string;
    role: 'student' | 'admin';
    is_staff?: boolean;
    is_superuser?: boolean;
    account_type?: 'crm' | 'self_signup';
    subscription_status?: 'free' | 'premium' | 'crm_full';
    has_full_access?: boolean;
    evaluations_remaining?: number;
    // IELTS Profile fields (from onboarding)
    onboarding_completed?: boolean;
    purpose?: string;
    test_type?: string;
    attempt_type?: string;
    target_score?: number;
    exam_date?: string;
    referral_source?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (username: string, password: string, role: 'student' | 'admin') => Promise<boolean>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    isAuthenticated: boolean;
    isAdmin: boolean;
    token: string | null;
    setAuthState: (user: User, token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load user from localStorage on mount and verify session
    useEffect(() => {
        const initAuth = async () => {
            const savedUser = localStorage.getItem('ielts_user');
            const savedToken = localStorage.getItem('ielts_token');

            if (savedUser && savedToken) {
                try {
                    setUser(JSON.parse(savedUser));
                    setToken(savedToken);

                    // Proactively verify the session with the backend
                    const meResponse = await fetch(`/api/auth/me/`, {
                        credentials: 'include',
                    });

                    if (!meResponse.ok) {
                        // Backend session is invalid, trigger logout
                        console.warn('Backend session expired on mount, logging out.');
                        logout();
                    } else {
                        // Refresh user data to be sure
                        const userData = await meResponse.json();
                        // (Optional: update user state with fresh data here)
                    }
                } catch (e) {
                    console.error('Auth initialization error:', e);
                    // Just clear storage on parse error, don't necessarily logout/redirect
                    localStorage.removeItem('ielts_user');
                    localStorage.removeItem('ielts_token');
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    // Global listener for unauthorized events (e.g., 401 from any API call)
    useEffect(() => {
        const handleUnauthorized = () => {
            console.warn('Unauthorized event received, logging out.');
            logout();
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    // Periodic session check (every 5 minutes)
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/auth/me/', { credentials: 'include' });
                if (!res.ok) {
                    console.warn('Periodic session check failed, logging out.');
                    logout();
                }
            } catch (error) {
                console.error('Periodic check error:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(interval);
    }, [user]);

    // Sync with NextAuth session (Google Login)
    const { data: session } = useSession();
    useEffect(() => {
        if (session?.user && !user) {
            const googleUser: User = {
                id: 0, // Placeholder ID for external auth
                username: session.user.email || "",
                name: session.user.name || session.user.email || "",
                email: session.user.email || undefined,
                role: 'student', // Default role
            };
            setUser(googleUser);
        }
    }, [session, user]);

    // Try local JSON auth first (for development and standalone use)
    const tryLocalAuth = async (username: string, password: string, role: 'student' | 'admin'): Promise<boolean> => {
        try {
            const response = await fetch('/data/users.json');
            const data = await response.json();

            const users = role === 'admin' ? data.admins : data.students;
            const foundUser = users.find(
                (u: { username: string; password: string }) => u.username === username && u.password === password
            );

            if (foundUser) {
                const loggedInUser: User = {
                    id: foundUser.id,
                    username: foundUser.username,
                    name: foundUser.name,
                    role: role,
                    is_staff: role === 'admin',
                };
                setUser(loggedInUser);
                localStorage.setItem('ielts_user', JSON.stringify(loggedInUser));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Local auth error:', error);
            return false;
        }
    };

    // Try Django auth (for production with CRM integration)
    const tryDjangoAuth = async (username: string, password: string, role: 'student' | 'admin'): Promise<boolean> => {
        try {
            // Use relative path so cookies are set for the correct domain (via Next.js rewrites)
            const response = await fetch(`/api/auth/login/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                // Django auth uses JWT cookies, not JSON response with token
                // Call /me to get user info (also via relative path)
                const meResponse = await fetch(`/api/auth/me/`, {
                    credentials: 'include',
                });

                if (meResponse.ok) {
                    const userData = await meResponse.json();

                    // Check if user has correct role
                    const isStaff = userData.is_superuser || userData.roles?.includes('Admin');
                    if (role === 'admin' && !isStaff) {
                        console.error('User is not an admin');
                        return false;
                    }

                    const loggedInUser: User = {
                        id: userData.id,
                        username: userData.username,
                        name: userData.first_name
                            ? `${userData.first_name} ${userData.last_name || ''}`.trim()
                            : userData.username,
                        email: userData.email,
                        role: isStaff ? 'admin' : 'student',
                        is_staff: isStaff,
                        is_superuser: userData.is_superuser,
                        account_type: userData.account_type,
                        subscription_status: userData.subscription_status,
                        has_full_access: userData.has_full_access,
                        evaluations_remaining: userData.evaluations_remaining,
                    };

                    setUser(loggedInUser);
                    setToken('django-cookie-auth'); // Mark as Django auth
                    localStorage.setItem('ielts_user', JSON.stringify(loggedInUser));
                    localStorage.setItem('ielts_token', 'django-cookie-auth');
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Django auth error:', error);
            return false;
        }
    };

    const login = async (username: string, password: string, role: 'student' | 'admin'): Promise<boolean> => {
        // Try Django auth first (sets JWT cookies needed for API calls)
        const djangoSuccess = await tryDjangoAuth(username, password, role);
        if (djangoSuccess) {
            console.log('Logged in via Django auth');
            return true;
        }

        // If Django fails, try local JSON auth (for development/offline use)
        const localSuccess = await tryLocalAuth(username, password, role);
        if (localSuccess) {
            console.log('Logged in via local JSON auth');
            return true;
        }

        return false;
    };

    const refreshUser = async (): Promise<void> => {
        try {
            const res = await fetch('/api/ielts/auth/me/', {
                credentials: 'include',
            });

            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    // Merge fresh data with existing user, preserving role info
                    const updatedUser: User = {
                        ...user,
                        ...data.user,
                        role: user?.role || 'student',
                        is_staff: user?.is_staff || false,
                    };
                    setUser(updatedUser);
                    localStorage.setItem('ielts_user', JSON.stringify(updatedUser));
                }
            }
        } catch (error) {
            console.error('Failed to refresh user data:', error);
        }
    };

    const logout = async () => {
        try {
            // Try Django logout if we were using Django auth
            if (token === 'django-cookie-auth') {
                await fetch(`/api/auth/logout/`, {
                    method: 'POST',
                    credentials: 'include',
                });
            }
            // Also clear IELTS student session cookies to prevent auto-login
            // when switching between admin and student panels
            try {
                await fetch(`/api/ielts/auth/logout/`, {
                    method: 'POST',
                    credentials: 'include',
                });
            } catch (e) {
                // Ignore 404s if endpoint doesn't exist
            }

            // Sign out from NextAuth if session exists
            if (session) {
                await signOut({ redirect: false });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            setToken(null);
            localStorage.removeItem('ielts_user');
            localStorage.removeItem('ielts_token');
            localStorage.removeItem('ielts_onboarding_completed');
            localStorage.removeItem('ielts_onboarding_data');
            // Redirect to login page with logout flag to prevent auto-login
            if (typeof window !== 'undefined') {
                const currentPath = window.location.pathname;
                if (currentPath !== '/login') {
                    window.location.href = '/login?logout=true';
                }
            }
        }
    };

    const setAuthState = (newUser: User, newToken: string) => {
        setUser(newUser);
        setToken(newToken);
        localStorage.setItem('ielts_user', JSON.stringify(newUser));
        localStorage.setItem('ielts_token', newToken);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                login,
                logout,
                refreshUser,
                isAuthenticated: !!user,
                isAdmin: user?.role === 'admin' || user?.is_staff === true,
                token,
                setAuthState,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
