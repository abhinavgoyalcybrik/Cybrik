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
                .then(res => res.json())
                .then(data => {
                    const plans = Array.isArray(data) ? data : (data.results || []);
                    // Find the premium plan (assuming 'Premium' in name)
                    const premium = plans.find((p: any) => p.name.includes('Premium')) || plans[0];
                    if (premium) {
                        setPlanId(premium.id);
                        if (premium.price_cents) {
                            setPrice((premium.price_cents / 100).toString());
                        }
                    }
                })
                .catch(console.error)
                .finally(() => setLoadingPlan(false));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 relative">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </button>

                    <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                        <h2 className="text-2xl font-bold text-center leading-none tracking-tight">Upgrade to Premium</h2>
                        <p className="text-sm text-center text-gray-500">
                            Unlock unlimited practice tests and accelerate your preparation.
                        </p>
                    </div>

                    <div className="flex flex-col gap-4 py-6">
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <span>Unlimited Speaking Tests</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <span>Unlimited Writing Tests</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <span>Full Reading & Listening Modules</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <span>Detailed AI Feedback & Analytics</span>
                        </div>

                        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                            <p className="text-lg font-semibold">Premium Plan</p>
                            <p className="text-3xl font-bold mt-1">₹{price}<span className="text-sm font-normal text-gray-500">/month</span></p>
                        </div>

                        {loadingPlan ? (
                            <div className="text-center text-sm text-gray-500">Loading plan details...</div>
                        ) : (
                            <RazorpayButton
                                planId={planId || ""}
                                buttonText="Upgrade Now"
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
        </div>
    );
};
