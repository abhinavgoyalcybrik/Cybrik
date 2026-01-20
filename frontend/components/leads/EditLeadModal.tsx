"use client";

import React, { useState, useEffect } from "react";
import apiFetch from "@/lib/api";

type Lead = {
    id: number | string;
    name?: string;
    phone?: string;
    email?: string;
    source?: string;
    preferred_country?: string;
    notes?: string;
    status?: string;
};

interface EditLeadModalProps {
    lead: Lead;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EditLeadModal({ lead, isOpen, onClose, onSuccess }: EditLeadModalProps) {
    const [formData, setFormData] = useState<Partial<Lead>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (lead) {
            setFormData({
                name: lead.name || "",
                email: lead.email || "",
                phone: lead.phone || "",
                status: lead.status || "received",
                source: lead.source || "",
                preferred_country: lead.preferred_country || "",
                notes: lead.notes || "",
            });
        }
    }, [lead]);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await apiFetch(`/api/leads/${lead.id}/`, {
                method: "PATCH",
                body: JSON.stringify(formData),
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to update lead");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-[var(--cy-navy)]">Edit Lead</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="label">Full Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="input"
                                placeholder="Lead Name"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="input"
                                    placeholder="Email Address"
                                />
                            </div>
                            <div>
                                <label className="label">Phone</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="input"
                                    placeholder="Phone Number"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="input"
                                >
                                    <option value="received">Received</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="converted">Converted</option>
                                    <option value="junk">Junk</option>
                                    <option value="lost">Lost</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Source</label>
                                <input
                                    type="text"
                                    value={formData.source}
                                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                    className="input"
                                    placeholder="Source (e.g. Website)"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="label">Preferred Country</label>
                            <select
                                value={formData.preferred_country}
                                onChange={(e) => setFormData({ ...formData, preferred_country: e.target.value })}
                                className="input w-full"
                            >
                                <option value="">Select preferred country</option>
                                <option value="USA">USA</option>
                                <option value="UK">United Kingdom</option>
                                <option value="Canada">Canada</option>
                                <option value="Australia">Australia</option>
                                <option value="Germany">Germany</option>
                                <option value="Ireland">Ireland</option>
                                <option value="New Zealand">New Zealand</option>
                                <option value="France">France</option>
                                <option value="Netherlands">Netherlands</option>
                                <option value="Singapore">Singapore</option>
                                <option value="Dubai">Dubai (UAE)</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Notes</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="input min-h-[100px]"
                                placeholder="Internal notes..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-outline"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
