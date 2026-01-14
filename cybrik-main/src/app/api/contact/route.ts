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
      source: 'cybrik_main_contact',
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
  <p style="color: #666; font-size: 12px; text-align: center;" >
    This email was sent from the Cybrik Solutions contact form.< br />
      <a href="https://cybriksolutions.com" > cybriksolutions.com </a>
        </p>
        </div>
          `;

    // Send email
    await transporter.sendMail({
      from: '"Cybrik Contact Form" <noreply@cybriksolutions.com>',
      to: 'info@cybriksolutions.com',
      replyTo: email,
      subject: `[Contact Form] ${ subject || 'New Message' } - from ${ name } `,
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
