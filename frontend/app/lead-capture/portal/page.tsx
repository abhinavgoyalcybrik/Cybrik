"use client";

import { useState } from "react";
import apiFetch from "@/lib/api";

export default function PortalLeadCapture() {
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        city: "",
        country: "",
        preferred_language: "English",
        interested_service: "",
        message: "",
        consent_given: false,
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.consent_given) {
            setError("You must agree to receive communications.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            // Use fetch directly for public endpoint if apiFetch requires auth
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.cybriksolutions.com'}/api/leads/portal/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(JSON.stringify(errData));
            }

            setSuccess(true);
        } catch (err: any) {
            setError("Failed to submit: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="card max-w-md w-full p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--cy-navy)] mb-2">Thank You!</h2>
                    <p className="text-[var(--cy-text-secondary)]">We have received your inquiry. You will receive a verification call shortly.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-[var(--cy-navy)]">Start Your Journey</h1>
                    <p className="mt-2 text-[var(--cy-text-secondary)]">Fill in your details to get started with CybricHQ.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="label">Full Name *</label>
                            <input required name="name" value={formData.name} onChange={handleChange} className="input" placeholder="John Doe" />
                        </div>

                        <div>
                            <label className="label">Mobile Number (WhatsApp) *</label>
                            <input required name="phone" value={formData.phone} onChange={handleChange} className="input" placeholder="+1234567890" />
                        </div>

                        <div>
                            <label className="label">Email (Optional)</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="input" placeholder="john@example.com" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">City</label>
                                <input name="city" value={formData.city} onChange={handleChange} className="input" placeholder="New York" />
                            </div>
                            <div>
                                <label className="label">Country</label>
                                <input name="country" value={formData.country} onChange={handleChange} className="input" placeholder="USA" />
                            </div>
                        </div>

                        <div>
                            <label className="label">Preferred Language</label>
                            <select name="preferred_language" value={formData.preferred_language} onChange={handleChange} className="select w-full">
                                <option value="English">English</option>
                                <option value="Spanish">Spanish</option>
                                <option value="Hindi">Hindi</option>
                                <option value="French">French</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Interested Service / Program</label>
                            <input name="interested_service" value={formData.interested_service} onChange={handleChange} className="input" placeholder="e.g. Study in Canada, MBA" />
                        </div>

                        <div>
                            <label className="label">Message (Optional)</label>
                            <textarea name="message" value={formData.message} onChange={handleChange} className="textarea h-24" placeholder="Tell us more about your goals..." />
                        </div>

                        <div className="flex items-start">
                            <div className="flex items-center h-5">
                                <input
                                    id="consent"
                                    name="consent_given"
                                    type="checkbox"
                                    checked={formData.consent_given}
                                    onChange={handleChange}
                                    className="checkbox checkbox-primary"
                                />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="consent" className="font-medium text-gray-700">I agree to receive automated calls and WhatsApp messages from CybricHQ.</label>
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={loading} className="btn btn-primary w-full">
                        {loading ? "Submitting..." : "Submit Inquiry"}
                    </button>
                </form>
            </div>
        </div>
    );
}
