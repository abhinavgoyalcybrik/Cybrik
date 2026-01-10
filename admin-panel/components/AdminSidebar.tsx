'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, CreditCard, Phone, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { auth } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const sidebarItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Tenants', href: '/tenants', icon: Users },
    { name: 'Billing', href: '/billing', icon: CreditCard },
    { name: 'Settings', href: '/settings', icon: Settings },
];

export function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);

    const handleLogout = async () => {
        try {
            await auth.logout();
            router.push('/login');
        } catch (error) {
            console.error('Logout failed:', error);
            router.push('/login');
        }
    };

    return (
        <div className={cn(
            "flex h-screen flex-col bg-navy-900 text-white transition-all duration-300",
            collapsed ? "w-20" : "w-64"
        )}>
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-navy-700">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center font-bold text-white">
                            C
                        </div>
                        <span className="font-bold text-lg tracking-tight">CybricHQ</span>
                    </div>
                )}
                {collapsed && (
                    <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center font-bold text-white mx-auto">
                        C
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                {sidebarItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                                collapsed && "justify-center px-2",
                                isActive
                                    ? "bg-brand-green text-white shadow-lg shadow-brand-green/20"
                                    : "text-slate-400 hover:bg-navy-800 hover:text-white"
                            )}
                            title={collapsed ? item.name : undefined}
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && <span>{item.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-navy-700 space-y-2">
                <button
                    onClick={handleLogout}
                    className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:bg-navy-800 hover:text-red-400 transition-colors",
                        collapsed && "justify-center px-2"
                    )}
                    title={collapsed ? "Sign Out" : undefined}
                >
                    <LogOut className="w-5 h-5" />
                    {!collapsed && <span>Sign Out</span>}
                </button>

                {/* Collapse Toggle */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex w-full items-center justify-center p-2 rounded-lg text-slate-500 hover:bg-navy-800 hover:text-white transition-colors"
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}
