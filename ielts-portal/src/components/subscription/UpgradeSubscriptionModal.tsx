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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col md:flex-row max-h-[90vh]">

                {/* Left Side: Value Prop & Features */}
                <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 md:p-10 flex flex-col justify-center relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-400 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 right-0 w-60 h-60 bg-purple-400 rounded-full blur-3xl"></div>
                    </div>

                    <div className="relative z-10">
                        <img
                            src="/cybrik-logo.png"
                            alt="Cybrik Logo"
                            className="h-12 w-auto object-contain mb-8"
                        />

                        <h2 className="text-3xl font-extrabold text-gray-900 mb-4 leading-tight">
                            Unlock Your <br />
                            <span className="text-blue-600">Full Potential</span>
                        </h2>

                        <p className="text-gray-600 mb-8 text-lg">
                            Get unlimited access to AI-powered feedback and ace your IELTS exam.
                        </p>

                        <div className="space-y-4">
                            {[
                                "Unlimited Speaking Tests with AI Grading",
                                "Unlimited Writing Corrections",
                                "Full Reading & Listening Mock Tests",
                                "Personalized Performance Analytics",
                                "Priority 24/7 Support"
                            ].map((feature, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-white/50 hover:bg-white hover:scale-[1.02] transition-all duration-200 shadow-sm cursor-default">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                        <Check className="h-5 w-5" />
                                    </div>
                                    <span className="font-medium text-gray-800">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Pricing & Action */}
                <div className="flex-1 bg-white p-8 md:p-10 flex flex-col relative">
                    <button
                        onClick={onClose}
                        className="absolute right-6 top-6 p-2 rounded-full hover:bg-gray-100 transition-colors z-20"
                    >
                        <X className="h-6 w-6 text-gray-400 hover:text-gray-600" />
                    </button>

                    <div className="flex-1 flex flex-col justify-center items-center text-center">
                        <div className="mb-8">
                            <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-sm font-bold rounded-full shadow-lg transform -rotate-2 mb-4">
                                ★ MOST POPULAR
                            </span>
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <span className="text-6xl font-black text-gray-900 tracking-tight">₹{price}</span>
                            </div>
                            <span className="text-gray-500 font-medium text-lg">per month</span>
                        </div>

                        <div className="w-full max-w-sm space-y-4">
                            {loadingPlan ? (
                                <div className="w-full py-4 rounded-xl bg-gray-100 animate-pulse text-gray-400">
                                    Loading plan details...
                                </div>
                            ) : (
                                <div className="transform hover:scale-[1.02] transition-transform duration-200">
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
                                </div>
                            )}

                            <p className="text-xs text-center text-gray-400 mt-6 flex items-center justify-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Secure Payment via Razorpay
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
