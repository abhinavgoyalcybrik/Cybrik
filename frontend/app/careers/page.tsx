'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiFetch from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function CareersPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        message: '',
        source: 'careers_page', // Hidden field to identify source
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
            // Prepare lead/applicant data
            const leadData = {
                ...formData,
                external_id: `career_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            };

            // Send to backend (reusing web-leads for now as requested)
            const response = await apiFetch('/api/web-leads/', {
                method: 'POST',
                body: JSON.stringify(leadData),
            });

            if (response) {
                setSuccess(true);
            }
        } catch (err: any) {
            console.error('Error submitting application:', err);
            setError(err.message || 'Failed to submit application. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--cy-bg-page)] flex flex-col relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[var(--cy-lime)] opacity-5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-[var(--cy-navy)] opacity-5 rounded-full blur-3xl"></div>
            </div>

            <header className="relative z-10 w-full p-6 flex justify-between items-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
                <Link href="/">
                    <Image
                        src="/cybrik-logo.png"
                        alt="Cybrik Solutions"
                        width={150}
                        height={40}
                        className="h-8 w-auto"
                        priority
                    />
                </Link>
                <Link href="/crm/login" className="text-sm font-medium text-[var(--cy-navy)] hover:text-[var(--cy-lime)] transition-colors">
                    Sign In
                </Link>
            </header>

            <div className="flex-grow flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="max-w-4xl w-full bg-white rounded-2xl shadow-xl border border-[var(--cy-border)] overflow-hidden flex flex-col md:flex-row"
                >
                    {/* Left Side: Copy & Info */}
                    <div className="bg-[var(--cy-navy)] p-8 md:p-12 text-white md:w-5/12 relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
                        <div className="relative z-10">
                            <h2 className="text-3xl font-bold mb-6">Join Our Mission</h2>
                            <p className="text-blue-100 mb-8 leading-relaxed">
                                Help us build the next generation of AI-powered business automation. We're looking for passionate individuals to join our growing team.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-[var(--cy-lime)] flex items-center justify-center flex-shrink-0 text-[var(--cy-navy)] font-bold">✓</div>
                                    <span className="text-sm">Remote-First Culture</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-[var(--cy-lime)] flex items-center justify-center flex-shrink-0 text-[var(--cy-navy)] font-bold">✓</div>
                                    <span className="text-sm">Competitive Impact</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-[var(--cy-lime)] flex items-center justify-center flex-shrink-0 text-[var(--cy-navy)] font-bold">✓</div>
                                    <span className="text-sm">Innovation Focused</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Right Side: Form */}
                    <div className="p-8 md:p-12 md:w-7/12 bg-white">
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold text-[var(--cy-navy)] mb-2">Apply Now</h1>
                            <p className="text-[var(--cy-text-muted)] text-sm">
                                Interested in joining Cybrik? Send us your details.
                            </p>
                        </div>

                        <AnimatePresence mode="wait">
                            {success ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="bg-green-50 border border-green-200 rounded-xl p-8 text-center h-full flex flex-col justify-center items-center"
                                >
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-green-800 mb-2">Application Received!</h3>
                                    <p className="text-green-600 mb-6">Thanks for your interest. We'll be in touch if your profile matches our needs.</p>
                                    <Link href="/">
                                        <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold">
                                            Return Home
                                        </button>
                                    </Link>
                                </motion.div>
                            ) : (
                                <motion.form
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onSubmit={handleSubmit}
                                    className="space-y-5"
                                >
                                    <div className="space-y-2">
                                        <label htmlFor="name" className="text-sm font-semibold text-[var(--cy-navy)]">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none"
                                            placeholder="Your Name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="email" className="text-sm font-semibold text-[var(--cy-navy)]">
                                            Email Address <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none"
                                            placeholder="you@example.com"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="phone" className="text-sm font-semibold text-[var(--cy-navy)]">
                                            Phone Number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            id="phone"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none"
                                            placeholder="+1 (555) 123-4567"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="message" className="text-sm font-semibold text-[var(--cy-navy)]">
                                            Role of Interest / Message
                                        </label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            rows={3}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none resize-none"
                                            placeholder="Tell us about your skills or the role you are interested in..."
                                        />
                                    </div>

                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2"
                                        >
                                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {error}
                                        </motion.div>
                                    )}

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-[var(--cy-lime)]/20 text-sm font-bold text-white bg-[var(--cy-navy)] hover:bg-[#1a2f4d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--cy-navy)] disabled:opacity-70 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
                                        >
                                            {loading ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    Submit Application
                                                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="text-center mt-4">
                                        <Link href="/" className="text-sm font-medium text-gray-500 hover:text-[var(--cy-navy)] transition-colors flex items-center justify-center gap-2 group">
                                            <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Home
                                        </Link>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
