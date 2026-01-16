require('dotenv').config();
const axios = require('axios');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const baseUrl = 'https://bankaccountdata.gocardless.com/api/v2';
let accessToken;

async function getAccessToken() {
  const response = await axios.post(`${baseUrl}/token/new/`, {
    secret_id: process.env.GOCARDLESS_SECRET_ID,
    secret_key: process.env.GOCARDLESS_SECRET_KEY
  });
  return response.data.access;
}

async function listInstitutions(country = 'GB') {
  const response = await axios.get(`${baseUrl}/institutions/?country=${country}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.data;
}

async function createEndUserAgreement(institutionId, maxHistoricalDays = 90) {
  const response = await axios.post(`${baseUrl}/agreements/enduser/`, {
    institution_id: institutionId,
    max_historical_days: maxHistoricalDays,
    access_valid_for_days: 90,
    access_scope: ['balances', 'details', 'transactions']
  }, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.data;
}

async function createRequisition(institutionId, agreementId, redirectUrl) {
  const response = await axios.post(`${baseUrl}/requisitions/`, {
    redirect: redirectUrl,
    institution_id: institutionId,
    agreement: agreementId,
    reference: `REQ-${Date.now()}`,
    user_language: 'EN'
  }, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  return response.data;
}

async function main() {
  try {
    console.log('🔐 GoCardless Bank Connection\n');

    // Get access token
    console.log('Getting access token...');
    accessToken = await getAccessToken();
    console.log('✅ Authenticated\n');

    // Get country
    const country = (await question('Enter country code (e.g., GB, DE, FR) [GB]: ')).toUpperCase() || 'GB';

    // List institutions
    console.log(`\n📋 Fetching banks for ${country}...`);
    const institutions = await listInstitutions(country);

    console.log(`\nFound ${institutions.length} banks. Showing first 20:\n`);
    institutions.slice(0, 20).forEach((inst, idx) => {
      console.log(`${idx + 1}. ${inst.name} (${inst.id})`);
    });

    // Select institution
    const selection = await question('\nEnter the number of the bank (or type bank ID): ');
    const selectedInstitution = isNaN(selection)
      ? institutions.find(i => i.id === selection)
      : institutions[parseInt(selection) - 1];

    if (!selectedInstitution) {
      console.error('❌ Invalid selection');
      rl.close();
      return;
    }

    console.log(`\n✅ Selected: ${selectedInstitution.name}`);

    // Create end user agreement
    console.log('\n📝 Creating end user agreement...');
    const agreement = await createEndUserAgreement(selectedInstitution.id);
    console.log(`✅ Agreement created: ${agreement.id}`);

    // Create requisition
    const redirectUrl = await question('\nEnter redirect URL (or press Enter for default): ')
      || 'http://localhost:3000/callback';

    console.log('\n🔗 Creating requisition...');
    const requisition = await createRequisition(
      selectedInstitution.id,
      agreement.id,
      redirectUrl
    );

    console.log('\n✅ Requisition created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Requisition Details:');
    console.log(`   ID: ${requisition.id}`);
    console.log(`   Status: ${requisition.status}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🌐 Authorization Link:');
    console.log(`   ${requisition.link}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📖 Next steps:');
    console.log('   1. Open the authorization link in your browser');
    console.log('   2. Select your bank and log in');
    console.log('   3. Grant access to your account');
    console.log('   4. You\'ll be redirected to the callback URL');
    console.log('   5. Use the requisition ID to fetch account data\n');

    // Save requisition info
    const fs = require('fs');
    const requisitionData = {
      requisition_id: requisition.id,
      institution: selectedInstitution.name,
      institution_id: selectedInstitution.id,
      agreement_id: agreement.id,
      status: requisition.status,
      created_at: new Date().toISOString(),
      link: requisition.link
    };

    fs.writeFileSync(
      'requisition.json',
      JSON.stringify(requisitionData, null, 2)
    );
    console.log('💾 Requisition details saved to requisition.json\n');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  } finally {
    rl.close();
  }
}

main();
