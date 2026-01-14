'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function ContactPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            setSuccess(true);
        } catch (err: any) {
            console.error('Error submitting contact form:', err);
            setError(err.message || 'Failed to send message. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0F1929] flex flex-col relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 opacity-5">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                            <circle cx="30" cy="30" r="1.5" fill="#6FB63A" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            <header className="relative z-10 w-full p-6 flex justify-between items-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                <Link href="/" className="flex items-center gap-2">
                    <img src="/logo.png" alt="Cybrik IELTS" className="h-10 w-auto" />
                </Link>
                <Link href="/login" className="text-sm font-medium text-white hover:text-[#6FB63A] transition-colors">
                    Sign In
                </Link>
            </header>

            <div className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row"
                >
                    {/* Left Side */}
                    <div className="bg-[#0B1F3A] p-8 md:p-12 text-white md:w-5/12 relative overflow-hidden flex flex-col justify-center">
                        <div className="relative z-10">
                            <h2 className="text-2xl font-bold mb-6">Get in Touch</h2>
                            <p className="text-blue-100 mb-8 leading-relaxed">
                                Have questions about our IELTS preparation platform? Need support? We're here to help.
                            </p>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#6FB63A]/20 flex items-center justify-center flex-shrink-0 text-[#6FB63A]">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-[#6FB63A] uppercase tracking-wider mb-1">Email Us</h3>
                                        <a href="mailto:support@cybriksolutions.com" className="text-white hover:text-blue-200 transition-colors text-lg font-medium">
                                            support@cybriksolutions.com
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#6FB63A]/20 flex items-center justify-center flex-shrink-0 text-[#6FB63A]">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-[#6FB63A] uppercase tracking-wider mb-1">Support</h3>
                                        <p className="text-blue-100">
                                            Our team is available Mon-Fri to assist with any inquiries.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side - Form */}
                    <div className="p-8 md:p-12 md:w-7/12 bg-white">
                        <div className="mb-8">
                            <h1 className="text-xl font-bold text-[#0B1F3A] mb-2">Send us a Message</h1>
                            <p className="text-slate-600 text-sm">
                                Fill out the form below and we'll get back to you as soon as possible.
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {success ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-green-50 border border-green-200 rounded-xl p-8 text-center"
                                >
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-green-800 mb-2">Message Sent!</h3>
                                    <p className="text-green-600 mb-6">Thanks for reaching out. We'll respond within 24 hours.</p>
                                    <Link href="/">
                                        <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                                            Return Home
                                        </button>
                                    </Link>
                                </motion.div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label className="text-sm font-semibold text-[#0B1F3A] mb-2 block">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none"
                                            placeholder="Your Name"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-[#0B1F3A] mb-2 block">
                                            Email Address <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none"
                                            placeholder="you@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-[#0B1F3A] mb-2 block">
                                            Subject <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="subject"
                                            value={formData.subject}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none"
                                            placeholder="What is this about?"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-[#0B1F3A] mb-2 block">
                                            Message <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            required
                                            rows={4}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6FB63A] focus:border-transparent outline-none resize-none"
                                            placeholder="How can we help you?"
                                        />
                                    </div>

                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-3.5 bg-[#6F B63A] text-white rounded-lg font-bold hover:bg-[#5FA030] disabled:opacity-70 transition-all"
                                    >
                                        {loading ? 'Sending...' : 'Send Message'}
                                    </button>

                                    <div className="text-center">
                                        <Link href="/" className="text-sm text-slate-500 hover:text-[#6FB63A] transition-colors">
                                            ← Back to Home
                                        </Link>
                                    </div>
                                </form>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
