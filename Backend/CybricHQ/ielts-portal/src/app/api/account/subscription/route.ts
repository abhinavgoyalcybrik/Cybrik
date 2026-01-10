import { NextResponse } from 'next/server';

export async function GET() {
    // TODO: Fetch from Django backend /api/ielts/account/subscription
    const mockSubscription = {
        plan: 'free',
        status: 'active',
        startDate: '2024-01-15',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        testsLimit: 5,
        testsUsed: 3,
        features: {
            unlimitedTests: false,
            detailedFeedback: false,
            oneOnOneSessions: false,
            prioritySupport: false,
        },
        upgradePath: 'basic', // Next available plan
    };

    return NextResponse.json(mockSubscription);
}

export async function POST(request: Request) {
    const { plan } = await request.json();

    // TODO: Process subscription via Stripe and update Django backend
    console.log('Subscribing to plan:', plan);

    return NextResponse.json({
        success: true,
        checkoutUrl: '/account/subscription/checkout?plan=' + plan
    });
}
