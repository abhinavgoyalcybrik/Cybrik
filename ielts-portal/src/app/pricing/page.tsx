"use client";

import { Check, X } from "lucide-react";
import { RazorpayButton } from "@/components/payment/RazorpayButton";
import { useSession } from "next-auth/react";

export default function PricingPage() {
    const { data: session } = useSession();

    // Check if user is already upgraded (assuming profile data is in session or fetched)
    // For now we just show the options.

    return (
        <div className="py-12 bg-gray-50 min-h-screen flex flex-col items-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h1>
            <p className="text-lg text-gray-600 mb-12">Choose the plan that fits your preparation needs.</p>

            <div className="flex flex-col md:flex-row gap-8 max-w-5xl px-4">

                {/* Free Plan */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col w-full md:w-80">
                    <h3 className="text-xl font-semibold text-gray-900">Free Plan</h3>
                    <div className="mt-4 mb-8">
                        <span className="text-4xl font-bold">₹0</span>
                        <span className="text-gray-500">/month</span>
                    </div>

                    <div className="flex-1 space-y-4 mb-8">
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <span className="text-gray-600">1 Test per Module</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <span className="text-gray-600">Basic Analytics</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <X className="h-5 w-5 text-gray-300" />
                            <span className="text-gray-400">AI Feedback</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <X className="h-5 w-5 text-gray-300" />
                            <span className="text-gray-400">Unlimited Practice</span>
                        </div>
                    </div>

                    <button className="w-full py-2 px-4 rounded-lg bg-gray-100 text-gray-900 font-medium cursor-default">
                        Current Plan
                    </button>
                </div>

                {/* Premium Plan */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-blue-600 p-8 flex flex-col w-full md:w-80 relative transform scale-105">
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
                        POPULAR
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Premium Plan</h3>
                    <div className="mt-4 mb-8">
                        <span className="text-4xl font-bold">₹1000</span>
                        <span className="text-gray-500">/month</span>
                    </div>

                    <div className="flex-1 space-y-4 mb-8">
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <span className="text-gray-900 font-medium">Unlimited Tests</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <span className="text-gray-600">Detailed Analytics</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <span className="text-gray-600">Advanced AI Feedback</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-green-500" />
                            <span className="text-gray-600">Priority Support</span>
                        </div>
                    </div>

                    <RazorpayButton
                        planId="051a32b0-9f37-432b-aed6-3c4a18e5d1a6"
                        buttonText="Upgrade to Premium"
                        onSuccess={() => {
                            alert("Payment Successful! Welcome to Premium.");
                            window.location.href = '/dashboard';
                        }}
                        description="Premium Plan Subscription"
                    />
                </div>

            </div>
        </div>
    );
}
