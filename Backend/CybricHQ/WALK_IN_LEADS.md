# Walk-in Lead Management

## Overview
Walk-in leads are prospects who physically visit your office. These leads are **100% manual** - no AI automation, no automated calls, no automated follow-ups. Everything is handled by counselors manually.

---

## How It Works

### 1. **Creating a Walk-in Lead**

**Frontend:**
- In the "Capture New Lead" form, select **"Walk-in"** from the Lead Source dropdown
- Fill in the lead's details manually
- Submit the form

**What Happens Automatically:**
- Backend automatically sets `is_manual_only = True`
- All AI automation is bypassed
- No SmartFlo call is initiated
- No AI follow-ups are generated
- Lead is ready for pure manual counseling

### 2. **Walk-in Lead Fields**

The Lead model has three special fields for walk-ins:

```python
is_manual_only = BooleanField
    - Automatically set to True for walk-in leads
    - Disables all AI automation when True
    
walked_in_at = DateTimeField  
    - Records when the lead physically walked in
    - Can be set manually by receptionist
    
receptionist = ForeignKey(User)
    - Tracks which staff member received the lead
    - Helpful for accountability and follow-up
```

### 3. **What Gets Disabled**

When `source = 'walk-in'` or `is_manual_only = True`:

✋ **Disabled:**
- ❌ SmartFlo AI calls
- ❌ ElevenLabs AI calls  
- ❌ Automated follow-up generation
- ❌ AI qualification calls
- ❌ Any automated AI interactions

✅ **Enabled:**
- ✅ Manual counseling
- ✅ Manual follow-up creation
- ✅ Manual call logging
- ✅ Manual status updates
- ✅ All CRM features (documents, applications, etc.)

---

## Backend Implementation

### Protection Points

**1. Lead Creation (`views.py` - LeadViewSet.perform_create)**
```python
if lead.source == 'walk-in':
    lead.is_manual_only = True
    lead.save(update_fields=['is_manual_only'])
    return  # Skip all AI automation
```

**2. Follow-up Generation (`followup_generator.py`)**
```python
if hasattr(applicant, 'is_manual_only') and applicant.is_manual_only:
    return None  # Skip AI follow-up
```

**3. Helper Method (`models.py` - Lead model)**
```python
def should_skip_ai_automation(self):
    return self.is_manual_only or self.source == 'walk-in'
```

---

## Usage Examples

### Example 1: Receptionist Creates Walk-in Lead
```python
from django.utils import timezone

lead = Lead.objects.create(
    external_id=f"WALKIN-{uuid.uuid4().hex[:8].upper()}",
    name="John Doe",
    phone="+1234567890",
    email="john@example.com",
    source='walk-in',
    walked_in_at=timezone.now(),
    receptionist=request.user,
    tenant=current_tenant,
    status='new'
)
# is_manual_only is automatically set to True
# No AI call is made
```

### Example 2: Checking Before AI Automation
```python
lead = Lead.objects.get(id=lead_id)

if lead.should_skip_ai_automation():
    # Skip AI processing
    return

# Proceed with AI automation...
```

### Example 3: Filtering Walk-in Leads
```python
# All walk-in leads
walkins = Lead.objects.filter(source='walk-in')

# Today's walk-ins
today = timezone.now().date()
today_walkins = Lead.objects.filter(
    source='walk-in',
    walked_in_at__date=today
)

# Walk-ins by receptionist
my_walkins = Lead.objects.filter(
    receptionist=request.user,
    source='walk-in'
)

# Manual-only leads (includes walk-ins)
manual_leads = Lead.objects.filter(is_manual_only=True)
```

---

## Frontend Lead Source Options

The dropdown now includes:

- Meta/Facebook Ads
- Google Ads
- Organic Search
- Referral
- **Walk-in** ← New option
- Other

---

## Database Migration

Migration applied: `0020_remove_lead_address_remove_lead_dob_and_more.py`

**Changes:**
- Added `is_manual_only` field
- Added `walked_in_at` field
- Added `receptionist` field (ForeignKey to User)
- Updated `source` field with choices including 'walk-in'

---

## Counselor Workflow

### Step 1: Lead Walks In
1. Receptionist greets the lead
2. Opens CRM → "Capture New Lead"
3. Selects **"Walk-in"** as source
4. Fills in basic details (name, phone, email)
5. Submits form

### Step 2: Manual Counseling
1. Counselor reviews the lead in CRM
2. Conducts face-to-face counseling session
3. Manually updates lead status and notes
4. Creates manual follow-up tasks if needed
5. Uploads documents manually

### Step 3: Manual Follow-up
1. Counselor schedules next meeting manually
2. Creates follow-up tasks with channel = "phone" or "in_app"
3. No AI calls are triggered
4. Everything is human-controlled

---

## Important Notes

⚠️ **AI Bypass is Automatic**
- You don't need to manually disable anything
- Setting `source='walk-in'` does it all automatically

⚠️ **Cannot Re-enable AI Later**
- Once a lead is walk-in, it stays manual-only
- This is intentional to prevent accidental AI calls

⚠️ **Walk-in ≠ Low Priority**
- Walk-in leads are often high-intent prospects
- They took the effort to physically visit
- Prioritize them for face-to-face counseling

---

## Testing

### Test 1: Create Walk-in Lead
```bash
# Via API
curl -X POST http://localhost:8000/api/leads/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "WALKIN-TEST-001",
    "name": "Test Walker",
    "phone": "+1234567890",
    "source": "walk-in"
  }'

# Expected: is_manual_only = True, no AI call made
```

### Test 2: Verify AI Skip
```python
lead = Lead.objects.get(external_id='WALKIN-TEST-001')
print(f"Manual only: {lead.is_manual_only}")  # True
print(f"Should skip AI: {lead.should_skip_ai_automation()}")  # True

# Check no call record was created
calls = CallRecord.objects.filter(lead=lead)
print(f"Call count: {calls.count()}")  # 0
```

---

## Troubleshooting

**Issue: Walk-in lead still got an AI call**
- Check: Is `is_manual_only` set to True?
- Check: Is `source` set to 'walk-in'?
- Check: Was the lead created after the migration?
- Solution: Manually set `is_manual_only=True` and check logs

**Issue: Cannot find "Walk-in" option in dropdown**
- Check: Is frontend code updated?
- Check: Browser cache cleared?
- Solution: Hard refresh (Ctrl+Shift+R)

---

## Summary

✅ Walk-in leads = 100% manual
✅ No AI calls, no automation
✅ Counselor has full control
✅ Perfect for face-to-face prospects
✅ Automatic protection built-in

🎯 **Use Case**: Physical office visitors, immediate consultations, high-touch counseling
