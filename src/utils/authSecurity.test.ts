import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { createApp, createInitialStore, revokedBeforeSecondsByUid } from '../../server';

function makeDecodedToken(overrides: Partial<DecodedIdToken>): DecodedIdToken {
  const now = Math.floor(Date.now() / 1000);
  return {
    aud: 'gen-lang-client-0419535639',
    auth_time: now - 10,
    exp: now + 3600,
    firebase: { identities: {}, sign_in_provider: 'google.com' },
    iat: now - 10,
    iss: 'https://securetoken.google.com/gen-lang-client-0419535639',
    sub: overrides.uid || 'uid-default',
    uid: overrides.uid || 'uid-default',
    ...overrides,
  };
}

async function startTestServer(verifyToken?: (token: string) => Promise<DecodedIdToken>) {
  const store = createInitialStore();
  const { app, db } = createApp({ store, verifyToken });
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    baseUrl,
    db,
    close: () => new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve()))),
  };
}

test('Real Firebase Admin SDK rejects missing, malformed, and forged tokens on protected routes', async (t) => {
  // Uses the real verifyFirebaseIdToken default (no mock verifier)
  const srv = await startTestServer();
  try {
    await t.test('Public endpoints succeed without authentication', async () => {
      const healthRes = await fetch(`${srv.baseUrl}/api/v1/health`);
      assert.equal(healthRes.status, 200);
      const marketsRes = await fetch(`${srv.baseUrl}/api/v1/markets/instruments`);
      assert.equal(marketsRes.status, 200);
    });

    await t.test('1. Missing Firebase token returns HTTP 401', async () => {
      const resMe = await fetch(`${srv.baseUrl}/api/v1/auth/me`);
      assert.equal(resMe.status, 401);

      const resTx = await fetch(`${srv.baseUrl}/api/v1/transactions`);
      assert.equal(resTx.status, 401);

      const resAdmin = await fetch(`${srv.baseUrl}/api/v1/admin/dashboard`);
      assert.equal(resAdmin.status, 401);
    });

    await t.test('2. Invalid / forged Firebase token returns HTTP 401', async () => {
      const resBad = await fetch(`${srv.baseUrl}/api/v1/transactions`, {
        headers: { Authorization: 'Bearer invalid.forged.jwt' },
      });
      assert.equal(resBad.status, 401);

      const resEmptyBearer = await fetch(`${srv.baseUrl}/api/v1/transactions`, {
        headers: { Authorization: 'Bearer   ' },
      });
      assert.equal(resEmptyBearer.status, 401);
    });

    await t.test('5a. Forged x-user-id header without Firebase token is rejected with HTTP 401', async () => {
      const resForgedHeader = await fetch(`${srv.baseUrl}/api/v1/transactions`, {
        headers: { 'x-user-id': 'user-default-1' },
      });
      assert.equal(resForgedHeader.status, 401);

      const resForgedAdminHeader = await fetch(`${srv.baseUrl}/api/v1/admin/dashboard`, {
        headers: { 'x-user-id': 'admin-1' },
      });
      assert.equal(resForgedAdminHeader.status, 401);
    });
  } finally {
    await srv.close();
  }
});

test('Firebase Auth Middleware, Ownership Isolation & Admin RBAC Security Suite', async (t) => {
  const tokenMap = new Map<string, DecodedIdToken>();
  const expiredTokens = new Set<string>(['token-expired']);
  const revokedTokens = new Set<string>(['token-revoked']);

  tokenMap.set(
    'token-user-a',
    makeDecodedToken({
      uid: 'uid-user-a',
      email: 'usera@example.com',
      email_verified: true,
      name: 'User A',
    })
  );
  tokenMap.set(
    'token-user-b',
    makeDecodedToken({
      uid: 'uid-user-b',
      email: 'userb@example.com',
      email_verified: true,
      name: 'User B',
    })
  );
  tokenMap.set(
    'token-fake-admin-email',
    makeDecodedToken({
      uid: 'uid-fake-admin',
      email: 'admin-super@example.com',
      email_verified: true,
      name: 'Fake Admin',
    })
  );
  tokenMap.set(
    'token-unverified-admin-email',
    makeDecodedToken({
      uid: 'uid-unverified-admin',
      email: 'yogesh.devhub@gmail.com',
      email_verified: false,
      name: 'Unverified Spoof',
    })
  );
  tokenMap.set(
    'token-real-admin',
    makeDecodedToken({
      uid: 'uid-real-admin',
      email: 'security-lead@finsight.internal',
      email_verified: true,
      admin: true,
      role: 'ADMIN',
      name: 'Real Admin',
    })
  );

  const mockVerifier = async (token: string): Promise<DecodedIdToken> => {
    if (expiredTokens.has(token)) {
      const err = new Error('Firebase ID token has expired.') as Error & { code?: string };
      err.code = 'auth/id-token-expired';
      throw err;
    }
    if (revokedTokens.has(token)) {
      const err = new Error('Firebase ID token has been revoked.') as Error & { code?: string };
      err.code = 'auth/id-token-revoked';
      throw err;
    }
    const decoded = tokenMap.get(token);
    if (!decoded) {
      const err = new Error('Invalid Firebase ID token.') as Error & { code?: string };
      err.code = 'auth/argument-error';
      throw err;
    }
    const revokedBefore = revokedBeforeSecondsByUid.get(decoded.uid);
    if (revokedBefore !== undefined && decoded.auth_time <= revokedBefore) {
      const err = new Error('Firebase ID token has been revoked.') as Error & { code?: string };
      err.code = 'auth/id-token-revoked';
      throw err;
    }
    return decoded;
  };

  const srv = await startTestServer(mockVerifier);

  try {
    let userBTxId = '';
    let userBHoldingId = '';
    let userBInvoiceId = '';

    await t.test('3. Expired Firebase token returns HTTP 401', async () => {
      const res = await fetch(`${srv.baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: 'Bearer token-expired' },
      });
      assert.equal(res.status, 401);
      const json = (await res.json()) as { error: { code: string } };
      assert.equal(json.error.code, 'AUTH_TOKEN_EXPIRED');
    });

    await t.test('4. Valid authenticated user receives verified UID and creates isolated records', async () => {
      const meRes = await fetch(`${srv.baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: 'Bearer token-user-a' },
      });
      assert.equal(meRes.status, 200);
      const meJson = (await meRes.json()) as { data: { uid: string; role: string } };
      assert.equal(meJson.data.uid, 'uid-user-a');
      assert.equal(meJson.data.role, 'USER');

      // Seed User B's private transaction, holding, and invoice via User B's token
      const txBRes = await fetch(`${srv.baseUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-user-b', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'User B Private Payroll',
          amount: 95000,
          type: 'INCOME',
          category: 'Salary',
        }),
      });
      assert.equal(txBRes.status, 201);
      const txBJson = (await txBRes.json()) as { data: { id: string; ownerId: string } };
      assert.equal(txBJson.data.ownerId, 'uid-user-b');
      userBTxId = txBJson.data.id;

      const holdBRes = await fetch(`${srv.baseUrl}/api/v1/holdings`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-user-b', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instrumentSymbol: 'TCS',
          instrumentName: 'TCS Ltd',
          assetType: 'Equity',
          quantity: 10,
          purchasePrice: 4000,
        }),
      });
      assert.equal(holdBRes.status, 201);
      const holdBJson = (await holdBRes.json()) as { data: { id: string; ownerId: string } };
      assert.equal(holdBJson.data.ownerId, 'uid-user-b');
      userBHoldingId = holdBJson.data.id;

      const invBRes = await fetch(`${srv.baseUrl}/api/v1/business/invoices`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-user-b', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: 'User B Client Corp',
          placeOfSupply: '29 - Karnataka (Intrastate)',
          lineItems: [{ id: '1', description: 'Advisory', quantity: 1, unitPrice: 50000, taxRate: 18 }],
        }),
      });
      assert.equal(invBRes.status, 201);
      const invBJson = (await invBRes.json()) as { data: { id: string; ownerId: string } };
      assert.equal(invBJson.data.ownerId, 'uid-user-b');
      userBInvoiceId = invBJson.data.id;
    });

    await t.test('5b. Forged x-user-id header on authenticated request cannot impersonate User B', async () => {
      const res = await fetch(`${srv.baseUrl}/api/v1/transactions`, {
        headers: {
          Authorization: 'Bearer token-user-a',
          'x-user-id': 'uid-user-b',
        },
      });
      assert.equal(res.status, 200);
      const json = (await res.json()) as { data: Array<{ ownerId: string }> };
      assert.equal(json.data.some(item => item.ownerId === 'uid-user-b'), false);
    });

    await t.test('6. Forged ownerId in request body is ignored and overwritten with verified UID', async () => {
      const res = await fetch(`${srv.baseUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-user-a',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerId: 'uid-user-b',
          description: 'Spoof attempt transaction',
          amount: 1500,
          type: 'EXPENSE',
          category: 'Food',
        }),
      });
      assert.equal(res.status, 201);
      const json = (await res.json()) as { data: { ownerId: string } };
      assert.equal(json.data.ownerId, 'uid-user-a');
    });

    await t.test('7. User A cannot read, update, or delete User B transaction', async () => {
      const listRes = await fetch(`${srv.baseUrl}/api/v1/transactions`, {
        headers: { Authorization: 'Bearer token-user-a' },
      });
      const listJson = (await listRes.json()) as { data: Array<{ id: string }> };
      assert.equal(listJson.data.some(item => item.id === userBTxId), false);

      const getRes = await fetch(`${srv.baseUrl}/api/v1/transactions/${userBTxId}`, {
        headers: { Authorization: 'Bearer token-user-a' },
      });
      assert.equal(getRes.status, 403);

      const putRes = await fetch(`${srv.baseUrl}/api/v1/transactions/${userBTxId}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer token-user-a', 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1 }),
      });
      assert.equal(putRes.status, 403);

      const delRes = await fetch(`${srv.baseUrl}/api/v1/transactions/${userBTxId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token-user-a' },
      });
      assert.equal(delRes.status, 403);
    });

    await t.test('8. User A cannot modify or delete User B holding', async () => {
      const putRes = await fetch(`${srv.baseUrl}/api/v1/holdings/${userBHoldingId}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer token-user-a', 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 9999 }),
      });
      assert.equal(putRes.status, 403);

      const delRes = await fetch(`${srv.baseUrl}/api/v1/holdings/${userBHoldingId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token-user-a' },
      });
      assert.equal(delRes.status, 403);

      const verifyRes = await fetch(`${srv.baseUrl}/api/v1/holdings/${userBHoldingId}`, {
        headers: { Authorization: 'Bearer token-user-b' },
      });
      assert.equal(verifyRes.status, 200);
      const verifyJson = (await verifyRes.json()) as { data: { quantity: number } };
      assert.equal(verifyJson.data.quantity, 10);
    });

    await t.test('9. User A cannot delete User B invoice', async () => {
      const delRes = await fetch(`${srv.baseUrl}/api/v1/business/invoices/${userBInvoiceId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token-user-a' },
      });
      assert.equal(delRes.status, 403);

      const verifyRes = await fetch(`${srv.baseUrl}/api/v1/business/invoices/${userBInvoiceId}`, {
        headers: { Authorization: 'Bearer token-user-b' },
      });
      assert.equal(verifyRes.status, 200);
    });

    await t.test('10. Normal user accessing /api/v1/admin/* gets HTTP 403; trusted admin gets HTTP 200', async () => {
      const userAdminDash = await fetch(`${srv.baseUrl}/api/v1/admin/dashboard`, {
        headers: { Authorization: 'Bearer token-user-a' },
      });
      assert.equal(userAdminDash.status, 403);

      const userAdminUsers = await fetch(`${srv.baseUrl}/api/v1/admin/users`, {
        headers: { Authorization: 'Bearer token-user-a' },
      });
      assert.equal(userAdminUsers.status, 403);

      const realAdminDash = await fetch(`${srv.baseUrl}/api/v1/admin/dashboard`, {
        headers: { Authorization: 'Bearer token-real-admin' },
      });
      assert.equal(realAdminDash.status, 200);
    });

    await t.test('11. Forged admin role via profile payload, email string, or unverified email is rejected', async () => {
      // Attempt client-side role promotion in PUT /api/v1/profile
      const updateRes = await fetch(`${srv.baseUrl}/api/v1/profile`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer token-user-a', 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'ADMIN', fullName: 'Promoted User' }),
      });
      assert.equal(updateRes.status, 200);
      const updateJson = (await updateRes.json()) as { data: { role: string } };
      assert.equal(updateJson.data.role, 'USER', 'Client must never promote its own role');

      const adminRetry = await fetch(`${srv.baseUrl}/api/v1/admin/dashboard`, {
        headers: { Authorization: 'Bearer token-user-a' },
      });
      assert.equal(adminRetry.status, 403);

      // Email containing "admin" without trusted claim
      const fakeEmailAdmin = await fetch(`${srv.baseUrl}/api/v1/admin/dashboard`, {
        headers: { Authorization: 'Bearer token-fake-admin-email' },
      });
      assert.equal(fakeEmailAdmin.status, 403);

      // Admin allowlisted email with email_verified: false must be rejected
      const unverifiedAdmin = await fetch(`${srv.baseUrl}/api/v1/admin/dashboard`, {
        headers: { Authorization: 'Bearer token-unverified-admin-email' },
      });
      assert.equal(unverifiedAdmin.status, 403);
    });

    await t.test('12. Revoked Firebase token returns HTTP 401 (both provider-revoked and server-revoked)', async () => {
      const revokedRes = await fetch(`${srv.baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: 'Bearer token-revoked' },
      });
      assert.equal(revokedRes.status, 401);
      const revokedJson = (await revokedRes.json()) as { error: { code: string } };
      assert.equal(revokedJson.error.code, 'AUTH_TOKEN_REVOKED');

      // Explicit session revocation via /api/v1/auth/revoke invalidates prior tokens for that UID
      const revokeCall = await fetch(`${srv.baseUrl}/api/v1/auth/revoke`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-user-a' },
      });
      assert.equal(revokeCall.status, 200);

      const postRevokeRes = await fetch(`${srv.baseUrl}/api/v1/transactions`, {
        headers: { Authorization: 'Bearer token-user-a' },
      });
      assert.equal(postRevokeRes.status, 401);
      const postRevokeJson = (await postRevokeRes.json()) as { error: { code: string } };
      assert.equal(postRevokeJson.error.code, 'AUTH_TOKEN_REVOKED');
    });

    await t.test('Frontend apiFetch and AuthContext contain zero x-user-id or window.fetch overrides', () => {
      const apiSrc = readFileSync(path.resolve('src/utils/api.ts'), 'utf-8');
      const authCtxSrc = readFileSync(path.resolve('src/contexts/AuthContext.tsx'), 'utf-8');
      const mainSrc = readFileSync(path.resolve('src/main.tsx'), 'utf-8');

      assert.equal(apiSrc.includes('x-user-id'), false);
      assert.equal(apiSrc.includes('finsight_user_id'), false);
      assert.equal(apiSrc.includes('getIdToken'), true);
      assert.equal(apiSrc.includes('Bearer'), true);
      assert.equal(authCtxSrc.includes("localStorage.getItem('finsight_user_id')"), false);
      assert.equal(mainSrc.includes('window.fetch ='), false);
    });
  } finally {
    revokedBeforeSecondsByUid.clear();
    await srv.close();
  }
});
