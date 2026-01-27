'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
    PenTool,
    Mic,
    Users,
    Settings,
    LogOut,
    Home,
    ChevronRight,
    Headphones,
    BookOpen,
    FileText,
    LifeBuoy,
    CreditCard,
} from 'lucide-react';
import { api, API_ENDPOINTS } from '@/lib/api';

const navItems = [
    { name: 'Dashboard', href: '/admin', icon: Home },
    { name: 'Writing Tests', href: '/admin/writing', icon: PenTool },
    { name: 'Speaking Tests', href: '/admin/speaking', icon: Mic },
    { name: 'Listening Tests', href: '/admin/listening', icon: Headphones },
    { name: 'Reading Tests', href: '/admin/reading', icon: BookOpen },
    { name: 'Student Reports', href: '/admin/reports', icon: FileText },
    { name: 'Support', href: '/admin/tickets', icon: LifeBuoy },
    { name: 'Manage Students', href: '/admin/users', icon: Users },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
];

const studentNavItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Practice Writing', href: '/tests/writing', icon: PenTool },
    { name: 'Practice Speaking', href: '/tests/speaking', icon: Mic },
    { name: 'Practice Listening', href: '/tests/listening', icon: Headphones },
    { name: 'Practice Reading', href: '/tests/reading', icon: BookOpen },
    { name: 'My Reports', href: '/reports', icon: FileText },
    { name: 'Subscription', href: '/account/subscription', icon: CreditCard },
    { name: 'Support', href: '/support', icon: LifeBuoy },
    { name: 'My Profile', href: '/account/profile', icon: Users },
];

interface AdminLayoutProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

export default function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = React.useState(0);

    React.useEffect(() => {
        const fetchUnread = async () => {
            // Only fetch if user is logged in
            if (!user) return;

            try {
                // Fetch unread count from API
                // Endpoint: /api/ielts/tickets/unread_count (Rewrite adds slash)
                console.log('Fetching unread support tickets...');
                const { data } = await api.get<{ unread_count: number }>(`${API_ENDPOINTS.IELTS_BASE}/tickets/unread_count`);
                if (data) {
                    console.log('Unread count:', data.unread_count);
                    setUnreadCount(data.unread_count);
                }
            } catch (e) {
                console.error("Failed to fetch notification count", e);
            }
        };

        fetchUnread();

        // Poll every 30 seconds to keep updated
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, [user]);

    const handleLogout = async () => {
        // AuthContext logout handles API call, localStorage cleanup, and redirect
        await logout();
    };

    // Show admin nav only if user is explicitly an admin, otherwise show student nav
    const isAdmin = user?.role === 'admin' || user?.is_staff === true;
    const items = isAdmin ? navItems : studentNavItems;
    const portalTitle = isAdmin ? "Admin Panel" : "Student Portal";
    const roleTitle = isAdmin ? "Administrator" : "Student";

    return (
        <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-50">
                {/* Logo */}
                <div className="p-6 border-b border-slate-100 flex flex-col items-center">
                    <img src="/logo.png" alt="Cybrik IELTS" className="h-10 w-auto object-contain" />
                    <span className="text-xs font-semibold text-slate-400 mt-3 tracking-wider uppercase">{portalTitle}</span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {items.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== '/dashboard' && item.href !== '/admin' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-[#6FB63A]/10 text-[#6FB63A] font-semibold'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-[#6FB63A]' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                <span>{item.name}</span>

                                {item.name === 'Support' && unreadCount > 0 ? (
                                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                                        {unreadCount}
                                    </span>
                                ) : (
                                    isActive && <ChevronRight className="w-4 h-4 ml-auto text-[#6FB63A]" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Info */}
                {/* User Info */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold shadow-sm shrink-0">
                            {user?.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate" title={user?.name}>{user?.name || 'Student'}</p>
                            <p className="text-xs text-slate-500 truncate" title={user?.email || user?.username}>{user?.email || user?.username || roleTitle}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                            title="Logout"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1 p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Page Header */}
                    {(title || actions) && (
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                {title && <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{title}</h2>}
                                {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
                            </div>
                            {actions}
                        </div>
                    )}

                    {children}
                </div>
            </main>
        </div>
    );
}
