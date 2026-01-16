# Getting Started Guide

Welcome! This guide will walk you through setting up your personal finance tracking system from scratch.

---

## Overview

This system helps you:
- 🏦 Connect to your bank via GoCardless (Open Banking)
- 📊 Fetch 3 months of transaction history
- 🤖 AI-powered automatic categorization (using Claude)
- 📈 Generate detailed spending reports
- 🔒 Privacy-first: PII redaction, local storage only

**Time to setup**: ~15 minutes

---

## Prerequisites

### Required

1. **Node.js** (v14 or higher)
   ```bash
   node --version  # Should show v14+
   ```

2. **A European bank account** that supports PSD2 Open Banking
   - Works with: ING, Revolut, N26, BRD, BCR, and most EU banks
   - Check supported banks: https://nordigen.com/en/coverage/

3. **GoCardless Account** (free for personal use)
   - Sign up at: https://bankaccountdata.gocardless.com/
   - Get your API credentials (Secret ID + Secret Key)

4. **Anthropic API Key** (for AI categorization)
   - Sign up at: https://console.anthropic.com/
   - Get your API key from the dashboard
   - Costs: ~$0.10-0.50 per month for personal use

### Optional

- Git (if you want version control for scripts)

---

## Step 1: Install Dependencies

```bash
cd /Users/alin/ego

# Install required Node packages
npm install

# Expected output:
# added 50 packages
```

**Packages installed**:
- `@anthropic-ai/sdk` - For AI categorization
- `axios` - For API calls
- `dotenv` - For environment variables

---

## Step 2: Configure API Credentials

Create a `.env` file with your API keys:

```bash
# Create .env file
cat > .env << 'EOF'
# GoCardless Bank Account Data API
# Get these from: https://bankaccountdata.gocardless.com/
GOCARDLESS_SECRET_ID=your_secret_id_here
GOCARDLESS_SECRET_KEY=your_secret_key_here
GOCARDLESS_ENVIRONMENT=sandbox

# Anthropic API (for AI categorization)
# Get this from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
EOF
```

**Important**:
- Replace `your_secret_id_here` with your actual GoCardless Secret ID
- Replace `your_secret_key_here` with your actual GoCardless Secret Key
- Replace `sk-ant-xxxxxxxxxxxxx` with your actual Anthropic API key
- Start with `GOCARDLESS_ENVIRONMENT=sandbox` for testing
- Change to `production` when you're ready to use real data

**Verify setup**:
```bash
# Test your credentials
npm run test-credentials

# Expected output:
# ✅ Authentication successful!
# ✅ API connection verified!
```

---

## Step 3: Connect Your Bank

Run the interactive bank connection wizard:

```bash
npm run connect-bank
```

**What this does**:
1. Shows you a list of available banks in your country
2. You select your bank
3. Creates an authorization link
4. You open the link in your browser
5. Log in to your bank and grant access
6. Returns to the terminal

**Example flow**:
```
🔐 GoCardless Bank Connection

Enter country code (e.g., GB, DE, FR, RO) [GB]: RO

📋 Fetching banks for RO...

Found 15 banks. Showing first 20:

1. ING Bank Romania (ING_INGBROBU)
2. BRD - Groupe Société Générale (BRD_BRDEROBU)
3. BCR (BCR_RNCBROBU)
4. Revolut (REVOLUT_REVOGB21)
...

Enter the number of the bank: 1

✅ Selected: ING Bank Romania

📝 Creating end user agreement...
✅ Agreement created

🔗 Creating requisition...

✅ Requisition created successfully!

🌐 Authorization Link:
   https://bankaccountdata.gocardless.com/psd2/start/...

📖 Next steps:
   1. Open the authorization link in your browser
   2. Select your bank and log in
   3. Grant access to your account
   4. You'll be redirected to the callback URL
   5. Use the requisition ID to fetch account data

💾 Requisition details saved to requisition.json
```

**Open the authorization link** in your browser and complete the bank login.

---

## Step 4: Verify Connection

After authorizing in your browser, check the connection status:

```bash
npm run check-requisition
```

**Expected output**:
```
🔍 Checking requisition status...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Requisition Status:
   ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   Status: LN (Linked)
   Institution: ING Bank Romania
   Created: 2026-01-15T10:30:00Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Connection successful! Linked accounts:

Found 1 account(s):

📊 Account ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   Name: Current Account
   IBAN: RO49AAAA1B31007593840000
   Currency: RON

💾 Updated requisition.json with account IDs

✨ Next step: Run node fetch-transactions.js to get your transactions
```

**If status is "CR" (Created)**: Complete the authorization in your browser first.

---

## Step 5: Fetch Transaction History

Fetch the last 3 months of transactions (one-time setup):

```bash
npm run fetch-historical
```

**What this does**:
1. Fetches up to 90 days of transactions (GoCardless limit)
2. Groups transactions by month
3. Saves to monthly files: `transactions_01_2026.json`, `transactions_12_2025.json`, etc.

**Expected output**:
```
Historical Transaction Fetch (Last 3 Months)
==================================================

Date range: 2025-10-15 to 2026-01-15

Fetching transactions for account: xxxxx...
   Found 347 booked transactions
   Found 3 pending transactions

   Grouped into 3 monthly files:

   Saved 125 transactions to transactions_01_2026.json
   Saved 112 transactions to transactions_12_2025.json
   Saved 110 transactions to transactions_11_2025.json

==================================================
Historical fetch complete!

Next steps:
  1. Run: npm run build-categories
  2. Run: npm run analyze
```

**Files created**:
- `transactions_01_2026.json` - January 2026 transactions
- `transactions_12_2025.json` - December 2025 transactions
- `transactions_11_2025.json` - November 2025 transactions
- `requisition.json` - Connection metadata

---

## Step 6: Configure Your Accounts (Security)

This step helps the system identify internal transfers (money moving between your own accounts):

```bash
npm run configure-accounts
```

**What this does**:
1. AI analyzes your transaction patterns
2. Asks intelligent questions about your accounts
3. Creates `.account-config.json` with your personal settings
4. Never stores sensitive data in source code

**Example interaction**:
```
══════════════════════════════════════════════════════════════════════
          AI-POWERED ACCOUNT CONFIGURATION
══════════════════════════════════════════════════════════════════════

🔒 PRIVACY NOTICE
This script will analyze transaction patterns with AI.
The following data will be REDACTED before sending to Anthropic:
  • Personal names (only first 3 chars kept for pattern matching)
  • IBANs (replaced with RO**IBAN**REDACTED)
  • Long numbers (replaced with [NUMBER_REDACTED])

Only transfer patterns and amounts will be analyzed.
By continuing, you consent to this data processing.
Press Ctrl+C to cancel.

══════════════════════════════════════════════════════════════════════

📊 Loaded 347 transactions

🤖 Analyzing your transaction patterns with AI...

✅ AI analysis complete!

══════════════════════════════════════════════════════════════════════
DETECTED PATTERNS
══════════════════════════════════════════════════════════════════════

{
  "possibleUserNames": ["Pos***"],
  "roundUpDetected": true,
  "internalTransferIndicators": [
    "Same prefix appears in 15 transfers",
    "Small regular amounts to savings"
  ]
}

══════════════════════════════════════════════════════════════════════
CONFIGURATION QUESTIONS
══════════════════════════════════════════════════════════════════════

I noticed transfers involving the prefix 'Pos***'. Is this your name?
ℹ️  This will help identify transfers between your own accounts
(yes/no) yes

Should 'Round-up Transaction' transfers be excluded from expenses?
ℹ️  These appear to be automatic savings transfers
(yes/no) yes

How should transfers between your own accounts be handled?
Options:
  1. Exclude from income/expenses
  2. Count as expenses
  3. Count as savings
Enter number 1

══════════════════════════════════════════════════════════════════════
ACCOUNT IDENTIFICATION (SECURE)
══════════════════════════════════════════════════════════════════════

To properly identify internal transfers, I need to know which IBANs are yours.
⚠️  This information will be stored LOCALLY in .account-config.json (gitignored).

Would you like to add your account IBANs? (yes/no) yes

Enter your IBANs (one per line, press Enter on empty line to finish):
IBAN RO49AAAA1B31007593840000
IBAN RO09BCYP0000001234567890
IBAN

══════════════════════════════════════════════════════════════════════
✅ CONFIGURATION COMPLETE
══════════════════════════════════════════════════════════════════════

Configuration saved to: .account-config.json

Your settings:
  - Name patterns: 1 configured
  - Personal IBANs: 2 configured
  - Round-up transactions: exclude
  - Internal transfers: exclude

You can now run: npm run analyze
```

**File created**:
- `.account-config.json` (gitignored, contains your personal IBANs)

---

## Step 7: Build Smart Categories (AI)

Let AI analyze your spending and create personalized categories:

```bash
npm run build-categories
```

**What this does**:
1. Loads last 3 months of transactions
2. Redacts all PII (IBANs, names, card numbers)
3. Sends merchant names to Claude AI
4. AI identifies spending patterns
5. Creates smart categories based on YOUR actual merchants

**Expected output**:
```
Smart Transaction Categorization Builder
==================================================

🔒 PRIVACY NOTICE
This script will send transaction data to Anthropic's API for analysis.
The following personal information will be REDACTED before sending:
  • IBANs and account numbers
  • Card numbers
  • Phone numbers
  • Personal names (beneficiaries, ordering parties)
  • Reference and authorization numbers
  • Exact transaction dates (only month is kept)

Only merchant names and transaction amounts will be analyzed.

By continuing, you consent to this data processing.
Press Ctrl+C to cancel, or any key to continue...
==================================================

Loading transaction history...
Loading transactions from: transactions_01_2026.json, transactions_12_2025.json, transactions_11_2025.json

Found 347 total transactions

⚠️  Privacy Notice: Redacting personal information before sending to AI...
   - IBANs, card numbers, phone numbers will be removed
   - Personal names will be anonymized
   - Only merchant names and amounts will be analyzed

Analyzing transactions with Claude AI...

Analysis complete!

Statistics:
   Categories created: 12
   Total keywords: 156
   Transactions analyzed: 200

Key Insights:
   1. Top spending category: Groceries (Kaufland, Lidl, Carrefour)
   2. Frequent small transactions at OMV suggest daily commute
   3. Regular monthly subscription to Netflix detected
   4. Weekend restaurant spending pattern observed

Categories saved to: smart-categories.json
Full analysis saved to: category-analysis.json

==================================================
Next steps:
   1. Review categories in smart-categories.json
   2. Run "npm run analyze" to see improved categorization
```

**Files created**:
- `smart-categories.json` - Your personalized categories
- `category-analysis.json` - Detailed AI analysis

**Example categories generated**:
```json
{
  "Groceries": {
    "keywords": ["kaufland", "lidl", "carrefour", "auchan", "mega image"],
    "description": "Supermarkets and food shopping"
  },
  "Fuel": {
    "keywords": ["omv", "petrom", "rompetrol", "mol"],
    "description": "Gas stations and fuel"
  },
  "Restaurants": {
    "keywords": ["restaurant", "beraria", "mcdonald", "kfc", "pizza"],
    "description": "Dining out and food delivery"
  }
}
```

---

## Step 8: Generate Spending Report

Finally, analyze your spending with the AI-generated categories:

```bash
npm run analyze
```

Or for a specific month:
```bash
npm run analyze january 2026
npm run analyze december 2025
```

**Expected output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 SPENDING ANALYSIS - JANUARY 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Income:      +8,500.00 RON
Total Expenses:    -6,418.35 RON
Net Savings:       +2,081.65 RON
Savings Rate:      24.5%

💳 EXPENSES BY CATEGORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Groceries              1,245.80 RON  (19.4%)
   • Kaufland: 8 transactions
   • Lidl: 6 transactions
   • Carrefour: 3 transactions

2. Restaurants             892.50 RON  (13.9%)
   • Beraria: 4 transactions
   • McDonald's: 3 transactions

3. Fuel                    765.00 RON  (11.9%)
   • OMV: 12 transactions

4. Utilities               450.00 RON  (7.0%)
   • Electricity, Internet, Phone

5. Shopping                523.40 RON  (8.2%)
   • Fashion, Electronics

6. Entertainment           180.00 RON  (2.8%)
   • Netflix, Cinema

7. Other                 2,361.65 RON  (36.8%)

📈 INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Groceries up 15% vs last month
• Excellent savings rate of 24.5%
• Consider meal prepping to reduce restaurant spending
• 12 fuel transactions suggest daily commute

💾 Full analysis saved to: analysis_2026-01_01_2026.json
```

---

## Step 9: Weekly Updates (Ongoing)

Every week, fetch new transactions:

```bash
npm run fetch-weekly
```

**What this does**:
1. Fetches last 7 days of transactions
2. Appends new transactions to monthly files
3. Deduplicates automatically
4. Handles month boundaries

**Expected output**:
```
Weekly Transaction Fetch (Last 7 Days)
==================================================

Date range: 2026-01-08 to 2026-01-15

Fetching transactions for account: xxxxx...
   Found 23 transactions in date range

   transactions_01_2026.json: +15 new, 8 duplicates skipped

==================================================
Summary: 15 new transactions added, 8 duplicates skipped

Run "npm run analyze" to generate updated reports.
```

**Set up weekly automation** (optional):
```bash
# Add to crontab (runs every Monday at 9am)
crontab -e

# Add this line:
0 9 * * 1 cd /Users/alin/ego && npm run fetch-weekly && npm run analyze
```

---

## Step 10: Monthly Category Refresh (Optional)

Every month, refresh categories to catch new merchants:

```bash
npm run build-categories
```

This updates the AI categories based on the latest transaction patterns.

---

## Complete Workflow Summary

```bash
# ONE-TIME SETUP (15 minutes)
npm install                    # Install dependencies
# Edit .env with API keys
npm run test-credentials       # Verify credentials
npm run connect-bank           # Connect your bank (opens browser)
npm run check-requisition      # Verify connection
npm run fetch-historical       # Fetch 3 months of data
npm run configure-accounts     # Set up account rules (AI-assisted)
npm run build-categories       # Generate smart categories (AI)
npm run analyze                # View spending report

# WEEKLY ROUTINE (automatic or manual)
npm run fetch-weekly           # Fetch last 7 days
npm run analyze                # View updated report

# MONTHLY (optional)
npm run build-categories       # Refresh categories
```

---

## Using with Claude Code (Conversational)

You can also interact conversationally through Claude Code:

**Ask questions naturally**:
- "How much did I spend this month?"
- "Show me all grocery transactions"
- "What's my savings rate?"
- "Update my transactions"
- "How's my spending compared to last month?"

Claude will automatically run the appropriate commands and give you a clear answer.

---

## File Structure

After setup, your directory will look like this:

```
/Users/alin/ego/
├── .env                        # API credentials (DO NOT COMMIT)
├── .account-config.json        # Your personal IBANs (DO NOT COMMIT)
├── .gitignore                  # Protects sensitive files
├── package.json                # Dependencies and scripts
│
├── transactions_01_2026.json  # Monthly transactions (DO NOT COMMIT)
├── transactions_12_2025.json
├── transactions_11_2025.json
│
├── smart-categories.json       # AI-generated categories
├── category-analysis.json      # Detailed analysis
├── requisition.json            # Bank connection (DO NOT COMMIT)
│
├── analyze-spending.js         # Analysis script
├── build-smart-categories.js   # Categorization script
├── configure-accounts-ai.js    # Account configuration
├── fetch-historical.js         # One-time fetch
├── fetch-weekly.js             # Weekly fetch
├── connect-bank.js             # Bank connection
├── check-requisition.js        # Status check
│
└── GETTING_STARTED.md          # This guide
```

**Files to NEVER commit** (already in .gitignore):
- `.env` - Contains API keys
- `.account-config.json` - Contains your IBANs
- `transactions_*.json` - Contains financial data
- `requisition.json` - Contains account IDs
- `analysis_*.json` - Contains spending summaries

---

## Troubleshooting

### "API credentials invalid"
```bash
# Check your .env file
cat .env

# Make sure:
# 1. No extra spaces around the = sign
# 2. Keys are correct (no typos)
# 3. File is in the project root
```

### "No transactions found"
```bash
# 1. Check requisition status
npm run check-requisition

# 2. Make sure status is "LN" (Linked)
# 3. Complete authorization in browser if needed
```

### "Rate limit exceeded"
```bash
# Wait 1-2 minutes and try again
# GoCardless has rate limits: ~30 requests per minute
```

### "ANTHROPIC_API_KEY not set"
```bash
# Make sure you added it to .env
echo $ANTHROPIC_API_KEY  # Should not be empty

# If empty, add to .env:
echo 'ANTHROPIC_API_KEY=sk-ant-xxxxx' >> .env
```

### "Module not found"
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

---

## Privacy & Security

### What Data is Stored Locally
- ✅ Transaction history (in monthly JSON files)
- ✅ Your personal IBANs (in `.account-config.json`)
- ✅ GoCardless/Anthropic API keys (in `.env`)

### What Data is Sent to External Services

**To GoCardless** (Open Banking API):
- API requests for transaction data
- Your bank authorization (handled by your bank, not us)

**To Anthropic** (AI categorization):
- ❌ NOT sent: IBANs, card numbers, phone numbers, full names
- ✅ SENT (redacted): Merchant names only (e.g., "KAUFLAND", "OMV")
- ✅ SENT: Transaction amounts (for pattern detection)
- ✅ SENT: Transaction month (for seasonality)

**Example of what Anthropic sees**:
```json
{
  "description": "KAUFLAND",     // Merchant name only
  "amount": 125.50,
  "month": 1
}
```

### Security Best Practices

1. **Never commit sensitive files**
   - `.gitignore` already protects them
   - Run `git status` to verify before committing

2. **Backup your data securely**
   ```bash
   # Encrypted backup
   tar -czf backup.tar.gz transactions_*.json .account-config.json
   openssl enc -aes-256-cbc -salt -in backup.tar.gz -out backup.tar.gz.enc
   rm backup.tar.gz
   ```

3. **Rotate API keys regularly**
   - GoCardless: Generate new keys every 6 months
   - Anthropic: Rotate keys quarterly

4. **Use sandbox mode for testing**
   - Set `GOCARDLESS_ENVIRONMENT=sandbox` in `.env`
   - Switch to `production` only when ready

---

## Cost Estimates

### GoCardless Bank Account Data API
- **Free tier**: 100 API calls per day
- **Personal use**: ~5-10 API calls per week
- **Cost**: $0/month for personal use

### Anthropic API (Claude)
- **Categorization**: ~$0.01-0.05 per run (200 transactions)
- **Account configuration**: ~$0.02 per run (one-time)
- **Monthly cost**: ~$0.10-0.50

**Total**: ~$0.50/month or less for personal use

---

## Next Steps

Now that you're set up:

1. ✅ Review your first spending report
2. ✅ Check `smart-categories.json` - are the categories accurate?
3. ✅ Set up weekly automation (optional)
4. ✅ Try conversational queries with Claude Code

**Questions or issues?**
- Check `SECURITY.md` for privacy details
- Check `CODE_IMPROVEMENTS.md` for enhancement ideas
- Check `CRITICAL_PRIVACY_FIXES.md` for security audit results

---

**Happy financial tracking!** 💰📊
