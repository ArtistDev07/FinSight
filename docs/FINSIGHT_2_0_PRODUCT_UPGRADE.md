# FinSight 2.0 — Product Upgrade & Architecture Overview

## Product Vision

**FinSight** — *Financial clarity. Intelligent decisions. Better control.*

FinSight 2.0 transforms the existing personal finance, investment, market research, taxation, fraud protection, and small-business platform into an integrated financial decision workspace tailored to Indian households, salaried professionals, investors, and small businesses.

The user journey evolves from static record-keeping into a causal four-stage workflow:

**Track Money → Understand Money → Predict Financial Impact → Take Better Actions**

## Key Architectural Principles

1. **Deterministic Financial Engines First**: Every numerical metric—including Net Worth, Financial Health Score, Emergency Runway, Cash-Flow Radar, Credit Card Minimum vs Extra Payment Interest, Avalanche vs Snowball Payoff, GST multi-rate calculations, CBDT FY 2024-25 / FY 2025-26 Old vs New Regime tax math, Portfolio Shock Stress Tests, and Receivables Aging—is computed deterministically in audited TypeScript (`src/utils/financialMath.ts` and `src/utils/financialIntelligence.ts`), never by LLM guesswork.
2. **Gemini AI Grounded Explanations**: Server-side Gemini (`GEMINI_MODEL = 'gemini-4-hydrogen'`) operates strictly as an explanatory copilot grounded in verified user records, separating verified observations from estimates.
3. **Zero Sensitive Financial Credentials**: Credit card management strictly accepts non-sensitive `lastFourDigits` and rejects full PANs, CVV/CVC, UPI PINs, OTPs, or banking passwords with HTTP 400.
4. **User-Confirmed Actions Only**: FinSight never sends automatic emails/messages, initiates bank transfers, or places automated trades. Payment follow-ups remain copy-only drafts until explicitly marked sent externally by the user, and reconciliation matches require explicit user confirmation.
5. **Dual Theme & Multi-Language Experience**: Full Light Mode ("Warm Editorial Mint") and Dark Mode ("Deep Emerald Editorial") token architecture (`--fs-*`) with English (`en`) and Hindi (`hi`) localization (`src/utils/i18n.ts`).
