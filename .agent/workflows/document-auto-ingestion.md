---
description: How to auto-ingest documents from Email/WhatsApp into CRM
---

# Document Auto-Ingestion Workflow

## Overview

This workflow captures documents sent via **Email**, **WhatsApp**, or **Direct Website Upload** and attaches them to the correct applicant in the CRM.

## 3 Document Upload Channels

| Channel | How it Works | Best For |
|---------|-------------|----------|
| **Email** | Send to `documents@yourcompany.com` | Agents forwarding docs |
| **WhatsApp** | Send to business number | Applicants on mobile |
| **Website** | Public form with Applicant ID | Self-service uploads |

## Flow Diagram

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   EMAIL     │  │  WHATSAPP   │  │   WEBSITE   │
│  Send doc   │  │  Send doc   │  │ Upload form │
│  to inbox   │  │ to business │  │ + Applicant │
│             │  │   number    │  │     ID      │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       ▼                ▼                ▼
┌────────────────────────────────────────────────┐
│              Django Backend                     │
│  /api/webhooks/email-document/                 │
│  /api/webhooks/whatsapp-document/              │
│  /api/public/upload-document/                  │
└────────────────────────┬───────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────┐
│         Find Matching Applicant                 │
│  - By application_number / applicant_id        │
│  - Or by sender phone/email                    │
└────────────────────────┬───────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌─────────────────┐             ┌─────────────────┐
│  Match Found    │             │  No Match       │
│  Attach doc to  │             │  Queue for      │
│  applicant      │             │  manual review  │
└─────────────────┘             └─────────────────┘
```
                     │
                     ▼
┌─────────────────────────────────────────┐
│       Extract Application Number         │
│  - From email subject/body              │
│  - From WhatsApp message caption        │
│  - Patterns: APP-2024-001, #12345       │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│         Find Matching Applicant          │
│  - By application_number field          │
│  - Or by sender phone/email             │
└────────────────────┬────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Match Found    │     │  No Match       │
│  Attach doc to  │     │  Queue for      │
│  applicant      │     │  manual review  │
└─────────────────┘     └─────────────────┘
```

## Step-by-Step Process

### 1. Applicant Sends Document

**Via Email:**
- Applicant sends email to `documents@yourcompany.com`
- Subject includes application number: "Documents for APP-2024-001"
- Attaches PDF/images

**Via WhatsApp:**
- Applicant sends document to your WhatsApp Business number
- Includes caption with application number: "My passport for #12345"

### 2. External Service Receives & Forwards

**Email (Mailgun/SendGrid):**
- Email arrives at your domain
- Service parses email and calls your webhook
- Sends: sender, subject, body, attachments

**WhatsApp (Twilio/Meta):**
- Message arrives at your business number
- API sends webhook with media URL and caption

### 3. Backend Processes Webhook

```
POST /api/webhooks/email-document/
POST /api/webhooks/whatsapp-document/
```

Backend does:
1. Parse incoming data
2. Download attachments
3. Extract application number using regex patterns
4. Search for matching applicant
5. Create document record linked to applicant

### 4. Document Attached to Applicant

If match found:
- Document saved to ApplicantDocument model
- Linked to correct applicant
- Marked with source (email/whatsapp)
- Notification sent to assigned agent (optional)

If no match:
- Document saved to pending queue
- Admin reviews and manually assigns

## Application Number Formats

The system will recognize these patterns:
- `APP-2024-001` (standard format)
- `#12345` (hash + numbers)
- `Application: 67890` (labeled)
- `Ref: ABC123` (reference code)

## Setup Requirements

### Email Integration
1. Domain DNS records (MX, SPF, DKIM)
2. Mailgun/SendGrid account
3. Inbound parse webhook configured
4. Webhook URL: `https://yourdomain.com/api/webhooks/email-document/`

### WhatsApp Integration
1. Meta Business account (verified)
2. WhatsApp Business API access
3. Twilio or direct Meta integration
4. Webhook URL: `https://yourdomain.com/api/webhooks/whatsapp-document/`

## Models Required

```python
# Already exists or needs creation
class ApplicantDocument(models.Model):
    applicant = ForeignKey(Applicant)
    file = FileField(upload_to='applicant_documents/')
    document_type = CharField()  # passport, transcript, etc.
    source = CharField()  # email, whatsapp, manual
    sender_info = TextField()  # email address or phone
    received_at = DateTimeField(auto_now_add=True)
    is_verified = BooleanField(default=False)

class PendingDocument(models.Model):
    file = FileField()
    source = CharField()
    sender_info = TextField()
    raw_content = TextField()  # For manual app number extraction
    received_at = DateTimeField(auto_now_add=True)
```

## Security Considerations

1. **Webhook Authentication**: Verify webhook signatures from Mailgun/Twilio
2. **File Validation**: Check file types, scan for malware
3. **Rate Limiting**: Prevent abuse of webhook endpoints
4. **Sender Verification**: Optionally only accept from known contacts
