"use client";

import { useRazorpayPayment } from "@/hooks/useRazorpayPayment";
import { useState } from "react";
import { useSession } from "next-auth/react";

interface RazorpayButtonProps {
    planId?: string;
    productId?: string;
    description?: string;
    buttonText?: string;
    onSuccess?: () => void;
}

export const RazorpayButton = ({
    planId,
    productId,
    description = "Payment",
    buttonText = "Pay with Razorpay",
    onSuccess
}: RazorpayButtonProps) => {
    const { handlePayment } = useRazorpayPayment();
    const { data: session } = useSession();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const initiatePayment = async () => {
        setLoading(true);
        setError(null);

        try {
            // 1. Create Order on Backend
            // Use existing API URL or relative path if proxied
            const response = await fetch('/api/billing/razorpay/initiate_payment/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Authorization handled by session cookie usually, but update if needed
                },
                body: JSON.stringify({
                    plan_id: planId,
                    product_id: productId
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to initiate payment");
            }

            const orderData = await response.json();

            // 2. Open Razorpay Checkout
            handlePayment(
                orderData,
                async (verificationData) => {
                    // 3. Verify Payment on Backend
                    try {
                        const verifyRes = await fetch('/api/billing/razorpay/verify_payment/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(verificationData)
                        });

                        if (verifyRes.ok) {
                            if (onSuccess) onSuccess();
                            else alert("Payment Successful!");
                        } else {
                            setError("Verification failed");
                        }
                    } catch (e) {
                        setError("Verification error");
                    }
                },
                (err) => {
                    setError(typeof err === 'string' ? err : err.description || "Payment failed");
                    setLoading(false);
                }
            );

            setLoading(false); // Note: Loading stays true while modal is open in logic above? 
            // Actually handlePayment is async related to user action, so we might want to keep loading 
            // until modal opens or closes. 
            // For now, let's keep it simple.

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
                onClick={initiatePayment}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? "Processing..." : buttonText}
            </button>
        </div>
    );
};
