// API configuration - uses relative paths that Next.js rewrites to Django
// For network access, the rewrites use NEXT_PUBLIC_API_URL from .env.local
const DJANGO_API_BASE = '';

export const API_ENDPOINTS = {
    // IELTS Service Base
    IELTS_BASE: `${DJANGO_API_BASE}/api/ielts`,

    // Admin endpoints
    ADMIN: {
        TESTS: `${DJANGO_API_BASE}/api/ielts/admin/tests`,
        MODULES: `${DJANGO_API_BASE}/api/ielts/admin/modules`,
        QUESTION_GROUPS: `${DJANGO_API_BASE}/api/ielts/admin/question-groups`,
        QUESTIONS: `${DJANGO_API_BASE}/api/ielts/admin/questions`,
        STATS: `${DJANGO_API_BASE}/api/ielts/admin/tests/stats`,
    },

    // Student endpoints
    STUDENT: {
        TESTS: `${DJANGO_API_BASE}/api/ielts/tests`,
        SESSIONS: `${DJANGO_API_BASE}/api/ielts/sessions`,
    },

    // AI Services
    SERVICES: {
        HANDWRITING: `${DJANGO_API_BASE}/api/ielts/analyze-handwriting`,
        TTS: `${DJANGO_API_BASE}/api/ielts/text-to-speech`,
        STT: `${DJANGO_API_BASE}/api/ielts/speech-to-text`,
    },

    // Auth (CRM)
    AUTH: {
        LOGIN: `${DJANGO_API_BASE}/api/auth/login`,
        LOGOUT: `${DJANGO_API_BASE}/api/auth/logout`,
        ME: `${DJANGO_API_BASE}/api/auth/me`,
    }
};

// Helper function to make authenticated API calls
export async function apiCall<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<{ data?: T; error?: string }> {
    try {
        const token = localStorage.getItem('ielts_token');

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Token ${token}` } : {}),
            ...options.headers,
        };

        const response = await fetch(endpoint, {
            ...options,
            headers,
            credentials: 'include',
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            }
            const errorData = await response.json().catch(() => ({}));
            return { error: errorData.detail || errorData.error || `Error: ${response.status}` };
        }

        const data = await response.json();
        return { data };
    } catch (error) {
        console.error('API call failed:', error);
        return { error: 'Network error. Please check your connection.' };
    }
}

// CRUD helper functions
export const api = {
    // GET request
    get: <T>(endpoint: string) => apiCall<T>(endpoint, { method: 'GET' }),

    // POST request
    post: <T>(endpoint: string, data: unknown) => apiCall<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    // PUT request
    put: <T>(endpoint: string, data: unknown) => apiCall<T>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    // PATCH request
    patch: <T>(endpoint: string, data: unknown) => apiCall<T>(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(data),
    }),

    // DELETE request
    delete: <T>(endpoint: string) => apiCall<T>(endpoint, { method: 'DELETE' }),
};

export default API_ENDPOINTS;
