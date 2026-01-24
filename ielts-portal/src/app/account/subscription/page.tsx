'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { UpgradeSubscriptionModal } from '@/components/subscription/UpgradeSubscriptionModal';

interface Subscription {
    plan: 'free' | 'basic' | 'premium';
    status: 'active' | 'cancelled' | 'expired';
    startDate: string;
    expiryDate: string;
    testsLimit: number;
    testsUsed: number;
    features: {
        unlimitedTests: boolean;
        detailedFeedback: boolean;
        oneOnOneSessions: boolean;
        prioritySupport: boolean;
    };
    upgradePath?: string;
}

const plans = [
    {
        name: 'Free',
        id: 'free',
        price: '₹0',
        period: 'forever',
        description: 'Perfect for getting started',
        features: [
            '1 test per module',
            'Basic scoring',
            'Standard support',
            'Email reports',
        ],
        limited: ['Unlimited tests', 'Detailed feedback', '1-on-1 sessions'],
        cta: 'Current Plan',
        highlighted: false,
    },
    {
        name: 'Premium',
        id: 'premium',
        price: '₹1,000',
        period: 'per month',
        description: 'Complete IELTS mastery',
        features: [
            'Unlimited practice tests',
            'Detailed AI Feedback',
            'Performance analytics',
            'Priority support (24/7)',
            'Custom study plans',
            'Mock test reviews',
        ],
        limited: [],
        cta: 'Upgrade to Premium',
        highlighted: true,
    },
];

export default function SubscriptionPage() {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/account/subscription')
            .then(res => res.json())
            .then(data => {
                setSubscription(data);
                setLoading(false);
            });
    }, []);

    const handleUpgrade = async (planId: string) => {
        try {
            const response = await fetch('/api/account/subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: planId }),
            });

            const data = await response.json();

            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            }
        } catch (error) {
            console.error('Subscription error:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg text-gray-600">Loading subscription...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 relative">
            {/* Top Left Logo */}
            <div className="absolute top-6 left-6 md:top-8 md:left-8 z-10">
                <img
                    src="/cybrik-logo.png"
                    alt="Cybrik Logo"
                    className="h-10 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
                />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <Link
                        href="/account"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Account
                    </Link>

                    <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Unlock your full potential with unlimited practice and expert guidance
                    </p>
                </div>

                {/* Current Subscription Alert */}
                {subscription && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-3xl mx-auto mb-8 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-900">
                                        Current Plan: {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {subscription.plan === 'free'
                                            ? `${subscription.testsUsed}/${subscription.testsLimit} tests used this month`
                                            : `Renews on ${new Date(subscription.expiryDate).toLocaleDateString()}`
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Plans Grid */}
                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {plans.map((plan, index) => {
                        const isCurrentPlan = subscription?.plan === plan.id;
                        const canUpgrade = subscription && plans.findIndex(p => p.id === subscription.plan) < index;
                        const isPremium = plan.id === 'premium';

                        return (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`relative bg-white rounded-2xl shadow-xl border-2 ${plan.highlighted
                                    ? 'border-blue-500 scale-105'
                                    : isCurrentPlan
                                        ? 'border-green-400'
                                        : 'border-gray-200'
                                    } p-8`}
                            >
                                {plan.highlighted && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-green-600 text-white text-sm font-semibold rounded-full">
                                        Most Popular
                                    </div>
                                )}

                                {isCurrentPlan && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-green-500 text-white text-sm font-semibold rounded-full">
                                        Current Plan
                                    </div>
                                )}

                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                                    <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                                    <div className="flex items-baseline justify-center gap-2">
                                        <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                                        <span className="text-gray-500">/{plan.period}</span>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    {plan.features.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className="text-gray-700">{feature}</span>
                                        </div>
                                    ))}

                                    {plan.limited.map((feature, i) => (
                                        <div key={`limited-${i}`} className="flex items-start gap-3 opacity-40">
                                            <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            <span className="text-gray-500">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                {isPremium ? (
                                    <div className="w-full">
                                        <UpgradeSubscriptionModal
                                            isOpen={showUpgradeModal}
                                            onClose={() => setShowUpgradeModal(false)}
                                        />
                                        <button
                                            onClick={() => setShowUpgradeModal(true)}
                                            disabled={isCurrentPlan}
                                            className={`w-full py-3 rounded-xl font-semibold transition-all ${isCurrentPlan
                                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                                }`}
                                        >
                                            {isCurrentPlan ? 'Current Plan' : 'Upgrade to Premium'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        disabled={true}
                                        className="w-full py-3 rounded-xl font-semibold transition-all bg-gray-100 text-gray-400 cursor-not-allowed"
                                    >
                                        {isCurrentPlan ? 'Current Plan' : 'Not Available'}
                                    </button>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* FAQ */}
                <div className="max-w-3xl mx-auto mt-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Frequently Asked Questions</h2>
                    <div className="space-y-4">
                        <details className="bg-white rounded-lg p-4 border border-gray-200">
                            <summary className="font-semibold text-gray-900 cursor-pointer">
                                Can I cancel anytime?
                            </summary>
                            <p className="text-gray-600 mt-2">
                                Yes! You can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
                            </p>
                        </details>

                        <details className="bg-white rounded-lg p-4 border border-gray-200">
                            <summary className="font-semibold text-gray-900 cursor-pointer">
                                What payment methods do you accept?
                            </summary>
                            <p className="text-gray-600 mt-2">
                                We accept all major credit/debit cards, UPI, and net banking through secure payment gateway.
                            </p>
                        </details>

                        <details className="bg-white rounded-lg p-4 border border-gray-200">
                            <summary className="font-semibold text-gray-900 cursor-pointer">
                                Do you offer refunds?
                            </summary>
                            <p className="text-gray-600 mt-2">
                                We offer a 7-day money-back guarantee. If you're not satisfied, contact us within 7 days for a full refund.
                            </p>
                        </details>
                    </div>
                </div>
            </div>
        </div>
    );
}

