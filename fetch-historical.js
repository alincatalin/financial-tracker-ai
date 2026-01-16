require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { loadJSONFile } = require('./lib/file-utils');

const baseUrl = 'https://bankaccountdata.gocardless.com/api/v2';

async function getAccessToken() {
  const response = await axios.post(`${baseUrl}/token/new/`, {
    secret_id: process.env.GOCARDLESS_SECRET_ID,
    secret_key: process.env.GOCARDLESS_SECRET_KEY
  });
  return response.data.access;
}

async function getAccountTransactions(accountId, accessToken, dateFrom, dateTo) {
  const params = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const response = await axios.get(`${baseUrl}/accounts/${accountId}/transactions/`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    params
  });
  return response.data;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getMonthKey(dateString) {
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}_${year}`;
}

function groupTransactionsByMonth(transactions) {
  const grouped = {};

  transactions.forEach(tx => {
    const date = tx.bookingDate || tx.valueDate;
    if (!date) return;

    const monthKey = getMonthKey(date);

    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        booked: [],
        pending: []
      };
    }

    grouped[monthKey].booked.push(tx);
  });

  return grouped;
}

function saveMonthlyFile(monthKey, transactions, accountId) {
  const [month, year] = monthKey.split('_');
  const filename = `transactions_${monthKey}.json`;

  const data = {
    month,
    year,
    lastUpdated: new Date().toISOString(),
    accountId,
    transactions
  };

  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`   Saved ${transactions.booked.length} transactions to ${filename}`);
}

async function main() {
  try {
    // Load requisition info
    const requisitionData = loadJSONFile('requisition.json');
    if (!requisitionData) {
      console.error('No requisition.json found. Run connect-bank.js first.');
      return;
    }

    if (!requisitionData.accounts || requisitionData.accounts.length === 0) {
      console.error('No accounts found. Make sure authorization is complete.');
      return;
    }

    console.log('\n');
    console.log('Historical Transaction Fetch (Last 3 Months)');
    console.log('='.repeat(50));
    console.log('\n');

    // Calculate date range (last 90 days - GoCardless max)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    console.log(`Date range: ${formatDate(startDate)} to ${formatDate(endDate)}\n`);

    const accessToken = await getAccessToken();

    for (const accountId of requisitionData.accounts) {
      console.log(`Fetching transactions for account: ${accountId}`);

      try {
        const transactionData = await getAccountTransactions(
          accountId,
          accessToken,
          formatDate(startDate),
          formatDate(endDate)
        );

        const bookedTransactions = transactionData.transactions?.booked || [];
        const pendingTransactions = transactionData.transactions?.pending || [];

        console.log(`   Found ${bookedTransactions.length} booked transactions`);
        console.log(`   Found ${pendingTransactions.length} pending transactions\n`);

        if (bookedTransactions.length === 0) {
          console.log('   No transactions to process.\n');
          continue;
        }

        // Group by month
        const grouped = groupTransactionsByMonth(bookedTransactions);

        console.log(`   Grouped into ${Object.keys(grouped).length} monthly files:\n`);

        // Save each month to a separate file
        for (const [monthKey, transactions] of Object.entries(grouped)) {
          saveMonthlyFile(monthKey, transactions, accountId);
        }

        console.log('');

      } catch (error) {
        if (error.response?.status === 429) {
          console.error('   Rate limit exceeded. Please try again later.');
        } else {
          console.error(`   Error: ${error.response?.data?.detail || error.message}`);
        }
      }
    }

    console.log('='.repeat(50));
    console.log('Historical fetch complete!');
    console.log('\nNext steps:');
    console.log('  1. Run: npm run build-categories');
    console.log('  2. Run: npm run analyze\n');

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
