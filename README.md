# FinSight — AI-Powered Financial Intelligence Platform

FinSight is a full-stack Indian personal finance, investment education, market strategy backtesting, income tax comparison, scam/fraud analysis, and small-business GST accounting application built with React, TypeScript, Tailwind CSS, Express, Firebase Authentication, Firestore security rules, and Gemini AI (`gemini-4-hydrogen`).

## Core Modules & Capabilities

1. **Smart Budgeting & Statement Processing**
   - Manual transactions, category budgets, and live savings-rate metrics (`calculateBudgetMetrics`).
   - Multi-format bank statement parsing (`csv-parse`, `xlsx`, `unpdf`, plain text, and Indian bank SMS alerts).
   - Automatic duplicate detection (`flagDuplicateCandidates`) with staged preview before ledger import and persisted import history.
2. **Investing & Portfolio Guide**
   - Multi-portfolio management (`GET/POST /api/v1/portfolios`), holding valuations, unrealized P&L, and asset allocation breakdowns.
3. **Trading, Watchlists, Backtesting & Paper Trading**
   - 140-session verified NSE historical OHLCV archive (`NIFTY 50`, `BANKNIFTY`, `RELIANCE`, `TCS`, `INFY`, `HDFCBANK`, `NIFTYBEES`).
   - Real historical candle strategy backtester (`runHistoricalBacktest`) with equity curve, drawdown, win rate, and brokerage friction.
   - User watchlists CRUD and isolated ₹10,00,000 virtual paper trading account with sell-quantity enforcement and reset.
4. **Income Tax Helper (CBDT FY 2025-26 & FY 2024-25)**
   - Versioned Old vs. New Regime (`Section 115BAC`) comparison with standard deductions, Section 87A rebate, surcharge tiers, and 4% cess.
   - Chapter VI-A deductions ledger, saved calculation audit snapshots, and owner-isolated encrypted-boundary document vault (`.pdf`, `.png`, `.jpg`).
5. **Scam & Fraud Detector**
   - Server-side Gemini 4 Hydrogen (`@google/genai`) structured JSON analysis returning risk score, severity, suspicious keywords, findings, and safety actions, with honest HTTP `503`/`429`/`502` error propagation.
6. **Small Business Finance & GST Invoicing**
   - Business profile & 15-character GSTIN validation (`validateGSTIN`).
   - Multi-rate (`0%`, `5%`, `12%`, `18%`, `28%`) CGST/SGST vs. IGST invoice builder, partial/full payment tracking, binary PDF Tax Invoice download (`pdfkit`), business expense receipt vault, live 3-month cash-flow runway forecast, and reducing-balance EMI planner.
7. **Global FinSight AI Assistant & Admin Console**
   - Grounded conversational AI with persisted history (`/api/v1/ai/conversations`), rate limiting (20 req/min/user), and audit logs.
   - Admin governance console protected by Firebase custom claims / allowlisted verified emails (`/api/v1/admin/*`).

## Architecture & Security

- **Frontend Auth**: Firebase Authentication SDK (`Google` + `Email/Password` + `Email Verification` + `Password Reset`). All protected requests attach `Authorization: Bearer <idToken>` via `src/utils/api.ts`.
- **Backend Verification**: Express middleware (`requireAuth`, `requireAdmin`) validates Bearer tokens via Firebase Admin `verifyIdToken()` and derives `ownerId` strictly from `req.auth.uid`.
- **Database & File Rules**: `firestore.rules`, `storage.rules`, and `firebase-blueprint.json` enforce strict per-owner access and MIME/size upload policies. Server persistence uses `.finsight-data/store.json` and `.finsight-data/vault/<uid>/` (gitignored).

## Quick Start

### Prerequisites
- Node.js 20+
- npm

### Installation & Local Development
```bash
npm install
cp .env.example .env
# Configure GEMINI_API_KEY in .env (optional: MARKET_DATA_API_KEY, ADMIN_EMAILS)
npm run dev
```
The Express + Vite application serves on `http://localhost:3000`.

### Scripts
- `npm run dev` — Start development server (`tsx server.ts`) on port 3000.
- `npm run build` — Build production frontend bundle (`vite build`).
- `npm run lint` — Type-check entire TypeScript codebase (`tsc --noEmit`).
- `npm test` — Run all unit, security, and full-stack integration tests (`tsx --test`).
- `npm start` — Start runtime entry (`node server.ts`).

## Environment Variables (`.env.example`)
- `GEMINI_API_KEY` — Server-side Google Gemini API key for `@google/genai` (`gemini-4-hydrogen`).
- `APP_URL` — Hosted application origin URL.
- `FIREBASE_PROJECT_ID` / `ADMIN_EMAILS` / `ADMIN_UIDS` / `MARKET_DATA_API_KEY` — Optional overrides.

## Educational & Regulatory Disclaimer
FinSight is an educational financial intelligence and simulation platform. It does not execute real brokerage trades, process live bank transfers, or substitute for advice from a SEBI-registered investment advisor or Chartered Accountant.
