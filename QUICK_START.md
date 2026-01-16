# Quick Start Guide - Financial Transaction Analysis

## First Time Setup

### 1. Connect Your Bank Account

```bash
npm run connect-bank
```

Follow the link to authorize GoCardless access to your bank via Open Banking (PSD2).

### 2. Fetch Historical Data

```bash
npm run fetch-historical
```

Downloads last 3 months of transactions and saves to `transactions_MM_YYYY.json` files.

### 3. Configure Your Account

**Option A: Using Claude Code (Recommended)**
```
User: "run configure-accounts"
```

**Option B: Using Terminal**
```bash
npm run configure-accounts
```

Answer the AI-generated questions to set up internal transfer detection.

### 4. Build Smart Categories

```bash
npm run build-categories
```

AI analyzes your spending patterns and creates personalized categories in `smart-categories.json`.

### 5. Generate Analysis

```bash
npm run analyze
```

View your spending analysis with accurate categorization.

## Weekly Routine

### Update Transactions

```bash
npm run fetch-weekly
```

Fetches last 7 days of transactions and appends to monthly files (deduplicates automatically).

### View Analysis

```bash
npm run analyze [month] [year]
```

Examples:
- `npm run analyze` - Current month
- `npm run analyze january 2026` - Specific month
- `npm run analyze december 2025` - Previous month

## Using with Claude Code

### Ask Questions

```
User: "How much did I spend on groceries last month?"
User: "What's my savings rate for January?"
User: "Show me my biggest expenses this week"
User: "Compare my December and January spending"
```

Claude will:
1. Fetch your latest transactions if needed
2. Analyze using smart categories
3. Calculate accurate metrics (excluding internal transfers)
4. Provide clear answers

### Reconfigure

```
User: "run configure-accounts"
```

Claude will use the interactive UI to update your settings.

### Rebuild Categories

```
User: "run build-categories"
```

Useful when you have new merchants or spending patterns.

## File Structure

```
ego/
├── transactions_01_2026.json       # January 2026 transactions
├── transactions_12_2025.json       # December 2025 transactions
├── smart-categories.json           # AI-generated categories (reusable)
├── category-analysis.json          # Full AI analysis with reasoning
├── .account-config.json            # Your personal configuration (gitignored)
├── requisition.json                # Bank connection info (gitignored)
└── .env                            # API keys (gitignored)
```

## Key Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run connect-bank` | Connect to bank via GoCardless | One-time setup |
| `npm run fetch-historical` | Get last 3 months | Initial setup |
| `npm run fetch-weekly` | Get last 7 days | Weekly update |
| `npm run configure-accounts` | Set up personal accounts | Initial setup, when patterns change |
| `npm run build-categories` | Generate smart categories | Monthly, when new merchants appear |
| `npm run analyze [month] [year]` | View spending analysis | Anytime |

## Understanding Your Results

### Categories

Your transactions are automatically categorized:

- **Groceries** - Kaufland, Lidl, Auchan, etc.
- **Restaurants** - Dining, cafes, food delivery
- **Transport** - Uber, fuel, parking
- **Utilities** - Electricity, internet, mobile
- **Shopping** - Clothing, electronics, books
- **Entertainment** - Subscriptions, tickets, activities
- **And more...**

### Metrics

- **Total Income** - Money received (salary, transfers in)
- **Total Expenses** - Money spent (excluding internal transfers)
- **Savings** - Money transferred to savings accounts
- **Savings Rate** - Percentage of income saved
- **Category Breakdown** - Spending per category

### Exclusions

Based on your configuration, these are automatically excluded:

- Internal transfers between your accounts
- Round-up savings transactions
- Transfers to your personal IBANs
- Payments from yourself to yourself

## Troubleshooting

### "ANTHROPIC_API_KEY not set"

```bash
export ANTHROPIC_API_KEY=your_key_here
# Or add to .env file:
echo "ANTHROPIC_API_KEY=your_key_here" >> .env
```

### "No transactions found"

Run historical fetch first:
```bash
npm run fetch-historical
```

### Categories seem wrong

Rebuild them:
```bash
npm run build-categories
```

This will regenerate categories based on your actual spending patterns.

### Savings rate seems too low

Run configuration:
```bash
npm run configure-accounts
```

Make sure internal transfers are excluded.

### Duplicate transactions

The system automatically deduplicates using `internalTransactionId`. If you see duplicates in analysis, they're likely different transactions with similar amounts/dates.

## Privacy & Security

✅ **Local Storage** - All data stored on your machine
✅ **Gitignored Secrets** - API keys, IBANs never committed
✅ **Redacted AI Requests** - Personal data redacted before API calls
✅ **No Third-Party Sharing** - Data only between you, your bank (via GoCardless), and Anthropic AI (redacted)

## Next Steps

1. ✅ Complete first-time setup above
2. ✅ Review your first analysis
3. ✅ Adjust categories if needed
4. ✅ Set up weekly fetch routine (cron/reminder)
5. ✅ Use Claude Code for natural language queries

## Getting Help

- Check `CONFIGURATION_GUIDE.md` for detailed configuration docs
- Check `CLAUDE_CODE_IMPROVEMENTS.md` for technical details
- Check `GETTING_STARTED.md` for comprehensive setup guide
- Ask Claude: "Help me understand my spending analysis"
