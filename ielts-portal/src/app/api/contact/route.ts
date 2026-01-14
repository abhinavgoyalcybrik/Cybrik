import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, email, subject, message, phone } = body;

        // Validate required fields
        if (!name || !email || !phone) {
            return NextResponse.json(
                { error: 'Name, email, and phone are required' },
                { status: 400 }
            );
        }

        // Prepare data for Django backend (web-leads endpoint)
        const leadData = {
            name,
            email,
            phone,
            message: `${subject ? `Subject: ${subject}\n\n` : ''}${message || ''}`,
            source: 'ielts_portal_contact',
        };

        // Send to existing Django web-leads endpoint
        const response = await fetch(`${API_BASE}/api/web-leads/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(leadData),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || 'Failed to send message');
        }

        return NextResponse.json(
            { message: 'Message sent successfully' },
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Error sending contact form:', error);
        return NextResponse.json(
            { error: 'Failed to send message', details: error.message },
            { status: 500 }
        );
    }
}
