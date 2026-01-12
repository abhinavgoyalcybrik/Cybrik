'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import apiFetch from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

type LeadSource = 'meta_ads' | 'google_ads' | 'organic' | 'referral' | 'other';

export default function LeadCapturePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    source: 'meta_ads' as LeadSource,
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
      // Prepare lead data
      const leadData = {
        ...formData,
        external_id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique ID for deduplication
      };

      // Send lead to backend
      const response = await apiFetch('/api/leads/', {
        method: 'POST',
        body: JSON.stringify(leadData),
      });

      if (response) {
        setSuccess(true);
        // Redirect to leads page after 1.5 seconds
        setTimeout(() => {
          router.push('/leads');
        }, 1500);
      }
    } catch (err: any) {
      console.error('Error submitting lead:', err);
      setError(err.message || 'Failed to submit lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cy-bg-page)] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[var(--cy-lime)] opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-[var(--cy-navy)] opacity-5 rounded-full blur-3xl"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-3xl w-full bg-white rounded-2xl shadow-xl border border-[var(--cy-border)] overflow-hidden relative z-10"
      >
        <div className="bg-[var(--cy-navy)] p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Capture New Lead</h1>
            <p className="text-[var(--cy-text-muted)] text-sm max-w-md mx-auto">
              Enter the details below to add a new prospect to your CRM pipeline.
            </p>
          </motion.div>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-green-50 border border-green-200 rounded-xl p-8 text-center"
              >
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">Lead Captured Successfully!</h3>
                <p className="text-green-600 mb-6">Redirecting to leads page...</p>
                <div className="flex justify-center">
                  <svg className="animate-spin h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </motion.div>
            ) : (
              <motion.form
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      placeholder="e.g. John Doe"
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
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      placeholder="e.g. +1 (555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="source" className="text-sm font-semibold text-[var(--cy-navy)]">
                      Lead Source
                    </label>
                    <div className="relative">
                      <select
                        id="source"
                        name="source"
                        value={formData.source}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none appearance-none"
                      >
                        <option value="meta_ads">Meta/Facebook Ads</option>
                        <option value="google_ads">Google Ads</option>
                        <option value="organic">Organic Search</option>
                        <option value="referral">Referral</option>
                        <option value="other">Other</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-semibold text-[var(--cy-navy)]">
                    Message / Notes
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none resize-none"
                    placeholder="Any additional details..."
                  />
                </div>

                {/* Qualification Details Section */}
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-[var(--cy-navy)] mb-2">
                    Qualification Details
                    <span className="text-sm font-normal text-[var(--cy-text-muted)] ml-2">(Optional)</span>
                  </h3>
                  <p className="text-xs text-[var(--cy-text-muted)] mb-4">
                    Help us personalize your AI consultation call
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="highest_qualification" className="text-sm font-semibold text-[var(--cy-navy)]">
                        Highest Qualification
                      </label>
                      <input
                        type="text"
                        id="highest_qualification"
                        name="highest_qualification"
                        value={formData.highest_qualification}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none"
                        placeholder="e.g., B.Tech, 12th, Diploma"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="qualification_marks" className="text-sm font-semibold text-[var(--cy-navy)]">
                        Marks/Percentage
                      </label>
                      <input
                        type="text"
                        id="qualification_marks"
                        name="qualification_marks"
                        value={formData.qualification_marks}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none"
                        placeholder="e.g., 85%, CGPA 8.5"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="english_test_scores" className="text-sm font-semibold text-[var(--cy-navy)]">
                        English Test Scores
                      </label>
                      <input
                        type="text"
                        id="english_test_scores"
                        name="english_test_scores"
                        value={formData.english_test_scores}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--cy-lime)] focus:border-transparent transition-all outline-none"
                        placeholder="e.g., IELTS 7.5, PTE 65"
                      />
                    </div>
                  </div>
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

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-500/20 text-sm font-bold text-white bg-[var(--cy-navy)] hover:bg-[var(--cy-navy-light)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--cy-navy)] disabled:opacity-70 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        Capture Lead
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}