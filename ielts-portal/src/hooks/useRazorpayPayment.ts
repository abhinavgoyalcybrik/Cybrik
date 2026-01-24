import { useRazorpay as useReactRazorpay, RazorpayOrderOptions } from "react-razorpay";
import { useCallback } from "react";

interface PaymentOrder {
    order_id: string;
    key_id: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    prefill: {
        name: string;
        email: string;
        contact?: string;
    };
    purchase_id: string; // Internal purchase ID
}

interface PaymentVerification {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

export const useRazorpayPayment = () => {
    const { Razorpay } = useReactRazorpay();

    const handlePayment = useCallback((order: PaymentOrder, onSuccess: (response: PaymentVerification) => void, onFailure?: (error: any) => void) => {
        const options: RazorpayOrderOptions = {
            key: order.key_id,
            amount: order.amount,
            currency: order.currency as any,
            name: order.name,
            description: order.description,
            order_id: order.order_id,
            handler: (response: any) => {
                onSuccess({
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature
                });
            },
            prefill: order.prefill,
            notes: {
                purchase_id: order.purchase_id
            } as any,
            theme: {
                color: "#3399cc"
            },
            modal: {
                ondismiss: () => {
                    if (onFailure) onFailure("Payment cancelled by user");
                }
            }
        };

        const rzp1 = new Razorpay(options);
        rzp1.on("payment.failed", function (response: any) {
            if (onFailure) onFailure(response.error);
        });
        rzp1.open();
    }, [Razorpay]);

    return { handlePayment };
};
