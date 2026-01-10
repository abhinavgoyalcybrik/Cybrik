'use client';

import React, { useState, useEffect } from 'react';
import apiFetch from '@/lib/api';

interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    is_staff: boolean;
}

interface UserProfile {
    id: number;
    user: number;
    username: string;
    email: string;
    role: number | null;
    role_name: string | null;
}

interface Role {
    id: number;
    name: string;
    description: string;
}

export default function UserAssignmentPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [usersData, rolesData, profilesData] = await Promise.all([
                apiFetch('/api/staff/'),
                apiFetch('/api/roles/'),
                apiFetch('/api/user-profiles/'),
            ]);
            setUsers(usersData || []);
            setRoles(rolesData || []);
            setProfiles(profilesData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const assignRole = async (userId: number, roleId: number | null) => {
        try {
            await apiFetch('/api/users/assign-role/', {
                method: 'POST',
                body: JSON.stringify({ user_id: userId, role_id: roleId }),
            });
            alert('Role assigned successfully!');
            fetchData();
        } catch (error) {
            console.error('Error assigning role:', error);
            alert('Failed to assign role');
        }
    };

    const getUserRole = (userId: number) => {
        const profile = profiles.find(p => p.user === userId);
        return profile?.role_name || 'No Role';
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--cy-lime)]"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-[var(--cy-bg-page)] min-h-screen">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                            <svg className="w-10 h-10 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            User Role Assignment
                        </h1>
                        <p className="text-blue-100 text-lg max-w-2xl">
                            Assign roles to users to control their permissions and access.
                        </p>
                    </div>
                </div>
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-[var(--cy-border)] overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                User
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Current Role
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Assign Role
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                        {user.first_name || user.last_name
                                            ? `${user.first_name} ${user.last_name}`.trim()
                                            : user.username}
                                    </div>
                                    {user.is_staff && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Staff</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {user.email}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                        {getUserRole(user.id)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <select
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent"
                                        value={profiles.find(p => p.user === user.id)?.role || ''}
                                        onChange={(e) => assignRole(user.id, e.target.value ? parseInt(e.target.value) : null)}
                                    >
                                        <option value="">No Role</option>
                                        {roles.map((role) => (
                                            <option key={role.id} value={role.id}>
                                                {role.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
