# FinSight - AI for Finance (Product Blueprint & Technical Documentation)

## 1. Executive Summary & Product Architecture

FinSight is a production-grade, full-stack financial intelligence platform engineered for India. It unifies six core financial capabilities into one cohesive workspace:
1. **Smart Budgeting**: Automated UPI transaction parsing, category spending limits, and cash flow analysis.
2. **Investing & Portfolio Guide**: Asset allocation breakdown, index ETF tracking, and interactive SIP compounding calculators.
3. **Trading & Market Insights**: NSE historical index archives, backtesting engine, and risk-free virtual paper trading.
4. **Tax Helper**: Side-by-side Old vs New Tax Regime comparisons (CBDT FY 2025-26 rules), Section 80C/80D deduction organizers, and indicative liability calculators.
5. **Scam & Fraud Detector**: Server-side Gemini AI inspection for phishing SMS alerts, fake KYC updates, and fraudulent UPI collect links.
6. **Small Business Finance**: GST-compliant invoice generation (Intrastate CGST/SGST vs Interstate IGST), corporate expense logs, cash-flow projections, and reducing-balance EMI loan planners.

---

## 2. Technical Stack & Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React icons.
- **Backend**: Express on Node.js with Vite middleware.
- **AI Engine**: Server-side `@google/genai` TypeScript SDK invoking `gemini-3.8-flash` with strictly secured API credentials in `process.env.GEMINI_API_KEY`.
- **Database & Security**: Cloud Firestore data model with owner-isolated security rules (`firestore.rules`) enforcing Role-Based Access Control (RBAC).
- **Localization**: Currency formatted in Indian Numbering System (`formatINR` - Lakhs/Crores), timezone `Asia/Kolkata`, and financial year April–March cycle.

---

## 3. Mathematical & Deterministic Formulas

1. **Budget Savings Rate**: `(Savings / Total Income) * 100`
2. **Portfolio Gain/Loss**: `Quantity * Current Price - Quantity * Purchase Price`
3. **Reducing-Balance EMI**:
   $$EMI = P \times r \times \frac{(1 + r)^n}{(1 + r)^n - 1}$$
4. **SIP Compounding**:
   $$FV = P \times \frac{(1 + i)^n - 1}{i} \times (1 + i)$$
5. **GST Calculations**:
   - Intrastate: CGST = 9%, SGST = 9%
   - Interstate: IGST = 18%

---

## 4. Test Verification Summary

- Pure mathematical functions verified via Node.js built-in test runner (`npx tsx --test src/utils/financialMath.test.ts`):
  - Budget calculations & savings rates
  - Holding valuations & returns
  - Reducing-balance loan amortization
  - Intrastate & Interstate GST splits
  - Indian tax rebate thresholds (Section 87A)
  - Indian currency formatting (Lakhs and Crores)
- Visual browser inspection verified on both Desktop (1440x900) and Mobile (390x844) viewports.
