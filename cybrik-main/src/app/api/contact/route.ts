import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Create transporter using SMTP settings (Google Workspace / Gmail)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER || 'noreply@cybriksolutions.com',
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a2f4d; border-bottom: 2px solid #6FB63A; padding-bottom: 10px;">
          New Contact Form Submission
        </h2>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>From:</strong> ${name}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Subject:</strong> ${subject || 'No subject provided'}</p>
        </div>
        
        <div style="padding: 20px; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h3 style="color: #1a2f4d; margin-top: 0;">Message:</h3>
          <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;" />
        
        <p style="color: #666; font-size: 12px; text-align: center;">
          This email was sent from the Cybrik Solutions contact form.<br/>
          <a href="https://cybriksolutions.com">cybriksolutions.com</a>
        </p>
      </div>
    `;

    // Send email
    await transporter.sendMail({
      from: '"Cybrik Contact Form" <noreply@cybriksolutions.com>',
      to: 'info@cybriksolutions.com',
      replyTo: email,
      subject: `[Contact Form] ${subject || 'New Message'} - from ${name}`,
      html: emailHtml,
    });

    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: 'Failed to send email. Please try again.' },
      { status: 500 }
    );
  }
}
