# FinSight 2.0 — New Features & Modules

## 1. Financial Health Index (`/app/financial-health`)
- **Net Worth & Cash Flow Summary**: Aggregates verified transactions (excluding internal transfers and credit card bill settlements), holdings, credit card balances, goals, and optional manual assets/liabilities.
- **Transparent 5-Dimension Composite Score**: Cash Flow Stability (25%), Savings Progress (20%), Debt Pressure (20%), Emergency Fund Readiness (20%), and Investment Diversification (15%) with disclosed formulas and missing-data notes.
- **Snapshot History & PDF Export**: Save historical monthly snapshots (`POST /api/v1/financial-health/snapshot`) and download formatted PDF reports (`GET /api/v1/financial-health/report/pdf` via `pdfkit`).

## 2. Money Calendar & Cash-Flow Radar (`/app/money-calendar`)
- **7 / 30 / 90-Day Horizon Projection**: Combines manual scheduled bills/inflows, upcoming credit card due dates, and confirmed recurring payments.
- **Shortfall Date Detection & What-If Simulator**: Flags projected negative balance dates and lets users test extra discretionary expenses before spending.

## 3. Money Inbox & Statement Triage (`/app/budgeting/import`)
- **Smart Deterministic Classification**: Detects Indian food, transit, utility, subscription, salary, and investment patterns while flagging internal transfers (`MARK_TRANSFER`) and credit card settlements (`MARK_CARD_PAYMENT`) to prevent double counting.
- **Transaction Splitting & Audit**: Split a single bank/UPI transaction across multiple budget categories with strict sum validation (`PATCH /api/v1/transactions/:id/inbox-action`).

## 4. Credit Card & Debt Command Center (`/app/credit-cards`)
- **Privacy-First Card Tracking**: Stores nickname, issuer, `lastFourDigits` only, credit limit, current balance, minimum due, APR, and due date (strictly rejects raw PAN, CVV, PIN, or OTP).
- **Minimum vs Extra Payment Simulator & Payoff Planner**: Compares paying Minimum Due only vs Extra Monthly Payments vs Avalanche and Snowball payoff schedules (`POST /api/v1/credit-cards/payoff-compare`).

## 5. Recurring Payments & Subscription Intelligence (`/app/recurring-payments`)
- **Pattern Detection**: Analyzes non-transfer expense history (`POST /api/v1/recurring-payments/detect`) to identify weekly, monthly, quarterly, and yearly charges with confidence ratings and annual run-rate impact.

## 6. Goal-Based Financial Planning (`/app/goals`)
- **Live Goal Projections**: Tracks Emergency Fund, Home, Education, Vehicle, Travel, Family, and Retirement goals with required monthly contribution calculations and what-if extra contribution sliders.

## 7. Enhanced Existing Modules
- **Investments (`/app/investments`)**: Added Allocation Ring Chart, Portfolio Risk & 10% Shock Stress Simulator (`GET /api/v1/investments/risk`), and Investment Decision Journal CRUD (`/api/v1/investments/journal`).
- **Indian Tax Center (`/app/tax`)**: Added FY Tax Filing Readiness Checklist (`GET/PUT /api/v1/tax/readiness`) and CBDT Tax Calendar deadlines alongside Old vs New Regime calculation and private Document Vault.
- **Scam & Fraud Shield (`/app/fraud`)**: Added live deterministic signal & lookalike domain pre-scan (`inspectFraudSignals`), UPI/QR intent safety inspector, Digital Arrest preset, and India National Cybercrime Helpline (`1930` / `cybercrime.gov.in`) emergency guidance.
- **Small Business Receivables & Reconciliation (`/app/business/receivables`, `/app/business/reconciliation`)**: Added invoice aging buckets (`not due`, `1–30`, `31–60`, `61–90`, `90+` days), copy-only payment follow-up drafts, and deterministic bank-credit vs GST-invoice reconciliation runs.
- **Global Command Palette (`Ctrl/Cmd + K`) & Mobile Bottom Navigation**: Fast keyboard workspace jump and responsive mobile navigation bar.
