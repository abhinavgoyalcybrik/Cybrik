"use client";

import React, { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import apiFetch from "@/lib/api";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

// Move component outside to prevent re-creation on every render
const PasswordInput = ({
    label,
    name,
    value,
    show,
    onToggle,
    onChange
}: {
    label: string,
    name: string,
    value: string,
    show: boolean,
    onToggle: () => void,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => (
    <div className="form-control w-full">
        <label className="label">
            <span className="label-text font-medium text-[var(--cy-navy)]">{label}</span>
        </label>
        <div className="relative">
            <input
                type={show ? "text" : "password"}
                name={name}
                value={value}
                onChange={onChange}
                className="input input-bordered w-full pr-10 focus:border-[var(--cy-lime)] focus:ring-1 focus:ring-[var(--cy-lime)]"
                required
            />
            <button
                type="button"
                onClick={onToggle}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--cy-navy)]"
            >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    </div>
);

export default function ChangePasswordPage() {
    const [formData, setFormData] = useState({
        old_password: "",
        new_password: "",
        confirm_password: ""
    });
    const [showPassword, setShowPassword] = useState({
        old: false,
        new: false,
        confirm: false
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (message) setMessage(null);
    };

    const toggleShow = (field: 'old' | 'new' | 'confirm') => {
        setShowPassword({ ...showPassword, [field]: !showPassword[field] });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.new_password !== formData.confirm_password) {
            setMessage({ type: 'error', text: "New passwords do not match" });
            return;
        }

        if (formData.new_password.length < 8) {
            setMessage({ type: 'error', text: "Password must be at least 8 characters long" });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            await apiFetch('/api/auth/change-password/', {
                method: 'POST',
                body: JSON.stringify({
                    old_password: formData.old_password,
                    new_password: formData.new_password,
                    confirm_password: formData.confirm_password
                })
            });

            setMessage({ type: 'success', text: "Password changed successfully! Please login again with your new password." });
            setFormData({ old_password: "", new_password: "", confirm_password: "" });

            // Optional: Logout user after timeout
            // setTimeout(() => window.location.href = '/login', 2000);

        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || "Failed to change password" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto p-6">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-[var(--cy-navy)] flex items-center gap-2">
                        <ShieldCheck className="w-8 h-8 text-[var(--cy-lime)]" />
                        Change Password
                    </h1>
                    <p className="text-[var(--cy-text-muted)] mt-2">
                        Update your account password. Ensure you use a strong password for better security.
                    </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-[var(--cy-border)] p-8">
                    {message && (
                        <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <PasswordInput
                            label="Current Password"
                            name="old_password"
                            value={formData.old_password}
                            show={showPassword.old}
                            onToggle={() => toggleShow('old')}
                            onChange={handleChange}
                        />

                        <div className="divider"></div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <PasswordInput
                                label="New Password"
                                name="new_password"
                                value={formData.new_password}
                                show={showPassword.new}
                                onToggle={() => toggleShow('new')}
                                onChange={handleChange}
                            />

                            <PasswordInput
                                label="Confirm New Password"
                                name="confirm_password"
                                value={formData.confirm_password}
                                show={showPassword.confirm}
                                onToggle={() => toggleShow('confirm')}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn w-full md:w-auto px-8 bg-[var(--cy-navy)] hover:bg-[var(--cy-navy-light)] text-white border-none"
                            >
                                {loading ? <span className="loading loading-spinner"></span> : "Update Password"}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="mt-8 p-6 bg-blue-50 rounded-xl border border-blue-100">
                    <h3 className="font-semibold text-blue-900 mb-2">Password Requirements</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                        <li>Minimum 8 characters long</li>
                        <li>Must contain at least one letter and one number</li>
                        <li>Special characters (!@#$%) recommended</li>
                        <li>Different from your previous password</li>
                    </ul>
                </div>
            </div>
        </DashboardLayout>
    );
}
