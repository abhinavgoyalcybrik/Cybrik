# Multi-Country Reports Feature Guide

## Overview
The Reports Center now supports **dynamic multi-country selection** with individual widgets for each selected country. This allows you to compare performance across multiple countries simultaneously.

## Features

### 1. **Multi-Country Selection**
- Select multiple countries from a dropdown menu
- Countries appear as removable chips/tags
- Real-time data filtering as you add/remove countries

### 2. **Country-Specific Widgets**
Each selected country gets its own collapsible section showing:
- **KPIs**: Total applications, leads, AI calls analyzed, and AI costs
- **Application Growth**: Monthly trend chart
- **Lead Sources**: Top sources with visual bars
- **Conversion Funnel**: From leads to enrollment
- **Counselor Performance**: Top performers for that country

### 3. **PDF Generation**
- **Single Country**: Traditional report layout
- **Multiple Countries**: Separate sections for each country with comparison data

## How to Use

### Frontend (Reports Page)

#### Step 1: Open Filters
Click the **"Filters"** button in the Reports Center header

#### Step 2: Select Countries
1. Click the "Countries (Multi-Select)" dropdown
2. Select "+ Add Country"
3. Choose a country from the list
4. Repeat for additional countries

#### Step 3: View Country Reports
- Each country appears as an expandable card
- Click the country header to expand/collapse details
- View country-specific metrics, charts, and counselor performance

#### Step 4: Generate PDF
- Click **"Generate PDF"** button
- If multiple countries selected, you'll get a multi-country report
- Each country has its own section in the PDF

### API Usage

#### GET Endpoint - Fetch Multi-Country Data

```bash
# Single country (backward compatible)
GET /api/reports/summary/?tenant_id=UUID&country=Canada

# Multiple countries
GET /api/reports/summary/?tenant_id=UUID&countries[]=Canada&countries[]=USA&countries[]=UK
```

**Response Structure:**
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
  "total_leads": 500,
  "companies": [...],
  "countries": ["Canada", "USA", "UK", ...],
  
  "country_breakdown": {
    "Canada": {
      "application_growth": [...],
      "call_outcomes": [...],
      "lead_sources": [...],
      "conversion_funnel": [...],
      "counselor_stats": [...],
      "ai_usage": {...},
      "demographics": [...],
      "document_status": [...],
      "task_completion": [...],
      "total_applications": 50,
      "total_leads": 200
    },
    "USA": {
      ...
    }
  }
}
```

#### POST Endpoint - Generate PDF

```bash
# Single country PDF
POST /api/reports/summary/
Content-Type: application/json

{
  "tenant_id": "UUID",
  "country": "Canada"
}

# Multi-country PDF
POST /api/reports/summary/
Content-Type: application/json

{
  "tenant_id": "UUID",
  "countries": ["Canada", "USA", "UK"]
}
```

## Technical Implementation

### Backend (Django)

**Key Changes:**
- `get_country_metrics(country_filter)` - Helper function computing all metrics for a specific country
- Modified GET method supports `countries[]` query parameter
- Returns `country_breakdown` dict with per-country data
- `_generate_multi_country_pdf()` - Generates PDF with country sections

**Performance:**
- Metrics computed once per country
- Efficient Q object filtering
- Reuses existing aggregation queries

### Frontend (React/TypeScript)

**State Management:**
```typescript
const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
const [expandedCountries, setExpandedCountries] = useState<{ [key: string]: boolean }>({});
```

**Components:**
- Multi-select dropdown with chip UI
- Collapsible country panels with individual charts
- Responsive grid layouts for country sections

## Use Cases

### 1. **Regional Comparison**
Select multiple countries in a region (e.g., Canada, USA, Mexico) to compare:
- Lead sources effectiveness
- Counselor performance
- Application conversion rates

### 2. **Market Analysis**
Compare established markets vs new markets:
- Growth trends
- AI call costs per market
- Document completion rates

### 3. **Resource Allocation**
Identify which countries need:
- More counselor support
- Better lead generation strategies
- Process improvements

### 4. **Executive Reporting**
Generate multi-country PDFs for:
- Board presentations
- Quarterly reviews
- Investor updates

## Benefits

✅ **Dynamic Configuration** - Add/remove countries on the fly without code changes
✅ **Granular Insights** - See exactly how each country performs individually
✅ **Easy Comparison** - View multiple countries side-by-side
✅ **Flexible Reporting** - Generate reports for any combination of countries
✅ **Backward Compatible** - Single country filtering still works as before

## Deployment Instructions

### Backend
```bash
cd ~/cybrik/Backend/CybricHQ
git pull origin main
sudo systemctl restart gunicorn
```

### Frontend
```bash
cd ~/cybrik/frontend
git pull origin main
npm run build
pm2 restart frontend
```

## Testing Checklist

- [ ] Select single country - verify data displays correctly
- [ ] Select multiple countries - verify country_breakdown appears
- [ ] Expand/collapse country sections - verify animation works
- [ ] Remove country chip - verify section disappears
- [ ] Generate PDF with single country - verify traditional layout
- [ ] Generate PDF with multiple countries - verify country sections
- [ ] Reset filters button - verify all countries cleared
- [ ] API performance with 5+ countries - verify reasonable load time

## Future Enhancements

- **Country Comparison Chart**: Side-by-side bar chart comparing key metrics
- **Country Rankings**: Top 5 countries by conversion rate, applications, etc.
- **Export to Excel**: Multi-sheet workbook with one sheet per country
- **Save Preset Filters**: Save favorite country combinations
- **Email Scheduling**: Auto-send multi-country reports weekly/monthly

## Support

For issues or questions:
- Check API errors in browser console
- Verify countries[] parameter format
- Check Django logs: `sudo tail -f /var/log/gunicorn/error.log`
- Contact: dev@cybriksolutions.com
