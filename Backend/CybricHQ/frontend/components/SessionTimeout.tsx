"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { clearCompleteSession } from '@/lib/clearSession';
import apiFetch from '@/lib/api';

const INACTIVITY_LIMIT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds (effectively disabled)

export default function SessionTimeout() {
    const router = useRouter();
    const { user, clearUser } = useUser();
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityRef = useRef<number>(Date.now());

    const handleLogout = useCallback(async () => {
        if (!user) return; // Already logged out

        console.log('[SessionTimeout] User inactive for too long. Logging out...');

        try {
            // Attempt server-side logout (best effort)
            await apiFetch('/api/auth/logout/', { method: 'POST' });
        } catch (e) {
            console.error("Logout error", e);
        } finally {
            clearUser();
            clearCompleteSession();
            router.push('/crm/login?reason=timeout');
        }
    }, [user, router, clearUser]);

    const resetTimer = useCallback(() => {
        lastActivityRef.current = Date.now();

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(handleLogout, INACTIVITY_LIMIT);
    }, [handleLogout]);

    useEffect(() => {
        if (!user) return;

        // Initial timer
        resetTimer();

        // Events to track activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

        // Throttle the event listener to avoid performance issues
        let throttleTimer: NodeJS.Timeout | null = null;

        const handleActivity = () => {
            if (!throttleTimer) {
                throttleTimer = setTimeout(() => {
                    resetTimer();
                    throttleTimer = null;
                }, 1000); // Only reset at most once per second
            }
        };

        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (throttleTimer) clearTimeout(throttleTimer);
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [user, resetTimer]);

    return null; // This component doesn't render anything
}
