'use client';

import { useEffect, useState } from 'react';
import { tenantApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Loader2, Copy, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TenantsPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Delete State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        company_name: '',
        primary_color: '#6366f1',
        admin_email: '',
        custom_domain: '',
        initial_plan_id: '',
        openai_key: '',
        elevenlabs_key: '',
        smartflo_numbers_str: '',
    });

    // Creation State
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [credentials, setCredentials] = useState<any>(null);
    const [error, setError] = useState('');

    // Edit State
    const [editingTenant, setEditingTenant] = useState<any>(null);
    const [editFormData, setEditFormData] = useState<{
        name: string;
        is_active: boolean;
        openai_key: string;
        elevenlabs_key: string;
        smartflo_numbers_str: string;
        company_name: string;
        primary_color: string;
        custom_domain: string;
        logo: File | null;
    }>({
        name: '',
        is_active: true,
        openai_key: '',
        elevenlabs_key: '',
        smartflo_numbers_str: '',
        company_name: '',
        primary_color: '',
        custom_domain: '',
        logo: null,
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [tData, pData] = await Promise.all([
                tenantApi.list(),
                tenantApi.getProducts()
            ]);
            setTenants(Array.isArray(tData) ? tData : []);
            setProducts(Array.isArray(pData) ? pData : []);
        } catch (err) {
            console.error('Failed to fetch data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            // 1. Create Tenant
            // 1. Create Tenant
            // Prepare payload with array conversion
            const payload = {
                ...formData,
                smartflo_numbers: formData.smartflo_numbers_str
                    ? formData.smartflo_numbers_str.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : []
            };
            // Remove the temporary string field from payload
            delete (payload as any).smartflo_numbers_str;

            const tenant: any = await tenantApi.create(payload);

            // 2. Add Subscription (if selected)
            if (formData.initial_plan_id && tenant?.id) {
                try {
                    await tenantApi.addSubscription(tenant.id, formData.initial_plan_id);
                } catch (subErr) {
                    console.error('Subscription failed', subErr);
                }
            }

            // 3. Show Credentials
            if (tenant?.generated_username && tenant?.generated_password) {
                setCredentials({
                    username: tenant.generated_username,
                    password: tenant.generated_password,
                    loginUrl: `${window.location.protocol}//${formData.slug}.${window.location.host.split('.').slice(-2).join('.')}/login`
                });
                setStep('success');
                fetchData(); // Refresh list in background
            } else {
                closeModal();
                fetchData();
            }

        } catch (err: any) {
            console.error(err);
            setError(err.detail || err.message || 'Failed to create tenant');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        try {
            await tenantApi.delete(deleteId);
            setDeleteId(null);
            fetchData();
        } catch (err: any) {
            alert(err.message || 'Failed to delete tenant');
        } finally {
            setDeleting(false);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setStep('form');
        setFormData({
            name: '',
            slug: '',
            company_name: '',
            primary_color: '#6366f1',
            admin_email: '',
            custom_domain: '',
            initial_plan_id: '',
            openai_key: '',
            elevenlabs_key: '',
            smartflo_numbers_str: '',
        });
        setCredentials(null);
        setError('');
    };

    // Edit/Manage Handlers
    const handleManage = (tenant: any) => {
        setEditingTenant(tenant);
        setEditFormData({
            logo: null,
            name: tenant.name,
            is_active: tenant.is_active,
            openai_key: '',
            elevenlabs_key: '',
            smartflo_numbers_str: tenant.phone_numbers ? tenant.phone_numbers.join(', ') : '',
            company_name: tenant.company_name || '',
            primary_color: tenant.primary_color || '#6366f1',
            custom_domain: tenant.custom_domain || '',
        });
    };

    const closeEditModal = () => {
        setEditingTenant(null);
        setEditFormData({
            logo: null,
            name: '',
            is_active: true,
            openai_key: '',
            elevenlabs_key: '',
            smartflo_numbers_str: '',
            company_name: '',
            primary_color: '',
            custom_domain: '',
        });
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('name', editFormData.name);
            formData.append('is_active', String(editFormData.is_active));
            if (editFormData.openai_key) formData.append('openai_key', editFormData.openai_key);
            if (editFormData.elevenlabs_key) formData.append('elevenlabs_key', editFormData.elevenlabs_key);
            if (editFormData.smartflo_numbers_str) {
                const numbers = editFormData.smartflo_numbers_str.split(',').map((s: string) => s.trim()).filter(Boolean);
                numbers.forEach((num: string) => formData.append('smartflo_numbers', num));
            }
            if (editFormData.company_name) formData.append('company_name', editFormData.company_name);
            if (editFormData.primary_color) formData.append('primary_color', editFormData.primary_color);
            if (editFormData.custom_domain) formData.append('custom_domain', editFormData.custom_domain);
            if (editFormData.logo) formData.append('logo', editFormData.logo);

            await tenantApi.update(editingTenant.id, formData);
            closeEditModal();
            fetchData();
        } catch (err: any) {
            alert(err.message || 'Failed to update tenant');
        } finally {
            setSubmitting(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Tenants</h1>
                    <p className="text-gray-500">Manage organizations and subscriptions.</p>
                </div>
                <Button onClick={() => setShowModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tenant
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tenants.map(tenant => (
                        <Card key={tenant.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex justify-between items-start">
                                    <span>{tenant.name}</span>
                                    <span className={cn(
                                        "text-xs px-2 py-1 rounded-full",
                                        tenant.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                    )}>
                                        {tenant.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-gray-500 space-y-1">
                                    <p>URL: {tenant.slug}</p>
                                    <p>Admin: {tenant.admin_email || 'N/A'}</p>
                                    <div className="pt-4 flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 flex-1"
                                            onClick={() => handleManage(tenant)}
                                        >
                                            Manage
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => setDeleteId(tenant.id)}
                                            title="Delete Tenant"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* CREATE MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200 bg-white max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle>
                                {step === 'form' ? 'Provision New Tenant' : 'Tenant Created Successfully'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {step === 'form' ? (
                                <form onSubmit={handleCreate} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Request Name</Label>
                                            <Input
                                                required
                                                placeholder="Acme Corp"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Slug (URL)</Label>
                                            <Input
                                                required
                                                value={formData.slug}
                                                onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Company Name (Display)</Label>
                                            <Input
                                                placeholder="Acme Corporation Ltd."
                                                value={formData.company_name}
                                                onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Admin Email</Label>
                                            <Input
                                                type="email"
                                                required
                                                placeholder="admin@acme.com"
                                                value={formData.admin_email}
                                                onChange={e => setFormData({ ...formData, admin_email: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Select Product (Subscription)</Label>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
                                            value={formData.initial_plan_id}
                                            onChange={e => setFormData({ ...formData, initial_plan_id: e.target.value })}
                                            required
                                        >
                                            <option value="">-- Select a Plan --</option>
                                            {products.map((prod: any) => (
                                                <optgroup key={prod.id} label={prod.name}>
                                                    {prod.plans.map((plan: any) => (
                                                        <option key={plan.id} value={plan.id}>{plan.name} - ${plan.price}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Brand Color</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="color"
                                                className="w-12 h-9 p-1"
                                                value={formData.primary_color}
                                                onChange={e => setFormData({ ...formData, primary_color: e.target.value })}
                                            />
                                            <Input
                                                value={formData.primary_color}
                                                onChange={e => setFormData({ ...formData, primary_color: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-gray-100">
                                        <h4 className="font-medium text-sm text-gray-900">Telephony & AI Configuration</h4>
                                        <div className="space-y-2">
                                            <Label>OpenAI API Key</Label>
                                            <Input
                                                type="password"
                                                placeholder="sk-..."
                                                value={formData.openai_key}
                                                onChange={e => setFormData({ ...formData, openai_key: e.target.value })}
                                            />
                                            <p className="text-xs text-gray-500">Required for AI Evaluator</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>ElevenLabs API Key</Label>
                                            <Input
                                                type="password"
                                                placeholder="..."
                                                value={formData.elevenlabs_key}
                                                onChange={e => setFormData({ ...formData, elevenlabs_key: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Smartflo/DID Numbers (Comma separated)</Label>
                                            <Input
                                                placeholder="+919999999999, +918888888888"
                                                value={formData.smartflo_numbers_str}
                                                onChange={e => setFormData({ ...formData, smartflo_numbers_str: e.target.value })}
                                            />
                                            <p className="text-xs text-gray-500">Enter numbers separated by commas</p>
                                        </div>
                                    </div>

                                    {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-200">{error}</div>}

                                    <div className="flex justify-end gap-2 pt-4">
                                        <Button type="button" variant="ghost" onClick={closeModal} disabled={submitting}>Cancel</Button>
                                        <Button type="submit" disabled={submitting}>
                                            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            Create Provisioning
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                                        <div>
                                            <h4 className="font-medium text-green-900">Tenant Provisioned Successfully</h4>
                                            <p className="text-sm text-green-700 mt-1">
                                                Active subscription created.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                                        <h4 className="font-medium text-sm text-gray-500 uppercase tracking-wider">Admin Credentials</h4>

                                        <div className="grid gap-4">
                                            <div>
                                                <Label className="text-xs text-gray-400">Username</Label>
                                                <div className="flex gap-2">
                                                    <code className="flex-1 bg-white p-2 rounded border font-mono text-sm">{credentials.username}</code>
                                                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(credentials.username)}><Copy className="w-4 h-4" /></Button>
                                                </div>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-400">Password</Label>
                                                <div className="flex gap-2">
                                                    <code className="flex-1 bg-white p-2 rounded border font-mono text-sm">{credentials.password}</code>
                                                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(credentials.password)}><Copy className="w-4 h-4" /></Button>
                                                </div>
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-400">Login URL</Label>
                                                <div className="flex gap-2">
                                                    <code className="flex-1 bg-white p-2 rounded border font-mono text-sm break-all">{credentials.loginUrl}</code>
                                                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(credentials.loginUrl)}><Copy className="w-4 h-4" /></Button>
                                                </div>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    You must use this URL to log in.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200">
                                            <AlertTriangle className="w-4 h-4" />
                                            Copy these now. They will not be shown again.
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <Button onClick={closeModal}>Done</Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 bg-white">
                        <CardHeader>
                            <CardTitle className="text-red-600 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                Confirm Deletion
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-gray-600">
                                Are you sure you want to delete this tenant? This action works like a factory reset:
                                <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                                    <li>Deletes the tenant record</li>
                                    <li>Drops the entire <strong>database schema</strong></li>
                                    <li>Permanently removes all data (Users, Leads, etc.)</li>
                                </ul>
                            </p>
                            <div className="bg-red-50 text-red-800 p-3 rounded text-sm font-medium">
                                This action cannot be undone.
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                >
                                    {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Delete Permanently
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* EDIT/MANAGE MODAL */}
            {editingTenant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200 bg-white max-h-[90vh] overflow-y-auto">
                        <CardHeader>
                            <CardTitle>Manage Tenant: {editingTenant.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleUpdate} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Tenant Name</Label>
                                    <Input
                                        value={editFormData.name}
                                        onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                                    />
                                </div>

                                <div className="flex items-center gap-2 py-2">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        className="w-4 h-4"
                                        checked={editFormData.is_active}
                                        onChange={e => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                                    />
                                    <Label htmlFor="is_active">Is Active?</Label>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <h4 className="font-medium text-sm text-gray-900">Update Configuration</h4>
                                    <p className="text-xs text-gray-500">Leave fields blank to keep existing values unchanged.</p>

                                    <div className="space-y-2">
                                        <Label>OpenAI API Key</Label>
                                        <Input
                                            type="password"
                                            placeholder="Update API Key..."
                                            value={editFormData.openai_key}
                                            onChange={e => setEditFormData({ ...editFormData, openai_key: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>ElevenLabs API Key</Label>
                                        <Input
                                            type="password"
                                            placeholder="Update API Key..."
                                            value={editFormData.elevenlabs_key}
                                            onChange={e => setEditFormData({ ...editFormData, elevenlabs_key: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Smartflo/DID Numbers (Comma separated)</Label>
                                        <Input
                                            placeholder="+91..."
                                            value={editFormData.smartflo_numbers_str}
                                            onChange={e => setEditFormData({ ...editFormData, smartflo_numbers_str: e.target.value })}
                                        />
                                        <p className="text-xs text-gray-500">Entering numbers here will REPLACE the existing list.</p>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <h4 className="font-medium text-sm text-gray-900">White Labeling</h4>

                                    <div className="space-y-2">
                                        <Label>Company Name</Label>
                                        <Input
                                            value={editFormData.company_name}
                                            onChange={e => setEditFormData({ ...editFormData, company_name: e.target.value })}
                                            placeholder="e.g. Acme Corp"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Logo</Label>
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => setEditFormData({ ...editFormData, logo: e.target.files?.[0] || null })}
                                        />
                                        <p className="text-xs text-gray-500">Upload a transparent PNG for best results</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Primary Brand Color</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                className="w-12 h-10 p-1 cursor-pointer"
                                                value={editFormData.primary_color}
                                                onChange={e => setEditFormData({ ...editFormData, primary_color: e.target.value })}
                                            />
                                            <Input
                                                value={editFormData.primary_color}
                                                onChange={e => setEditFormData({ ...editFormData, primary_color: e.target.value })}
                                                placeholder="#6366f1"
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Custom Domain</Label>
                                        <Input
                                            value={editFormData.custom_domain}
                                            onChange={e => setEditFormData({ ...editFormData, custom_domain: e.target.value })}
                                            placeholder="e.g. portal.acme.com"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button type="button" variant="ghost" onClick={closeEditModal} disabled={submitting}>Cancel</Button>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
