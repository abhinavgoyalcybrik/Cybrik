"use client";

import { Check, X } from "lucide-react";
import { RazorpayButton } from "@/components/payment/RazorpayButton";
import { useEffect, useState } from "react";

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UpgradeSubscriptionModal = ({ isOpen, onClose }: UpgradeModalProps) => {
    const [planId, setPlanId] = useState<string | null>(null);
    const [price, setPrice] = useState<string>("1000");
    const [loadingPlan, setLoadingPlan] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoadingPlan(true);
            fetch('/api/billing/plans/?active=true')
                .then(async (res) => {
                    const text = await res.text();
                    try {
                        const data = JSON.parse(text);
                        if (!res.ok) throw new Error(data.detail || data.error || "Failed to fetch plans");

                        const plans = Array.isArray(data) ? data : (data.results || []);
                        const premium = plans.find((p: any) => p.name.includes('Premium')) || plans[0];
                        if (premium) {
                            setPlanId(premium.id);
                            if (premium.price_cents) {
                                setPrice((premium.price_cents / 100).toString());
                            }
                        }
                    } catch (e) {
                        console.error("Plan Fetch Error:", e);
                        console.error("Server Response Body:", text); // <--- THIS IS CRITICAL
                    }
                })
                .catch(console.error)
                .finally(() => setLoadingPlan(false));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100">
                {/* Header with Gradient */}
                <div className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 p-8 text-center border-b border-gray-100">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-2 rounded-full hover:bg-black/5 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>

                    <div className="mx-auto w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 p-2">
                        <img
                            src="/cybrik-logo.png"
                            alt="Cybrik Logo"
                            className="h-full w-auto object-contain"
                        />
                    </div>

                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                        Upgrade to Premium
                    </h2>
                    <p className="text-gray-600">
                        Maximize your score with unlimited access
                    </p>
                </div>

                <div className="p-8">
                    {/* Features Grid */}
                    <div className="grid grid-cols-1 gap-4 mb-8">
                        {[
                            "Unlimited Speaking Tests",
                            "Unlimited Writing Tests",
                            "Full Reading & Listening Modules",
                            "Detailed AI Feedback & Analytics"
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                </div>
                                <span className="font-medium text-gray-700">{feature}</span>
                            </div>
                        ))}
                    </div>

                    {/* Pricing */}
                    <div className="text-center mb-8">
                        <div className="inline-block px-4 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full mb-3">
                            Most Popular Plan
                        </div>
                        <div className="flex items-center justify-center gap-1">
                            <span className="text-4xl font-bold text-gray-900">₹{price}</span>
                            <span className="text-gray-500 font-medium">/month</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Cancel anytime • Secure payment</p>
                    </div>

                    {loadingPlan ? (
                        <div className="text-center text-sm text-gray-500 animate-pulse">Loading plan...</div>
                    ) : (
                        <RazorpayButton
                            planId={planId || ""}
                            buttonText="Upgrade to Premium Now"
                            onSuccess={() => {
                                alert("Welcome to Premium!");
                                onClose();
                                window.location.reload();
                            }}
                            description="Premium Subscription"
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
