"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/context/UserContext';
import { useTenant } from '@/context/TenantContext';
import apiFetch from '@/lib/api';
import { clearCompleteSession } from '@/lib/clearSession';
import SessionTimeout from './SessionTimeout';


interface DashboardLayoutProps {
    children: React.ReactNode;
    user?: any; // Optional override, but we prefer context
}

// Define all possible nav items with their required roles
// roles: undefined = all, or array of allowed roles
const allNavItems = [
    {
        label: 'Overview', href: '/dashboard', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        ),
        roles: ['admin', 'counsellor', 'admissions']
    },
    {
        label: 'Leads', href: '/leads', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        ),
        roles: ['admin', 'counsellor', 'admissions']
    },
    {
        label: 'Applications', href: '/applications', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        ),
        roles: ['admin', 'counsellor', 'admissions']
    },
    {
        label: 'Tasks', href: '/tasks', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
        ),
        roles: ['admin', 'counsellor', 'admissions']
    },
    {
        label: 'Calls', href: '/calls', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
        ),
        roles: ['admin', 'counsellor']
    },

    {
        label: 'Staff', href: '/staff', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        ),
        roles: ['admin']
    },
    {
        label: 'Reports', href: '/reports', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        ),
        roles: ['admin']
    },
    {
        label: 'Tools', href: '/tools', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        ),
        roles: ['admin']
    },
    {
        label: 'Marketing', href: '/marketing/ads', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
        ),
        roles: ['admin']
    },
    {
        label: 'Messaging', href: '/settings/messaging', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        ),
        roles: ['admin']
    },
    {
        label: 'Settings', href: '/settings/dashboard', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        ),
        roles: ['admin']
    },
    {
        label: 'Password', href: '/settings/password', icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        ),
        roles: ['admin', 'counsellor', 'staff', 'user']
    },
];

export default function DashboardLayout({ children, user: initialUser }: DashboardLayoutProps) {
    const pathname = usePathname() || '';
    const [isSidebarOpen, setSidebarOpen] = useState(true);

    // Use global context, but allow prop override if provided
    const { user: contextUser, loading: contextLoading, refreshUser } = useUser();
    const { branding } = useTenant();
    const user = initialUser || contextUser;
    const loading = !initialUser && contextLoading;

    const navItems = useMemo(() => {
        if (!user) return []; // Wait for user to load

        // Map of sidebar item keys to nav items
        const sidebarKeyMap: Record<string, string> = {
            'dashboard': '/dashboard',
            'leads': '/leads',
            'applications': '/applications',
            'calls': '/calls',
            'tasks': '/tasks',
            'staff': '/staff',
            'documents': '/documents',
            'analytics': '/reports',
            'tools': '/tools',
            'followups': '/tasks',
            'settings': '/settings/dashboard',
            'password': '/settings/password',
            'ai_insights': '/ai-insights',
            'marketing': '/marketing/ads',
        };

        const sidebar_config = user?.sidebar_config || {};
        const isSuperUser = user?.is_superuser;

        // If superuser, show all items
        // If superuser, show all items
        if (isSuperUser) {
            return allNavItems;
        }

        // Filter nav items based on sidebar_config AND roles
        return allNavItems.filter(item => {
            // Check role requirements first (if defined)
            if (item.roles && item.roles.length > 0) {
                // Use role_name from custom RBAC system, fallback to groups for legacy support
                let userRole = (user?.role_name || user?.groups?.[0]?.name)?.toLowerCase();

                // Normalize role names: "tenant admin" → "admin"
                if (userRole === 'tenant admin') {
                    userRole = 'admin';
                }

                const hasRole = isSuperUser || (userRole && item.roles.includes(userRole));

                if (!hasRole) {
                    return false;
                }
            }

            // Find the corresponding sidebar key for this nav item
            const sidebarKey = Object.keys(sidebarKeyMap).find(
                key => sidebarKeyMap[key] === item.href
            );

            if (!sidebarKey) {
                // If no mapping found, allow by default (for legacy items)
                return true;
            }

            // Check if this item is enabled in sidebar_config
            return sidebar_config[sidebarKey] !== false;
        });
    }, [user, loading]);

    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);

    // Search & Notification State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Fetch unread count on mount
    React.useEffect(() => {
        if (user) {
            apiFetch('/api/notifications/').then(data => {
                setUnreadCount(data.filter((n: any) => !n.is_read).length);
            }).catch(() => { });
        }
    }, [user]);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length > 2) {
            try {
                const res = await apiFetch(`/api/search/?q=${encodeURIComponent(query)}`);
                setSearchResults(res);
                setIsSearchOpen(true);
            } catch (e) {
                console.error("Search error", e);
            }
        } else {
            setIsSearchOpen(false);
        }
    };

    const toggleNotifications = async () => {
        if (!isNotificationsOpen) {
            try {
                const data = await apiFetch('/api/notifications/');
                setNotifications(data);
                setIsNotificationsOpen(true);
                // Mark all as read in background
                await apiFetch('/api/notifications/mark_all_read/', { method: 'POST' });
                setUnreadCount(0);
            } catch (e) {
                console.error("Notification error", e);
            }
        } else {
            setIsNotificationsOpen(false);
        }
    };

    const handleLogout = async () => {
        try {
            // Call backend logout endpoint to blacklist token and clear cookies
            await apiFetch('/api/auth/logout/', { method: 'POST' });
        } catch (e) {
            console.error("Logout error", e);
        } finally {
            // Forcefully clear ALL cookies and storage on client side
            clearCompleteSession();

            // Force a full page reload to clear all state and redirect to login
            window.location.href = '/crm/login';
        }
    };

    return (
        <div className="flex h-screen bg-[var(--cy-bg-page)] overflow-hidden">
            <SessionTimeout />
            {/* Logo - Fixed Position, Independent of Sidebar */}
            <div className="fixed top-3 left-3 z-30 flex items-center justify-center py-3 px-2">
                {branding?.logo ? (
                    <img
                        src={branding.logo}
                        alt="Logo"
                        className="h-12 w-auto object-contain drop-shadow-[0_0_20px_rgba(181,255,6,0.4)]"
                    />
                ) : branding?.name && branding.name !== 'CybricHQ' ? (
                    <div className="h-12 flex items-center">
                        <span className="text-xl font-bold bg-gradient-to-r from-[var(--tenant-primary)] to-[var(--tenant-secondary)] bg-clip-text text-transparent">
                            {branding.name}
                        </span>
                    </div>
                ) : (
                    <img
                        src="/logo.png"
                        alt="CybricHQ"
                        className="h-12 w-auto object-contain drop-shadow-[0_0_20px_rgba(181,255,6,0.4)]"
                    />
                )}
            </div>

            {/* Sidebar - Modern Floating Design */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 280 : 88 }}
                className="flex flex-col z-20 p-3 h-full pt-20"
            >

                {/* Navigation Card - Below Logo */}
                <div className="flex-1 bg-gradient-to-b from-[#1a2d47] to-[#152238] backdrop-blur-xl rounded-2xl border border-[rgba(255,255,255,0.1)] shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col">

                    {/* Navigation Items */}
                    <nav className="flex-1 p-2 overflow-y-auto">
                        {loading && !user ? (
                            <div className="space-y-1 animate-pulse">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="h-10 bg-[rgba(255,255,255,0.05)] rounded-lg"></div>
                                ))}
                            </div>
                        ) : navItems.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm text-gray-400 mb-4">Session expired or no access.</p>
                                <Link href="/crm/login" className="text-xs bg-[var(--cy-lime)] text-[var(--cy-navy)] px-4 py-2 rounded-xl font-bold hover:opacity-90 transition-opacity">
                                    Login Again
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {navItems.map((item) => {
                                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                    return (
                                        <Link key={item.href} href={item.href}>
                                            <div className={`
                                                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer group
                                                ${isActive
                                                    ? 'text-white shadow-lg'
                                                    : 'text-gray-300 hover:bg-[rgba(255,255,255,0.08)] hover:text-white'}
                                            `}
                                                style={isActive ? { background: `linear-gradient(to right, ${branding?.primary_color || '#2563eb'}, ${branding?.secondary_color || '#1e40af'})` } : {}}
                                            >
                                                <div className={`flex-shrink-0 w-5 h-5 flex items-center justify-center ${isActive ? 'text-white' : 'group-hover:text-white'}`}>
                                                    {item.icon}
                                                </div>
                                                {isSidebarOpen && (
                                                    <span className="font-semibold text-sm whitespace-nowrap">
                                                        {item.label}
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                        )}
                    </nav>

                    {/* Collapse Button */}
                    <div className="p-2 border-t border-[rgba(255,255,255,0.06)]">
                        <button
                            onClick={() => setSidebarOpen(!isSidebarOpen)}
                            className="w-full flex items-center justify-center p-2 rounded-lg bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-gray-500 hover:text-white transition-all duration-200"
                        >
                            <svg className={`w-5 h-5 transform transition-transform duration-300 ${!isSidebarOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

                {/* Floating Bubbles - Top Right */}
                <div className="absolute top-4 right-4 z-30 flex items-center gap-3">

                    {/* Search Bubble */}
                    <div className="relative group">
                        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 px-4 py-2.5 flex items-center gap-3 hover:shadow-xl transition-all duration-300">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                onFocus={() => {
                                    if (searchQuery.length > 2) setIsSearchOpen(true);
                                }}
                                onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                                className="bg-transparent text-sm focus:outline-none w-44 placeholder-gray-400"
                            />
                        </div>

                        <AnimatePresence>
                            {isSearchOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute top-full right-0 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 mt-2 z-50 max-h-96 overflow-y-auto"
                                >
                                    {searchResults.length > 0 ? (
                                        searchResults.map((r: any) => (
                                            <Link
                                                key={`${r.type}-${r.id}`}
                                                href={r.link}
                                                className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                                                onClick={() => setIsSearchOpen(false)}
                                            >
                                                <div className="text-sm font-medium text-gray-900">{r.title}</div>
                                                <div className="text-xs text-gray-500">{r.type} • {r.subtitle}</div>
                                            </Link>
                                        ))
                                    ) : (
                                        <div className="p-4 text-sm text-gray-500 text-center">No results found</div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Notification Bubble */}
                    <div className="relative">
                        <button
                            onClick={toggleNotifications}
                            onBlur={() => setTimeout(() => setIsNotificationsOpen(false), 200)}
                            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-3 hover:shadow-xl transition-all duration-300 relative"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unreadCount}</span>
                            )}
                        </button>

                        <AnimatePresence>
                            {isNotificationsOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 py-1 z-50"
                                >
                                    <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">Notifications</div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length > 0 ? (
                                            notifications.map((n: any) => (
                                                <div key={n.id} className={`p-3 border-b border-gray-100 hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50' : ''}`}>
                                                    <div className="text-sm font-medium text-gray-900">{n.title}</div>
                                                    <div className="text-xs text-gray-600 mt-1">{n.message}</div>
                                                    <div className="text-xs text-gray-400 mt-2 flex justify-between">
                                                        <span>{new Date(n.created_at).toLocaleDateString()}</span>
                                                        {n.link && (
                                                            <Link href={n.link} className="text-blue-600 hover:underline">
                                                                View
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-gray-500 text-sm">No notifications</div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* User Profile Bubble */}
                    <div className="relative">
                        <button
                            onClick={() => setUserMenuOpen(!isUserMenuOpen)}
                            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-lg border border-gray-200/50 p-2 pr-4 flex items-center gap-3 hover:shadow-xl transition-all duration-300"
                        >
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--cy-navy)] to-[#1a3a5c] text-white flex items-center justify-center text-sm font-bold">
                                {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                            </div>
                            <div className="text-left hidden md:block">
                                <div className="text-sm font-medium text-gray-900">
                                    {user?.first_name || user?.username || 'User'}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {user?.groups?.[0]?.name || (user?.is_superuser ? 'Admin' : 'User')}
                                </div>
                            </div>
                        </button>

                        <AnimatePresence>
                            {isUserMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50"
                                >
                                    <div className="px-4 py-2 border-b border-gray-100">
                                        <p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p>
                                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            refreshUser();
                                            setProfileModalOpen(true);
                                            setUserMenuOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        Profile Settings
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                        Logout
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Scrollable Content */}
                <main className="flex-1 overflow-y-auto p-6 pt-20">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>

                {/* Profile Modal */}
                <AnimatePresence>
                    {isProfileModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                            >
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-[var(--cy-navy)]">Profile Settings</h3>
                                    <button onClick={() => setProfileModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-center mb-6">
                                        <div className="w-20 h-20 rounded-full bg-[var(--cy-navy)] text-white flex items-center justify-center text-2xl font-bold ring-4 ring-gray-50">
                                            {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">First Name</label>
                                            <div className="text-gray-900 font-medium">{user?.first_name || '-'}</div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Last Name</label>
                                            <div className="text-gray-900 font-medium">{user?.last_name || '-'}</div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
                                        <div className="text-gray-900 font-medium">{user?.email || '-'}</div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Role</label>
                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {user?.groups?.[0]?.name || (user?.is_superuser ? 'Super Admin' : 'Staff')}
                                        </div>
                                    </div>

                                    {!user?.is_superuser && (
                                        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-xs text-yellow-800 mt-4">
                                            Contact an administrator to update your profile details or role.
                                        </div>
                                    )}

                                    <div className="pt-4">
                                        <button
                                            onClick={() => setProfileModalOpen(false)}
                                            className="w-full btn btn-primary"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
