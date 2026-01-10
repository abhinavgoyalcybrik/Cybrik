'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';

interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_superuser: boolean;
    roles: string[];
    role_name?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    const checkAuth = useCallback(async () => {
        try {
            const userData = await auth.me() as unknown as User;
            setUser(userData);
            setError(null);
        } catch (err) {
            setUser(null);
            // Only redirect if not already on login page
            if (pathname !== '/login') {
                router.push('/login');
            }
        } finally {
            setLoading(false);
        }
    }, [pathname, router]);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = async (username: string, password: string) => {
        setLoading(true);
        setError(null);
        try {
            await auth.login({ username, password });
            await checkAuth();
            router.push('/tenants');
        } catch (err: any) {
            setError(err.detail || 'Login failed');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await auth.logout();
        } catch (err) {
            // Ignore logout errors
        } finally {
            setUser(null);
            router.push('/login');
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!user,
        isSuperAdmin: user?.is_superuser ?? false,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    requireSuperAdmin: boolean = false
) {
    return function ProtectedComponent(props: P) {
        const { user, loading, isAuthenticated, isSuperAdmin } = useAuth();
        const router = useRouter();

        useEffect(() => {
            if (!loading) {
                if (!isAuthenticated) {
                    router.push('/login');
                } else if (requireSuperAdmin && !isSuperAdmin) {
                    router.push('/unauthorized');
                }
            }
        }, [loading, isAuthenticated, isSuperAdmin, router]);

        if (loading) {
            return (
                <div className="flex items-center justify-center h-screen">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            );
        }

        if (!isAuthenticated || (requireSuperAdmin && !isSuperAdmin)) {
            return null;
        }

        return <WrappedComponent {...props} />;
    };
}
