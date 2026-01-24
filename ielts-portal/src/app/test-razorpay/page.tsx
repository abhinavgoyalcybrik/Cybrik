"use client";

import { RazorpayButton } from "@/components/payment/RazorpayButton";
import { useState } from "react";

export default function TestRazorpayPage() {
    const [status, setStatus] = useState("Waiting for action...");

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Razorpay Integration Test</h1>
            <p className="mb-4">Status: {status}</p>

            <div className="border p-4 rounded max-w-md">
                <h2 className="font-semibold mb-2">Premium Plan (1000 INR)</h2>
                <p className="mb-4">Simulate purchasing the Premium plan.</p>
                <RazorpayButton
                    planId="051a32b0-9f37-432b-aed6-3c4a18e5d1a6"
                    buttonText="Buy Premium Plan"
                    onSuccess={() => setStatus("Payment Verified Successfully!")}
                    description="Premium Plan Subscription"
                />
            </div>

            <div className="mt-8 text-sm text-gray-500">
                <p>Plan Configured: Premium Plan (1000 INR)</p>
                <p>Plan ID: 051a32b0-9f37-432b-aed6-3c4a18e5d1a6</p>
                <p className="mt-2">Also Created: Free Plan (ID: cee3caf4-e003-4af6-a6f5-eb7458d6012b)</p>
                <p className="mt-2 text-red-500">WARNING: You are using LIVE keys. This will charge 1000 INR. Switch to Test keys or use a small amount for testing.</p>
            </div>
        </div>
    );
}
