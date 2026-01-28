"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import apiFetch from '@/lib/api';

/**
 * Tenant branding data from the backend API
 */
export interface TenantBranding {
    tenant_id: number | null;
    name: string;
    logo: string | null;
    favicon: string | null;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    font_family: string;
}

interface TenantContextType {
    branding: TenantBranding | null;
    loading: boolean;
    error: string | null;
    refreshBranding: () => Promise<void>;
}

// Default branding (fallback)
const DEFAULT_BRANDING: TenantBranding = {
    tenant_id: null,
    name: 'CybricHQ',
    logo: null,
    favicon: null,
    primary_color: '#2563eb',
    secondary_color: '#0f172a',
    accent_color: '#8b5cf6',
    font_family: 'Inter, system-ui, sans-serif',
};

const TenantContext = createContext<TenantContextType>({
    branding: DEFAULT_BRANDING,
    loading: true,
    error: null,
    refreshBranding: async () => { },
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
    const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshBranding = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch branding from authenticated endpoint
            const data = await apiFetch('/api/tenant/branding/');

            setBranding(data);

            // Apply CSS custom properties for dynamic theming
            applyBrandingColors(data);

            // Update favicon if provided
            if (data.favicon) {
                updateFavicon(data.favicon);
            }

            // Update document title
            if (data.name) {
                document.title = data.name;
            }
        } catch (err: any) {
            console.error('[TenantContext] Failed to fetch branding:', err);
            setError(err.message || 'Failed to load branding');
            // Keep default branding on error
            applyBrandingColors(DEFAULT_BRANDING);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshBranding();
    }, []);

    return (
        <TenantContext.Provider value={{ branding, loading, error, refreshBranding }}>
            {children}
        </TenantContext.Provider>
    );
}

/**
 * Hook to access tenant branding
 */
export const useTenant = () => useContext(TenantContext);

/**
 * Apply branding colors as CSS custom properties on :root
 */
function applyBrandingColors(branding: TenantBranding) {
    const root = document.documentElement;

    root.style.setProperty('--tenant-primary', branding.primary_color);
    root.style.setProperty('--tenant-secondary', branding.secondary_color);
    root.style.setProperty('--tenant-accent', branding.accent_color);
    root.style.setProperty('--tenant-font-family', branding.font_family);

    // Also generate RGB values for use with opacity
    const primaryRgb = hexToRgb(branding.primary_color);
    const secondaryRgb = hexToRgb(branding.secondary_color);
    const accentRgb = hexToRgb(branding.accent_color);

    if (primaryRgb) {
        root.style.setProperty('--tenant-primary-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
    }
    if (secondaryRgb) {
        root.style.setProperty('--tenant-secondary-rgb', `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`);
    }
    if (accentRgb) {
        root.style.setProperty('--tenant-accent-rgb', `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
    }
}

/**
 * Convert hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
}

/**
 * Update the page favicon
 */
function updateFavicon(url: string) {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = url;
}
