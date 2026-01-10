"use client";

import { useEffect, useState } from 'react';
import apiFetch from '@/lib/api';

export default function WhoAmIPage() {
    const [user, setUser] = useState<any>(null);
    const [cookies, setCookies] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await apiFetch('/api/auth/me/');
                setUser(data);
                setCookies(document.cookie);
            } catch (e) {
                console.error(e);
                setUser(null);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Who Am I?</h1>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Current User</h2>
                {user ? (
                    <div className="space-y-2">
                        <p><strong>ID:</strong> {user.id}</p>
                        <p><strong>Username:</strong> {user.username}</p>
                        <p><strong>Email:</strong> {user.email}</p>
                        <p><strong>First Name:</strong> {user.first_name || 'N/A'}</p>
                        <p><strong>Last Name:</strong> {user.last_name || 'N/A'}</p>
                        <p><strong>Is Superuser:</strong> {user.is_superuser ? 'Yes' : 'No'}</p>
                        <p><strong>Groups:</strong> {JSON.stringify(user.groups)}</p>
                        <p><strong>Roles:</strong> {JSON.stringify(user.roles)}</p>
                    </div>
                ) : (
                    <p className="text-red-600">Not logged in</p>
                )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Browser Cookies</h2>
                <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-xs">
                    {cookies || 'No cookies found'}
                </pre>
            </div>

            <div className="mt-6 space-x-4">
                <a href="/crm/login" className="btn btn-primary">
                    Go to Login
                </a>
                <a href="/dashboard" className="btn btn-secondary">
                    Go to Dashboard
                </a>
            </div>
        </div>
    );
}
