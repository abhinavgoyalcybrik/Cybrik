'use client';

import { useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
}

interface UseApiOptions {
    auth?: boolean;
}

export function useApi() {
    const [loading, setLoading] = useState(false);

    const getToken = () => localStorage.getItem('ielts_token');

    const request = useCallback(async <T>(
        endpoint: string,
        options: RequestInit = {},
        useAuth: boolean = true
    ): Promise<{ data: T | null; error: string | null }> => {
        setLoading(true);

        try {
            const token = getToken();
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
                ...(useAuth && token ? { 'Authorization': `Token ${token}` } : {}),
                ...options.headers,
            };

            const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include',
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || errorData.error || `Error: ${response.status}`;
                return { data: null, error: errorMessage };
            }

            // Handle empty responses (DELETE, etc.)
            const text = await response.text();
            const data = text ? JSON.parse(text) : null;
            return { data, error: null };
        } catch (error) {
            console.error('API request failed:', error);
            return { data: null, error: 'Network error. Please check your connection.' };
        } finally {
            setLoading(false);
        }
    }, []);

    const get = useCallback(<T>(endpoint: string) =>
        request<T>(endpoint, { method: 'GET' }), [request]);

    const post = useCallback(<T>(endpoint: string, data: unknown) =>
        request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        }), [request]);

    const put = useCallback(<T>(endpoint: string, data: unknown) =>
        request<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        }), [request]);

    const patch = useCallback(<T>(endpoint: string, data: unknown) =>
        request<T>(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }), [request]);

    const del = useCallback(<T>(endpoint: string) =>
        request<T>(endpoint, { method: 'DELETE' }), [request]);

    return { get, post, put, patch, del, loading, request };
}

// API endpoints
export const ENDPOINTS = {
    // Admin IELTS endpoints
    ADMIN: {
        TESTS: '/api/ielts/admin/tests/',
        TEST: (id: string) => `/api/ielts/admin/tests/${id}/`,
        STATS: '/api/ielts/admin/tests/stats/',
        MODULES: '/api/ielts/admin/modules/',
        MODULE: (id: string) => `/api/ielts/admin/modules/${id}/`,
        QUESTION_GROUPS: '/api/ielts/admin/question-groups/',
        QUESTION_GROUP: (id: string) => `/api/ielts/admin/question-groups/${id}/`,
        QUESTIONS: '/api/ielts/admin/questions/',
        QUESTION: (id: string) => `/api/ielts/admin/questions/${id}/`,
    },
    // Student IELTS endpoints
    STUDENT: {
        TESTS: '/api/ielts/tests/',
        TEST: (id: string) => `/api/ielts/tests/${id}/`,
        START_SESSION: (testId: string) => `/api/ielts/tests/${testId}/start_session/`,
        SESSIONS: '/api/ielts/sessions/',
    },
    // Services
    SERVICES: {
        HANDWRITING: '/api/ielts/analyze-handwriting/',
        TTS: '/api/ielts/text-to-speech/',
        STT: '/api/ielts/speech-to-text/',
    },
    // Auth
    AUTH: {
        LOGIN: '/api/auth/login/',
        LOGOUT: '/api/auth/logout/',
        ME: '/api/auth/me/',
    },
};

export { API_BASE };
