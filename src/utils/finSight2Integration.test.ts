import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { createApp, createInitialStore } from '../../server';

function makeToken(uid: string, email: string): DecodedIdToken {
  const now = Math.floor(Date.now() / 1000);
  return {
    aud: 'gen-lang-client-0419535639',
    auth_time: now - 5,
    exp: now + 3600,
    firebase: { identities: {}, sign_in_provider: 'google.com' },
    iat: now - 5,
    iss: 'https://securetoken.google.com/gen-lang-client-0419535639',
    sub: uid,
    uid,
    email,
    email_verified: true,
    name: uid,
  };
}

test('FinSight 2.0 Integration: Health PDF, Credit Card Privacy, Inbox Split, Recurring, Tax Readiness, Receivables & Reconciliation', async (t) => {
  const tempVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finsight2-test-'));
  const tokens = new Map<string, DecodedIdToken>([
    ['tok-alice', makeToken('uid-alice', 'alice@finsight.in')],
    ['tok-bob', makeToken('uid-bob', 'bob@finsight.in')],
  ]);

  const store = createInitialStore();
  const { app } = createApp({
    store,
    vaultRootDir: tempVaultDir,
    verifyToken: async tok => {
      const hit = tokens.get(tok);
      if (!hit) throw new Error('Invalid test token');
      return hit;
    },
  });

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;

  try {
    await t.test('Money Inbox split validation, transfer exclusion & Financial Health Score + PDF report', async () => {
      // Seed income + expense + card bill settlement
      await fetch(`${baseUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'TechCorp Salary',
          merchant: 'TechCorp',
          amount: 120000,
          type: 'INCOME',
          category: 'Salary',
          transactionDate: '2026-04-01',
        }),
      });

      const billTxRes = await fetch(`${baseUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'Amazon & Grocery Order',
          merchant: 'Amazon',
          amount: 4000,
          type: 'EXPENSE',
          category: 'Shopping',
          transactionDate: '2026-04-03',
        }),
      });
      const billTx = (await billTxRes.json()) as { data: { id: string } };

      // Invalid split sum must return 400
      const badSplit = await fetch(`${baseUrl}/api/v1/transactions/${billTx.data.id}/inbox-action`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SPLIT',
          splitItems: [
            { category: 'Groceries', amount: 1500 },
            { category: 'Electronics', amount: 1500 },
          ],
        }),
      });
      assert.equal(badSplit.status, 400);

      // Valid split succeeds
      const okSplit = await fetch(`${baseUrl}/api/v1/transactions/${billTx.data.id}/inbox-action`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SPLIT',
          splitItems: [
            { category: 'Groceries', amount: 2500 },
            { category: 'Shopping', amount: 1500 },
          ],
        }),
      });
      assert.equal(okSplit.status, 200);

      // Card bill settlement marked as MARK_CARD_PAYMENT should be excluded from monthlyExpenses
      const ccBillTxRes = await fetch(`${baseUrl}/api/v1/transactions`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'HDFC Card Settlement',
          merchant: 'HDFC',
          amount: 25000,
          type: 'EXPENSE',
          category: 'Other',
          transactionDate: '2026-04-05',
        }),
      });
      const ccBillTx = (await ccBillTxRes.json()) as { data: { id: string } };
      await fetch(`${baseUrl}/api/v1/transactions/${ccBillTx.data.id}/inbox-action`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_CARD_PAYMENT' }),
      });

      const healthRes = await fetch(`${baseUrl}/api/v1/financial-health/summary`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(healthRes.status, 200);
      const healthJson = (await healthRes.json()) as {
        data: { monthlyIncome: number; monthlyExpenses: number; compositeIndex: number };
      };
      assert.equal(healthJson.data.monthlyIncome, 120000);
      assert.equal(healthJson.data.monthlyExpenses, 4000);

      // Save snapshot & download PDF report
      const snapRes = await fetch(`${baseUrl}/api/v1/financial-health/snapshot`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(snapRes.status, 201);

      const pdfRes = await fetch(`${baseUrl}/api/v1/financial-health/report/pdf`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(pdfRes.status, 200);
      assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
      const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
      assert.equal(pdfBuf.subarray(0, 4).toString('ascii'), '%PDF');
    });

    await t.test('Credit Cards strictly reject PAN, CVV & >4-digit card numbers, and isolate tenants', async () => {
      const rejectPan = await fetch(`${baseUrl}/api/v1/credit-cards`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'Millennia',
          issuer: 'HDFC',
          cardNumber: '4111222233334444',
          lastFourDigits: '4444',
          creditLimit: 150000,
        }),
      });
      assert.equal(rejectPan.status, 400);

      const rejectCvv = await fetch(`${baseUrl}/api/v1/credit-cards`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'Millennia',
          issuer: 'HDFC',
          cvv: '123',
          lastFourDigits: '4444',
          creditLimit: 150000,
        }),
      });
      assert.equal(rejectCvv.status, 400);

      const reject5Digits = await fetch(`${baseUrl}/api/v1/credit-cards`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'Millennia',
          issuer: 'HDFC',
          lastFourDigits: '12345',
          creditLimit: 150000,
        }),
      });
      assert.equal(reject5Digits.status, 400);

      const validCardRes = await fetch(`${baseUrl}/api/v1/credit-cards`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: 'HDFC Millennia',
          issuer: 'HDFC Bank',
          lastFourDigits: '4444',
          creditLimit: 150000,
          currentBalance: 30000,
          annualInterestRate: 36,
        }),
      });
      assert.equal(validCardRes.status, 201);
      const validCard = (await validCardRes.json()) as { data: { id: string } };

      // Bob cannot read Alice's card statements
      const bobRes = await fetch(`${baseUrl}/api/v1/credit-cards/${validCard.data.id}/statements`, {
        headers: { Authorization: 'Bearer tok-bob' },
      });
      assert.equal(bobRes.status, 403);

      const payoffRes = await fetch(`${baseUrl}/api/v1/credit-cards/payoff-compare`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyBudget: 10000 }),
      });
      assert.equal(payoffRes.status, 200);
    });

    await t.test('Goals, Money Calendar Radar, Recurring Detection, Risk Journal, Tax Readiness & Business Receivables/Reconciliation', async () => {
      // Goal CRUD + cross-tenant 403
      const gRes = await fetch(`${baseUrl}/api/v1/goals`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Emergency Corpus',
          category: 'Emergency Fund',
          targetAmount: 200000,
          currentAmount: 50000,
          targetDate: '2027-06-01',
          monthlyContribution: 10000,
          priority: 'HIGH',
        }),
      });
      assert.equal(gRes.status, 201);
      const goal = (await gRes.json()) as { data: { id: string } };

      const bobGoal = await fetch(`${baseUrl}/api/v1/goals/${goal.data.id}`, {
        headers: { Authorization: 'Bearer tok-bob' },
      });
      assert.equal(bobGoal.status, 403);

      // Calendar radar
      const radarRes = await fetch(`${baseUrl}/api/v1/calendar/radar?horizon=30`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(radarRes.status, 200);

      // Investment Risk & Journal
      const journalRes = await fetch(`${baseUrl}/api/v1/investments/journal`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investmentName: 'Nifty 50 Index ETF',
          reasonForResearch: 'Low-cost broad equity allocation',
          expectedHoldingPeriod: '7+ Years',
          risksConsidered: 'Short-term market drawdowns',
        }),
      });
      assert.equal(journalRes.status, 201);

      const riskRes = await fetch(`${baseUrl}/api/v1/investments/risk`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(riskRes.status, 200);

      // Tax Readiness checklist
      const trRes = await fetch(`${baseUrl}/api/v1/tax/readiness?fy=2025-26`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(trRes.status, 200);
      const trJson = (await trRes.json()) as { data: Array<{ id: string }> };
      assert.ok(trJson.data.length >= 5);

      const updTr = await fetch(`${baseUrl}/api/v1/tax/readiness/${trJson.data[0].id}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VERIFIED_BY_USER' }),
      });
      assert.equal(updTr.status, 200);

      // Business Invoice -> Receivables -> Follow-Up Draft -> Reconciliation Run -> Confirm
      const invRes = await fetch(`${baseUrl}/api/v1/business/invoices`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Delta Systems',
          placeOfSupply: '29 - Karnataka (Intrastate)',
          dueDate: '2026-03-01',
          lineItems: [{ description: 'Audit Advisory', quantity: 1, unitPrice: 10000, taxRate: 18 }],
        }),
      });
      assert.equal(invRes.status, 201);
      const invJson = (await invRes.json()) as { data: { id: string } };

      const recAgingRes = await fetch(`${baseUrl}/api/v1/business/receivables`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(recAgingRes.status, 200);

      const fuRes = await fetch(`${baseUrl}/api/v1/business/receivables/follow-up`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invJson.data.id, reminderType: 'OVERDUE' }),
      });
      assert.equal(fuRes.status, 201);
      const fuJson = (await fuRes.json()) as { data: { status: string } };
      assert.equal(fuJson.data.status, 'DRAFT_COPY_ONLY');

      const reconRun = await fetch(`${baseUrl}/api/v1/business/reconciliation/run`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'FULL_LEDGER' }),
      });
      assert.equal(reconRun.status, 201);
      const reconJson = (await reconRun.json()) as { data: { id: string } };

      const confirmRecon = await fetch(`${baseUrl}/api/v1/business/reconciliation/${reconJson.data.id}/confirm`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(confirmRecon.status, 200);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    fs.rmSync(tempVaultDir, { recursive: true, force: true });
  }
});
