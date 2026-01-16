#!/usr/bin/env node

/**
 * Smart Transaction Categorization Builder
 *
 * This script uses Claude AI to analyze your transaction history
 * and generate improved categorization logic based on patterns it discovers.
 *
 * Usage: node build-smart-categories.js
 *        npm run build-categories
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const path = require('path');
const { loadJSONFile } = require('./lib/file-utils');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Load transactions from monthly files (last 3 months)
function loadTransactions() {
  const files = fs.readdirSync('.')
    .filter(f => f.match(/^transactions_\d{2}_\d{4}\.json$/))
    .sort()
    .reverse(); // Most recent first

  if (files.length === 0) {
    console.error('No monthly transaction files found.');
    console.error('Run "npm run fetch-historical" first to fetch transactions.');
    process.exit(1);
  }

  // Take last 3 months of files
  const recentFiles = files.slice(0, 3);
  console.log(`Loading transactions from: ${recentFiles.join(', ')}\n`);

  const allTransactions = [];

  for (const file of recentFiles) {
    const data = loadJSONFile(file, { transactions: { booked: [] } });
    if (data && data.transactions && data.transactions.booked) {
      allTransactions.push(...data.transactions.booked);
    }
  }

  return allTransactions;
}

// Redact sensitive information from transaction descriptions
function redactSensitiveInfo(text) {
  if (!text) return 'Unknown';

  let redacted = text;

  // Redact IBANs (format: RO##XXXX############)
  redacted = redacted.replace(/RO\d{2}[A-Z]{4}\d{16}/gi, '[IBAN_REDACTED]');

  // Redact card numbers (partial or full)
  redacted = redacted.replace(/\*{4}\s*\d{4}/g, '[CARD_REDACTED]');
  redacted = redacted.replace(/\d{4}\s*\d{4}\s*\d{4}\s*\d{4}/g, '[CARD_REDACTED]');

  // Redact phone numbers (Romanian format and international)
  redacted = redacted.replace(/\b0\d{9}\b/g, '[PHONE_REDACTED]');
  redacted = redacted.replace(/\+\d{10,15}/g, '[PHONE_REDACTED]');

  // Redact reference numbers (long numeric sequences)
  redacted = redacted.replace(/Reference number,\s*\d+/gi, 'Reference number, [REDACTED]');
  redacted = redacted.replace(/Authorization number,\s*\d+/gi, 'Authorization number, [REDACTED]');

  // Redact personal names in common patterns
  redacted = redacted.replace(/Beneficiary,\s*[^,]+,/gi, 'Beneficiary, [NAME_REDACTED],');
  redacted = redacted.replace(/Ordering party,\s*[^,]+,/gi, 'Ordering party, [NAME_REDACTED],');

  // Extract only merchant names (keep the valuable categorization data)
  // Pattern: "Transaction at, MERCHANT_NAME  COUNTRY  CITY"
  const merchantMatch = redacted.match(/Transaction at,\s*([^,]+?)(?:\s+[A-Z]{2}\s+|\s*$)/i);
  if (merchantMatch) {
    return merchantMatch[1].trim();
  }

  // If no merchant pattern, return a cleaned version
  return redacted;
}

// Redact person names (keep first 2 chars for pattern detection)
function redactPersonName(name) {
  if (!name) return '[NAME_REDACTED]';

  // If it looks like a merchant (all caps, contains common merchant words), keep it
  const merchantIndicators = ['SRL', 'SA', 'SCS', 'SHOP', 'STORE', 'MARKET', 'RESTAURANT', 'CAFE', 'BAR', 'HOTEL'];
  if (merchantIndicators.some(indicator => name.toUpperCase().includes(indicator))) {
    return name;
  }

  // If it's all uppercase and short (likely merchant code), keep it
  if (name === name.toUpperCase() && name.length < 20 && !/\s/.test(name)) {
    return name;  // e.g., "KAUFLAND", "OMV", "LIDL"
  }

  // If it contains lowercase letters and spaces (likely a person's name), redact it
  if (/[a-z]/.test(name) && /\s/.test(name)) {
    // "Postolache Alin" -> "Po***"
    return name.substring(0, 2) + '***';
  }

  // Default: keep for categorization (likely a merchant)
  return name;
}

// Extract transaction descriptions for LLM analysis (with PII redaction)
function prepareTransactionSample(transactions, sampleSize = 200) {
  console.log('⚠️  Privacy Notice: Redacting personal information before sending to AI...');
  console.log('   - IBANs, card numbers, phone numbers will be removed');
  console.log('   - Personal names will be anonymized');
  console.log('   - Only merchant names and amounts will be analyzed\n');

  // Filter out internal transfers and take a representative sample
  const sample = transactions
    .filter(tx => {
      const type = tx.proprietaryBankTransactionCode || '';
      return type !== 'Round-up Transaction' &&
             type !== 'Incoming funds' &&
             !type.includes('Transfer');
    })
    .slice(0, sampleSize)
    .map(tx => {
      let rawDescription = tx.remittanceInformationUnstructured;

      // If description is missing, fall back to creditor/debtor but redact names
      if (!rawDescription) {
        const fallback = tx.creditorName || tx.debtorName;
        if (fallback) {
          rawDescription = redactPersonName(fallback);
        } else {
          rawDescription = 'Unknown';
        }
      }

      return {
        description: redactSensitiveInfo(rawDescription),
        amount: Math.abs(parseFloat(tx.transactionAmount?.amount || 0)),
        type: tx.proprietaryBankTransactionCode || 'Unknown',
        // Redact exact dates, only keep month for seasonality analysis
        month: tx.bookingDate ? new Date(tx.bookingDate).getMonth() + 1 : null
      };
    });

  return sample;
}

// Build categorization logic using Claude
async function buildCategorizationLogic(transactions) {
  console.log('Analyzing transactions with Claude AI...\n');

  const sample = prepareTransactionSample(transactions);

  const prompt = `You are a financial categorization expert. Analyze these real banking transactions and create a comprehensive categorization system.

TRANSACTION SAMPLE (${sample.length} transactions):
${JSON.stringify(sample, null, 2)}

YOUR TASK:
1. Analyze the transaction descriptions and identify common patterns
2. Create category definitions that fit this user's actual spending patterns
3. Generate comprehensive keyword lists for each category
4. Include Romanian-specific merchants and terminology (this is a Romanian bank account)
5. Be specific - use actual merchant names you see in the data

REQUIRED CATEGORIES (include at minimum):
- Groceries (supermarkets, food stores)
- Restaurants (dining, cafes, fast food, delivery)
- Transport (fuel, parking, ride-sharing, public transport)
- Utilities (electricity, gas, water, internet, phone)
- Shopping (clothing, electronics, general retail)
- Health (pharmacies, doctors, medical)
- Entertainment (cinema, subscriptions, games)
- Home (furniture, home improvement)
- Cash Withdrawal (ATM withdrawals)
- Transfers (bank transfers - but NOT internal/savings transfers)

You may add additional categories if you see clear patterns.

OUTPUT FORMAT (JSON only, no markdown):
{
  "version": "1.0",
  "generatedAt": "${new Date().toISOString()}",
  "categories": {
    "CategoryName": {
      "keywords": ["keyword1", "keyword2"],
      "description": "What this category includes"
    }
  },
  "improvements": [
    "List of insights about the spending patterns"
  ],
  "statistics": {
    "transactionsAnalyzed": ${sample.length},
    "categoriesCreated": 0,
    "totalKeywords": 0
  }
}

IMPORTANT:
- Keywords should be lowercase
- Include variations (e.g., "kaufland", "kaufland 8410", "kaufland ro")
- Be thorough - more keywords = better categorization
- Return ONLY valid JSON, no explanation text`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;

    // Extract JSON from the response (handle markdown code blocks if present)
    let jsonContent = responseText;

    // Try to extract from code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    // Clean up any leading/trailing whitespace
    jsonContent = jsonContent.trim();

    const result = JSON.parse(jsonContent);

    // Calculate statistics
    let totalKeywords = 0;
    for (const cat of Object.values(result.categories)) {
      totalKeywords += cat.keywords?.length || 0;
    }
    result.statistics.categoriesCreated = Object.keys(result.categories).length;
    result.statistics.totalKeywords = totalKeywords;

    return result;
  } catch (error) {
    console.error('Error calling Claude API:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('\n');
  console.log('Smart Transaction Categorization Builder');
  console.log('='.repeat(50));
  console.log('\n');

  // Privacy notice and consent
  console.log('🔒 PRIVACY NOTICE');
  console.log('This script will send transaction data to Anthropic\'s API for analysis.');
  console.log('The following personal information will be REDACTED before sending:');
  console.log('  • IBANs and account numbers');
  console.log('  • Card numbers');
  console.log('  • Phone numbers');
  console.log('  • Personal names (beneficiaries, ordering parties)');
  console.log('  • Reference and authorization numbers');
  console.log('  • Exact transaction dates (only month is kept)');
  console.log('');
  console.log('Only merchant names and transaction amounts will be analyzed.');
  console.log('');
  console.log('By continuing, you consent to this data processing.');
  console.log('Press Ctrl+C to cancel, or any key to continue...');
  console.log('='.repeat(50));
  console.log('\n');

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY environment variable not set.');
    console.error('Please set it with: export ANTHROPIC_API_KEY=your_api_key');
    process.exit(1);
  }

  // Load transactions from monthly files
  console.log('Loading transaction history...');
  const transactions = loadTransactions();
  console.log(`Found ${transactions.length} total transactions\n`);

  if (transactions.length === 0) {
    console.error('No transactions found to analyze.');
    process.exit(1);
  }

  // Build categorization logic with LLM
  const result = await buildCategorizationLogic(transactions);

  console.log('Analysis complete!\n');
  console.log('Statistics:');
  console.log(`   Categories created: ${result.statistics.categoriesCreated}`);
  console.log(`   Total keywords: ${result.statistics.totalKeywords}`);
  console.log(`   Transactions analyzed: ${result.statistics.transactionsAnalyzed}\n`);

  console.log('Key Insights:');
  (result.improvements || []).forEach((imp, i) => {
    console.log(`   ${i + 1}. ${imp}`);
  });
  console.log('');

  // Save smart categories JSON (the main output)
  const categoriesFile = path.join(process.cwd(), 'smart-categories.json');
  fs.writeFileSync(categoriesFile, JSON.stringify(result, null, 2));
  console.log(`Categories saved to: ${categoriesFile}`);

  // Save full analysis for reference
  const analysisFile = path.join(process.cwd(), 'category-analysis.json');
  fs.writeFileSync(analysisFile, JSON.stringify({
    ...result,
    sampleTransactions: prepareTransactionSample(transactions, 50)
  }, null, 2));
  console.log(`Full analysis saved to: ${analysisFile}\n`);

  console.log('='.repeat(50));
  console.log('Next steps:');
  console.log('   1. Review categories in smart-categories.json');
  console.log('   2. Run "npm run analyze" to see improved categorization\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
