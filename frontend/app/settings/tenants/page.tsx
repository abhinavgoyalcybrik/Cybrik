'use client';

import React, { useState, useEffect } from 'react';
import apiFetch from '@/lib/api';
import DashboardLayout from '@/components/DashboardLayout';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    created_at: string;
    member_count: number;
    subscription_count: number;
    products: string[];
    company_name: string;
}

interface TenantDetail {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    settings: {
        company_name: string;
        logo_url: string | null;
        primary_color: string;
        secondary_color: string;
        accent_color: string;
        support_email: string | null;
    };
    subscriptions: {
        id: string;
        product_name: string;
        product_code: string;
        plan_name: string;
        status: string;
    }[];
    available_features: Record<string, boolean>;
}

interface Product {
    id: string;
    code: string;
    name: string;
    description: string;
    features: Record<string, boolean>;
    plans: {
        id: string;
        name: string;
        price: number;
        currency: string;
        interval: string;
    }[];
}

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
    const [editMode, setEditMode] = useState<'create' | 'edit' | 'subscriptions'>('create');

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        company_name: '',
        primary_color: '#6366f1',
        is_active: true,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [tenantsData, productsData] = await Promise.all([
                apiFetch('/api/admin/tenants/'),
                apiFetch('/api/admin/products/'),
            ]);
            setTenants(tenantsData || []);
            setProducts(productsData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setFormData({
            name: '',
            slug: '',
            company_name: '',
            primary_color: '#6366f1',
            is_active: true,
        });
        setSelectedTenant(null);
        setEditMode('create');
        setShowModal(true);
    };

    const openEditModal = async (tenantId: string) => {
        try {
            const detail = await apiFetch(`/api/admin/tenants/${tenantId}/`);
            setSelectedTenant(detail);
            setFormData({
                name: detail.name,
                slug: detail.slug,
                company_name: detail.settings?.company_name || detail.name,
                primary_color: detail.settings?.primary_color || '#6366f1',
                is_active: detail.is_active,
            });
            setEditMode('edit');
            setShowModal(true);
        } catch (error) {
            console.error('Error fetching tenant:', error);
        }
    };

    const openSubscriptionsModal = async (tenantId: string) => {
        try {
            const detail = await apiFetch(`/api/admin/tenants/${tenantId}/`);
            setSelectedTenant(detail);
            setEditMode('subscriptions');
            setShowModal(true);
        } catch (error) {
            console.error('Error fetching tenant:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editMode === 'create') {
                await apiFetch('/api/admin/tenants/', {
                    method: 'POST',
                    body: JSON.stringify(formData),
                });
            } else if (editMode === 'edit' && selectedTenant) {
                // Update tenant
                await apiFetch(`/api/admin/tenants/${selectedTenant.id}/`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        name: formData.name,
                        is_active: formData.is_active,
                    }),
                });
                // Update settings
                await apiFetch(`/api/admin/tenants/${selectedTenant.id}/update-settings/`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        company_name: formData.company_name,
                        primary_color: formData.primary_color,
                    }),
                });
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error('Error saving tenant:', error);
            alert('Failed to save tenant');
        }
    };

    const addSubscription = async (planId: string) => {
        if (!selectedTenant) return;
        try {
            await apiFetch(`/api/admin/tenants/${selectedTenant.id}/add_subscription/`, {
                method: 'POST',
                body: JSON.stringify({ plan_id: planId }),
            });
            // Refresh tenant details
            const detail = await apiFetch(`/api/admin/tenants/${selectedTenant.id}/`);
            setSelectedTenant(detail);
            fetchData();
        } catch (error: any) {
            alert(error?.error || 'Failed to add subscription');
        }
    };

    const removeSubscription = async (subscriptionId: string) => {
        if (!selectedTenant) return;
        try {
            await apiFetch(`/api/admin/tenants/${selectedTenant.id}/remove_subscription/`, {
                method: 'POST',
                body: JSON.stringify({ subscription_id: subscriptionId }),
            });
            const detail = await apiFetch(`/api/admin/tenants/${selectedTenant.id}/`);
            setSelectedTenant(detail);
            fetchData();
        } catch (error) {
            console.error('Error removing subscription:', error);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Hero Section */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[var(--cy-navy)] via-blue-900 to-slate-900 p-8 text-white shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                                <svg className="w-10 h-10 text-[var(--cy-lime)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                Tenant Management
                            </h1>
                            <p className="text-blue-100 text-lg max-w-2xl">
                                Manage your white-label clients and their subscriptions.
                            </p>
                        </div>
                        <button
                            onClick={openCreateModal}
                            className="px-5 py-3 bg-[var(--cy-lime)] text-[var(--cy-navy)] rounded-xl font-bold hover:brightness-110 transition-all flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Tenant
                        </button>
                    </div>
                    {/* Decorative background elements */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[var(--cy-lime)] rounded-full blur-3xl opacity-10"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-cyan-500 rounded-full blur-3xl opacity-10"></div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <div className="text-2xl font-bold text-gray-900">{tenants.length}</div>
                        <div className="text-sm text-gray-500">Total Tenants</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <div className="text-2xl font-bold text-green-600">
                            {tenants.filter(t => t.is_active).length}
                        </div>
                        <div className="text-sm text-gray-500">Active Tenants</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                        <div className="text-2xl font-bold text-indigo-600">
                            {tenants.reduce((sum, t) => sum + t.subscription_count, 0)}
                        </div>
                        <div className="text-sm text-gray-500">Active Subscriptions</div>
                    </div>
                </div>

                {/* Tenant Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Members</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {tenants.map((tenant) => (
                                <tr key={tenant.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{tenant.company_name || tenant.name}</div>
                                        <div className="text-sm text-gray-500">/{tenant.slug}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${tenant.is_active
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {tenant.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {tenant.products.length > 0 ? (
                                                tenant.products.map((p, i) => (
                                                    <span key={i} className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
                                                        {p}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-gray-400 text-sm">No subscriptions</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">{tenant.member_count}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openEditModal(tenant.id)}
                                                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => openSubscriptionsModal(tenant.id)}
                                                className="text-green-600 hover:text-green-900 text-sm font-medium"
                                            >
                                                Subscriptions
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editMode === 'create' && 'Create New Tenant'}
                                    {editMode === 'edit' && 'Edit Tenant'}
                                    {editMode === 'subscriptions' && `Manage Subscriptions - ${selectedTenant?.name}`}
                                </h2>
                            </div>

                            {editMode !== 'subscriptions' ? (
                                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                            required
                                        />
                                    </div>
                                    {editMode === 'create' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL identifier)</label>
                                            <input
                                                type="text"
                                                value={formData.slug}
                                                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                                placeholder="auto-generated-from-name"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name (Display)</label>
                                        <input
                                            type="text"
                                            value={formData.company_name}
                                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={formData.primary_color}
                                                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                                className="h-10 w-20 rounded border border-gray-300"
                                            />
                                            <input
                                                type="text"
                                                value={formData.primary_color}
                                                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="is_active"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="rounded"
                                        />
                                        <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                        >
                                            {editMode === 'create' ? 'Create Tenant' : 'Save Changes'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="p-6 space-y-6">
                                    {/* Current Subscriptions */}
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-3">Current Subscriptions</h3>
                                        {selectedTenant?.subscriptions && selectedTenant.subscriptions.length > 0 ? (
                                            <div className="space-y-2">
                                                {selectedTenant.subscriptions.map((sub) => (
                                                    <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                        <div>
                                                            <div className="font-medium">{sub.product_name}</div>
                                                            <div className="text-sm text-gray-500">{sub.plan_name} • {sub.status}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => removeSubscription(sub.id)}
                                                            className="text-red-600 hover:text-red-800 text-sm"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500">No active subscriptions</p>
                                        )}
                                    </div>

                                    {/* Add Subscription */}
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-3">Add Subscription</h3>
                                        <div className="space-y-3">
                                            {products.map((product) => (
                                                <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <div className="font-medium">{product.name}</div>
                                                            <div className="text-sm text-gray-500">{product.description}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {product.plans.map((plan) => (
                                                            <button
                                                                key={plan.id}
                                                                onClick={() => addSubscription(plan.id)}
                                                                disabled={selectedTenant?.subscriptions.some(s => s.product_code === product.code)}
                                                                className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {plan.name} - ${plan.price}/{plan.interval}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
