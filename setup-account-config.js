#!/usr/bin/env node

/**
 * Account Configuration Setup
 *
 * This script analyzes your transactions and helps you configure:
 * 1. Which accounts are yours (to exclude internal transfers)
 * 2. Your name patterns (to identify personal transfers)
 * 3. How to handle different types of transfers
 *
 * Run this once during initial setup, or anytime you add new accounts.
 */

const fs = require('fs');
const path = require('path');
const { loadJSONFile } = require('./lib/file-utils');

// Load all transactions to analyze patterns
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

// Extract unique account patterns from transactions
function analyzeAccountPatterns(transactions) {
  const accounts = new Set();
  const names = new Set();
  const transferPatterns = [];

  for (const tx of transactions) {
    const type = tx.proprietaryBankTransactionCode || '';
    const creditorIban = tx.creditorAccount?.iban;
    const debtorIban = tx.debtorAccount?.iban;
    const creditorName = tx.creditorName;
    const debtorName = tx.debtorName;

    // Collect IBANs
    if (creditorIban) accounts.add(creditorIban);
    if (debtorIban) accounts.add(debtorIban);

    // Collect names
    if (creditorName) names.add(creditorName);
    if (debtorName) names.add(debtorName);

    // Collect transfer patterns
    if (type.includes('Transfer') || type === 'Incoming funds') {
      transferPatterns.push({
        type,
        from: debtorName || debtorIban || 'Unknown',
        to: creditorName || creditorIban || 'Unknown',
        amount: parseFloat(tx.transactionAmount?.amount || 0),
        description: tx.remittanceInformationUnstructured || ''
      });
    }
  }

  return {
    accounts: Array.from(accounts),
    names: Array.from(names),
    transferPatterns: transferPatterns.slice(0, 50) // Sample
  };
}

// Interactive configuration
async function runConfiguration() {
  console.log('\n');
  console.log('='.repeat(70));
  console.log('                  ACCOUNT CONFIGURATION SETUP');
  console.log('='.repeat(70));
  console.log('\n');

  // Check if transaction files exist
  const transactionFiles = fs.readdirSync('.')
    .filter(f => f.match(/^transactions_\d{2}_\d{4}\.json$/));

  if (transactionFiles.length === 0) {
    console.error('❌ No transaction files found.');
    console.error('Please run "npm run fetch-historical" first.\n');
    process.exit(1);
  }

  console.log('📊 Analyzing your transactions...\n');

  const transactions = loadAllTransactions();
  const patterns = analyzeAccountPatterns(transactions);

  console.log(`Found ${transactions.length} transactions`);
  console.log(`Identified ${patterns.accounts.length} unique IBANs`);
  console.log(`Identified ${patterns.names.length} unique names`);
  console.log(`Found ${patterns.transferPatterns.length} transfer transactions\n`);

  console.log('='.repeat(70));
  console.log('STEP 1: Identify Your Personal Accounts');
  console.log('='.repeat(70));
  console.log('\n');
  console.log('I found these IBANs in your transactions:');
  console.log('');

  patterns.accounts.forEach((iban, index) => {
    console.log(`${index + 1}. ${iban}`);
  });

  console.log('\n');
  console.log('⚠️  IMPORTANT: Your account IBANs should be stored securely.');
  console.log('This configuration will be saved in ".account-config.json" (gitignored).\n');

  console.log('='.repeat(70));
  console.log('STEP 2: Identify Your Name Patterns');
  console.log('='.repeat(70));
  console.log('\n');
  console.log('I found these names in transfer transactions:');
  console.log('');

  patterns.names.forEach((name, index) => {
    console.log(`${index + 1}. ${name}`);
  });

  console.log('\n');
  console.log('='.repeat(70));
  console.log('STEP 3: Sample Transfer Patterns');
  console.log('='.repeat(70));
  console.log('\n');
  console.log('Here are some transfer transactions I found:\n');

  patterns.transferPatterns.slice(0, 10).forEach((pattern, index) => {
    console.log(`${index + 1}. ${pattern.type}`);
    console.log(`   From: ${pattern.from}`);
    console.log(`   To: ${pattern.to}`);
    console.log(`   Amount: ${pattern.amount} RON`);
    console.log('');
  });

  console.log('='.repeat(70));
  console.log('NEXT STEPS');
  console.log('='.repeat(70));
  console.log('\n');
  console.log('I need to create a configuration file to identify:');
  console.log('  1. Your personal IBANs (to exclude internal transfers)');
  console.log('  2. Your name patterns (to identify self-transfers)');
  console.log('  3. Round-up/savings rules');
  console.log('\n');
  console.log('⚠️  This script has identified patterns but needs your confirmation.');
  console.log('For security, I will NOT auto-configure without your explicit input.\n');
  console.log('Please review the patterns above and create ".account-config.json":');
  console.log('');
  console.log('Example structure:');
  console.log(JSON.stringify({
    version: '1.0',
    personalIbans: [
      'RO##XXXX################',  // Your main account
      'RO##XXXX################'   // Your savings account
    ],
    namePatterns: [
      'Your Full Name',
      'Nickname or Variation'
    ],
    transferRules: {
      roundUpTransactions: 'exclude',  // Don't count as expenses
      internalTransfers: 'exclude',    // Between your own accounts
      savingsDeposits: 'exclude'       // Transfers to savings
    }
  }, null, 2));
  console.log('\n');
  console.log('Or use the AI-assisted configuration (recommended):');
  console.log('  Run: npm run configure-accounts\n');
}

runConfiguration().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
