# Smart Transaction Categorization

## Overview

This system uses Claude AI to analyze your actual transaction history and build improved categorization logic based on the patterns it discovers in your spending.

## The Problem

The current keyword-based categorization is rigid:
- Many transactions end up in "Other"
- Misses merchant variations and Romanian-specific names
- Can't adapt to your changing spending patterns
- Fixed keywords don't cover all cases

## The Solution

`build-smart-categories.js` uses Claude to:
1. Analyze your actual transaction descriptions
2. Identify spending patterns and merchant names you use
3. Generate comprehensive keyword lists for each category
4. Create new categories if needed based on your spending
5. Output optimized categorization code

## Setup

1. **Set your Anthropic API key:**
   ```bash
   export ANTHROPIC_API_KEY=your_api_key_here
   ```

2. **Make sure you have transaction data:**
   ```bash
   # Run analysis first to generate transaction data
   node analyze-spending.js
   ```

## Usage

### Step 1: Generate Smart Categories

```bash
node build-smart-categories.js
```

This will:
- Analyze up to 200 of your recent transactions
- Use Claude to build improved categorization logic
- Generate `smart-categories.js` with the new code
- Save full analysis to `category-analysis.json`

### Step 2: Review Generated Categories

Open `smart-categories.js` to see:
- New category definitions
- Comprehensive keyword lists based on your actual merchants
- AI's improvements and reasoning

### Step 3: Integrate into Your Analysis

Update `analyze-spending.js` to use the smart categories:

```javascript
// Replace the old categorizeTransaction function with:
import { categorizeTransaction } from './smart-categories.js';

// Or keep both and compare:
import { categorizeTransaction as smartCategorize } from './smart-categories.js';

// In analyzeTransactions function:
tx.smartCategory = smartCategorize(tx);  // AI-generated
tx.category = categorizeTransaction(tx);  // Original
```

### Step 4: Re-run Analysis

```bash
node analyze-spending.js
```

Now your transactions will be categorized using the AI-learned patterns!

## When to Re-run

Re-run `build-smart-categories.js` when:
- You have new types of merchants/transactions
- Categories seem inaccurate
- Your spending patterns change
- You want to improve accuracy periodically (e.g., monthly)

## Output Files

| File | Description |
|------|-------------|
| `smart-categories.js` | Generated categorization code (ready to import) |
| `category-analysis.json` | Full AI analysis with statistics and improvements |

## Example Output

```javascript
{
  "categories": {
    "Groceries": {
      "keywords": ["kaufland", "lidl", "carrefour", "mega image", "profi",
                   "auchan", "penny", "cora", "supermarket"],
      "description": "Supermarkets and grocery stores",
      "examples": ["Kaufland Romania", "Lidl Discount", "Mega Image"]
    },
    "Transport": {
      "keywords": ["uber", "bolt", "taxi", "metrorex", "stib", "ratb",
                   "parking", "benzinarie", "petrom", "omv"],
      "description": "Transportation including rideshare, public transit, fuel",
      "examples": ["Uber BV", "Bolt Operations", "Petrom"]
    }
  }
}
```

## Benefits

✅ **Adaptive:** Learns from YOUR actual transactions
✅ **Comprehensive:** Discovers merchant name variations
✅ **Romanian-aware:** Understands local merchant names
✅ **Updatable:** Re-run anytime to improve
✅ **Transparent:** See exactly what keywords were learned
✅ **Flexible:** Review and edit generated categories

## Tips

- **Sample size:** By default analyzes 200 transactions. Edit `sampleSize` in the script for more/less
- **Manual tweaks:** Edit `smart-categories.js` after generation to fine-tune
- **Version control:** Commit generated files to track how categories evolve
- **Compare results:** Keep both old and new categorization to compare accuracy

## Troubleshooting

**"No transaction data found"**
- Run `node analyze-spending.js` first to generate `analysis-output.json`

**"ANTHROPIC_API_KEY not set"**
- Set the environment variable: `export ANTHROPIC_API_KEY=your_key`

**Categories seem off**
- Review `category-analysis.json` to see AI's reasoning
- Manually edit keywords in `smart-categories.js`
- Re-run with more transactions for better patterns

## Cost Estimate

- Uses Claude Sonnet 4
- Typical cost: ~$0.10-0.30 per run
- Analyzes 200 transactions by default
- Worth it for significantly better categorization!
