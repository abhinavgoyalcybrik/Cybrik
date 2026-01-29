# Reports Center - Company & Country Filtering

## Overview

The Reports Center now supports comprehensive filtering by **Company (Tenant)** and **Country**, allowing you to generate detailed analytics reports for specific organizations and geographic regions.

## Features

### 1. Company-Wise Filtering (Multi-Tenant)

Filter all reports by specific companies/tenants:
- Select "All Companies" to see aggregated data across all tenants
- Select a specific company to see only that tenant's data
- All metrics are automatically filtered:
  - Lead counts and sources
  - Application growth trends
  - Call outcomes and AI usage
  - Counselor performance
  - Demographics and task completion

### 2. Country-Wise Filtering

Filter reports by country to analyze geographic performance:
- Select "All Countries" for global view
- Select specific country to see leads and applications from that region
- Filters both lead country and applicant country fields
- Useful for analyzing market penetration and regional performance

### 3. PDF Report Generation

Generate professional PDF reports with applied filters:
- Click "Generate PDF" button to create downloadable report
- PDF includes all filtered data:
  - Executive summary with key metrics
  - Lead source breakdown
  - Counselor performance table
  - Company and country information in header
- Automatic filename: `CRM_Report_CompanyName_YYYYMMDD.pdf`

## API Endpoints

### GET `/api/reports/summary/`

Fetch report data with optional filters.

**Query Parameters:**
- `tenant_id` (optional): UUID of the tenant/company
- `country` (optional): Country name (case-insensitive)

**Example Request:**
```bash
GET /api/reports/summary/?tenant_id=123e4567-e89b-12d3-a456-426614174000&country=Canada
```

**Response:**
```json
{
  "application_growth": [...],
  "call_outcomes": [...],
  "lead_sources": [...],
  "conversion_funnel": [...],
  "counselor_stats": [...],
  "ai_usage": {...},
  "demographics": [...],
  "document_status": [...],
  "task_completion": [...],
  "available_reports": [...],
  "total_applications": 150,
  "companies": [
    {"id": "uuid-1", "name": "Company A"},
    {"id": "uuid-2", "name": "Company B"}
  ],
  "countries": ["Canada", "USA", "UK", "Australia"]
}
```

### POST `/api/reports/summary/`

Generate PDF report with filters.

**Request Body:**
```json
{
  "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
  "country": "Canada"
}
```

**Response:**
- Content-Type: `application/pdf`
- Downloads PDF file with filtered report data

## Frontend Usage

### Filter Panel

Open the filter panel by clicking the "Filters" button in the Reports Center header.

Available Filters:
1. **Company** - Select from dropdown of active tenants
2. **Country** - Select from list of unique countries in your leads
3. **Date Range** - Last 7/30 days, Quarter, Year, Custom (UI placeholder)
4. **Counselor** - Filter by specific counselor (UI placeholder)
5. **Reset Filters** - Clear all filters and show global data

### Real-Time Updates

The reports automatically refresh when you change Company or Country filters, providing instant feedback on the selected data slice.

## Backend Implementation

### Filter Logic

The backend applies filters at the database query level for optimal performance:

```python
# Build base filters
lead_filters = Q()
app_filters = Q()

if tenant_id:
    lead_filters &= Q(tenant_id=tenant_id)
    app_filters &= Q(tenant_id=tenant_id)

if country:
    lead_filters &= Q(country__iexact=country)
    app_filters &= Q(applicant__country__iexact=country)

# Apply to queries
leads = Lead.objects.filter(lead_filters).count()
apps = Application.objects.filter(app_filters).count()
```

### PDF Generation

Uses **WeasyPrint** library to convert HTML to professional PDF:

1. Collects filtered data
2. Generates HTML template with company branding
3. Converts to PDF using WeasyPrint
4. Returns as downloadable file

**Installation:**
```bash
pip install weasyprint
```

## Use Cases

### 1. Client Reporting
Generate company-specific reports for each client/tenant showing their performance metrics.

### 2. Geographic Analysis
Analyze performance by country to identify strong markets and growth opportunities:
- Which countries generate most leads?
- What's the conversion rate per country?
- Which regions need more counselor support?

### 3. Multi-Tenant Management
For agencies managing multiple educational institutions:
- Compare performance across different companies
- Identify best practices from high-performing tenants
- Track regional variations in each tenant's performance

### 4. Executive Dashboards
Generate PDF reports for stakeholders showing:
- Company-wide metrics
- Country-specific performance
- Counselor productivity
- Lead source effectiveness

## Data Filtering Scope

When filters are applied, the following metrics are filtered:

✅ **Filtered:**
- Total Leads
- Total Applications
- Enrolled Students
- Application Growth (monthly trends)
- Call Outcomes
- Lead Sources
- Conversion Funnel
- Counselor Performance (leads, calls, apps assigned to them)
- AI Usage Metrics (calls from filtered leads)
- Demographics (city breakdown)
- Document Status
- Task Completion

❌ **Not Filtered:**
- Available Reports list (system-wide)
- Date Range selector (UI only)

## Example Workflows

### Workflow 1: Generate Client Report

1. Open Reports Center
2. Click "Filters" button
3. Select client company from "Company" dropdown
4. Optionally select country if client operates in specific region
5. Review filtered metrics on screen
6. Click "Generate PDF"
7. Download and share PDF with client

### Workflow 2: Country Performance Analysis

1. Open Reports Center
2. Click "Filters"
3. Leave "Company" as "All Companies"
4. Select target country (e.g., "Canada")
5. Analyze:
   - Total leads from Canada
   - Conversion rates
   - Top cities within Canada
   - Counselor performance for Canadian leads
6. Generate PDF for stakeholder review

### Workflow 3: Multi-Tenant Comparison

1. Open Reports Center (no filters = all data)
2. Note overall metrics
3. Apply filter for Company A, compare metrics
4. Reset filters
5. Apply filter for Company B, compare metrics
6. Identify performance differences and best practices

## Troubleshooting

### PDF Generation Fails

**Error:** "PDF generation library not installed"

**Solution:**
```bash
cd Backend/CybricHQ
pip install weasyprint
```

On Windows, WeasyPrint may require GTK3. Install from: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer

### No Companies in Dropdown

**Issue:** Company filter dropdown is empty

**Check:**
1. Verify tenants exist in database: `Tenant.objects.all()`
2. Ensure tenants are active: `is_active=True`
3. Check database connection

### Country Filter Not Working

**Issue:** Selecting country doesn't filter data

**Check:**
1. Verify leads have country field populated
2. Check for case sensitivity issues (filter uses case-insensitive matching)
3. Ensure Lead model has `country` field

## Performance Considerations

### Efficient Querying

All filters use database-level filtering with Django Q objects, ensuring efficient queries with proper indexes.

**Recommended Indexes:**
```python
# In Lead model
class Meta:
    indexes = [
        models.Index(fields=['tenant', 'country']),
        models.Index(fields=['created_at']),
    ]
```

### Caching (Future Enhancement)

Consider implementing Redis caching for frequently accessed report data:
```python
cache_key = f"reports:{tenant_id}:{country}:{date_range}"
cached_data = cache.get(cache_key)
if not cached_data:
    cached_data = generate_report()
    cache.set(cache_key, cached_data, timeout=300)  # 5 minutes
```

## Future Enhancements

### Planned Features
- [ ] Date range filtering (functional, not just UI)
- [ ] Export to Excel (XLSX)
- [ ] Export to CSV
- [ ] Email report scheduling
- [ ] Comparison mode (compare two companies or countries side-by-side)
- [ ] Custom report builder
- [ ] Report templates
- [ ] Saved filter presets
- [ ] Real-time report refresh (WebSocket updates)

### Advanced Filtering
- [ ] Multiple country selection
- [ ] Multiple company selection
- [ ] Lead source filtering (functional)
- [ ] Date range picker with custom dates
- [ ] Counselor filtering (functional)
- [ ] Status filtering (new, qualified, converted, etc.)

## Security

### Access Control

The Reports Center uses `permission_classes = [AllowAny]` for development. 

**For Production:**
```python
class ReportsSummary(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Only show user's own tenant data if not admin
        if not request.user.is_staff:
            tenant_id = request.user.profile.tenant_id
        else:
            tenant_id = request.GET.get('tenant_id', None)
        # ... rest of code
```

### Data Isolation

Multi-tenant data isolation is enforced at the query level using tenant_id filters, ensuring users only see data from their authorized tenants.

## Conclusion

The enhanced Reports Center provides powerful analytics with flexible filtering by Company and Country, enabling data-driven decision making across multi-tenant CRM operations. PDF export functionality allows easy sharing of insights with stakeholders.

For questions or issues, contact the development team or file an issue in the project repository.
