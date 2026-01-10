"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import apiFetch from '@/lib/api';

interface User {
    id: string | number;
    username: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    groups?: { name: string }[] | string[];
    roles?: string[];
    role_name?: string;
    is_superuser?: boolean;
    sidebar_config?: Record<string, boolean>;
}

interface UserContextType {
    user: User | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
    clearUser: () => void;
}

const UserContext = createContext<UserContextType>({
    user: null,
    loading: true,
    refreshUser: async () => { },
    clearUser: () => { },
});

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        console.log('[UserContext] Refreshing user...');
        try {
            const data = await apiFetch('/api/auth/me/');
            console.log('[UserContext] User data received:', JSON.stringify(data, null, 2));
            setUser(data);
        } catch (error: any) {
            // Only log actual errors, not expected 401/403 for unauthenticated users
            if (error?.status !== 401 && error?.status !== 403) {
                console.error("[UserContext] Failed to fetch user:", error);
            }
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const clearUser = () => {
        console.log('[UserContext] Clearing user');
        setUser(null);
    };

    useEffect(() => {
        refreshUser();
    }, []);

    return (
        <UserContext.Provider value={{ user, loading, refreshUser, clearUser }}>
            {children}
        </UserContext.Provider>
    );
}

export const useUser = () => useContext(UserContext);
