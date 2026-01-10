'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/lib/auth-context";
import { Loader2, LogOut } from 'lucide-react';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, isAuthenticated, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.push('/login');
        }
    }, [loading, isAuthenticated, router]);

    // Show loading while checking auth
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // Don't render if not authenticated
    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <AdminSidebar />

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto">
                {/* Top Header with User Info */}
                <div className="bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between">
                    <div></div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                                {user?.first_name || user?.username}
                            </p>
                            <p className="text-xs text-gray-500">
                                {user?.is_superuser ? 'Super Admin' : 'Admin'}
                            </p>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Logout"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
