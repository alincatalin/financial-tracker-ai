require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const baseUrl = 'https://bankaccountdata.gocardless.com/api/v2';

async function getAccessToken() {
  const response = await axios.post(`${baseUrl}/token/new/`, {
    secret_id: process.env.GOCARDLESS_SECRET_ID,
    secret_key: process.env.GOCARDLESS_SECRET_KEY
  });
  return response.data.access;
}

async function getAccountDetails(accountId, accessToken) {
  const response = await axios.get(`${baseUrl}/accounts/${accountId}/details/`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.data;
}

async function getAccountBalances(accountId, accessToken) {
  const response = await axios.get(`${baseUrl}/accounts/${accountId}/balances/`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.data;
}

async function getAccountTransactions(accountId, accessToken) {
  const response = await axios.get(`${baseUrl}/accounts/${accountId}/transactions/`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.data;
}

function formatAmount(amount, currency) {
  const num = parseFloat(amount);
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)} ${currency}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

async function main() {
  try {
    // Load requisition info
    if (!fs.existsSync('requisition.json')) {
      console.error('❌ No requisition.json found. Run connect-bank.js first.');
      return;
    }

    const requisitionData = JSON.parse(fs.readFileSync('requisition.json', 'utf8'));

    if (!requisitionData.accounts || requisitionData.accounts.length === 0) {
      console.error('❌ No accounts found. Make sure authorization is complete.');
      return;
    }

    console.log('💰 Fetching Account Data\n');
    const accessToken = await getAccessToken();

    for (const accountId of requisitionData.accounts) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Account: ${accountId}\n`);

      // Get account details
      console.log('📋 Account Details:');
      const details = await getAccountDetails(accountId, accessToken);
      console.log(`   IBAN: ${details.account?.iban || 'N/A'}`);
      console.log(`   Owner: ${details.account?.ownerName || 'N/A'}`);
      console.log(`   Currency: ${details.account?.currency || 'N/A'}\n`);

      // Get balances
      console.log('💵 Balances:');
      const balances = await getAccountBalances(accountId, accessToken);
      if (balances.balances && balances.balances.length > 0) {
        balances.balances.forEach(balance => {
          console.log(`   ${balance.balanceType}: ${formatAmount(balance.balanceAmount.amount, balance.balanceAmount.currency)}`);
        });
      } else {
        console.log('   No balance data available');
      }
      console.log('');

      // Get transactions
      console.log('📝 Recent Transactions:');
      const transactions = await getAccountTransactions(accountId, accessToken);

      if (transactions.transactions?.booked && transactions.transactions.booked.length > 0) {
        const booked = transactions.transactions.booked;
        console.log(`   Found ${booked.length} booked transactions\n`);

        // Show last 10 transactions
        const recent = booked.slice(-10).reverse();
        recent.forEach((tx, idx) => {
          const amount = tx.transactionAmount?.amount || '0';
          const currency = tx.transactionAmount?.currency || '';
          const date = formatDate(tx.bookingDate || tx.valueDate);
          const info = tx.remittanceInformationUnstructured || tx.creditorName || tx.debtorName || 'N/A';

          console.log(`   ${idx + 1}. ${date}`);
          console.log(`      ${formatAmount(amount, currency)}`);
          console.log(`      ${info}`);
          if (tx.creditorName) console.log(`      To: ${tx.creditorName}`);
          if (tx.debtorName) console.log(`      From: ${tx.debtorName}`);
          console.log('');
        });

        // Save all transactions to file
        const outputFile = `transactions_${accountId}.json`;
        fs.writeFileSync(outputFile, JSON.stringify(transactions, null, 2));
        console.log(`   💾 All transactions saved to ${outputFile}\n`);

      } else if (transactions.transactions?.pending && transactions.transactions.pending.length > 0) {
        console.log(`   Found ${transactions.transactions.pending.length} pending transactions\n`);
      } else {
        console.log('   No transactions found\n');
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response?.status === 429) {
      console.error('⚠️  Rate limit exceeded. Please wait a moment and try again.');
    }
  }
}

main();
