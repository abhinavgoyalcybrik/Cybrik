# 📱 WhatsApp Access Token Renewal Guide

## Problem
Your WhatsApp Access Token has **EXPIRED** (expired on Jan 28, 2026).

**Error Message:**
```
Error validating access token: Session has expired on Wednesday, 28-Jan-26 00:00:00 PST
```

## Solution: Generate a New Access Token

### Option 1: Generate Long-Lived Token (Recommended - 60 days)

1. **Go to Meta Developer Portal**
   - Visit: https://developers.facebook.com/apps
   - Select your WhatsApp Business app

2. **Navigate to WhatsApp > API Setup**
   - Click on "WhatsApp" in the left sidebar
   - Go to "API Setup" tab

3. **Generate System User Token (Permanent)**
   - Go to "Business Settings" > "System Users"
   - Create a new System User or use existing
   - Click "Generate New Token"
   - Select your WhatsApp app
   - Select permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
   - Copy the generated token (starts with `EAA...`)

4. **Update Your Environment Variable**
   ```bash
   # Set in your environment or .env file
   WHATSAPP_ACCESS_TOKEN=<your_new_token>
   ```

### Option 2: Generate 24-Hour Token (Quick Test)

1. Go to: https://developers.facebook.com/apps
2. Select your app > WhatsApp > API Setup
3. Copy the "Temporary access token" (valid for 24 hours)
4. Update `WHATSAPP_ACCESS_TOKEN` with this token

**Note:** Temporary tokens expire in 24 hours. Use System User tokens for production.

---

## Current Configuration Status

✅ **Phone Number ID:** 927714997095934
❌ **Access Token:** EXPIRED (needs renewal)
⚠️  **Business Account ID:** Not set (optional)
✅ **Verify Token:** cybrik_wa_verify

---

## Steps After Renewal

1. **Update the token in your environment:**
   ```bash
   # Windows PowerShell
   $env:WHATSAPP_ACCESS_TOKEN = "your_new_token_here"
   
   # OR add to .env file if you have one
   echo "WHATSAPP_ACCESS_TOKEN=your_new_token_here" >> .env
   ```

2. **Restart your Django server:**
   ```bash
   # Stop current server (Ctrl+C)
   # Then restart
   python manage.py runserver
   ```

3. **Test the connection:**
   ```bash
   python test_whatsapp.py
   ```

---

## Webhook Configuration

Make sure your webhook is configured in Meta:

**Webhook URL:** `https://your-domain.com/api/whatsapp/webhook/`

**Verify Token:** `cybrik_wa_verify`

**Subscribe to events:**
- ✅ messages
- ✅ message_status

---

## Common Issues

### Issue: "Invalid Access Token"
- **Solution:** Token expired, generate new one

### Issue: "No messages received"
- Check webhook URL is publicly accessible (not localhost)
- Verify webhook is subscribed to correct events
- Check webhook verify token matches

### Issue: "Messages not sending"
- Verify phone number is added to WhatsApp Business API
- Check template messages are approved
- Verify user has opted in to receive messages

---

## Test After Setup

Run the diagnostic script:
```bash
python test_whatsapp.py
```

Expected output:
```
✅ API Connection Successful
✅ Phone: +XX XXXXX XXXXX
✅ Quality: HIGH
```

---

## Support Links

- [Meta WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started)
- [System User Tokens](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/system-user-tokens)
- [WhatsApp Cloud API Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

---

**Last Updated:** January 29, 2026
