"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check } from "lucide-react";
import { RazorpayButton } from "@/components/payment/RazorpayButton";

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UpgradeSubscriptionModal = ({ isOpen, onClose }: UpgradeModalProps) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center">Upgrade to Premium</DialogTitle>
                    <DialogDescription className="text-center">
                        Unlock unlimited practice tests and accelerate your preparation.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
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
                        <p className="text-3xl font-bold mt-1">₹1000<span className="text-sm font-normal text-gray-500">/month</span></p>
                    </div>

                    <RazorpayButton
                        planId="051a32b0-9f37-432b-aed6-3c4a18e5d1a6"
                        buttonText="Upgrade Now"
                        onSuccess={() => {
                            alert("Welcome to Premium!");
                            onClose();
                            // Ideally refresh session/user data here
                            window.location.reload();
                        }}
                        description="Premium Subscription"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
};
