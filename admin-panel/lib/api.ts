import axios, { AxiosError } from 'axios';
import Cookies from 'js-cookie';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
    baseURL: API_BASE,
    withCredentials: true, // Important for HttpOnly cookies
    headers: {
        'Content-Type': 'application/json',
    },
});

// Response Interceptor for handling errors globally
api.interceptors.response.use(
    (response) => response.data,
    (error: AxiosError) => {
        if (error.response) {
            // Server responded with a status code outside 2xx
            if (error.response.status === 401) {
                // Unauthorized - Redirect to login
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                    window.location.href = '/login';
                }
            }
            return Promise.reject(error.response.data || error.message);
        } else if (error.request) {
            // Request made but no response received
            return Promise.reject('Network Error: No response received');
        } else {
            // Something happened in setting up the request
            return Promise.reject(error.message);
        }
    }
);

// Auth Helpers
export const auth = {
    login: (credentials: any) => api.post('/auth/login/', credentials),
    logout: () => api.post('/auth/logout/'),
    me: () => api.get('/auth/me/'),
    getToken: () => Cookies.get('access_token'), // If using manual token handling fallback
};

// Tenant API
export const tenantApi = {
    list: () => api.get('/admin/tenants/'),
    create: (data: any) => api.post('/admin/tenants/', data),
    get: (id: string) => api.get(`/admin/tenants/${id}/`),
    update: (id: string, data: any) => {
        // For FormData, let browser auto-set Content-Type with boundary
        // Setting it manually causes issues
        const config = data instanceof FormData ? { headers: { 'Content-Type': undefined } } : {};
        return api.patch(`/admin/tenants/${id}/`, data, config);
    },
    updateSettings: (id: string, data: any) => {
        // Update tenant settings/branding (separate endpoint)
        const config = data instanceof FormData ? { 
            headers: { 'Content-Type': 'multipart/form-data' }
        } : {};
        return api.patch(`/admin/tenants/${id}/update-settings/`, data, config);
    },
    delete: (id: string) => api.delete(`/admin/tenants/${id}/`),
    addSubscription: (id: string, planId: string) => api.post(`/admin/tenants/${id}/add_subscription/`, { plan_id: planId }),
    getProducts: () => api.get('/admin/products/'),
    dashboardStats: () => api.get('/admin/tenants/dashboard_stats/'),
};

// Product API (for billing/subscription management)
export const productApi = {
    list: () => api.get('/admin/products/'),
    create: (data: any) => api.post('/admin/products/', data),
    update: (id: string, data: any) => api.patch(`/admin/products/${id}/`, data),
    delete: (id: string) => api.delete(`/admin/products/${id}/`),
    createPlan: (productId: string, data: any) => api.post(`/admin/products/${productId}/plans/`, data),
    deletePlan: (productId: string, planId: string) => api.delete(`/admin/products/${productId}/plans/${planId}/`),
};

// Telephony API
export const telephonyApi = {
    getVoiceAgents: () => api.get('/tenant/voice-agents/'),
    createVoiceAgent: (data: any) => api.post('/tenant/voice-agents/', data),
    updateVoiceAgent: (id: string, data: any) => api.patch(`/tenant/voice-agents/${id}/`, data),
    deleteVoiceAgent: (id: string) => api.delete(`/tenant/voice-agents/${id}/`),

    getPhoneNumbers: () => api.get('/tenant/phone-numbers/'),
    createPhoneNumber: (data: any) => api.post('/tenant/phone-numbers/', data),

    getConfigs: () => api.get('/tenant/telephony-config/'),
    createConfig: (data: any) => api.post('/tenant/telephony-config/', data),
    updateConfig: (id: string, data: any) => api.patch(`/tenant/telephony-config/${id}/`, data),
    deleteConfig: (id: string) => api.delete(`/tenant/telephony-config/${id}/`),
};

// Usage Tracking API
export const usageApi = {
    // Admin endpoints (view all tenants)
    getSummaries: (params?: any) => api.get('/admin/usage/summaries/', { params }),
    getLogs: (params?: any) => api.get('/admin/usage/logs/', { params }),
    getAlerts: (params?: any) => api.get('/admin/usage/alerts/', { params }),
    getQuotas: () => api.get('/admin/usage/quotas/'),
    createQuota: (data: any) => api.post('/admin/usage/quotas/', data),
    updateQuota: (id: string, data: any) => api.patch(`/admin/usage/quotas/${id}/`, data),
    acknowledgeAlert: (id: string) => api.post(`/admin/usage/alerts/${id}/acknowledge/`),
    
    // Tenant endpoints (own usage only)
    getTenantDashboard: () => api.get('/tenant/usage/dashboard/'),
    getTenantHistory: (months: number = 6) => api.get('/tenant/usage/history/', { params: { months } }),
    getTenantLogs: (params?: any) => api.get('/tenant/usage/logs/', { params }),
};

