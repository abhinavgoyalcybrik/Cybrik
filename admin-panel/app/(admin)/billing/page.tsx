'use client';

import { useEffect, useState } from 'react';
import { productApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Plus,
    Package,
    Edit2,
    Trash2,
    X,
    DollarSign,
    Save,
    Loader2,
    Check
} from 'lucide-react';

interface Plan {
    id?: string;
    name: string;
    price: number;
    interval: 'month' | 'year';
    features?: string[];
}

interface Product {
    id?: string;
    name: string;
    code: string;
    description: string;
    is_active: boolean;
    plans: Plan[];
    feature_flags?: Record<string, boolean>;
}

export default function BillingPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // New product form state
    const [productForm, setProductForm] = useState<Partial<Product>>({
        name: '',
        code: '',
        description: '',
        is_active: true,
    });

    // New plan form state
    const [planForm, setPlanForm] = useState<Partial<Plan>>({
        name: '',
        price: 0,
        interval: 'month',
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = () => {
        setLoading(true);
        productApi.list()
            .then((data: any) => setProducts(Array.isArray(data) ? data : []))
            .catch((err: unknown) => console.error(err))
            .finally(() => setLoading(false));
    };

    const openNewProductModal = () => {
        setEditingProduct(null);
        setProductForm({ name: '', code: '', description: '', is_active: true });
        setShowModal(true);
    };

    const openEditProductModal = (product: Product) => {
        setEditingProduct(product);
        setProductForm({
            name: product.name,
            code: product.code,
            description: product.description,
            is_active: product.is_active,
        });
        setShowModal(true);
    };

    const openAddPlanModal = (productId: string) => {
        setSelectedProductId(productId);
        setPlanForm({ name: '', price: 0, interval: 'month' });
        setShowPlanModal(true);
    };

    const handleSaveProduct = async () => {
        setSaving(true);
        try {
            // Map frontend field names to backend field names
            const payload = {
                name: productForm.name,
                code: productForm.code,
                description: productForm.description || '',
                active: productForm.is_active ?? true,
                feature_flags: productForm.feature_flags || {},
            };
            
            if (editingProduct?.id) {
                await productApi.update(editingProduct.id, payload);
            } else {
                await productApi.create(payload);
            }
            setShowModal(false);
            fetchProducts();
        } catch (err: any) {
            console.error('Failed to save product', err);
            alert(err?.detail || err?.message || 'Failed to save product');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePlan = async () => {
        if (!selectedProductId) return;
        setSaving(true);
        try {
            // Convert price from dollars to cents for backend
            const payload = {
                name: planForm.name,
                price_cents: Math.round((planForm.price || 0) * 100),
                interval: planForm.interval || 'month',
                currency: 'USD',
                active: true,
            };
            await productApi.createPlan(selectedProductId, payload);
            setShowPlanModal(false);
            fetchProducts();
        } catch (err: any) {
            console.error('Failed to save plan', err);
            alert(err?.detail || err?.message || 'Failed to save plan');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await productApi.delete(id);
            fetchProducts();
        } catch (err) {
            console.error('Failed to delete product', err);
        }
    };

    const handleDeletePlan = async (productId: string, planId: string) => {
        if (!confirm('Are you sure you want to delete this plan?')) return;
        try {
            await productApi.deletePlan(productId, planId);
            fetchProducts();
        } catch (err) {
            console.error('Failed to delete plan', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Billing & Products</h1>
                    <p className="text-slate-500">Manage products and subscription plans</p>
                </div>
                <Button onClick={openNewProductModal}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                </Button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(product => (
                    <Card key={product.id} className="border-slate-200 overflow-hidden group hover:shadow-md transition-shadow">
                        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-green-50 rounded-lg">
                                        <Package className="h-5 w-5 text-brand-green" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">{product.name}</CardTitle>
                                        <p className="text-xs text-slate-400 font-mono mt-0.5">{product.code}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEditProductModal(product)}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => product.id && handleDeleteProduct(product.id)}
                                        className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                                {product.description || 'No description available'}
                            </p>

                            {/* Plans */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Plans</span>
                                    <button
                                        onClick={() => product.id && openAddPlanModal(product.id)}
                                        className="text-xs text-brand-green hover:text-brand-green-600 font-medium flex items-center gap-1"
                                    >
                                        <Plus className="h-3 w-3" /> Add Plan
                                    </button>
                                </div>
                                {product.plans && product.plans.length > 0 ? (
                                    product.plans.map((plan: Plan) => (
                                        <div
                                            key={plan.id}
                                            className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 group/plan"
                                        >
                                            <span className="font-medium text-slate-700">{plan.name}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 text-slate-900">
                                                    <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                                                    <span className="font-semibold">{plan.price}</span>
                                                    <span className="text-xs text-slate-400">/ {plan.interval}</span>
                                                </div>
                                                <button
                                                    onClick={() => product.id && plan.id && handleDeletePlan(product.id, plan.id)}
                                                    className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 opacity-0 group-hover/plan:opacity-100 transition-opacity"
                                                    title="Delete plan"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-sm text-slate-400 py-4 bg-slate-50 rounded-lg">
                                        No plans yet
                                    </p>
                                )}
                            </div>

                            {/* Status Badge */}
                            <div className="mt-4 pt-3 border-t border-slate-100">
                                {product.is_active ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                                        <Check className="h-3 w-3" /> Active
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                        Inactive
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {/* Empty State */}
                {products.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-700">No products yet</h3>
                        <p className="text-slate-500 mt-1 mb-4">Create your first product to get started</p>
                        <Button onClick={openNewProductModal}>
                            <Plus className="w-4 h-4 mr-2" /> Add Product
                        </Button>
                    </div>
                )}
            </div>

            {/* Product Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-semibold text-slate-900">
                                {editingProduct ? 'Edit Product' : 'New Product'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <Label htmlFor="name">Product Name</Label>
                                <Input
                                    id="name"
                                    value={productForm.name}
                                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                                    placeholder="e.g., CRM Suite"
                                />
                            </div>
                            <div>
                                <Label htmlFor="code">Product Code</Label>
                                <Input
                                    id="code"
                                    value={productForm.code}
                                    onChange={(e) => setProductForm({ ...productForm, code: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                                    placeholder="e.g., crm_suite"
                                />
                            </div>
                            <div>
                                <Label htmlFor="description">Description</Label>
                                <textarea
                                    id="description"
                                    value={productForm.description}
                                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                                    placeholder="Describe what this product includes..."
                                    className="w-full h-24 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-green focus:border-transparent outline-none resize-none"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={productForm.is_active}
                                    onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 text-brand-green focus:ring-brand-green"
                                />
                                <Label htmlFor="is_active" className="cursor-pointer">Active (available for subscription)</Label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
                            <Button onClick={handleSaveProduct} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                                {editingProduct ? 'Update' : 'Create'} Product
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Plan Modal */}
            {showPlanModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-xl font-semibold text-slate-900">Add Plan</h2>
                            <button onClick={() => setShowPlanModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <Label htmlFor="plan_name">Plan Name</Label>
                                <Input
                                    id="plan_name"
                                    value={planForm.name}
                                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                                    placeholder="e.g., Basic, Pro, Enterprise"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="price">Price</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            id="price"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={planForm.price ?? 0}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setPlanForm({ ...planForm, price: isNaN(val) ? 0 : val });
                                            }}
                                            className="pl-9"
                                            placeholder="99"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="interval">Interval</Label>
                                    <select
                                        id="interval"
                                        value={planForm.interval}
                                        onChange={(e) => setPlanForm({ ...planForm, interval: e.target.value as 'month' | 'year' })}
                                        className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-brand-green outline-none"
                                    >
                                        <option value="month">Monthly</option>
                                        <option value="year">Yearly</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                            <Button variant="outline" onClick={() => setShowPlanModal(false)}>Cancel</Button>
                            <Button onClick={handleSavePlan} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                Add Plan
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
