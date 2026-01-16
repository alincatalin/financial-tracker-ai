# Personal Finance AI

> AI-powered personal finance tracker using GoCardless Open Banking and Claude AI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Personal Finance AI** is an open-source tool that connects to your bank via Open Banking (PSD2), analyzes your spending with Claude AI, and provides accurate financial insights—all while keeping your data local and private.


---

## ✨ Features

- 🏦 **Open Banking Integration** - Securely connect to 2,500+ European banks via GoCardless
- 🤖 **AI-Powered Categorization** - Claude AI learns your spending patterns and creates personalized categories
- 🔍 **Smart Transfer Detection** - Automatically identifies internal transfers, round-ups, and savings
- 📊 **Accurate Metrics** - Get real savings rates (not inflated by self-transfers)
- 🔒 **Privacy-First** - All data stored locally, PII redacted before AI processing
- 💬 **Claude Code Integration** - Native UI experience with natural language queries
- 🌍 **Multi-Country Support** - Works with banks across Europe (tested with Romanian banks)
- 📈 **Beautiful Reports** - Detailed spending breakdowns by category and time period

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v14+ ([Download](https://nodejs.org/))
- **European bank account** with PSD2 support
- **GoCardless account** ([Sign up free](https://bankaccountdata.gocardless.com/))
- **Anthropic API key** ([Get key](https://console.anthropic.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/alincatalin/financial-tracker-ai.git
cd financial-tracker-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys (see below)
```

### Configuration

Create a `.env` file with your credentials:

```bash
# GoCardless Bank Account Data API
# Get from: https://bankaccountdata.gocardless.com/user-secrets/
GOCARDLESS_SECRET_ID=your_secret_id_here
GOCARDLESS_SECRET_KEY=your_secret_key_here
GOCARDLESS_ENVIRONMENT=sandbox

# Anthropic API (for AI features)
# Get from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
```

**Important:**
- Start with `sandbox` environment for testing
- Switch to `production` when ready for real data
- Never commit your `.env` file (already gitignored)

### First-Time Setup

```bash
# 1. Connect to your bank
npm run connect-bank
# Follow the link to authorize access via your bank's login

# 2. Fetch transaction history (last 3 months)
npm run fetch-historical

# 3. Configure account settings (AI-assisted)
npm run configure-accounts
# Answer questions about internal transfers and savings

# 4. Generate smart categories
npm run build-categories
# AI analyzes your spending patterns

# 5. View your analysis
npm run analyze
```

**Setup time:** ~15 minutes

---

## 📖 Usage

### Basic Commands

```bash
# Fetch latest transactions (weekly routine)
npm run fetch-weekly

# Analyze spending
npm run analyze                    # Current month
npm run analyze january 2026       # Specific month
npm run analyze december 2025      # Previous month

# Reconfigure settings
npm run configure-accounts

# Rebuild categories (when new merchants appear)
npm run build-categories
```

### Using with Claude Code

If you use [Claude Code](https://www.anthropic.com/claude/code), you get natural language interaction:

```
User: "How much did I spend on groceries last month?"
User: "What's my savings rate for January?"
User: "Show me my biggest expenses this week"
User: "Compare December and January spending"
```

Claude will:
1. Fetch your latest transactions
2. Analyze using smart categories
3. Calculate accurate metrics (excluding internal transfers)
4. Provide clear, conversational answers

### Example Output

```
📊 Financial Analysis - January 2026

💰 Income
   Salary (ACME Corporation SRL)        10,000.00 RON

💸 Expenses by Category
   Groceries                              2,145.30 RON  (35.6%)
   Restaurants                              850.50 RON  (14.1%)
   Transport                                445.20 RON   (7.4%)
   Utilities                                320.15 RON   (5.3%)
   Shopping                                 580.00 RON   (9.6%)
   Entertainment                            185.25 RON   (3.1%)
   Other                                  1,495.60 RON  (24.9%)

   Total Expenses                         6,022.00 RON

💾 Savings
   Internal Transfers (Excluded)          1,230.00 RON
   Actual Savings                         3,978.00 RON

📈 Savings Rate: 39.8%

🔍 Top Merchants
   1. Supermarket Chain                    425.50 RON
   2. Gas Station                          198.30 RON
   3. Online Store                         165.00 RON
   ...
```

---

## 🏗️ How It Works

### Architecture

```
┌─────────────────┐
│   Your Bank     │  (via GoCardless Open Banking)
└────────┬────────┘
         │ PSD2 API
         ▼
┌─────────────────┐
│  Fetch Scripts  │  (connect-bank, fetch-historical, fetch-weekly)
└────────┬────────┘
         │ Transactions stored locally
         ▼
┌─────────────────┐
│ Configuration   │  (AI detects patterns, you confirm)
└────────┬────────┘
         │ Internal transfer rules
         ▼
┌─────────────────┐
│   Claude AI     │  (builds smart categories)
└────────┬────────┘
         │ Personalized categories
         ▼
┌─────────────────┐
│    Analysis     │  (accurate metrics & reports)
└─────────────────┘
```

### Privacy & Security

🔒 **What stays local:**
- All transaction data (`transactions_*.json`)
- Your configuration (`.account-config.json`)
- Bank connection info (`requisition.json`)
- Generated reports

🔐 **What's sent to APIs:**
- **GoCardless**: Bank credentials (OAuth flow, not stored)
- **Anthropic**: Redacted transaction data for categorization
  - Names → First 3 chars only (`"John Doe" → "Joh***"`)
  - IBANs → `RO**IBAN**REDACTED`
  - Long numbers → `[NUMBER_REDACTED]`

✅ **Security measures:**
- Secrets in `.env` (never committed)
- `.gitignore` for all sensitive data
- PII redaction before AI calls
- No third-party analytics or tracking

---

## 📁 Project Structure

```
personal-finance-ai/
├── connect-bank.js              # OAuth flow with GoCardless
├── fetch-historical.js          # Download 3 months of history
├── fetch-weekly.js              # Weekly transaction updates
├── configure-accounts-ai.js     # AI-powered configuration
├── build-smart-categories.js    # Generate personalized categories
├── analyze-spending.js          # Generate reports
├── lib/
│   └── file-utils.js           # Shared utilities
├── transactions_*.json          # Your data (gitignored)
├── smart-categories.json        # AI-generated categories (gitignored)
├── .account-config.json         # Your settings (gitignored)
├── .env                         # API keys (gitignored)
└── package.json                 # Dependencies
```

---

## 🤝 Contributing

Contributions are welcome! 

### Development Setup

```bash
# Fork and clone the repo
git clone https://github.com/alincatalin/financial-tracker-ai.git
cd financial-tracker-ai

# Install dependencies
npm install

# Run tests (coming soon)
npm test

# Format code
npx prettier --write "**/*.js"
```

### Reporting Issues

Found a bug? [Open an issue](https://github.com/yourusername/personal-finance-ai/issues) with:
- Description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your Node.js version and OS

---

## 📚 Documentation

- **[Quick Start Guide](QUICK_START.md)** - Commands reference
- **[Configuration Guide](CONFIGURATION_GUIDE.md)** - Detailed setup instructions
- **[Getting Started](GETTING_STARTED.md)** - Step-by-step walkthrough
- **[Security](SECURITY.md)** - Privacy and security details
---

## 🌍 Supported Banks

Works with any European bank that supports PSD2 Open Banking, including:

**Romania:** CEC Bank, BRD, BCR, ING Bank, Raiffeisen, UniCredit
**UK:** Barclays, HSBC, Lloyds, NatWest, Revolut, Monzo
**Germany:** Deutsche Bank, Commerzbank, N26, DKB
**France:** BNP Paribas, Crédit Agricole, Société Générale
**And 2,500+ more...**

Check full list: [GoCardless Coverage](https://nordigen.com/en/coverage/)

---

## 💡 Use Cases

- **Budget tracking** - See where your money actually goes
- **Savings optimization** - Identify areas to cut spending
- **Tax preparation** - Export transaction data for accountants
- **Financial planning** - Understand spending patterns over time
- **Expense reports** - For freelancers and contractors
- **Learning tool** - See how AI categorization works

---

## 🎓 Tech Stack

- **Node.js** - Runtime environment
- **GoCardless API** - Open Banking data access
- **Claude AI (Anthropic)** - Smart categorization & analysis
- **JavaScript** - Core language (no frameworks, pure Node.js)

---

## 🔮 Roadmap

- [ ] **v0.2.0** - Add web UI dashboard (React)
- [ ] **v0.3.0** - Multi-account support
- [ ] **v0.4.0** - Budget tracking & alerts
- [ ] **v0.5.0** - Export to PDF/CSV
- [ ] **v0.6.0** - Recurring transaction detection
- [ ] **v0.7.0** - Mobile app (React Native)
- [ ] **v1.0.0** - Stable release with tests

See [open issues](https://github.com/yourusername/personal-finance-ai/issues) for full roadmap.

---

## ⚠️ Disclaimer

This tool is for personal use only. Always verify financial data independently. The authors are not responsible for any financial decisions made based on this tool's output.

**Open Banking Disclaimer:** You're granting read-only access to your transaction history. No payments or transfers can be initiated through this tool.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**TL;DR:** You can use, modify, and distribute this software freely, even for commercial purposes, as long as you include the original license.

---

## 🙏 Acknowledgments

- **[GoCardless](https://gocardless.com/)** - For Open Banking API access
- **[Anthropic](https://www.anthropic.com/)** - For Claude AI capabilities
- **[Claude Code](https://www.anthropic.com/claude/code)** - For native integration support
- All contributors and testers who helped improve this tool

---

## 📞 Support

- **Documentation:** Check the [docs](QUICK_START.md) first
- **Issues:** [GitHub Issues](https://github.com/yourusername/personal-finance-ai/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/personal-finance-ai/discussions)
- **Email:** your.email@example.com

---

## ⭐ Star History

If you find this project useful, please consider giving it a star! It helps others discover the tool.

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/personal-finance-ai&type=Date)](https://star-history.com/#yourusername/personal-finance-ai&Date)

---

<p align="center">
  Made with ❤️ and <a href="https://www.anthropic.com/claude">Claude AI</a>
  <br>
  <sub>Your data, your machine, your control</sub>
</p>
