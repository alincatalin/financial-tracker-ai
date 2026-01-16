require('dotenv').config();
const fs = require('fs');
const { loadJSONFile } = require('./lib/file-utils');

// Default categories (fallback if smart-categories.json doesn't exist)
// These are generic keywords - the AI will learn your specific merchants
const DEFAULT_CATEGORIES = {
  'Utilities': { keywords: ['utilities', 'electric', 'power', 'gas', 'water', 'internet', 'phone', 'telecom', 'mobile'] },
  'Shopping': { keywords: ['shop', 'store', 'retail', 'fashion', 'clothing', 'apparel', 'boutique', 'mall'] },
  'Groceries': { keywords: ['supermarket', 'grocery', 'market', 'food store', 'convenience'] },
  'Restaurants': { keywords: ['restaurant', 'cafe', 'coffee', 'bistro', 'diner', 'eatery', 'food', 'pizza', 'burger'] },
  'Transport': { keywords: ['uber', 'taxi', 'transport', 'parking', 'fuel', 'gas station', 'petrol'] },
  'Entertainment': { keywords: ['cinema', 'theater', 'entertainment', 'tickets', 'subscription', 'streaming'] },
  'Health': { keywords: ['pharmacy', 'medical', 'health', 'doctor', 'clinic', 'hospital'] },
  'ATM': { keywords: ['atm', 'cash withdrawal', 'withdrawal'] },
  'Transfer': { keywords: ['transfer', 'bank transfer', 'payment'] },
  'Books': { keywords: ['bookstore', 'books', 'library'] },
  'Home': { keywords: ['furniture', 'home improvement', 'hardware', 'diy'] }
};

// Load categories from smart-categories.json or use defaults
function loadCategories() {
  const categoryFile = 'smart-categories.json';
  const data = loadJSONFile(categoryFile);

  if (data && data.categories) {
    console.log(`Loaded ${Object.keys(data.categories).length} categories from ${categoryFile}`);
    console.log(`Generated on: ${data.generatedAt || 'unknown'}\n`);
    return data.categories;
  }

  console.log('No smart-categories.json found. Using default categories.');
  console.log('Run "npm run build-categories" to generate AI-powered categories.\n');
  return DEFAULT_CATEGORIES;
}

// Load categories at startup
const CATEGORIES = loadCategories();

// Load account configuration (IBANs, names, transfer rules)
function loadAccountConfig() {
  const configPath = '.account-config.json';
  const config = loadJSONFile(configPath);

  if (config) {
    console.log('✅ Loaded account configuration');
    console.log(`   Personal accounts: ${config.personalIbans?.length || 0} configured`);
    console.log(`   Name patterns: ${config.namePatterns?.length || 0} configured\n`);
    return config;
  }

  // Default configuration (no personal data)
  console.log('⚠️  No account configuration found.');
  console.log('   Run "npm run configure-accounts" to set up personal account detection.');
  console.log('   This will help exclude internal transfers from expense calculations.\n');

  return {
    version: '1.0',
    personalIbans: [],
    namePatterns: [],
    transferRules: {
      roundUpTransactions: 'exclude',
      internalTransfers: 'exclude',
      savingsDeposits: 'exclude'
    }
  };
}

const ACCOUNT_CONFIG = loadAccountConfig();

function categorizeTransaction(tx) {
  const description = (
    tx.remittanceInformationUnstructured ||
    tx.creditorName ||
    tx.debtorName ||
    ''
  ).toLowerCase();

  for (const [category, categoryData] of Object.entries(CATEGORIES)) {
    // Support both old format (array) and new format (object with keywords)
    const keywords = Array.isArray(categoryData) ? categoryData : (categoryData.keywords || []);
    if (keywords.some(keyword => description.includes(keyword.toLowerCase()))) {
      return category;
    }
  }

  return 'Other';
}

function isInternalTransfer(tx, myIban) {
  const transactionType = tx.proprietaryBankTransactionCode || '';
  const creditorAccount = tx.creditorAccount?.iban || '';
  const debtorAccount = tx.debtorAccount?.iban || '';
  const creditorName = tx.creditorName || '';
  const debtorName = tx.debtorName || '';

  // Round-up transactions to savings account
  if (transactionType === 'Round-up Transaction' &&
      ACCOUNT_CONFIG.transferRules.roundUpTransactions === 'exclude') {
    return true;
  }

  // Check if transfer involves user's name patterns (no hardcoded names)
  if (ACCOUNT_CONFIG.namePatterns.length > 0) {
    for (const namePattern of ACCOUNT_CONFIG.namePatterns) {
      if (creditorName.includes(namePattern) || debtorName.includes(namePattern)) {
        if (ACCOUNT_CONFIG.transferRules.internalTransfers === 'exclude') {
          return true;
        }
      }
    }
  }

  // Check if transfer involves user's personal IBANs (no hardcoded IBANs)
  if (ACCOUNT_CONFIG.personalIbans.length > 0) {
    if (ACCOUNT_CONFIG.personalIbans.includes(creditorAccount) ||
        ACCOUNT_CONFIG.personalIbans.includes(debtorAccount)) {
      if (ACCOUNT_CONFIG.transferRules.internalTransfers === 'exclude') {
        return true;
      }
    }
  }

  return false;
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

function getWeekDateRange(weekString) {
  const [year, week] = weekString.split('-W');
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const weekStart = new Date(simple);
  weekStart.setDate(simple.getDate() - dow + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return {
    start: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    end: weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  };
}

function analyzeTransactions(transactions, myIban) {
  const weeklyData = {};
  const categorySummary = {};
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalInternalTransfers = 0;
  let largestExpense = null;

  transactions.forEach(tx => {
    const amount = parseFloat(tx.transactionAmount?.amount || 0);
    const date = tx.bookingDate || tx.valueDate;
    const week = getWeekNumber(date);
    const category = categorizeTransaction(tx);
    const isInternal = isInternalTransfer(tx, myIban);

    // Initialize week data
    if (!weeklyData[week]) {
      weeklyData[week] = {
        income: 0,
        expenses: 0,
        internalTransfers: { in: 0, out: 0 },
        categories: {},
        transactions: [],
        largestExpense: null
      };
    }

    // Initialize category summary
    if (!categorySummary[category]) {
      categorySummary[category] = { total: 0, count: 0 };
    }

    if (amount > 0) {
      // Incoming money
      if (isInternal) {
        weeklyData[week].internalTransfers.in += amount;
        totalInternalTransfers += amount;
      } else {
        weeklyData[week].income += amount;
        totalIncome += amount;
      }
    } else {
      // Outgoing money
      const absAmount = Math.abs(amount);

      if (isInternal) {
        weeklyData[week].internalTransfers.out += absAmount;
        totalInternalTransfers += absAmount;
      } else {
        weeklyData[week].expenses += absAmount;
        totalExpenses += absAmount;

        // Track by category
        if (!weeklyData[week].categories[category]) {
          weeklyData[week].categories[category] = 0;
        }
        weeklyData[week].categories[category] += absAmount;
        categorySummary[category].total += absAmount;
        categorySummary[category].count += 1;

        // Track largest expense
        if (!weeklyData[week].largestExpense || absAmount > weeklyData[week].largestExpense.amount) {
          weeklyData[week].largestExpense = {
            amount: absAmount,
            description: tx.remittanceInformationUnstructured || tx.creditorName || 'N/A',
            date: date
          };
        }

        if (!largestExpense || absAmount > largestExpense.amount) {
          largestExpense = {
            amount: absAmount,
            description: tx.remittanceInformationUnstructured || tx.creditorName || 'N/A',
            date: date,
            category: category
          };
        }
      }
    }

    weeklyData[week].transactions.push({
      date,
      amount,
      category,
      isInternal,
      description: tx.remittanceInformationUnstructured || tx.creditorName || tx.debtorName || 'N/A'
    });
  });

  return {
    weeklyData,
    categorySummary,
    totalIncome,
    totalExpenses,
    totalInternalTransfers,
    largestExpense
  };
}

function generateReport(analysis, currency = 'RON') {
  const { weeklyData, categorySummary, totalIncome, totalExpenses, largestExpense } = analysis;

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                     FINANCIAL ANALYSIS REPORT                      ');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n');

  // Overall Summary
  console.log('📊 OVERALL SUMMARY');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`   Total Income (actual):          ${totalIncome.toFixed(2)} ${currency}`);
  console.log(`   Total Expenses (actual):        ${totalExpenses.toFixed(2)} ${currency}`);
  console.log(`   Net:                            ${(totalIncome - totalExpenses).toFixed(2)} ${currency}`);
  console.log(`   Savings Rate:                   ${totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0}%`);
  console.log('');
  console.log(`   ℹ️  Internal transfers between your accounts are excluded from`);
  console.log(`      income/expenses (e.g., transfers to savings accounts)`);
  console.log('\n');

  // Top Categories
  console.log('💰 TOP SPENDING CATEGORIES');
  console.log('───────────────────────────────────────────────────────────────────');
  const sortedCategories = Object.entries(categorySummary)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5);

  sortedCategories.forEach(([category, data], idx) => {
    const percentage = totalExpenses > 0 ? (data.total / totalExpenses * 100).toFixed(1) : 0;
    const bar = '█'.repeat(Math.floor(percentage / 2));
    console.log(`   ${idx + 1}. ${category.padEnd(25)} ${data.total.toFixed(2).padStart(10)} ${currency}  ${percentage}% ${bar}`);
    console.log(`      ${data.count} transactions`);
  });
  console.log('\n');

  // Largest Single Expense
  if (largestExpense) {
    console.log('🔴 LARGEST SINGLE EXPENSE');
    console.log('───────────────────────────────────────────────────────────────────');
    console.log(`   Amount:      ${largestExpense.amount.toFixed(2)} ${currency}`);
    console.log(`   Date:        ${new Date(largestExpense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);
    console.log(`   Category:    ${largestExpense.category}`);
    console.log(`   Description: ${largestExpense.description.substring(0, 60)}`);
    console.log('\n');
  }

  // Weekly Breakdown
  console.log('📅 WEEKLY BREAKDOWN');
  console.log('═══════════════════════════════════════════════════════════════════');

  const weeks = Object.keys(weeklyData).sort().reverse().slice(0, 8); // Last 8 weeks

  weeks.forEach(week => {
    const data = weeklyData[week];
    const dateRange = getWeekDateRange(week);
    const net = data.income - data.expenses;

    console.log(`\n${week}  (${dateRange.start} - ${dateRange.end})`);
    console.log('───────────────────────────────────────────────────────────────────');

    // Income section
    if (data.income > 0) {
      console.log(`   💵 Income:                      +${data.income.toFixed(2)} ${currency}`);
    }

    // Internal transfers
    if (data.internalTransfers.in > 0 || data.internalTransfers.out > 0) {
      console.log(`   🔄 Internal Transfers (not counted in expenses):`);
      if (data.internalTransfers.in > 0) {
        console.log(`      From your savings/accounts:    +${data.internalTransfers.in.toFixed(2)} ${currency}`);
      }
      if (data.internalTransfers.out > 0) {
        console.log(`      To your savings/accounts:      -${data.internalTransfers.out.toFixed(2)} ${currency}`);
      }
    }

    console.log(`   💸 Expenses:                    -${data.expenses.toFixed(2)} ${currency}`);
    console.log(`   📈 Net:                          ${net >= 0 ? '+' : ''}${net.toFixed(2)} ${currency}`);

    // Top categories for the week
    const topCategories = Object.entries(data.categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (topCategories.length > 0) {
      console.log('\n   Top Spending:');
      topCategories.forEach(([category, amount]) => {
        const percentage = data.expenses > 0 ? (amount / data.expenses * 100).toFixed(0) : 0;
        console.log(`      • ${category.padEnd(25)} ${amount.toFixed(2).padStart(8)} ${currency}  (${percentage}%)`);
      });
    }

    // Largest expense of the week
    if (data.largestExpense) {
      console.log(`\n   🔴 Biggest Expense: ${data.largestExpense.amount.toFixed(2)} ${currency}`);
      console.log(`      ${data.largestExpense.description.substring(0, 55)}`);
    }
  });

  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('\n');
}

function parseMonth(monthStr) {
  // Parse formats like "december", "dec", "2025-12", "12/2025", "december 2025"
  const str = monthStr.toLowerCase().trim();

  const monthNames = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
  };

  // Try "december 2025" format
  for (const [name, month] of Object.entries(monthNames)) {
    if (str.includes(name)) {
      const yearMatch = str.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
      return { year, month };
    }
  }

  // Try "2025-12" or "12/2025" format
  const dashMatch = str.match(/(\d{4})-(\d{1,2})/);
  if (dashMatch) {
    return { year: parseInt(dashMatch[1]), month: parseInt(dashMatch[2]) - 1 };
  }

  const slashMatch = str.match(/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return { year: parseInt(slashMatch[2]), month: parseInt(slashMatch[1]) - 1 };
  }

  return null;
}

function filterTransactionsByDateRange(transactions, startMonth, endMonth) {
  if (!startMonth && !endMonth) {
    return transactions;
  }

  return transactions.filter(tx => {
    const date = new Date(tx.bookingDate || tx.valueDate);
    const txYear = date.getFullYear();
    const txMonth = date.getMonth();

    if (startMonth && endMonth) {
      const start = new Date(startMonth.year, startMonth.month, 1);
      const end = new Date(endMonth.year, endMonth.month + 1, 0);
      return date >= start && date <= end;
    } else if (startMonth) {
      return txYear === startMonth.year && txMonth === startMonth.month;
    }

    return true;
  });
}

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let startMonth = null;
    let endMonth = null;

    if (args.length > 0) {
      startMonth = parseMonth(args[0]);
      if (args.length > 1) {
        endMonth = parseMonth(args[1]);
      } else {
        endMonth = startMonth; // Single month
      }

      if (!startMonth) {
        console.error('❌ Invalid date format. Examples:');
        console.error('   npm run analyze december 2025');
        console.error('   npm run analyze "december 2025" "january 2026"');
        console.error('   npm run analyze 2025-12 2026-01');
        return;
      }
    }

    // Find transaction files
    const files = fs.readdirSync('.')
      .filter(f => f.startsWith('transactions_') && f.endsWith('.json'));

    if (files.length === 0) {
      console.error('❌ No transaction files found. Run fetch-transactions.js first.');
      return;
    }

    console.log(`\n📁 Found ${files.length} transaction file(s)\n`);

    for (const file of files) {
      const data = loadJSONFile(file, { transactions: { booked: [] } });
      if (!data) {
        console.error(`❌ Failed to load ${file}, skipping...`);
        continue;
      }

      let transactions = data.transactions?.booked || [];
      const myIban = data.account?.iban || '';

      if (transactions.length === 0) {
        console.log(`⚠️  No transactions in ${file}`);
        continue;
      }

      // Filter by date range if specified
      if (startMonth) {
        transactions = filterTransactionsByDateRange(transactions, startMonth, endMonth);
        const monthName = new Date(startMonth.year, startMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const endMonthName = endMonth && (endMonth.year !== startMonth.year || endMonth.month !== startMonth.month)
          ? ' - ' + new Date(endMonth.year, endMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : '';
        console.log(`Analyzing ${transactions.length} transactions from ${monthName}${endMonthName}...`);
      } else {
        console.log(`Analyzing ${transactions.length} transactions from ${file}...`);
      }

      if (transactions.length === 0) {
        console.log('⚠️  No transactions in the specified date range\n');
        continue;
      }

      const analysis = analyzeTransactions(transactions, myIban);
      const currency = transactions[0]?.transactionAmount?.currency || 'RON';

      generateReport(analysis, currency);

      // Save detailed analysis to JSON
      const suffix = startMonth
        ? `_${startMonth.year}-${(startMonth.month + 1).toString().padStart(2, '0')}${endMonth && (endMonth.year !== startMonth.year || endMonth.month !== startMonth.month) ? '_to_' + endMonth.year + '-' + (endMonth.month + 1).toString().padStart(2, '0') : ''}`
        : '';
      const outputFile = file.replace('transactions_', `analysis${suffix}_`).replace('.json', '.json');
      fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
      console.log(`💾 Detailed analysis saved to ${outputFile}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
