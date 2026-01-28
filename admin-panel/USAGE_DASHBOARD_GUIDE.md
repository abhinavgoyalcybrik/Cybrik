# Usage Monitoring Dashboard - User Guide

## What You'll See

### Admin Panel (For You - View All Customers)

**Access:** Admin Panel → Usage Monitoring (📊 icon in sidebar)

#### Main Dashboard Shows:

1. **Overview Cards at Top:**
   - Total number of customers
   - Total cost across all customers this month
   - Total API calls made
   - Number of active alerts

2. **Alerts Section (if any):**
   - Red/orange warning boxes showing customers approaching or exceeding limits
   - One-click "Acknowledge" button to mark as seen
   - Shows which customer, which service, and what the issue is

3. **Three Tabs:**

   **Monthly Summaries Tab:**
   - Cards for each customer showing their usage
   - Each card shows:
     - Customer name and date range
     - Total cost (highlighted in green)
     - OpenAI usage and cost
     - ElevenLabs usage and cost
     - Smartflo usage and cost
     - Total number of API calls
   - Search box to find specific customers

   **Recent Activity Tab:**
   - Detailed table of the last 50 API calls
   - Filter by service (All/OpenAI/ElevenLabs/Smartflo)
   - Shows: time, customer, service, usage amount, cost, success/error
   - Perfect for troubleshooting

   **Service Breakdown Tab:**
   - Three big cards showing totals for each service
   - Top 10 customers by cost
   - See who's using what the most

### Customer Dashboard (What Your Customers See)

**Access:** Customer Portal → Usage

#### They See:

1. **Their Total Cost** - Big green number showing monthly spend

2. **Three Service Cards:**
   - OpenAI: Shows tokens used, cost, and quota progress bar
   - ElevenLabs: Shows characters used, cost, and quota progress bar
   - Smartflo: Shows minutes used, cost, and quota progress bar
   
   Progress bars are color-coded:
   - Green: Under 60%
   - Yellow: 60-80%
   - Orange: 80-90%
   - Red: 90%+

3. **Two Tabs:**
   - **Current Month:** Detailed breakdown of this month's usage
   - **Usage History:** Table showing past 6 months with trends

## How to Use It

### For Daily Monitoring

1. **Start your day by checking alerts:**
   - Open Usage Monitoring page
   - Look for the red alert section
   - Review any customers approaching limits
   - Click "Acknowledge" to mark as seen

2. **Quick health check:**
   - Look at the 4 overview cards
   - Compare to previous days mentally
   - Notice any unusual spikes

### For Billing/Reports

1. **Monthly Summaries Tab:**
   - Use search to find specific customers
   - Review costs for billing
   - Export data if needed (can copy from browser)

2. **Service Breakdown Tab:**
   - See which service is most used
   - Identify top spenders
   - Plan infrastructure accordingly

### For Troubleshooting

1. **Recent Activity Tab:**
   - Filter by service if needed
   - Look for error status (red)
   - Check timestamps for patterns
   - See exact usage amounts per call

### Setting Limits for Customers

To set usage limits (quotas):

1. Contact your developer to add quota via admin API
2. Or use Django admin panel
3. Set limits like:
   - "1 million OpenAI tokens per month"
   - "$500 maximum cost per month"
   - "100 requests per minute"

When customer reaches 80% of limit:
- Alert automatically created
- Shows in red alert section
- Can notify customer manually

## Tips

✅ **Check alerts daily** - Don't let customers hit hard limits unexpectedly

✅ **Use search** - When customer calls about usage, search their name quickly

✅ **Watch the breakdown tab** - Shows trends across all customers

✅ **Compare month-to-month** - Each customer card shows period dates

✅ **Look for errors** - Error calls cost money but provide no value

## Understanding the Numbers

**OpenAI Tokens:**
- 1 token ≈ 4 letters
- "Hello, how are you?" = about 5 tokens
- Typical conversation = 500-2000 tokens

**ElevenLabs Characters:**
- Same as letter count
- "Hello" = 5 characters
- Typical sentence = 50-100 characters

**Smartflo Minutes:**
- Call duration in minutes
- Shows as decimal (5.5 = 5 minutes 30 seconds)

**Costs:**
- Calculated automatically based on:
  - GPT-4: $0.03-0.06 per 1K tokens
  - GPT-3.5: $0.0005-0.0015 per 1K tokens
  - ElevenLabs: $0.30 per 10K characters
  - Smartflo: $0.02 per minute

## What Customers See

Your customers ONLY see their own usage. They cannot see:
- Other customers' data
- Your total costs
- Other customers' names or usage

They see:
- Their current month usage
- Their past 6 months history
- Their quota progress bars (if you set limits)
- Any alerts about their usage

## Common Questions

**Q: How often does it update?**
A: Real-time! Every API call is tracked immediately.

**Q: Can I export this data?**
A: Yes, you can copy from browser or use the API endpoints for CSV export.

**Q: What if someone goes over their limit?**
A: Alert is created, but service continues. You decide whether to block them.

**Q: Can I see usage by day instead of month?**
A: Currently shows monthly totals. Daily breakdown available via Recent Activity tab.

**Q: How do I notify customers about alerts?**
A: Manual for now - check alerts and email them. Auto-notifications can be added.

**Q: Where is the data stored?**
A: In your database, securely separated by customer.

## Quick Actions

**See specific customer's usage:**
1. Go to Monthly Summaries tab
2. Type customer name in search box
3. Their card appears

**Check if a service is down:**
1. Go to Recent Activity tab
2. Look for multiple red "Error" badges
3. Check timestamps for pattern

**Find highest cost customer:**
1. Go to Service Breakdown tab
2. Look at "Top 10 Consumers" list
3. First one is highest

**Review yesterday's activity:**
1. Go to Recent Activity tab
2. Look at timestamps
3. Shows last 50 calls

---

**Need help?** The system is working automatically in the background. This dashboard is just for viewing and monitoring. All tracking happens whether you look at it or not!
