# White-Label Branding System

Complete guide for configuring custom branding per tenant in your multi-tenant CRM system.

## Overview

Your platform now supports **complete white-labeling** for each tenant, including:

- ✅ **Custom Logos** - Upload PNG/SVG with transparent backgrounds
- ✅ **Custom Favicons** - ICO or PNG files (32x32 or 64x64)
- ✅ **Brand Colors** - Primary, Secondary, and Accent colors
- ✅ **Custom Fonts** - Choose from popular web fonts
- ✅ **Custom Domains** - Each tenant can use their own domain
- ✅ **Isolated File Storage** - Logo files stored in tenant-specific directories

## Architecture

### Backend (Django)

**Model: `TenantSettings`**
```python
# File uploads (ImageField)
logo = models.ImageField(upload_to=tenant_logo_upload_path)
favicon = models.ImageField(upload_to=tenant_favicon_upload_path)

# Fallback URL fields
logo_url = models.URLField(blank=True, null=True)
favicon_url = models.URLField(blank=True, null=True)

# Brand colors
primary_color = models.CharField(max_length=7, default='#6366f1')
secondary_color = models.CharField(max_length=7, default='#4f46e5')
accent_color = models.CharField(max_length=7, default='#8b5cf6')

# Typography
font_family = models.CharField(max_length=100, default='Inter, system-ui, sans-serif')
```

**API Endpoints:**
- `GET /api/tenant/branding/` - Public endpoint (no auth) for fetching tenant branding
- `PATCH /api/tenant/settings/` - Update branding (requires tenant admin)
- `PATCH /api/admin/tenants/{id}/update-settings/` - Admin panel endpoint (requires staff)

**File Storage:**
```
media/
└── tenants/
    ├── acme-corp/
    │   ├── logos/
    │   │   └── logo_acme-corp.png
    │   └── favicons/
    │       └── favicon_acme-corp.ico
    └── techstart/
        ├── logos/
        │   └── logo_techstart.svg
        └── favicons/
            └── favicon_techstart.png
```

### Frontend (Next.js)

**TenantContext** (`frontend/context/TenantContext.tsx`)
```tsx
export interface TenantBranding {
    tenant_id: number | null;
    name: string;
    logo: string | null;
    favicon: string | null;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    font_family: string;
}
```

**CSS Variables Applied:**
```css
:root {
    --tenant-primary: #6366f1;
    --tenant-secondary: #4f46e5;
    --tenant-accent: #8b5cf6;
    --tenant-font-family: 'Inter, system-ui, sans-serif';
    
    /* RGB versions for opacity */
    --tenant-primary-rgb: 99, 102, 241;
    --tenant-secondary-rgb: 79, 70, 229;
    --tenant-accent-rgb: 139, 92, 246;
}
```

**Usage in Components:**
```tsx
import { useTenant } from '@/context/TenantContext';

function MyComponent() {
    const { branding, loading } = useTenant();
    
    if (loading) return <Loader />;
    
    return (
        <div>
            <img src={branding.logo} alt={branding.name} />
            <h1 style={{ fontFamily: branding.font_family }}>
                {branding.name}
            </h1>
        </div>
    );
}
```

## Admin Panel Configuration

### 1. Access Tenant Management
Navigate to **Admin Panel → Tenants**

### 2. Edit Tenant Branding

Click **"Manage"** on any tenant to open the branding editor.

**White Labeling & Branding Section:**

#### Company Name
```
Display name: "Acme Corporation"
```

#### Logo & Favicon
- **Logo**: Upload PNG/SVG (transparent background recommended)
  - Ideal size: 200x60px or similar aspect ratio
  - Max file size: 5MB
  
- **Favicon**: Upload ICO/PNG 
  - Required size: 32x32 or 64x64 pixels
  - Format: ICO, PNG

#### Brand Colors
- **Primary Color**: Main brand color for buttons, links, headers
  - Example: `#6366f1` (Indigo)
  
- **Secondary Color**: Supporting color for backgrounds, borders
  - Example: `#4f46e5` (Dark Indigo)
  
- **Accent Color**: Highlight color for CTAs, badges, alerts
  - Example: `#8b5cf6` (Purple)

#### Font Family
Choose from:
- **Inter** (Default) - Modern, clean sans-serif
- **Roboto** - Google's Material Design font
- **Open Sans** - Friendly, open appearance
- **Poppins** - Geometric, bold
- **Montserrat** - Urban, cosmopolitan
- **Lato** - Warm, stable
- **Georgia** - Classic serif
- **Times New Roman** - Traditional serif
- **Courier New** - Monospace

#### Custom Domain
```
portal.acme.com
```
DNS configuration required (see below).

### 3. Save Changes
Click **"Save Changes"** to apply branding.

## Custom Domain Setup

### DNS Configuration

For tenant custom domain: `portal.acme.com`

**Option A: CNAME Record (Recommended)**
```
Type:  CNAME
Name:  portal
Value: your-server.com
TTL:   3600
```

**Option B: A Record**
```
Type:  A
Name:  portal
Value: 123.45.67.89 (your server IP)
TTL:   3600
```

### Server Configuration

**Nginx Configuration** (`/etc/nginx/sites-available/cybrik-crm`)
```nginx
server {
    listen 80;
    server_name *.yourdomain.com portal.acme.com crm.techstart.io;
    
    # SSL certificates (Let's Encrypt)
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /media/ {
        alias /path/to/media/;
    }
}
```

**SSL Certificate (Let's Encrypt)**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate for custom domain
sudo certbot --nginx -d portal.acme.com

# Auto-renewal (runs every 12 hours)
sudo systemctl enable certbot.timer
```

### Tenant Middleware Resolution Flow

```
1. Client Request → portal.acme.com
                      ↓
2. Nginx → Django with Host header "portal.acme.com"
                      ↓
3. TenantMiddleware checks:
   - TenantSettings.custom_domain = "portal.acme.com" ✓
                      ↓
4. request.tenant = Tenant(slug='acme-corp')
                      ↓
5. All queries filtered by tenant automatically
```

## File Upload Implementation

### Backend Upload Handling

**View: `views_tenant_admin.py`**
```python
@action(detail=True, methods=['patch'], parser_classes=[MultiPartParser, FormParser, JSONParser])
def update_settings(self, request, pk=None):
    """Update tenant branding (supports file uploads)"""
    tenant = self.get_object()
    settings_obj = tenant.settings
    
    serializer = TenantSettingsSerializer(
        settings_obj,
        data=request.data,
        partial=True,
        context={'request': request}
    )
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)
```

**Serializer: `serializers_tenant.py`**
```python
class TenantSettingsSerializer(serializers.ModelSerializer):
    logo = serializers.ImageField(required=False, allow_null=True)
    favicon = serializers.ImageField(required=False, allow_null=True)
    
    class Meta:
        model = TenantSettings
        fields = [
            'logo', 'favicon', 'logo_url', 'favicon_url',
            'primary_color', 'secondary_color', 'accent_color',
            'font_family', 'custom_domain', ...
        ]
```

### Frontend Upload Form

**Admin Panel: `admin-panel/app/(admin)/tenants/page.tsx`**
```tsx
const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('company_name', editFormData.company_name);
    formData.append('primary_color', editFormData.primary_color);
    formData.append('secondary_color', editFormData.secondary_color);
    formData.append('accent_color', editFormData.accent_color);
    formData.append('font_family', editFormData.font_family);
    
    // File uploads
    if (editFormData.logo) formData.append('logo', editFormData.logo);
    if (editFormData.favicon) formData.append('favicon', editFormData.favicon);
    
    await tenantApi.update(tenantId, formData);
};
```

## Using Branding in Your App

### React/Next.js Components

**Method 1: Context Hook**
```tsx
import { useTenant } from '@/context/TenantContext';

function Header() {
    const { branding } = useTenant();
    
    return (
        <header style={{ backgroundColor: branding.primary_color }}>
            <img src={branding.logo} alt={branding.name} />
        </header>
    );
}
```

**Method 2: CSS Variables**
```css
.primary-button {
    background-color: var(--tenant-primary);
    color: white;
}

.secondary-button {
    background-color: var(--tenant-secondary);
}

.accent-badge {
    background-color: var(--tenant-accent);
}

/* With opacity */
.primary-overlay {
    background-color: rgba(var(--tenant-primary-rgb), 0.1);
}
```

**Method 3: Tailwind (after extending config)**
```tsx
// Add to tailwind.config.js
module.exports = {
    theme: {
        extend: {
            colors: {
                'tenant-primary': 'var(--tenant-primary)',
                'tenant-secondary': 'var(--tenant-secondary)',
                'tenant-accent': 'var(--tenant-accent)',
            }
        }
    }
}

// Usage
<button className="bg-tenant-primary text-white">
    Click Me
</button>
```

## Testing White-Label Setup

### 1. Create Test Tenant
```bash
curl -X POST http://localhost:8000/api/admin/tenants/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "name=Test Corp" \
  -F "slug=testcorp" \
  -F "admin_email=admin@testcorp.com"
```

### 2. Upload Branding
```bash
curl -X PATCH http://localhost:8000/api/admin/tenants/{tenant_id}/update-settings/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "logo=@logo.png" \
  -F "favicon=@favicon.ico" \
  -F "primary_color=#00A86B" \
  -F "font_family=Poppins, sans-serif"
```

### 3. Test Frontend
```tsx
// Add ?tenant=testcorp to URL for testing
http://localhost:3000/?tenant=testcorp
```

### 4. Verify Branding Applied
- Check logo displays in header
- Check favicon in browser tab
- Inspect CSS variables in DevTools:
  ```js
  console.log(getComputedStyle(document.documentElement).getPropertyValue('--tenant-primary'));
  ```

## Production Checklist

### Security
- [ ] Validate file types (PNG, SVG, ICO only)
- [ ] Limit file sizes (5MB max)
- [ ] Sanitize uploaded SVG files (remove scripts)
- [ ] Enable CORS for custom domains
- [ ] Configure CSP headers

### Performance
- [ ] Serve logo/favicon via CDN (Cloudflare, AWS CloudFront)
- [ ] Enable browser caching for branding assets
- [ ] Compress uploaded images
- [ ] Use WebP format for better compression

### Monitoring
- [ ] Track branding API response times
- [ ] Log file upload errors
- [ ] Monitor media storage usage per tenant
- [ ] Set up alerts for failed tenant resolution

## Troubleshooting

### Logo Not Displaying
```python
# Check if logo file exists
tenant.settings.logo.path  # Absolute path
tenant.settings.logo.url   # URL path

# Verify MEDIA_URL and MEDIA_ROOT in settings.py
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
```

### Custom Domain Not Resolving
```python
# Debug middleware
import logging
logger = logging.getLogger(__name__)
logger.info(f"Host: {request.get_host()}")
logger.info(f"Resolved tenant: {request.tenant}")
```

### Colors Not Applying
```javascript
// Check CSS variables in browser console
console.log(getComputedStyle(document.documentElement).getPropertyValue('--tenant-primary'));

// Force refresh branding
const { refreshBranding } = useTenant();
await refreshBranding();
```

## API Reference

### GET `/api/tenant/branding/`
**Public endpoint (no auth required)**

Response:
```json
{
    "tenant_id": "uuid-here",
    "name": "Acme Corp",
    "logo": "https://yourdomain.com/media/tenants/acme-corp/logos/logo_acme-corp.png",
    "favicon": "https://yourdomain.com/media/tenants/acme-corp/favicons/favicon_acme-corp.ico",
    "primary_color": "#6366f1",
    "secondary_color": "#4f46e5",
    "accent_color": "#8b5cf6",
    "font_family": "Inter, system-ui, sans-serif"
}
```

### PATCH `/api/tenant/settings/`
**Requires tenant admin auth**

Request (multipart/form-data):
```
logo: File
favicon: File
primary_color: "#00A86B"
font_family: "Poppins, sans-serif"
```

### PATCH `/api/admin/tenants/{id}/update-settings/`
**Requires staff auth**

Same as above, but allows cross-tenant updates.

## Support

For issues or questions:
1. Check logs: `tail -f logs/django.log`
2. Review migration status: `python manage.py showmigrations crm_app`
3. Test branding endpoint: `curl http://localhost:8000/api/tenant/branding/?tenant=your-slug`
