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

function loadMonthlyFile(monthKey) {
  const filename = `transactions_${monthKey}.json`;

  const [month, year] = monthKey.split('_');
  const defaultData = {
    month,
    year,
    lastUpdated: null,
    accountId: null,
    transactions: {
      booked: [],
      pending: []
    }
  };

  return loadJSONFile(filename, defaultData);
}

function saveMonthlyFile(monthKey, data) {
  const filename = `transactions_${monthKey}.json`;
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  return filename;
}

function appendTransactions(monthKey, newTransactions, accountId) {
  const data = loadMonthlyFile(monthKey);
  data.accountId = accountId;

  // Create a Set of existing transaction IDs for deduplication
  const existingIds = new Set(
    data.transactions.booked.map(tx => tx.internalTransactionId)
  );

  let addedCount = 0;
  let duplicateCount = 0;

  for (const tx of newTransactions) {
    if (existingIds.has(tx.internalTransactionId)) {
      duplicateCount++;
    } else {
      data.transactions.booked.push(tx);
      existingIds.add(tx.internalTransactionId);
      addedCount++;
    }
  }

  if (addedCount > 0) {
    // Sort transactions by date (newest first)
    data.transactions.booked.sort((a, b) => {
      const dateA = new Date(a.bookingDate || a.valueDate);
      const dateB = new Date(b.bookingDate || b.valueDate);
      return dateB - dateA;
    });

    const filename = saveMonthlyFile(monthKey, data);
    console.log(`   ${filename}: +${addedCount} new, ${duplicateCount} duplicates skipped`);
  } else {
    console.log(`   ${monthKey}: No new transactions (${duplicateCount} already exist)`);
  }

  return { added: addedCount, duplicates: duplicateCount };
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
    console.log('Weekly Transaction Fetch (Last 7 Days)');
    console.log('='.repeat(50));
    console.log('\n');

    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log(`Date range: ${formatDate(startDate)} to ${formatDate(endDate)}\n`);

    const accessToken = await getAccessToken();

    let totalAdded = 0;
    let totalDuplicates = 0;

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

        console.log(`   Found ${bookedTransactions.length} transactions in date range\n`);

        if (bookedTransactions.length === 0) {
          console.log('   No transactions to process.\n');
          continue;
        }

        // Group transactions by month (handles month boundaries)
        const byMonth = {};
        for (const tx of bookedTransactions) {
          const date = tx.bookingDate || tx.valueDate;
          if (!date) continue;

          const monthKey = getMonthKey(date);
          if (!byMonth[monthKey]) {
            byMonth[monthKey] = [];
          }
          byMonth[monthKey].push(tx);
        }

        // Append to each monthly file
        for (const [monthKey, transactions] of Object.entries(byMonth)) {
          const result = appendTransactions(monthKey, transactions, accountId);
          totalAdded += result.added;
          totalDuplicates += result.duplicates;
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
    console.log(`Summary: ${totalAdded} new transactions added, ${totalDuplicates} duplicates skipped`);
    console.log('\nRun "npm run analyze" to generate updated reports.\n');

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
