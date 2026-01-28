# MULTI-TENANT COMPLETE SEPARATION IMPLEMENTATION PLAN

## 🎯 OBJECTIVE: Zero Data Mixing Between Tenants with Custom Domains

**Date:** January 28, 2026  
**Status:** Phase 1 Complete | Phase 2-5 In Planning

---

## 📊 CURRENT ARCHITECTURE STATUS

### ✅ Implemented (Phase 1)
- [x] Tenant middleware with custom domain support
- [x] WebSocket tenant validation
- [x] Tenant-specific API keys (ElevenLabs, Smartflo, OpenAI)
- [x] Tenant-aware integration base classes
- [x] Basic ViewSet tenant filtering (some models)

### ❌ Critical Gaps
- [ ] **Inconsistent tenant filtering** - Not all ViewSets enforce isolation
- [ ] **File storage shared** - Media files not tenant-separated
- [ ] **Cache pollution** - Redis cache keys not tenant-scoped
- [ ] **Session cookies shared** - Cross-subdomain cookie leakage
- [ ] **Database-level isolation missing** - No PostgreSQL schema separation

---

## 🏗️ HOW CUSTOM DOMAINS WORK

### Domain Resolution Flow

```
┌──────────────────────────────────────────────────┐
│  CLIENT DNS CONFIGURATION (You Setup)           │
├──────────────────────────────────────────────────┤
│  client-crm.com     → CNAME → app.yourdomain.com │
│  partner-portal.com → A     → 203.0.113.10      │
└──────────────────────────────────────────────────┘
                    ↓ HTTP Request
┌──────────────────────────────────────────────────┐
│  NGINX / LOAD BALANCER                           │
├──────────────────────────────────────────────────┤
│  server {                                        │
│    server_name *.yourdomain.com;                 │
│    server_name _; # Catch all custom domains    │
│    proxy_pass http://django;                     │
│    proxy_set_header Host $host;                  │
│  }                                                │
└──────────────────────────────────────────────────┘
                    ↓ Forward with Host header
┌──────────────────────────────────────────────────┐
│  DJANGO - TenantMiddleware                       │
├──────────────────────────────────────────────────┤
│  1. Extract: host = request.get_host()           │
│     → "client-crm.com"                           │
│                                                   │
│  2. Query Database:                              │
│     TenantSettings.objects.filter(               │
│       custom_domain="client-crm.com"             │
│     )                                             │
│                                                   │
│  3. Result: Tenant(slug='client-abc')            │
│                                                   │
│  4. Set: request.tenant = tenant                 │
│                                                   │
│  5. All queries filtered:                        │
│     Lead.objects.filter(tenant=request.tenant)   │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│  TENANT-SPECIFIC RESPONSE                        │
├──────────────────────────────────────────────────┤
│  - Data: Only client-abc's data                  │
│  - Branding: client-abc's logo/colors            │
│  - API Keys: client-abc's credentials            │
│  - Files: /media/tenants/client-abc/             │
└──────────────────────────────────────────────────┘
```

---

## 🔐 COMPLETE DATA ISOLATION PLAN

### Phase 2: Database-Level Isolation (HIGH PRIORITY)

#### Task 2.1: Enforce Tenant Filtering on ALL ViewSets

**Current Problem:**
```python
# Some ViewSets don't use TenantQuerySetMixin
# Example: NotificationViewSet, TaskViewSet, etc.
class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()  # ❌ NO TENANT FILTER!
```

**Solution:**
```python
# Update ALL ViewSets to use TenantQuerySetMixin
from crm_app.tenant_mixins import TenantQuerySetMixin

class NotificationViewSet(TenantQuerySetMixin, viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    # ✅ Automatically filters by request.tenant
```

**Files to Audit & Update:**
- `crm_app/views.py` - All ViewSets
- `ielts_service/views.py` - IELTSTestViewSet, etc.
- `billing/views.py` - Subscription endpoints
- Any custom API views

**Testing Strategy:**
```python
# Test: User from Tenant A cannot access Tenant B's data
def test_cross_tenant_access_denied():
    tenant_a = Tenant.objects.create(slug='tenant-a')
    tenant_b = Tenant.objects.create(slug='tenant-b')
    
    user_a = create_user(tenant=tenant_a)
    lead_b = Lead.objects.create(tenant=tenant_b, name='Secret Lead')
    
    client = APIClient()
    client.force_authenticate(user=user_a)
    
    response = client.get(f'/api/leads/{lead_b.id}/')
    assert response.status_code == 404  # ✅ Access denied
```

---

#### Task 2.2: File Storage Tenant Isolation

**Current Problem:**
```python
# All files stored in shared directory
/media/documents/file.pdf
/media/applicants/photo.jpg
```

**Solution:**
```python
# 1. Create tenant-aware upload path function
def tenant_upload_path(instance, filename):
    """Generate tenant-specific upload path"""
    tenant_slug = instance.tenant.slug if instance.tenant else 'default'
    model_name = instance._meta.model_name
    
    # Sanitize filename
    safe_filename = get_valid_filename(filename)
    
    # Generate unique filename to prevent overwrites
    unique_filename = f"{uuid.uuid4().hex[:8]}_{safe_filename}"
    
    return f'tenants/{tenant_slug}/{model_name}/{unique_filename}'

# 2. Update ALL models with file fields
class Document(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    file = models.FileField(upload_to=tenant_upload_path)  # ✅ Tenant-specific path

class Applicant(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    photo = models.ImageField(upload_to=tenant_upload_path)  # ✅ Tenant-specific path
```

**File Download Security:**
```python
# 3. Add permission check for file downloads
from django.http import FileResponse, Http404

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_document(request, document_id):
    try:
        # Get document with tenant filtering
        document = Document.objects.get(
            id=document_id,
            tenant=request.tenant  # ✅ Tenant check
        )
    except Document.DoesNotExist:
        raise Http404("Document not found")
    
    # Check user has permission
    if not request.user.has_perm('crm_app.view_document'):
        return Response({'error': 'Permission denied'}, status=403)
    
    # Serve file
    return FileResponse(document.file.open('rb'), as_attachment=True)
```

**Nginx Configuration for Secure File Serving:**
```nginx
# Add X-Accel-Redirect for efficient file serving
location /protected/media/ {
    internal;  # Only accessible via X-Accel-Redirect
    alias /var/www/media/;
}

# Django checks permissions, then redirects to protected location
```

---

#### Task 2.3: Cache Key Tenant Isolation

**Current Problem:**
```python
# Cache keys don't include tenant identifier
cache_key = f"dashboard:overview:{user_id}"
# Tenant A and Tenant B could share cache! ❌
```

**Solution:**
```python
# 1. Create tenant-aware cache key helper
def get_tenant_cache_key(request, key_base, *args):
    """Generate tenant-scoped cache key"""
    tenant_id = request.tenant.id if request.tenant else 'global'
    parts = [key_base, f"tenant_{tenant_id}"] + [str(arg) for arg in args]
    return ":".join(parts)

# 2. Update ALL cache operations
from django.core.cache import cache

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_overview(request):
    tenant = request.tenant
    user_id = request.user.id
    
    # ✅ Tenant-specific cache key
    cache_key = get_tenant_cache_key(
        request, 
        'dashboard:overview', 
        user_id,
        request.GET.get('filter', 'all')
    )
    # Result: "dashboard:overview:tenant_abc123:42:all"
    
    data = cache.get(cache_key)
    if not data:
        # Calculate dashboard data
        data = calculate_dashboard_data(tenant, request.user)
        cache.set(cache_key, data, timeout=300)  # 5 min
    
    return Response(data)
```

**Cache Invalidation:**
```python
# 3. Invalidate tenant-specific cache on data changes
def invalidate_tenant_cache(tenant, pattern):
    """Invalidate all cache keys matching pattern for a tenant"""
    cache_pattern = f"*:tenant_{tenant.id}:{pattern}:*"
    # Use Redis SCAN to find and delete matching keys
    # Or use django-redis cache.delete_pattern()
```

---

### Phase 3: Session & Cookie Isolation

#### Task 3.1: Tenant-Specific Session Cookies

**Problem:**
```python
# Cookies shared across subdomains
# User logs into tenant-a.yourdomain.com
# Cookie: sessionid=xyz; Domain=.yourdomain.com
# Now accessible to tenant-b.yourdomain.com ❌
```

**Solution:**
```python
# settings.py
SESSION_COOKIE_NAME = 'sessionid'
SESSION_COOKIE_DOMAIN = None  # ✅ No domain sharing
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'Lax'

# For custom domains, Django will automatically set:
# Cookie: sessionid=xyz; Domain=client-crm.com
# This cookie won't be sent to other-client.com ✅
```

#### Task 3.2: JWT Token Tenant Validation

**Enhancement:**
```python
# Add tenant_id to JWT payload
from rest_framework_simplejwt.tokens import AccessToken

class CustomAccessToken(AccessToken):
    @classmethod
    def for_user(cls, user):
        token = super().for_user(user)
        
        # Add tenant_id to token
        if hasattr(user, 'profile') and user.profile.tenant:
            token['tenant_id'] = str(user.profile.tenant.id)
            token['tenant_slug'] = user.profile.tenant.slug
        
        return token

# Validate tenant on each request
def validate_token_tenant(request, token):
    """Ensure token tenant matches request tenant"""
    token_tenant_id = token.get('tenant_id')
    request_tenant_id = str(request.tenant.id) if request.tenant else None
    
    if token_tenant_id != request_tenant_id:
        raise PermissionDenied("Token tenant mismatch")
```

---

## 📝 DNS SETUP INSTRUCTIONS (For You)

### For Each Tenant with Custom Domain:

#### Step 1: Get Tenant's Custom Domain
```sql
-- In Django admin or database
SELECT slug, company_name, custom_domain 
FROM crm_app_tenantsettings 
WHERE custom_domain IS NOT NULL;
```

#### Step 2: Configure DNS (At Domain Registrar)

**Option A: CNAME Record (Recommended)**
```
Type: CNAME
Name: @ (or www)
Value: app.yourdomain.com
TTL: 3600
```

**Option B: A Record**
```
Type: A
Name: @ (or www)
Value: 203.0.113.10 (Your server IP)
TTL: 3600
```

#### Step 3: SSL Certificate Setup

**Using Let's Encrypt (Certbot):**
```bash
# Add domain to SSL certificate
sudo certbot --nginx -d client-crm.com -d www.client-crm.com

# Auto-renew will handle all domains
sudo certbot renew
```

**Or Use Cloudflare (Easier):**
1. Point domain nameservers to Cloudflare
2. Add A/CNAME record in Cloudflare
3. Enable SSL (Full or Full Strict)
4. Cloudflare handles certificates automatically

#### Step 4: Nginx Configuration

```nginx
# /etc/nginx/sites-available/django-app

# Wildcard for all custom domains
server {
    listen 80;
    listen 443 ssl http2;
    server_name _;  # Catch all domains
    
    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Forward Host header to Django
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files
    location /static/ {
        alias /var/www/static/;
    }
    
    # Protected media (requires Django permission check)
    location /media/ {
        alias /var/www/media/;
        # Consider using X-Accel-Redirect for better security
    }
}

# Reload nginx
sudo nginx -t && sudo systemctl reload nginx
```

#### Step 5: Test Tenant Resolution

```bash
# Test custom domain
curl -H "Host: client-crm.com" https://yourdomain.com/api/tenant-branding/

# Expected response:
{
  "tenant_id": "abc-123",
  "slug": "client-crm",
  "company_name": "Client CRM Inc",
  "custom_domain": "client-crm.com",
  ...
}
```

---

## 🔒 SECURITY CHECKLIST

### Data Isolation
- [ ] All ViewSets use `TenantQuerySetMixin`
- [ ] All database queries filtered by `tenant=request.tenant`
- [ ] File uploads stored in tenant-specific directories
- [ ] Cache keys include tenant identifier
- [ ] Session cookies not shared across tenants

### API Security  
- [ ] WebSocket connections validate tenant
- [ ] API keys stored per-tenant (not global)
- [ ] JWT tokens include tenant_id
- [ ] Cross-tenant API calls blocked

### Infrastructure
- [ ] Custom domains configured in TenantSettings
- [ ] DNS records point to your server
- [ ] SSL certificates cover all custom domains
- [ ] Nginx forwards Host header correctly
- [ ] TenantMiddleware logs tenant resolution

---

## 🧪 TESTING STRATEGY

### 1. Unit Tests
```python
# tests/test_tenant_isolation.py
class TenantIsolationTests(TestCase):
    def test_lead_creation_assigns_tenant(self):
        tenant_a = Tenant.objects.create(slug='tenant-a')
        request = self.factory.get('/')
        request.tenant = tenant_a
        
        lead = Lead.objects.create(name='Test', phone='1234567890')
        # Should auto-assign tenant from middleware
        self.assertEqual(lead.tenant, tenant_a)
    
    def test_cross_tenant_access_denied(self):
        tenant_a = Tenant.objects.create(slug='tenant-a')
        tenant_b = Tenant.objects.create(slug='tenant-b')
        
        user_a = create_user(tenant=tenant_a)
        lead_b = Lead.objects.create(tenant=tenant_b, name='Secret')
        
        client = APIClient()
        client.force_authenticate(user=user_a)
        
        response = client.get(f'/api/leads/{lead_b.id}/')
        self.assertEqual(response.status_code, 404)
```

### 2. Integration Tests
```python
# Test custom domain resolution
def test_custom_domain_resolves_tenant(self):
    tenant = Tenant.objects.create(slug='client-abc')
    TenantSettings.objects.create(
        tenant=tenant,
        custom_domain='client-crm.com'
    )
    
    request = self.factory.get('/', HTTP_HOST='client-crm.com')
    middleware = TenantMiddleware(lambda r: HttpResponse())
    middleware.process_request(request)
    
    self.assertEqual(request.tenant.slug, 'client-abc')
```

### 3. Manual Testing Checklist
- [ ] Login to Tenant A, verify only Tenant A's data visible
- [ ] Login to Tenant B, verify only Tenant B's data visible
- [ ] Try accessing Tenant A's lead ID while logged into Tenant B
- [ ] Upload file to Tenant A, verify path is `/media/tenants/tenant-a/`
- [ ] Clear cache, verify Tenant B doesn't see Tenant A's cached data
- [ ] Test custom domain: `https://client-crm.com` loads correct tenant

---

## 📈 ROLLOUT PLAN

### Phase 1: ✅ COMPLETE (1-2 days)
- [x] API key isolation
- [x] WebSocket tenant validation
- [x] Tenant middleware improvements

### Phase 2: Data Isolation (2-3 days)
- [ ] Audit all ViewSets - add TenantQuerySetMixin
- [ ] File storage tenant isolation
- [ ] Cache key tenant scoping
- [ ] Session cookie isolation

### Phase 3: Testing & Validation (1-2 days)
- [ ] Write comprehensive test suite
- [ ] Manual testing with multiple tenants
- [ ] Load testing with concurrent tenants

### Phase 4: Production Deployment (1 day)
- [ ] Database migration (add tenant FK if missing)
- [ ] Update file paths (migrate existing files)
- [ ] Clear all caches
- [ ] Deploy to staging, then production

### Phase 5: Monitoring & Maintenance (Ongoing)
- [ ] Set up tenant-specific logging
- [ ] Monitor cross-tenant access attempts
- [ ] Regular security audits
- [ ] Performance monitoring per tenant

---

## 🚨 CRITICAL NOTES

1. **NO DATA MIXING**: With proper implementation, tenants are completely isolated
   - Each tenant has separate data (filtered by tenant FK)
   - Each tenant has separate files (`/media/tenants/{slug}/`)
   - Each tenant has separate cache keys
   - Each tenant has separate API credentials

2. **CUSTOM DOMAINS**: DNS setup is YOUR responsibility
   - You configure DNS records (CNAME or A)
   - Server must have SSL certificates for all domains
   - Nginx must forward Host header correctly
   - Django TenantMiddleware resolves tenant from domain

3. **SECURITY FIRST**: Every API endpoint must check tenant
   - Use `TenantQuerySetMixin` on ALL ViewSets
   - Never trust user-supplied tenant ID
   - Always filter by `request.tenant`
   - Log all tenant resolution for audit

4. **BACKWARD COMPATIBILITY**: Plan for migration
   - Existing data without tenant FK
   - Global API keys as fallback
   - Graceful degradation if tenant not found

---

## 📞 NEXT STEPS

**Immediate Actions:**
1. Review this plan and confirm approach
2. Decide on rollout timeline
3. Start with Phase 2: Data Isolation audit
4. Set up staging environment for testing

**Questions to Answer:**
- Which tenants need custom domains first?
- Do you have SSL certificate management setup?
- Should we use PostgreSQL schema separation for extra isolation?
- What's your backup/disaster recovery plan per tenant?

---

**Document Version:** 1.0  
**Last Updated:** January 28, 2026  
**Status:** Phase 1 Complete | Ready for Phase 2
