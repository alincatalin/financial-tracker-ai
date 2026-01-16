# Account Configuration Guide

## Overview

The account configuration system helps identify internal transfers, personal accounts, and spending patterns to provide accurate financial analysis. Two configuration methods are available:

1. **Claude Code Integration** (Recommended) - Interactive UI with AskUserQuestion
2. **Terminal Mode** - Traditional command-line interface

## Quick Start

### Using Claude Code (Recommended)

When running in Claude Code, simply ask:

```
User: "run configure-accounts"
```

Claude will:
1. Run AI analysis on your transactions
2. Present configuration questions using the native Claude Code UI
3. Save your preferences to `.account-config.json`

### Using Terminal

```bash
npm run configure-accounts
```

The script will detect terminal mode and use readline for input.

## How It Works

### 1. AI Analysis Phase

The script analyzes your transaction history to detect:

- **Name patterns** - Recurring names in transfers that might be yours
- **Round-up transactions** - Small automatic savings transfers
- **Internal transfer patterns** - Transfers between your own accounts
- **Employer patterns** - Companies that pay you regularly

**Privacy Protection:**
- Personal names are redacted to first 3 characters before AI analysis
- IBANs are replaced with `RO**IBAN**REDACTED`
- Long numbers are replaced with `[NUMBER_REDACTED]`

### 2. Configuration Questions

Based on the analysis, you'll be asked:

1. **Name Pattern Confirmation**
   - "I noticed transfers involving the name 'X'. Is this your name?"
   - Helps identify self-transfers between your accounts

2. **Round-up Transactions**
   - "Should 'Round-up Transaction' transfers be excluded from expenses?"
   - These are usually automatic savings

3. **Internal Transfer Handling**
   - "How should transfers between your own accounts be handled?"
   - Options: Exclude from income/expenses, Count as expenses, Count as savings

4. **IBAN Configuration** (Optional)
   - "Would you like to add your personal account IBANs?"
   - Stored locally only, never sent to external services

### 3. Configuration Output

Your preferences are saved to `.account-config.json`:

```json
{
  "version": "1.0",
  "createdAt": "2026-01-15T09:45:00.000Z",
  "personalIbans": [],
  "namePatterns": [
    "Your Name Here"
  ],
  "employerPatterns": [
    "Your Employer SRL"
  ],
  "transferRules": {
    "roundUpTransactions": "exclude",
    "internalTransfers": "exclude",
    "savingsDeposits": "exclude",
    "salaryTracking": "separate"
  },
  "notes": {
    "configured": "AI-assisted configuration via Claude Code",
    "nameDetected": "...",
    "employerDetected": "...",
    "roundUpsDetected": true
  }
}
```

## Files

### configure-accounts-ai.js
Main script that supports both terminal and Claude Code modes. Automatically detects the environment.

### configure-accounts-claude.js
Helper module with functions that can be called programmatically from Claude Code:
- `runAnalysis()` - Run AI analysis and return detected patterns
- `processClaudeAnswers()` - Convert answers to configuration
- `saveConfiguration()` - Save config to file

## Environment Detection

The script detects Claude Code by checking:
```javascript
process.env.CLAUDE_CODE === 'true'
process.env.CLAUDE_MCP === 'true'
process.env.MCP_SERVER === 'true'
```

## Integration with Analysis

Once configured, the settings are used by:

- `analyze-spending.js` - Excludes internal transfers, tracks salary separately
- `build-smart-categories.js` - Uses patterns for better categorization
- `report_generator.py` - Applies rules when generating reports

## Benefits

**Before Configuration:**
- Internal transfers counted as expenses
- Savings appear as spending
- Inaccurate savings rate

**After Configuration:**
- Internal transfers excluded
- Salary tracked separately
- Accurate expense and savings calculations

## Example Impact

Real example from user's data:

**Before:**
- Total expenses: 12,450 RON
- Savings rate: 8.5%

**After:**
- Total expenses: 6,200 RON (excluding 6,250 RON internal transfers)
- Savings rate: 52.3%

## Re-running Configuration

You can re-run configuration anytime to update your preferences:

```bash
npm run configure-accounts
```

Or in Claude Code:
```
User: "run configure-accounts"
```

The script will overwrite `.account-config.json` with new settings.

## Privacy & Security

- Configuration file is `.gitignore`d by default
- Personal data never leaves your machine except during AI analysis (with redaction)
- IBANs stored locally only
- AI analysis uses redacted data only

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
Set your API key:
```bash
export ANTHROPIC_API_KEY=your_key_here
```

### "No transactions found"
Run historical fetch first:
```bash
npm run fetch-historical
```

### Script waits for input in Claude Code
This is the old behavior. The improved script should detect Claude Code automatically. If you see this, the environment detection may need adjustment.

## Technical Details

### Claude Code Integration

When Claude Code calls the script, it:

1. Detects Claude Code environment
2. Runs AI analysis
3. Outputs questions in structured format
4. Claude reads the output and uses AskUserQuestion tool
5. Claude calls `configure-accounts-claude.js` functions to process answers
6. Configuration is saved

This provides a seamless UI experience instead of terminal prompts.

### Terminal Mode

In terminal mode:
1. Uses readline for interactive prompts
2. Questions asked one at a time
3. Manual IBAN entry with loop
4. Configuration saved automatically

## Future Improvements

Planned enhancements:
- [ ] Direct IBAN input in Claude Code mode
- [ ] Validation of IBAN format
- [ ] Import/export configuration
- [ ] Multi-account support
- [ ] Merchant categorization suggestions
