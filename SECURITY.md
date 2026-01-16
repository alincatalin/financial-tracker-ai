# Security & Privacy Guide

## Overview

This financial transaction system handles sensitive banking data. This document outlines the security measures implemented and best practices for protecting your information.

## Data Privacy Measures

### 1. Local Data Storage

All transaction data is stored **locally on your machine** only:
- `transactions_MM_YYYY.json` - Monthly transaction files
- `smart-categories.json` - Category definitions
- No data is sent to cloud storage or third-party services (except AI analysis, see below)

### 2. API Credentials Security

**Never commit credentials to version control:**

```bash
# Credentials are stored in .env (gitignored by default)
GOCARDLESS_SECRET_ID=your_secret_id
GOCARDLESS_SECRET_KEY=your_secret_key
ANTHROPIC_API_KEY=your_anthropic_key
```

**Best practices:**
- Use environment variables for all credentials
- Never share your `.env` file
- Rotate credentials if accidentally exposed
- Use different credentials for development/production

### 3. PII Redaction for AI Analysis

When using `npm run build-categories`, transaction data is sent to Anthropic's API for categorization. **The following PII is automatically redacted before transmission:**

#### Redacted Information:
- ✅ **IBANs** - Full account numbers (e.g., `RO##XXXX################`)
- ✅ **Card numbers** - Both partial (`****1234`) and full card numbers
- ✅ **Phone numbers** - Romanian (10-digit) and international formats
- ✅ **Personal names** - Beneficiary names, ordering parties
- ✅ **Reference numbers** - Transaction and authorization numbers
- ✅ **Exact dates** - Only month is preserved for seasonality analysis

#### Transmitted Information:
- ✅ **Merchant names only** - e.g., "Kaufland ", "OMV "
- ✅ **Transaction amounts** - For spending pattern analysis
- ✅ **Transaction month** - For seasonal trends (not exact dates)
- ✅ **Transaction type** - e.g., "POS purchase", "ATM withdrawal"

#### Example Transformation:

**Before redaction (NEVER sent):**
```json
{
  "description": "Card number, **** 8475, Transaction at, Kaufland  1234 Iasi  RO  Iasi, Authorization date, 04-01-2026, Authorization number, XXXX",
  "amount": 1234.80,
  "date": "2026-12-12"
}
```

**After redaction (sent to AI):**
```json
{
  "description": "Kaufland 1234 Iasi",
  "amount": 1234.80,
  "month": 1
}
```

### 4. Consent & Transparency

The `build-smart-categories.js` script displays a **privacy notice** before sending any data:

```
🔒 PRIVACY NOTICE
This script will send transaction data to Anthropic's API for analysis.
The following personal information will be REDACTED before sending:
  • IBANs and account numbers
  • Card numbers
  • Phone numbers
  • Personal names (beneficiaries, ordering parties)
  • Reference and authorization numbers
  • Exact transaction dates (only month is kept)

Only merchant names and transaction amounts will be analyzed.

By continuing, you consent to this data processing.
Press Ctrl+C to cancel, or any key to continue...
```

**You must explicitly continue** to send data to the AI service.

## Security Best Practices

### For Users

1. **Protect your .env file**
   ```bash
   chmod 600 .env  # Make it readable only by you
   ```

2. **Review transaction files before sharing**
   - Transaction files contain sensitive data
   - Never share `transactions_*.json` files publicly
   - If you need to share for debugging, redact personal info first

3. **Use strong API credentials**
   - Use separate GoCardless accounts for testing vs production
   - Rotate API keys periodically
   - Monitor API usage in GoCardless dashboard

4. **Limit GoCardless permissions**
   - Use read-only access (transactions, balances, details)
   - Never grant write access unless absolutely necessary
   - Review connected apps regularly in your bank account

5. **Secure your development machine**
   - Use disk encryption
   - Lock your screen when away
   - Keep your OS and software updated

### For Developers

1. **Code review sensitive operations**
   - Any code that handles transaction data should be reviewed
   - Look for potential data leaks (logging, error messages, etc.)
   - Verify redaction functions work correctly

2. **Never log sensitive data**
   ```javascript
   // ❌ BAD
   console.log('Transaction:', fullTransaction);

   // ✅ GOOD
   console.log('Processing transaction:', transactionId);
   ```

3. **Test redaction functions**
   ```bash
   # Verify no IBANs, names, or card numbers in output
   node build-smart-categories.js --dry-run
   ```

4. **Document data flows**
   - Where does data come from?
   - Where does it go?
   - What transformations occur?
   - Who has access?

## Data Retention

### Local Files
- **Transaction files** (`transactions_*.json`) - Kept indefinitely locally
- **Category files** (`smart-categories.json`) - Regenerated monthly
- **Analysis files** (`analysis_*.json`) - Optional, can be deleted

### External Services

#### GoCardless
- Access tokens: Valid for 180 days (bank-dependent)
- Transaction data: Available for 90 days via API
- Requisitions: Valid for 90 days, then must re-authorize

#### Anthropic API
Per Anthropic's [Data Privacy Policy](https://www.anthropic.com/legal/privacy):
- API requests are not used to train models
- Data is retained for 30 days for trust & safety purposes
- You can request deletion via Anthropic support

**Note:** Even with redaction, avoid sending sensitive financial data unless necessary. The AI categorization is optional - default categories work without any external API calls.

## Incident Response

### If API Keys Are Compromised

1. **Immediately revoke credentials:**
   - GoCardless: Delete the secret in Developer dashboard
   - Anthropic: Regenerate API key in account settings

2. **Generate new credentials:**
   - Create new secrets/keys
   - Update `.env` file
   - Test the new credentials

3. **Review access logs:**
   - Check GoCardless API logs for unauthorized access
   - Monitor bank account for suspicious activity

4. **Notify relevant parties:**
   - If bank data was accessed, contact your bank
   - If using shared systems, notify team members

### If Transaction Data Is Exposed

1. **Assess the scope:**
   - What data was exposed?
   - How many transactions?
   - What time period?

2. **Mitigate:**
   - Delete exposed files from public locations
   - Revoke access to compromised systems
   - Change passwords/credentials

3. **Monitor:**
   - Watch for fraudulent transactions
   - Enable fraud alerts at your bank
   - Consider temporary spending limits

## Compliance Considerations

### GDPR (EU Users)
- **Right to access**: All your data is local - you have full access
- **Right to erasure**: Delete transaction files to remove data
- **Data portability**: Files are in standard JSON format
- **Consent**: Explicit consent required for AI analysis

### PSD2 (Open Banking)
- **Read-only access**: System only reads transaction data
- **Limited scope**: Access expires after 90 days
- **Explicit consent**: User must authorize bank connection
- **Secure communication**: All API calls use HTTPS

## Auditing & Logging

The system logs:
- ✅ **Fetch operations** - When transactions are fetched
- ✅ **Analysis runs** - When reports are generated
- ✅ **Category updates** - When AI categorization runs
- ✅ **API errors** - Failed requests (without sensitive data)

The system does NOT log:
- ❌ Raw transaction data
- ❌ API credentials
- ❌ Personal information (IBANs, names, etc.)

## Questions?

If you have security concerns or find vulnerabilities:
1. Review this document
2. Check the code in `build-smart-categories.js` for redaction logic
3. Open an issue (do NOT include sensitive data in issue reports)

## Security Updates

This document was last updated: **2026-01-14**

**Version History:**
- v1.1 (2026-01-14): Added PII redaction for AI analysis
- v1.0 (2026-01-14): Initial security documentation
