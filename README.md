# FinSight — Financial Clarity & Intelligence Platform

**Financial clarity. Intelligent decisions. Better control.**

FinSight is a full-stack Indian personal, investment, tax, fraud-protection, and small-business financial management platform built with **React 19, TypeScript, Tailwind CSS v4, Express, Firebase Auth/Firestore, and Gemini AI (`gemini-4-hydrogen`)**.

---

## Core Capabilities

### Personal Money & Forward Planning
- **Financial Health Index (`/app/financial-health`)**: Net worth breakdown, emergency reserve runway in months, 5-dimension composite score with disclosed formulas, and downloadable PDF snapshots.
- **Money Calendar & Cash-Flow Radar (`/app/money-calendar`)**: 7/30/90-day liquidity projection combining income, scheduled bills, credit card dues, and recurring charges with shortfall warnings and what-if expense testing.
- **Smart Budgeting & Money Inbox (`/app/budgeting/*`)**: CSV, XLSX, PDF statement, and bank SMS parsing with duplicate detection, multi-category transaction splitting, and automatic internal-transfer / card-settlement exclusion.
- **Credit Card & Debt Command Center (`/app/credit-cards`)**: Privacy-first card tracking (last 4 digits only — full PAN/CVV/PIN strictly rejected), Minimum vs Extra payment interest simulator, and Avalanche vs Snowball payoff planner.
- **Recurring Payments & Subscriptions (`/app/recurring-payments`)**: Pattern detection across historical expenses with monthly and annual run-rate summaries.
- **Goal-Based Financial Planning (`/app/goals`)**: Required monthly contribution calculations and what-if timeline acceleration sliders.

### Investing, Markets, Tax & Protection
- **Portfolio Guide & Risk Drift (`/app/investments`)**: Allocation breakdown, concentration metrics, 10% market shock stress simulator, and an Investment Decision Journal.
- **NSE Markets & Paper Trading (`/app/markets`)**: Historical NSE OHLCV candles, deterministic Moving Average / RSI strategy backtester, and virtual paper trading.
- **Indian Tax Center & Readiness (`/app/tax`)**: Versioned CBDT FY 2024-25 & FY 2025-26 Old vs New Regime calculator, Chapter VI-A deductions tracker, private Document Vault, and ITR Filing Readiness Checklist.
- **Scam & Fraud Shield (`/app/fraud`)**: Instant deterministic phishing/lookalike-domain & UPI/QR intent inspection paired with Gemini AI threat analysis and India National Cybercrime Helpline (`1930`) emergency guidance.

### Small Business Finance
- **GST Invoicing & Clients (`/app/business/*`)**: Multi-rate CGST/SGST & IGST invoicing, GSTIN validation, downloadable PDF tax invoices, business expense receipt vault, and EMI loan planner.
- **Receivables Aging & Ledger Reconciliation (`/app/business/receivables`, `/app/business/reconciliation`)**: Overdue invoice aging buckets (`1–30`, `31–60`, `61–90`, `90+` days), copy-only payment follow-up drafts, and bank-credit vs invoice reconciliation.

---

## Local Development & Verification

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Start full-stack dev server (Express + Vite on port 3000)
npm run dev

# 4. Run TypeScript check, production build, and test suites
npm run lint
npm run build
npm test
```

## Documentation

- [FinSight 2.0 Product Upgrade Overview](docs/FINSIGHT_2_0_PRODUCT_UPGRADE.md)
- [New Features Guide](docs/NEW_FEATURES.md)
- [Design System & Tokens](docs/DESIGN_SYSTEM.md)
- [API Integration Register](docs/API_INTEGRATION_REGISTER.md)
- [Final Security Audit](docs/FINAL_SECURITY_AUDIT.md)
- [Final QA Report](docs/FINAL_QA_REPORT.md)
- [GitHub Final Checklist](docs/GITHUB_FINAL_CHECKLIST.md)
