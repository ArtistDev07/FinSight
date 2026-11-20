# FinSight — Final Authentication & Security Audit

## 1. Executive Summary

The FinSight application has been hardened from an untrusted client-header identity model (`localStorage` `finsight_user_id` + `x-user-id` header) to cryptographic **Firebase Authentication** on the client and **Firebase Admin SDK (`verifyIdToken`)** verification on the Express backend.

- **Client-side identity spoofing removed**: `localStorage` user IDs are no longer used or trusted as credentials, and `window.fetch` / `globalThis.fetch` remain untouched.
- **Server-side zero-trust verification**: Every protected API endpoint requires a valid `Authorization: Bearer <idToken>` verified by `firebase-admin/auth`, deriving `uid` and `isAdmin` exclusively from the verified token and server-controlled allowlists/claims.
- **Strict per-user ownership isolation**: Every user-owned resource (`transactions`, `budgets`, `holdings`, `backtests`, `paperAccounts`, `paperTrades`, `taxDeductions`, `fraudAnalyses`, `clients`, `invoices`, `businessExpenses`, `emiPlans`, `notifications`) derives `ownerId` from `req.auth.uid` and rejects cross-user access with HTTP `403`.
- **Admin RBAC enforcement**: Every `/api/v1/admin/*` route is protected by `requireAuth` + `requireAdmin`, returning HTTP `401` when unauthenticated and HTTP `403` when authenticated without verified admin privileges.

---

## 2. Authentication Flow

### Frontend (`src/lib/firebase.ts`, `src/utils/api.ts`, `src/contexts/AuthContext.tsx`, `src/pages/auth/AuthPage.tsx`)
1. Firebase Web SDK is initialized from `firebase-applet-config.json` (`auth`, `db`, `googleProvider`).
2. `AuthContext` subscribes to `onAuthStateChanged(auth, ...)` and supports:
   - Google Sign-In (`signInWithPopup` with `GoogleAuthProvider`)
   - Email/Password Sign-In & Sign-Up (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `sendEmailVerification`)
   - Password Reset (`sendPasswordResetEmail`)
   - Sign Out (`signOut` + server-side `/api/v1/auth/revoke`)
3. `apiFetch` waits for `auth.authStateReady()`, calls `auth.currentUser.getIdToken()`, attaches `Authorization: Bearer <token>`, preserves all caller `RequestInit` options/headers, and automatically retries once with `getIdToken(true)` on HTTP `401` before triggering session sign-out if still unauthorized.
4. `App.tsx` gates `/app/*`, `/onboarding/*`, and `/admin*` routes behind verified authentication and admin state.

### Backend (`server.ts`)
1. `firebase-admin` initializes with the provisioned Firebase `projectId`.
2. `requireAuth` middleware extracts the Bearer token and calls `verifyFirebaseIdToken(token)`:
   - Calls `getAdminAuth().verifyIdToken(token, true)` (falling back to cryptographic `verifyIdToken(token, false)` only if GCP Application Default Credentials are absent in a local sandbox, never on invalid/expired/revoked tokens).
   - Enforces the server-side `revokedBeforeSecondsByUid` revocation timestamp map.
   - Rejects missing, empty, malformed, expired, invalid, or revoked tokens with HTTP `401`.
   - Attaches `req.auth = { uid, email, emailVerified, isAdmin, claims }` derived strictly from the decoded token.
3. Public endpoints (`/api/v1/health`, `/api/v1/markets/instruments`) remain accessible without authentication and expose zero user-specific data.

---

## 3. Ownership & Admin Authorization Rules

- **Ignored Untrusted Inputs**: `x-user-id`, `req.body.ownerId`, `req.body.role`, query user IDs, and `email.includes('admin')` heuristics are completely removed/ignored.
- **Resource Creation**: Server always stamps `ownerId: req.auth.uid`.
- **Resource Read/Update/Delete**: Endpoints for transactions (`/api/v1/transactions/:id`), holdings (`/api/v1/holdings/:id`), invoices (`/api/v1/business/invoices/:id` + payment), and notifications (`/api/v1/notifications/:id/read`) verify `resource.ownerId === req.auth.uid`, returning HTTP `403` on cross-user access and HTTP `404` if missing.
- **Admin Authorization**: `isTrustedAdminToken` grants admin access only for verified Firebase custom claims (`admin === true` or `role === 'ADMIN'`) or server-controlled UID/verified-email allowlists (`email_verified === true` required). `app.use('/api/v1/admin', requireAuth, requireAdmin)` protects all admin routes.
- **Firestore Rules (`firestore.rules` + `firebase-blueprint.json`)**: Updated and deployed with default-deny catchall, immutable `ownerId`/`uid`, anti-privilege-escalation checks on `users/{userId}`, and read-only server-managed `admins/{uid}`.

---

## 4. Verification Results

- **Unit & Security Integration Tests** (`npx tsx --test src/utils/financialMath.test.ts src/utils/security.test.ts src/utils/authSecurity.test.ts`): **39/39 passed**, covering:
  1. Missing Firebase token (`401`)
  2. Invalid/forged Firebase token verified against real `firebase-admin` (`401`)
  3. Expired Firebase token (`401`, `AUTH_TOKEN_EXPIRED`)
  4. Valid authenticated user identity and isolated resource creation (`200`/`201`)
  5. Forged `x-user-id` header rejected when unauthenticated (`401`) and ignored when authenticated
  6. Forged `ownerId` in request body ignored (`ownerId` forced to verified `req.auth.uid`)
  7. Cross-user transaction list/get/update/delete blocked (`403`)
  8. Cross-user holding modification/deletion blocked (`403`)
  9. Cross-user invoice deletion blocked (`403`)
  10. Normal user accessing `/api/v1/admin/*` blocked (`403`); verified admin claim allowed (`200`)
  11. Forged admin role via profile payload, `admin-*` email heuristic, or unverified email rejected (`403`)
  12. Revoked Firebase token (`auth/id-token-revoked`) and `/api/v1/auth/revoke` rejected (`401`)
- **TypeScript Type Check** (`tsc --noEmit`): Passed with 0 errors.
- **Production Bundle Build** (`npm run build`): Succeeded.
- **Playwright Browser Verification (`http://localhost:3000`)**:
  - `/` Landing Page rendered with 0 console errors.
  - `/auth/sign-in` rendered Google Sign-In + Email/Password form with 0 console errors.
  - `/app/dashboard` gated unauthenticated navigation to the Sign-In view.
  - Unauthenticated browser `fetch` checks confirmed `/api/v1/transactions` -> `401`, `/api/v1/admin/dashboard` -> `401`, `/api/v1/markets/instruments` -> `200`.

---

## 5. Remaining Risks & Operational Notes

1. **In-Memory Backend Store**: Backend domain records in `server.ts` currently reside in an in-memory store (`createInitialStore()`), meaning records reset on server process restart. Migrating API persistence to Firestore Admin SDK or Cloud SQL is recommended for multi-instance production persistence.
2. **Firebase Auth Providers**: `ProvisionFirebase` enables Google Sign-In out of the box. If Email/Password sign-in is used in production, ensure the Email/Password provider is enabled in Firebase Console -> Authentication -> Sign-in method.
3. **Token Revocation in Non-ADC Environments**: Full upstream `checkRevoked: true` verification requires GCP Application Default Credentials (`identitytoolkit` read access) on the server host; in environments lacking ADC, cryptographic verification + the server-side `revokedBeforeSecondsByUid` map remain active until restart.
