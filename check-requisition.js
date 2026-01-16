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

async function getRequisition(requisitionId, accessToken) {
  const response = await axios.get(`${baseUrl}/requisitions/${requisitionId}/`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.data;
}

async function getAccountDetails(accountId, accessToken) {
  const response = await axios.get(`${baseUrl}/accounts/${accountId}/details/`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.data;
}

async function main() {
  try {
    // Load requisition info
    const requisitionData = loadJSONFile('requisition.json');
    if (!requisitionData) {
      console.error('❌ No requisition.json found. Run connect-bank.js first.');
      return;
    }

    console.log('🔍 Checking requisition status...\n');

    const accessToken = await getAccessToken();
    const requisition = await getRequisition(requisitionData.requisition_id, accessToken);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Requisition Status:');
    console.log(`   ID: ${requisition.id}`);
    console.log(`   Status: ${requisition.status}`);
    console.log(`   Institution: ${requisitionData.institution}`);
    console.log(`   Created: ${requisitionData.created_at}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (requisition.status === 'LN') {
      console.log('✅ Connection successful! Linked accounts:\n');

      if (requisition.accounts && requisition.accounts.length > 0) {
        console.log(`Found ${requisition.accounts.length} account(s):\n`);

        for (const accountId of requisition.accounts) {
          try {
            const details = await getAccountDetails(accountId, accessToken);
            console.log(`📊 Account ID: ${accountId}`);
            console.log(`   Name: ${details.account?.name || 'N/A'}`);
            console.log(`   IBAN: ${details.account?.iban || 'N/A'}`);
            console.log(`   Currency: ${details.account?.currency || 'N/A'}`);
            console.log('');
          } catch (error) {
            console.log(`📊 Account ID: ${accountId}`);
            console.log(`   (Details will be available shortly)\n`);
          }
        }

        // Update requisition.json with account IDs
        requisitionData.accounts = requisition.accounts;
        requisitionData.status = requisition.status;
        fs.writeFileSync('requisition.json', JSON.stringify(requisitionData, null, 2));
        console.log('💾 Updated requisition.json with account IDs\n');
        console.log('✨ Next step: Run node fetch-transactions.js to get your transactions\n');
      }
    } else if (requisition.status === 'CR') {
      console.log('⏳ Status: Created - waiting for authorization\n');
      console.log('Please complete the authorization process:');
      console.log(`🔗 ${requisition.link}\n`);
    } else {
      console.log(`ℹ️  Status: ${requisition.status}`);
      console.log('   CR = Created');
      console.log('   LN = Linked (authorized)');
      console.log('   EX = Expired');
      console.log('   RJ = Rejected\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

main();
