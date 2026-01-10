"use client";

import { useState } from "react";
import apiFetch from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { useRouter } from "next/navigation";

export default function WalkInLeadCapture() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        visit_type: "first_time",
        message: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await apiFetch("/api/leads/walk-in/", {
                method: "POST",
                body: JSON.stringify(formData),
            });
            alert("Walk-in lead registered successfully!");
            router.push("/leads");
        } catch (err: any) {
            setError("Failed to register: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                    <h1 className="h2 text-[var(--cy-navy)]">Walk-In Registration</h1>
                    <p className="text-[var(--cy-text-secondary)]">Register a new visitor at the center.</p>
                </div>

                <div className="card p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="label">Visitor Name *</label>
                                <input required name="name" value={formData.name} onChange={handleChange} className="input" placeholder="Visitor Name" />
                            </div>

                            <div>
                                <label className="label">Mobile Number *</label>
                                <input required name="phone" value={formData.phone} onChange={handleChange} className="input" placeholder="+1234567890" />
                            </div>
                        </div>

                        <div>
                            <label className="label">Email (Optional)</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="input" placeholder="visitor@example.com" />
                        </div>

                        <div>
                            <label className="label">Visit Type</label>
                            <select name="visit_type" value={formData.visit_type} onChange={handleChange} className="select w-full">
                                <option value="first_time">First Time Visit</option>
                                <option value="follow_up">Follow-up Visit</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Notes / Purpose</label>
                            <textarea name="message" value={formData.message} onChange={handleChange} className="textarea h-24" placeholder="Notes from the front desk..." />
                        </div>

                        <div className="flex justify-end pt-4">
                            <button type="submit" disabled={loading} className="btn btn-primary">
                                {loading ? "Registering..." : "Register Walk-In"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </DashboardLayout>
    );
}
