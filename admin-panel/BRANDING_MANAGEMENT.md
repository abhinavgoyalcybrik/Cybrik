# Admin Panel - Tenant White-Labeling Guide

Quick reference for managing tenant branding in the admin panel.

## Accessing Tenant Management

1. Log in to the admin panel
2. Navigate to **Tenants** in the sidebar
3. View list of all tenants with their status and products

## Creating a New Tenant

Click **"Add Tenant"** button to open the provisioning form:

### Basic Information
- **Tenant Name**: Organization name (e.g., "Acme Corp")
- **Slug**: URL-safe identifier (auto-generated from name)
- **Company Name**: Display name (e.g., "Acme Corporation Ltd.")
- **Admin Email**: Email for tenant administrator

### Initial Subscription
- Select a product and plan from the dropdown
- This creates the initial subscription for the tenant

### Branding (Optional at Creation)
- **Brand Color**: Primary color (hex code)

### API Configuration (Optional)
- **OpenAI API Key**: For AI features
- **ElevenLabs API Key**: For voice AI
- **Smartflo Numbers**: Phone numbers (comma-separated)

## Managing Existing Tenant

Click **"Manage"** on any tenant card to open the full editor.

### Tenant Information Tab
- **Name**: Tenant organization name
- **Active Status**: Toggle to enable/disable tenant

### API Keys Section
All API keys are encrypted and only show placeholder text. Enter new keys to update:

- **OpenAI API Key**: `sk-...`
- **ElevenLabs API Key**: For conversational AI agents
- **Smartflo/DID Numbers**: Phone numbers for telephony

### White Labeling & Branding Section

#### Company Name
Display name shown to end users throughout the platform.

#### Logo Upload
- **Current Logo**: Displays if already uploaded
- **File Types**: PNG, JPEG, SVG
- **Recommendations**:
  - Use transparent background (PNG/SVG)
  - Ideal size: 200x60px (or similar aspect ratio)
  - Max file size: 5MB
  - SVG recommended for scalability

#### Favicon Upload
- **Current Favicon**: Displays if already uploaded  
- **File Types**: ICO, PNG
- **Requirements**:
  - Size: 32x32 or 64x64 pixels
  - ICO format preferred for best browser support

#### Brand Colors

**Primary Color**
- Main brand color for buttons, links, headers
- Used throughout the UI for primary actions
- Example: `#6366f1` (Indigo)

**Secondary Color**
- Supporting color for backgrounds, borders
- Used for secondary UI elements
- Example: `#4f46e5` (Dark Indigo)

**Accent Color**
- Highlight color for CTAs, badges, alerts
- Used for emphasis and special elements
- Example: `#8b5cf6` (Purple)

Each color field has:
- Color picker input (click to open visual picker)
- Text input (enter hex code manually)

#### Font Family
Select from popular web fonts:
- **Inter** (Default) - Modern, clean sans-serif
- **Roboto** - Google Material Design
- **Open Sans** - Friendly, readable
- **Poppins** - Geometric, bold
- **Montserrat** - Urban, sophisticated
- **Lato** - Warm, stable
- **Georgia** - Classic serif
- **Times New Roman** - Traditional serif
- **Courier New** - Monospace

#### Custom Domain
Enter the custom domain for this tenant (e.g., `portal.acme.com`)

**Important**: DNS must be configured before this works. See DNS Configuration section below.

### Branding Preview
Live preview showing:
- Three buttons with your selected colors
- Sample text in your chosen font family
- Real-time updates as you change values

## Saving Changes

Click **"Save Changes"** to apply all updates. The system will:
1. Update tenant basic information
2. Upload logo/favicon files to tenant-specific directory
3. Update branding settings
4. Apply changes immediately (no restart needed)

## Visual Indicators

### Tenant Cards
Each tenant card shows:
- **Name & Company Name**: Both displayed if different
- **Status Badge**: Green (Active) or Red (Inactive)
- **Slug**: URL identifier
- **Products**: List of subscribed products
- **Manage Button**: Opens full editor
- **Delete Button**: Red trash icon (use with caution)

## DNS Configuration (For Custom Domains)

When a tenant wants to use a custom domain like `portal.acme.com`:

### Step 1: CNAME Record (Recommended)
Ask the client to add this DNS record:
```
Type:  CNAME
Name:  portal
Value: your-main-server.com
TTL:   3600
```

### Step 2: SSL Certificate
Ensure SSL certificate covers the custom domain:
```bash
sudo certbot --nginx -d portal.acme.com
```

### Step 3: Test Resolution
```bash
# Check DNS propagation
nslookup portal.acme.com

# Test in browser
https://portal.acme.com
```

## Tips & Best Practices

### Logo Guidelines
✅ **Do:**
- Use transparent background (PNG/SVG)
- Provide high-resolution image
- Use horizontal layout (wider than tall)
- Test on both light and dark backgrounds

❌ **Don't:**
- Use low-resolution images
- Include too much text in logo
- Use white logo on white background

### Color Selection
✅ **Do:**
- Ensure sufficient contrast (WCAG AA standards)
- Test colors for accessibility
- Use consistent color scheme
- Preview on multiple devices

❌ **Don't:**
- Use very similar colors for primary/secondary
- Choose colors that are hard to read
- Ignore brand guidelines

### Font Selection
✅ **Do:**
- Choose readable fonts
- Test font size and weight
- Consider brand personality
- Ensure web font loads properly

❌ **Don't:**
- Mix too many font families
- Use decorative fonts for body text
- Choose fonts with poor readability

## Troubleshooting

### Logo Not Displaying
1. Check file was uploaded successfully
2. Verify file size < 5MB
3. Check browser console for errors
4. Clear cache and reload

### Colors Not Applying
1. Ensure hex codes are valid (#RRGGBB)
2. Check branding preview before saving
3. Verify changes were saved successfully
4. Refresh frontend application

### Custom Domain Not Working
1. Verify DNS record is correct
2. Check DNS propagation (can take 24-48 hours)
3. Ensure SSL certificate is configured
4. Check server logs for domain resolution

### Upload Fails
1. Check file size and type
2. Verify network connection
3. Check server disk space
4. Review server error logs

## API Endpoints Used

The admin panel interacts with these endpoints:

- `GET /api/admin/tenants/` - List all tenants
- `POST /api/admin/tenants/` - Create new tenant
- `GET /api/admin/tenants/{id}/` - Get tenant details
- `PATCH /api/admin/tenants/{id}/` - Update tenant info
- `PATCH /api/admin/tenants/{id}/update-settings/` - Update branding (multipart/form-data)
- `DELETE /api/admin/tenants/{id}/` - Delete tenant

## Security Notes

- All API keys are stored encrypted in the database
- Logo files are stored in tenant-isolated directories
- File uploads are validated for type and size
- Custom domains require proper DNS configuration
- Only authenticated admin users can access these endpoints

## Support

For technical issues:
1. Check browser console for errors
2. Review Django server logs
3. Verify database migrations are applied
4. Test API endpoints directly with curl/Postman
5. Check file permissions on media directory
