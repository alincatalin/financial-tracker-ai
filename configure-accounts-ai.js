#!/usr/bin/env node

/**
 * AI-Powered Account Configuration
 *
 * Uses Claude AI to intelligently ask you about your accounts and
 * create a personalized configuration for handling internal transfers.
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const readline = require('readline');
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
  // Keep enough info for AI to understand patterns, but redact specific numbers
  return text
    .replace(/RO\d{2}[A-Z]{4}\d{16}/gi, 'RO**IBAN**REDACTED')
    .replace(/\d{10,}/g, '[NUMBER_REDACTED]');
}

// Redact personal names but keep patterns for AI analysis
function redactName(name) {
  if (!name || name === 'N/A') return 'N/A';

  // Keep first 3 characters to allow pattern detection, redact the rest
  // e.g., "Postolache Alin Catalin" -> "Pos***"
  // This allows AI to see if same pattern repeats without exposing full name
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
  console.log('🤖 Analyzing your transaction patterns with AI...\n');

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

// Detect if running in Claude Code environment
function isClaudeCode() {
  // Check for Claude Code environment indicators
  return process.env.CLAUDE_CODE === 'true' ||
         process.env.CLAUDE_MCP === 'true' ||
         process.env.MCP_SERVER === 'true';
}

// Interactive Q&A (terminal fallback)
async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question + ' ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Build AskUserQuestion format from AI analysis
function buildClaudeQuestions(aiAnalysis) {
  const questions = [];

  // Convert AI questions to Claude Code format
  for (const q of aiAnalysis.questions) {
    if (q.type === 'yes_no') {
      questions.push({
        question: `${q.question}\n${q.context ? `ℹ️  ${q.context}` : ''}`,
        header: q.id.replace(/_/g, ' '),
        multiSelect: false,
        options: [
          { label: 'Yes', description: 'Confirm this setting' },
          { label: 'No', description: 'Skip this setting' }
        ]
      });
    } else if (q.type === 'multiple_choice') {
      questions.push({
        question: `${q.question}\n${q.context ? `ℹ️  ${q.context}` : ''}`,
        header: q.id.replace(/_/g, ' '),
        multiSelect: false,
        options: q.options.map(opt => ({
          label: opt,
          description: ''
        }))
      });
    }
  }

  // Add IBAN question
  questions.push({
    question: 'Would you like to add your personal account IBANs for internal transfer detection?\n⚠️  This information will be stored LOCALLY in .account-config.json (gitignored).',
    header: 'IBANs',
    multiSelect: false,
    options: [
      { label: 'Yes', description: 'Add IBANs for better transfer detection' },
      { label: 'No', description: 'Skip IBAN configuration' }
    ]
  });

  return questions;
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

  // Process IBAN answer
  const ibanAnswer = answers[`question_${questionIndex}`];
  if (ibanAnswer === 'Yes') {
    config.notes.ibanConfigRequired = true;
    console.log('\n⚠️  IBAN configuration selected but not yet implemented.');
    console.log('You can manually add IBANs to .account-config.json in the "personalIbans" array.\n');
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

// Main configuration flow
async function runAIConfiguration() {
  console.log('\n');
  console.log('='.repeat(70));
  console.log('          AI-POWERED ACCOUNT CONFIGURATION');
  console.log('='.repeat(70));
  console.log('\n');

  // Privacy notice
  console.log('🔒 PRIVACY NOTICE');
  console.log('This script will analyze transaction patterns with AI.');
  console.log('The following data will be REDACTED before sending to Anthropic:');
  console.log('  • Personal names (only first 3 chars kept for pattern matching)');
  console.log('  • IBANs (replaced with RO**IBAN**REDACTED)');
  console.log('  • Long numbers (replaced with [NUMBER_REDACTED])');
  console.log('\nOnly transfer patterns and amounts will be analyzed.');
  console.log('By continuing, you consent to this data processing.');
  console.log('Press Ctrl+C to cancel.\n');
  console.log('='.repeat(70));
  console.log('\n');

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set.');
    console.error('Please set it with: export ANTHROPIC_API_KEY=your_key\n');
    process.exit(1);
  }

  // Load transactions
  const transactions = loadAllTransactions();
  if (transactions.length === 0) {
    console.error('❌ No transactions found. Run "npm run fetch-historical" first.\n');
    process.exit(1);
  }

  console.log(`📊 Loaded ${transactions.length} transactions\n`);

  // AI analysis
  const aiAnalysis = await analyzeWithAI(transactions);
  if (!aiAnalysis) {
    console.error('❌ AI analysis failed. Please try manual configuration.\n');
    process.exit(1);
  }

  console.log('✅ AI analysis complete!\n');
  console.log('='.repeat(70));
  console.log('DETECTED PATTERNS');
  console.log('='.repeat(70));
  console.log('\n');
  console.log(JSON.stringify(aiAnalysis.detectedPatterns, null, 2));
  console.log('\n');

  let config;

  // Check if running in Claude Code
  if (isClaudeCode()) {
    console.log('🤖 Running in Claude Code - using interactive UI\n');
    console.log('Claude will now ask you configuration questions using the UI.\n');

    // Export questions for Claude to use
    const claudeQuestions = buildClaudeQuestions(aiAnalysis);

    // Output for Claude to parse
    console.log('CLAUDE_CODE_QUESTIONS_START');
    console.log(JSON.stringify({
      detectedPatterns: aiAnalysis.detectedPatterns,
      questions: claudeQuestions
    }, null, 2));
    console.log('CLAUDE_CODE_QUESTIONS_END');

    // Note: Claude Code will call this script with answers via process.env or args
    // For now, we'll indicate this mode is available
    console.log('\n⚠️  This script should be called by Claude Code with AskUserQuestion tool.');
    console.log('If you see this message, Claude should use the questions above.\n');

    // Return early - Claude will handle the rest
    return;

  } else {
    // Terminal mode - use readline
    console.log('🖥️  Running in terminal mode - using readline\n');

    // Ask user the questions
    console.log('='.repeat(70));
    console.log('CONFIGURATION QUESTIONS');
    console.log('='.repeat(70));
    console.log('\n');

    config = {
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
        configured: 'Manual terminal configuration'
      }
    };

    // Ask each question
    for (const q of aiAnalysis.questions) {
      console.log(`\n${q.question}`);
      if (q.context) {
        console.log(`ℹ️  ${q.context}`);
      }

      if (q.type === 'yes_no') {
        const answer = await askQuestion('(yes/no)');
        if (answer.toLowerCase().startsWith('y')) {
          if (q.id === 'name_pattern' && aiAnalysis.detectedPatterns.possibleUserNames) {
            config.namePatterns = aiAnalysis.detectedPatterns.possibleUserNames;
            config.notes.nameDetected = aiAnalysis.detectedPatterns.possibleUserNames.join(', ');
          }
          if (q.id === 'round_ups') {
            config.notes.roundUpsDetected = true;
          }
        }
      } else if (q.type === 'multiple_choice') {
        console.log('Options:');
        q.options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
        const answer = await askQuestion('Enter number');
        const choice = q.options[parseInt(answer) - 1];
        if (q.id === 'internal_transfers') {
          config.transferRules.internalTransfers = choice === 'Exclude from income/expenses' ? 'exclude' : 'include';
        }
      }
    }

    // Detect employer patterns
    if (aiAnalysis.detectedPatterns.possibleUserNames) {
      const possibleEmployers = aiAnalysis.detectedPatterns.possibleUserNames.filter(name =>
        name.includes('SRL') || name.includes('SA') || name.includes('LLC')
      );
      if (possibleEmployers.length > 0) {
        config.employerPatterns = possibleEmployers;
        config.notes.employerDetected = possibleEmployers.join(', ');
      }
    }

    // Ask about specific IBANs (securely)
    console.log('\n');
    console.log('='.repeat(70));
    console.log('ACCOUNT IDENTIFICATION (SECURE)');
    console.log('='.repeat(70));
    console.log('\n');
    console.log('To properly identify internal transfers, I need to know which IBANs are yours.');
    console.log('⚠️  This information will be stored LOCALLY in .account-config.json (gitignored).\n');

    const addAccount = await askQuestion('Would you like to add your account IBANs? (yes/no)');
    if (addAccount.toLowerCase().startsWith('y')) {
      console.log('\nEnter your IBANs (one per line, press Enter on empty line to finish):');
      while (true) {
        const iban = await askQuestion('IBAN');
        if (!iban) break;
        config.personalIbans.push(iban.trim());
      }
    }
  }

  // Save configuration
  const configPath = '.account-config.json';
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log('\n');
  console.log('='.repeat(70));
  console.log('✅ CONFIGURATION COMPLETE');
  console.log('='.repeat(70));
  console.log('\n');
  console.log(`Configuration saved to: ${configPath}`);
  console.log('\nYour settings:');
  console.log(`  - Name patterns: ${config.namePatterns.length} configured`);
  console.log(`  - Personal IBANs: ${config.personalIbans.length} configured`);
  console.log(`  - Round-up transactions: ${config.transferRules.roundUpTransactions}`);
  console.log(`  - Internal transfers: ${config.transferRules.internalTransfers}`);
  console.log('\n');
  console.log('You can now run: npm run analyze\n');
}

runAIConfiguration().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
