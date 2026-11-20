# GitHub Submission & Release Checklist

## 1. Repository Hygiene & Secrets Safety
- [x] `.gitignore` excludes `node_modules/`, `dist/`, `build/`, `coverage/`, `.env*` (except `.env.example`), `.finsight-data/`, and `.playwright-cli/`.
- [x] Zero hardcoded API keys, private keys, service account JSON files, or secrets committed in source files.
- [x] `.env.example` contains only placeholder keys and documentation comments.
- [x] Public Firebase client config (`firebase-applet-config.json`) matches deployed project `gen-lang-client-0419535639`.

## 2. Authentication & Security Boundaries
- [x] Zero `x-user-id` headers or `localStorage` identity trust in `src/utils/api.ts` or `src/contexts/AuthContext.tsx`.
- [x] Zero `window.fetch` or `globalThis.fetch` overrides in `src/main.tsx`.
- [x] Backend verifies Firebase ID tokens via Firebase Admin SDK (`verifyIdToken`) and enforces session revocation (`/api/v1/auth/revoke`).
- [x] Owner-scoped isolation enforced across all user collections (`transactions`, `budgets`, `portfolios`, `holdings`, `watchlists`, `backtests`, `paperAccounts`, `taxDocuments`, `invoices`, `businessExpenses`, `aiConversations`, `notifications`).
- [x] Admin routes (`/api/v1/admin/*`) gated by `requireAdmin` (verified custom claims / server-controlled allowlist with `email_verified: true`).
- [x] File vault enforces allowlisted extensions (`.pdf`, `.csv`, `.xlsx`, `.txt`, `.png`, `.jpg`, `.jpeg`), 10 MB limit, magic-byte inspection, and owner directory isolation.
- [x] `firestore.rules` deployed and `storage.rules` + `firebase-blueprint.json` synchronized with collections.

## 3. Functional & Integration Verification
- [x] `npm run lint` (`tsc --noEmit`) passes with 0 errors.
- [x] `npm run build` (`vite build`) compiles cleanly.
- [x] `npm test` (`tsx --test`) passes all 53 test cases across financial math, security isolation, auth verification, and full-stack integration tests.
- [x] Live `/api/v1/health` reports Firebase Auth, Firestore Rules, Document Vault, Gemini 4 Hydrogen, NSE Archive, and CBDT Tax Rulesets readiness.
- [x] Headless Chromium Playwright visual & responsive verification passed across Desktop (`1440x900`), Tablet (`768x1024`), and Mobile (`390x844`) with 0 console errors and 0 horizontal overflow.

## 4. Pre-Push Manual Step
Run `git status` and `git diff` locally before committing to verify no temporary or untracked artifacts are staged.
