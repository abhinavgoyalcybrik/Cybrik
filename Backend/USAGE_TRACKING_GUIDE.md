# How to Track and Monitor API Usage

## What This Does

Think of this like a meter on your utilities (water, electricity, gas). Every time your customers use AI services through your platform, this system keeps track of:

- **OpenAI** - The AI that writes text and has conversations (charges by "tokens" - roughly 4 letters = 1 token)
- **ElevenLabs** - The AI that converts text into realistic speech (charges by character count)
- **Smartflo** - Phone calling service (charges by minutes)

**The Key Idea:** Each of your customers has their own separate account credentials, and this system watches how much they use so you can:
- See who's using what
- Set limits to prevent overuse
- Get warnings before they hit their limit
- Calculate costs automatically

---

## How It's Organized

The system keeps four different types of records:

### 1. Individual Call Records

**What it is:** Like an itemized phone bill - every single API call is recorded.

**What it tracks:**
- Which customer made the call
- Which service they used (OpenAI, ElevenLabs, or Smartflo)
- When it happened
- How much it cost
- How many tokens/characters/minutes were used
- Whether it worked or had an error

**Why it's useful:** You can see the exact history of what happened, perfect for debugging or answering customer questions about charges.

---

### 2. Monthly Summaries

**What it is:** Like your monthly credit card statement - all the individual charges added up.

**What it shows:**
- Total usage per customer per month
- Breakdown by service (OpenAI, ElevenLabs, Smartflo)
- Total costs
- Total number of API calls made

**Why it's useful:** Fast way to see the big picture without looking through thousands of individual records. Perfect for billing and dashboards.

---

### 3. Usage Limits (Quotas)

**What it is:** Like a data cap on your phone plan - you set maximum limits for each customer.

**What you can limit:**
- Maximum OpenAI tokens per month
- Maximum ElevenLabs characters per month
- Maximum Smartflo minutes per month
- Maximum total cost per month in dollars
- How many requests per minute (to prevent abuse)

**Why it's useful:** Prevents customers from accidentally (or intentionally) running up huge bills. You get warned when they reach 80% of their limit.

---

### 4. Alerts and Warnings

**What it is:** Like low-fuel warning light in your car - automatic notifications when something needs attention.

**What triggers alerts:**
- Customer reaches 80% of their limit
- Customer exceeds their limit
- Too many requests too quickly
- Total monthly cost getting too high

**Why it's useful:** You know about problems before they become serious. Can notify customers proactively.

---

## How to Actually Use It

### What Happens Automatically

Every time a customer uses one of these AI services through your system, the tracking happens automatically in the background:

1. **Records the call** - Saves all the details (who, what, when, how much)
2. **Calculates the cost** - Based on current pricing (you can see prices below)
3. **Updates monthly totals** - Adds it to the running total for this month
4. **Checks limits** - Compares usage to any limits you've set
5. **Sends alerts** - If they're getting close to or over their limit

**Current Pricing (what customers get charged):**

**OpenAI:**
- GPT-4 (the smart one): $0.03 per 1,000 input tokens, $0.06 per 1,000 output tokens
- GPT-3.5 (the fast one): $0.0005 per 1,000 input tokens, $0.0015 per 1,000 output tokens
- *Example: A typical conversation uses about 500-1000 tokens*

**ElevenLabs:**
- $0.30 per 10,000 characters
- *Example: "Hello, how are you?" is 19 characters*

**Smartflo:**
- $0.02 per minute of call time
- *Example: A 5-minute call costs $0.10*

---

## Where to See This Information

### Admin View (You See Everything)

You have special admin pages where you can see usage for ALL customers:

**Usage Logs Page**
- See every single API call made by any customer
- Filter by customer, service type, or date
- See which calls had errors

**Monthly Summaries Page**
- See monthly totals for all customers
- Sort by highest usage or cost
- Compare month-to-month

**Quotas Page**
- See and edit limits for each customer
- Set new limits or remove them

**Alerts Page**
- See all active warnings across all customers
- Mark them as seen or resolved

### Customer View (They See Only Their Own)

Each customer can log into their own dashboard and see:

**Their Usage Dashboard**
- Current month usage summary
- How close they are to their limits (shown as percentage)
- Recent API calls
- Active warnings

**Their Usage History**
- Past 6 months of usage
- Month-by-month breakdown
- Cost trends over time

---

## Setting It Up

### Step 1: Decide on Limits

For each customer, you can set limits like:
- "Maximum 1 million OpenAI tokens per month"
- "Maximum $500 total spending per month"
- "No more than 100 requests per minute"

If you don't set limits, they have unlimited usage (be careful with this!).

### Step 2: Get Alerts

The system will automatically create alerts when:
- A customer reaches 80% of any limit
- A customer goes over a limit
- There's unusual activity (too many requests too fast)

You can set up email notifications to be sent automatically when alerts happen.

### Step 3: Monitor Usage

Check the admin dashboard regularly to:
- See who's using the most resources
- Spot unusual patterns
- Identify customers who might need limit adjustments
- Review total costs

---

## Common Questions

**Q: What if a customer goes over their limit?**
A: The system creates an alert, but it doesn't automatically block them. You decide what to do - either block future requests, contact the customer, or increase their limit.

**Q: How accurate is the cost calculation?**
A: Very accurate. It uses the official pricing from each service and tracks usage down to individual tokens/characters/seconds.

**Q: Can customers see their own usage?**
A: Yes! Each customer has their own dashboard showing their usage, costs, and limits. They can only see their own data, not other customers'.

**Q: What happens at the start of each month?**
A: The monthly totals reset to zero, but all historical data is kept. You can always look back at previous months.

**Q: Can I change the pricing?**
A: The pricing is configured in the system code. If the actual service providers change their prices, the code can be updated to match.

**Q: How long is data kept?**
A: 
- Individual call records: Recommended 90 days (can be adjusted)
- Monthly summaries: Forever (they're small and useful for billing history)
- Alerts: Until you mark them as resolved

---

## Real-World Example

Let's say you have a customer named "Acme Corp":

**Month Start:**
- They have a limit of 500,000 OpenAI tokens
- They have a limit of $200 total cost

**Week 1:**
- They make 50 OpenAI calls = 120,000 tokens = $7.20
- System shows: "24% of token limit used, $7.20 of $200 budget used"

**Week 2:**
- They make 80 more calls = 190,000 tokens = $11.40 more
- System shows: "62% of token limit used, $18.60 of $200 budget used"

**Week 3:**
- They make 100 more calls = 210,000 tokens = $12.60 more
- System shows: "104% of token limit used" 
- **Alert created:** "Acme Corp has exceeded their OpenAI token quota"
- You get notified and can decide whether to allow more or contact them

**Month End:**
- Total: 520,000 tokens, $31.20 cost
- You have the complete history of what they used
- The monthly summary is saved for your records
- Next month starts fresh at zero

---

## What You Need to Do Next

1. **Test it out** - Try making some API calls and watch the usage tracking work
2. **Set limits** - Decide on reasonable limits for each customer
3. **Set up alerts** - Configure email notifications so you know when things need attention
4. **Build the dashboard** - Create a nice-looking admin page to view all this data
5. **Train your team** - Show them how to check usage and respond to alerts

---

## Bottom Line

You now have a complete "meter" system that:
- ✅ Tracks every API call each customer makes
- ✅ Calculates costs automatically and accurately
- ✅ Shows you and your customers exactly what's being used
- ✅ Warns you before problems happen
- ✅ Gives you control over limits and access
- ✅ Keeps detailed records for billing and auditing

It's like having a smart electric meter for your API usage - always watching, always accurate, and always ready to tell you what's happening.
