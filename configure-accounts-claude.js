#!/usr/bin/env node

/**
 * Claude Code Wrapper for Account Configuration
 *
 * This script is designed to be called by Claude Code with user responses.
 * It handles the configuration without requiring interactive terminal input.
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const { loadJSONFile } = require('./lib/file-utils');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Load all transactions
function loadAllTransactions() {
  const files = fs.readdirSync('.')
    .filter(f => f.match(/^transactions_\d{2}_\d{4}\.json$/))
    .sort();

  const allTransactions = [];
  for (const file of files) {
    const data = loadJSONFile(file, { transactions: { booked: [] } });
    if (data && data.transactions && data.transactions.booked) {
      allTransactions.push(...data.transactions.booked);
    }
  }
  return allTransactions;
}

// Redact PII from sample for AI analysis
function redactForAI(text) {
  if (!text) return 'Unknown';
  return text
    .replace(/RO\d{2}[A-Z]{4}\d{16}/gi, 'RO**IBAN**REDACTED')
    .replace(/\d{10,}/g, '[NUMBER_REDACTED]');
}

// Redact personal names but keep patterns for AI analysis
function redactName(name) {
  if (!name || name === 'N/A') return 'N/A';
  if (name.length <= 3) return '***';
  return name.substring(0, 3) + '***';
}

// Prepare redacted sample of transfers for AI
function prepareTransferSample(transactions) {
  const transfers = transactions
    .filter(tx => {
      const type = tx.proprietaryBankTransactionCode || '';
      return type.includes('Transfer') || type === 'Incoming funds' || type === 'Round-up Transaction';
    })
    .slice(0, 30)
    .map(tx => ({
      type: tx.proprietaryBankTransactionCode,
      amount: parseFloat(tx.transactionAmount?.amount || 0),
      creditorName: redactName(tx.creditorName),
      debtorName: redactName(tx.debtorName),
      description: redactForAI(tx.remittanceInformationUnstructured || ''),
      hasCreditorIban: !!tx.creditorAccount?.iban,
      hasDebtorIban: !!tx.debtorAccount?.iban
    }));

  return transfers;
}

// Ask Claude to analyze patterns and generate questions
async function analyzeWithAI(transactions) {
  const transferSample = prepareTransferSample(transactions);

  const prompt = `You are a financial assistant helping a user configure their expense tracking system. Analyze these transfer transactions and help identify:

1. Which transfers are internal (between the user's own accounts)
2. Which should be excluded from expense calculations
3. What rules should be created

TRANSFER SAMPLE (${transferSample.length} transactions):
${JSON.stringify(transferSample, null, 2)}

Based on these patterns, identify:

1. **Recurring name patterns** that suggest self-transfers (same person moving money between accounts)
2. **Round-up transactions** (small amounts going to savings)
3. **Internal account patterns** (transfers where both sender and recipient seem to be the same person)

Generate a JSON configuration with these questions for the user:

{
  "questions": [
    {
      "id": "name_pattern",
      "question": "I noticed transfers involving the name 'X'. Is this your name?",
      "context": "This will help identify transfers between your own accounts",
      "type": "yes_no"
    },
    {
      "id": "round_ups",
      "question": "Should 'Round-up Transaction' transfers be excluded from expenses?",
      "context": "These appear to be automatic savings transfers",
      "type": "yes_no"
    },
    {
      "id": "internal_transfers",
      "question": "How should transfers between your own accounts be handled?",
      "options": ["Exclude from income/expenses", "Count as expenses", "Count as savings"],
      "type": "multiple_choice"
    }
  ],
  "detectedPatterns": {
    "possibleUserNames": ["list of names that appear frequently in transfers"],
    "roundUpDetected": true/false,
    "internalTransferIndicators": ["patterns suggesting self-transfers"]
  }
}

Return ONLY the JSON, no explanations.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse AI response');
  } catch (error) {
    console.error('AI analysis failed:', error.message);
    return null;
  }
}

// Process Claude Code answers
function processClaudeAnswers(aiAnalysis, answers) {
  const config = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    personalIbans: [],
    namePatterns: [],
    employerPatterns: [],
    transferRules: {
      roundUpTransactions: 'exclude',
      internalTransfers: 'exclude',
      savingsDeposits: 'exclude',
      salaryTracking: 'separate'
    },
    notes: {
      configured: 'AI-assisted configuration via Claude Code'
    }
  };

  let questionIndex = 0;

  // Process each AI question
  for (const q of aiAnalysis.questions) {
    const answerKey = `question_${questionIndex}`;
    const answer = answers[answerKey];

    if (q.type === 'yes_no' && answer === 'Yes') {
      if (q.id === 'name_pattern' && aiAnalysis.detectedPatterns.possibleUserNames) {
        config.namePatterns = aiAnalysis.detectedPatterns.possibleUserNames;
        config.notes.nameDetected = aiAnalysis.detectedPatterns.possibleUserNames.join(', ');
      }
      if (q.id === 'round_ups') {
        config.notes.roundUpsDetected = true;
      }
    } else if (q.type === 'multiple_choice') {
      if (q.id === 'internal_transfers') {
        config.transferRules.internalTransfers = answer === 'Exclude from income/expenses' ? 'exclude' : 'include';
      }
    }

    questionIndex++;
  }

  // Process IBAN answer (last question)
  const ibanAnswer = answers[`question_${questionIndex}`];
  if (ibanAnswer === 'Yes') {
    config.notes.ibanConfigRequired = true;
  }

  // Detect employer patterns from detected names
  if (aiAnalysis.detectedPatterns.possibleUserNames) {
    const possibleEmployers = aiAnalysis.detectedPatterns.possibleUserNames.filter(name =>
      name.includes('SRL') || name.includes('SA') || name.includes('LLC')
    );
    if (possibleEmployers.length > 0) {
      config.employerPatterns = possibleEmployers;
      config.notes.employerDetected = possibleEmployers.join(', ');
    }
  }

  return config;
}

// Main function to run analysis and return questions
async function runAnalysis() {
  console.log('🤖 Running AI analysis on transactions...\n');

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  // Load transactions
  const transactions = loadAllTransactions();
  if (transactions.length === 0) {
    throw new Error('No transactions found. Run "npm run fetch-historical" first.');
  }

  console.log(`📊 Loaded ${transactions.length} transactions\n`);

  // AI analysis
  const aiAnalysis = await analyzeWithAI(transactions);
  if (!aiAnalysis) {
    throw new Error('AI analysis failed');
  }

  console.log('✅ AI analysis complete!\n');

  return aiAnalysis;
}

// Save configuration
function saveConfiguration(config) {
  const configPath = '.account-config.json';
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n✅ Configuration saved to: ${configPath}\n`);
  return configPath;
}

// Export functions for use in Claude Code
module.exports = {
  runAnalysis,
  processClaudeAnswers,
  saveConfiguration,
  loadAllTransactions,
  analyzeWithAI
};

// If run directly, just run analysis
if (require.main === module) {
  runAnalysis()
    .then(analysis => {
      console.log('Detected patterns:');
      console.log(JSON.stringify(analysis.detectedPatterns, null, 2));
      console.log('\nQuestions to ask:');
      console.log(JSON.stringify(analysis.questions, null, 2));
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
