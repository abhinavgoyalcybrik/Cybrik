import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get authenticated user profile
export async function GET() {
    try {
        // Check if user is logged in via IELTS portal auth
        const cookieStore = await cookies();
        const userDataCookie = cookieStore.get('ielts_user');

        if (!userDataCookie) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userData = JSON.parse(userDataCookie.value);

        // Get subscription/usage data from localStorage (client-side) or DB
        // For now, return user data with default subscription info
        const profile = {
            id: userData.id || '1',
            name: userData.name || 'User',
            email: userData.email || userData.username + '@example.com',
            accessMode: 'standalone', // Default to standalone, can be 'crm_managed'
            subscriptionPlan: 'free',
            subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            testsThisMonth: 0, // TODO: Query from test results
            testsLimit: 5,
            joinedDate: '2024-01-15',
        };

        return NextResponse.json(profile);
    } catch (error) {
        console.error('Profile fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const cookieStore = await cookies();
        const userDataCookie = cookieStore.get('ielts_user');

        if (!userDataCookie) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // TODO: Update user profile in database
        console.log('Updating profile:', body);

        return NextResponse.json({ success: true, profile: body });
    } catch (error) {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
