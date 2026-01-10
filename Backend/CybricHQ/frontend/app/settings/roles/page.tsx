'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import apiFetch from '@/lib/api';

interface Permission {
    label: string;
    default: boolean;
}

interface PermissionSchema {
    [resource: string]: {
        [action: string]: Permission;
    };
}

interface Role {
    id: number;
    name: string;
    description: string;
    permissions: any;
    sidebar_config: any;
    dashboard_config: any;
    is_system_role: boolean;
    user_count: number;
}

interface Schema {
    permissions: PermissionSchema;
    sidebar_items: { [key: string]: Permission };
    dashboard_widgets: { [key: string]: Permission };
}

export default function RolesSettingsPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [schema, setSchema] = useState<Schema | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedRole, setEditedRole] = useState<Partial<Role>>({});

    useEffect(() => {
        fetchRoles();
        fetchSchema();
    }, []);

    const fetchRoles = async () => {
        try {
            const data = await apiFetch('/api/roles/');
            setRoles(data);
        } catch (error) {
            console.error('Error fetching roles:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSchema = async () => {
        try {
            const data = await apiFetch('/api/roles/permission_schema/');
            setSchema(data);
        } catch (error) {
            console.error('Error fetching schema:', error);
        }
    };

    const handleCreateRole = () => {
        setIsEditing(true);
        setSelectedRole(null);
        setEditedRole({
            name: '',
            description: '',
            permissions: {},
            sidebar_config: {},
            dashboard_config: {},
        });
    };

    const handleEditRole = (role: Role) => {
        setIsEditing(true);
        setSelectedRole(role);
        setEditedRole({ ...role });
    };

    const handleSaveRole = async () => {
        try {
            if (selectedRole) {
                // Update existing role
                await apiFetch(`/api/roles/${selectedRole.id}/`, {
                    method: 'PUT',
                    body: JSON.stringify(editedRole),
                });
            } else {
                // Create new role
                await apiFetch('/api/roles/', {
                    method: 'POST',
                    body: JSON.stringify(editedRole),
                });
            }
            setIsEditing(false);
            setSelectedRole(null);
            fetchRoles();
        } catch (error) {
            console.error('Error saving role:', error);
            alert('Failed to save role');
        }
    };

    const handleDeleteRole = async (roleId: number) => {
        if (!confirm('Are you sure you want to delete this role?')) return;

        try {
            await apiFetch(`/api/roles/${roleId}/`, { method: 'DELETE' });
            fetchRoles();
        } catch (error) {
            console.error('Error deleting role:', error);
            alert('Failed to delete role. System roles cannot be deleted.');
        }
    };

    const togglePermission = (resource: string, action: string) => {
        setEditedRole(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [resource]: {
                    ...(prev.permissions?.[resource] || {}),
                    [action]: !(prev.permissions?.[resource]?.[action] || false),
                },
            },
        }));
    };

    const toggleSidebar = (item: string) => {
        setEditedRole(prev => ({
            ...prev,
            sidebar_config: {
                ...prev.sidebar_config,
                [item]: !(prev.sidebar_config?.[item] ?? true),
            },
        }));
    };

    const toggleDashboard = (widget: string) => {
        setEditedRole(prev => ({
            ...prev,
            dashboard_config: {
                ...prev.dashboard_config,
                [widget]: !(prev.dashboard_config?.[widget] ?? true),
            },
        }));
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Role Management
                        </h1>
                        <p className="text-blue-100 text-lg max-w-2xl">
                            Configure roles, permissions, and access control for your team.
                        </p>
                    </div>
                    <button
                        onClick={handleCreateRole}
                        className="px-5 py-3 bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-xl font-bold hover:brightness-110 transition-all flex items-center gap-2"
                    >
                        + Create Role
                    </button>
                </div>
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
            </div>

            {/* Role List */}
            {!isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {roles.map((role) => (
                        <motion.div
                            key={role.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-xl shadow-sm border border-[var(--cy-border)] p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--cy-navy)]">{role.name}</h3>
                                    {role.is_system_role && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full mt-1 inline-block">
                                            System Role
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm text-gray-500">{role.user_count} users</span>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">{role.description || 'No description'}</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEditRole(role)}
                                    className="flex-1 px-3 py-2 bg-[var(--cy-lime)] text-[var(--cy-navy)] text-sm font-bold rounded-md hover:brightness-110 transition-all"
                                >
                                    Edit
                                </button>
                                {!role.is_system_role && (
                                    <button
                                        onClick={() => handleDeleteRole(role.id)}
                                        className="flex-1 px-3 py-2 bg-red-100 text-red-700 text-sm font-bold rounded-md hover:bg-red-200 transition-all"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            ) : (
                /* Role Editor */
                <div className="bg-white rounded-xl shadow-sm border border-[var(--cy-border)] p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-[var(--cy-navy)]">
                            {selectedRole ? `Edit Role: ${selectedRole.name}` : 'Create New Role'}
                        </h2>
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setSelectedRole(null);
                            }}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
                            <input
                                type="text"
                                value={editedRole.name || ''}
                                onChange={(e) => setEditedRole({ ...editedRole, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent"
                                placeholder="e.g., Sales Manager"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={editedRole.description || ''}
                                onChange={(e) => setEditedRole({ ...editedRole, description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent"
                                rows={2}
                                placeholder="Describe the role's purpose..."
                            />
                        </div>
                    </div>

                    {/* Permissions */}
                    {schema && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-[var(--cy-navy)] mb-3">Permissions</h3>
                                <div className="space-y-4">
                                    {Object.entries(schema.permissions).map(([resource, actions]) => (
                                        <div key={resource} className="border border-gray-200 rounded-lg p-4">
                                            <h4 className="font-bold text-gray-800 mb-2 capitalize">{resource}</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                {Object.entries(actions).map(([action, config]) => (
                                                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={editedRole.permissions?.[resource]?.[action] || false}
                                                            onChange={() => togglePermission(resource, action)}
                                                            className="w-4 h-4 text-[var(--cy-navy)] rounded focus:ring-[var(--cy-lime)]"
                                                        />
                                                        <span className="text-sm text-gray-700">{config.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sidebar Config */}
                            <div>
                                <h3 className="text-lg font-bold text-[var(--cy-navy)] mb-3">Sidebar Visibility</h3>
                                <div className="border border-gray-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {Object.entries(schema.sidebar_items).map(([item, config]) => (
                                        <label key={item} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={editedRole.sidebar_config?.[item] ?? config.default}
                                                onChange={() => toggleSidebar(item)}
                                                className="w-4 h-4 text-[var(--cy-navy)] rounded focus:ring-[var(--cy-lime)]"
                                            />
                                            <span className="text-sm text-gray-700">{config.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Dashboard Config */}
                            <div>
                                <h3 className="text-lg font-bold text-[var(--cy-navy)] mb-3">Dashboard Widgets</h3>
                                <div className="border border-gray-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {Object.entries(schema.dashboard_widgets).map(([widget, config]) => (
                                        <label key={widget} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={editedRole.dashboard_config?.[widget] ?? config.default}
                                                onChange={() => toggleDashboard(widget)}
                                                className="w-4 h-4 text-[var(--cy-navy)] rounded focus:ring-[var(--cy-lime)]"
                                            />
                                            <span className="text-sm text-gray-700">{config.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 mt-6 pt-6 border-t">
                        <button
                            onClick={handleSaveRole}
                            className="px-6 py-2 bg-[var(--cy-navy)] text-white rounded-lg hover:bg-opacity-90 transition-colors font-medium"
                        >
                            Save Role
                        </button>
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setSelectedRole(null);
                            }}
                            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
