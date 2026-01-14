'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiFetch from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function ContactPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        source: 'contact_page', // Hidden field to identify source
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
            // Prepare data
            const leadData = {
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                message: `${formData.subject ? `Subject: ${formData.subject}\n\n` : ''}${formData.message || ''}`,
                source: 'cybrik_main_contact',
                external_id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            };

            // Send to Django backend
            const response = await apiFetch('/api/web-leads/', {
                method: 'POST',
                body: JSON.stringify(leadData),
            });

            if (response) {
                setSuccess(true);
            }
        } catch (err: any) {
            console.error('Error submitting contact form:', err);
            setError(err.message || 'Failed to send message. Please try again.');
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
                <Link href="/" className="flex items-center gap-2">
                    <Image
                        src="/images/cybrik-logo.png"
                        alt="Cybrik Solutions"
                        width={0}
                        height={0}
                        sizes="100vw"
                        style={{ width: 'auto', height: '2.5rem' }}
                        className="logo-glow"
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
                            <h2 className="text-2xl font-bold mb-6">Get in Touch</h2>
                            <p className="text-blue-100 mb-8 leading-relaxed">
                                Have questions about our AI solutions? Need support? We're here to help.
                            </p>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[var(--cy-lime)]/20 flex items-center justify-center flex-shrink-0 text-[var(--cy-lime)]">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-[var(--cy-lime)] uppercase tracking-wider mb-1">Email Us</h3>
                                        <a href="mailto:info@cybriksolutions.com" className="text-white hover:text-blue-200 transition-colors text-lg font-medium">
                                            info@cybriksolutions.com
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[var(--cy-lime)]/20 flex items-center justify-center flex-shrink-0 text-[var(--cy-lime)]">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-[var(--cy-lime)] uppercase tracking-wider mb-1">Support</h3>
                                        <p className="text-blue-100">
                                            Our team is available Mon-Fri to assist with any inquiries.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Form */}
                    <div className="p-8 md:p-12 md:w-7/12 bg-white">
                        <div className="mb-8">
                            <h1 className="text-xl font-bold text-[var(--cy-navy)] mb-2">Send us a Message</h1>
                            <p className="text-[var(--cy-text-muted)] text-sm">
                                Fill out the form below and we'll get back to you as soon as possible.
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
                                    <h3 className="text-xl font-bold text-green-800 mb-2">Message Sent!</h3>
                                    <p className="text-green-600 mb-6">Thank you for contacting us. We will respond to your inquiry shortly.</p>
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
                                        <label htmlFor="subject" className="text-sm font-semibold text-[var(--cy-navy)]">
                                            Subject
                                        </label>
                                        <input
                                            type="text"
                                            id="subject"
                                            name="subject"
                                            value={formData.subject}
                                            onChange={handleChange}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none"
                                            placeholder="How can we help?"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="message" className="text-sm font-semibold text-[var(--cy-navy)]">
                                            Message <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            id="message"
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            required
                                            rows={4}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none resize-none"
                                            placeholder="Your message details..."
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
                                                    Sending Message...
                                                </>
                                            ) : (
                                                <>
                                                    Send Message
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
