'use client';

import React, { useState } from 'react';
import { MessageCircle, X, Send, AlertCircle, CheckCircle } from 'lucide-react';

interface QuickSupportWidgetProps {
    testType: string;
    testId?: string;
}

export default function QuickSupportWidget({ testType, testId }: QuickSupportWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [category, setCategory] = useState('test');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setSubmitting(true);
        try {
            const subject = `Issue Report: ${testType} Test ${testId ? `#${testId}` : ''}`;

            const res = await fetch('/api/ielts/tickets/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    subject,
                    description: message,
                    category,
                    priority: 'medium',
                }),
            });

            if (res.ok) {
                setSuccess(true);
                setMessage('');
                setTimeout(() => {
                    setSuccess(false);
                    setIsOpen(false);
                }, 2000);
            }
        } catch (err) {
            console.error('Error submitting ticket:', err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-white text-slate-700 rounded-full shadow-lg border border-slate-200 hover:shadow-xl hover:border-[#6FB63A] hover:text-[#6FB63A] transition-all duration-200 ${isOpen ? 'hidden' : 'flex'}`}
            >
                <div className="w-8 h-8 rounded-full bg-[#6FB63A]/10 flex items-center justify-center text-[#6FB63A]">
                    <MessageCircle className="w-5 h-5" />
                </div>
                <span className="font-medium pr-1">Report Issue</span>
            </button>

            {/* Widget Modal */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
                    {/* Header */}
                    <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
                        <h3 className="text-white font-medium flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-[#6FB63A]" />
                            Support
                        </h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        {success ? (
                            <div className="text-center py-6">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                                <h4 className="font-semibold text-slate-900 mb-1">Sent!</h4>
                                <p className="text-sm text-slate-500">We've received your report.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Issue Type</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent"
                                    >
                                        <option value="test">Test Content Issue</option>
                                        <option value="technical">Technical Bug</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Describe the issue..."
                                        rows={4}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent resize-none"
                                        required
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#6FB63A] text-white text-sm font-medium rounded-lg hover:bg-[#5FA030] transition-colors disabled:opacity-50"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        {submitting ? 'Sending...' : 'Send Report'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
