"use client";

import React, { useState } from 'react';
import apiFetch from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

type LeadSource = 'meta_ads' | 'google_ads' | 'organic' | 'referral' | 'other';

interface LeadCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function LeadCaptureModal({ isOpen, onClose, onSuccess }: LeadCaptureModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        message: '',
        source: 'meta_ads' as LeadSource,
        preferred_country: '',
        highest_qualification: '',
        qualification_marks: '',
        english_test_scores: '',
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const leadData = {
                ...formData,
                external_id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            };

            const response = await apiFetch('/api/leads/', {
                method: 'POST',
                body: JSON.stringify(leadData),
            });

            if (response) {
                setSuccess(true);
                setTimeout(() => {
                    onSuccess();
                    setSuccess(false);
                    setFormData({
                        name: '',
                        email: '',
                        phone: '',
                        message: '',
                        source: 'meta_ads',
                        preferred_country: '',
                        highest_qualification: '',
                        qualification_marks: '',
                        english_test_scores: '',
                    });
                    onClose();
                }, 1500);
            }
        } catch (err: any) {
            console.error('Error submitting lead:', err);
            setError(err.message || 'Failed to submit lead. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto relative">
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50 backdrop-blur-sm"
                                type="button"
                            >
                                <X size={20} />
                            </button>

                            <div className="bg-[var(--cy-navy)] p-6 text-center relative overflow-hidden">
                                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                                <h2 className="text-2xl font-bold text-white mb-1 relative z-10">Capture New Lead</h2>
                                <p className="text-[var(--cy-text-muted)] text-sm relative z-10">
                                    Add a new prospect to your pipeline
                                </p>
                            </div>

                            <div className="p-6">
                                {success ? (
                                    <div className="text-center py-8">
                                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-green-800 mb-2">Lead Captured!</h3>
                                        <p className="text-green-600">Closing form...</p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-semibold text-[var(--cy-navy)]">
                                                    Full Name <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    required
                                                    className="input w-full"
                                                    placeholder="e.g. John Doe"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-semibold text-[var(--cy-navy)]">
                                                    Email Address <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    required
                                                    className="input w-full"
                                                    placeholder="john@example.com"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-semibold text-[var(--cy-navy)]">
                                                    Phone Number <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    value={formData.phone}
                                                    onChange={handleChange}
                                                    required
                                                    className="input w-full"
                                                    placeholder="+1 (555) 000-0000"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-semibold text-[var(--cy-navy)]">
                                                    Lead Source
                                                </label>
                                                <select
                                                    name="source"
                                                    value={formData.source}
                                                    onChange={handleChange}
                                                    className="input w-full"
                                                >
                                                    <option value="meta_ads">Meta/Facebook Ads</option>
                                                    <option value="google_ads">Google Ads</option>
                                                    <option value="organic">Organic Search</option>
                                                    <option value="referral">Referral</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-semibold text-[var(--cy-navy)]">
                                                Preferred Country
                                            </label>
                                            <select
                                                name="preferred_country"
                                                value={formData.preferred_country}
                                                onChange={handleChange}
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

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-semibold text-[var(--cy-navy)]">
                                                Message / Notes
                                            </label>
                                            <textarea
                                                name="message"
                                                value={formData.message}
                                                onChange={handleChange}
                                                rows={3}
                                                className="input w-full resize-none"
                                                placeholder="Additional details..."
                                            />
                                        </div>

                                        <div className="border-t border-gray-100 pt-4">
                                            <h3 className="text-sm font-semibold text-[var(--cy-navy)] mb-3">
                                                Qualification Details <span className="font-normal text-[var(--cy-text-muted)]">(Optional)</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <input
                                                    type="text"
                                                    name="highest_qualification"
                                                    value={formData.highest_qualification}
                                                    onChange={handleChange}
                                                    className="input w-full text-sm"
                                                    placeholder="Qualification"
                                                />
                                                <input
                                                    type="text"
                                                    name="qualification_marks"
                                                    value={formData.qualification_marks}
                                                    onChange={handleChange}
                                                    className="input w-full text-sm"
                                                    placeholder="Marks/CGPA"
                                                />
                                                <input
                                                    type="text"
                                                    name="english_test_scores"
                                                    value={formData.english_test_scores}
                                                    onChange={handleChange}
                                                    className="input w-full text-sm"
                                                    placeholder="Test Scores"
                                                />
                                            </div>
                                        </div>

                                        {error && (
                                            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                                                {error}
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="btn btn-primary w-full justify-center"
                                            >
                                                {loading ? 'Processing...' : 'Capture Lead'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
