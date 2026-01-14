import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, email, subject, message, phone } = body;

        // Validate required fields
        if (!name || !email) {
            return NextResponse.json(
                { error: 'Name and email are required' },
                { status: 400 }
            );
        }

        // Create transporter using SMTP
        const transporter = nodemailer.createTransporter({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });

        // Email content
        const emailSubject = subject || 'New Contact Form Submission';
        const emailBody = `
Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}\n` : ''}
Subject: ${emailSubject}

Message:
${message || 'No message provided'}
        `;

        // Send email
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: 'info@cybriksolutions.com', // Send to company email
            replyTo: email, // Set user's email as reply-to
            subject: `[IELTS Portal] ${emailSubject}`,
            text: emailBody,
        });

        return NextResponse.json(
            { message: 'Email sent successfully' },
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Error sending email:', error);
        return NextResponse.json(
            { error: 'Failed to send email', details: error.message },
            { status: 500 }
        );
    }
}
