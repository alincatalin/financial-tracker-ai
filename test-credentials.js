require('dotenv').config();
const axios = require('axios');

async function testGoCardlessCredentials() {
  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;
  const environment = process.env.GOCARDLESS_ENVIRONMENT || 'sandbox';

  if (!secretId || !secretKey) {
    console.error('❌ Missing credentials. Please check your .env file.');
    return;
  }

  const baseUrl = environment === 'sandbox'
    ? 'https://bankaccountdata.gocardless.com/api/v2'
    : 'https://bankaccountdata.gocardless.com/api/v2';

  try {
    console.log('🔍 Testing GoCardless credentials...');
    console.log(`Environment: ${environment}`);

    // Get access token
    const tokenResponse = await axios.post(`${baseUrl}/token/new/`, {
      secret_id: secretId,
      secret_key: secretKey
    });

    const accessToken = tokenResponse.data.access;
    console.log('✅ Authentication successful!');
    console.log(`Access token obtained (expires in ${tokenResponse.data.access_expires} seconds)`);

    // Test by fetching institutions
    const institutionsResponse = await axios.get(`${baseUrl}/institutions/?country=gb`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log(`✅ API connection verified!`);
    console.log(`Found ${institutionsResponse.data.length} banking institutions available`);

  } catch (error) {
    console.error('❌ Error testing credentials:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(error.message);
    }
  }
}

testGoCardlessCredentials();
