import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { createApp, createInitialStore } from '../../server';
import {
  calculateIndianTax,
  calculateInvoiceTotals,
  runHistoricalBacktest,
  validateGSTIN,
} from './financialMath';
import {
  parseBankSMS,
  parseCsvStatement,
  parsePdfStatement,
  parseXlsxStatement,
} from './statementParser';
import { generateHistoricalMarketCatalog } from '../server/marketData';
import { AIServiceError, GEMINI_MODEL } from '../server/geminiService';

function makeToken(uid: string, email: string, extra: Partial<DecodedIdToken> = {}): DecodedIdToken {
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
    ...extra,
  };
}

async function generateSimplePdfBuffer(lines: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    for (const line of lines) {
      doc.fontSize(11).text(line);
    }
    doc.end();
  });
}

test('Deterministic Statement Parsers (CSV, XLSX, PDF, SMS) & Financial Engines', async (t) => {
  await t.test('CSV parser parses credits, debits, dates, and reference IDs', () => {
    const csv = [
      'Date,Description,Debit,Credit,Reference',
      '2026-03-01,Zomato Lunch Order,540,,UTR10001',
      '2026-03-02,Infosys Salary Credit,,125000,SAL202603',
    ].join('\n');

    const rows = parseCsvStatement(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].type, 'EXPENSE');
    assert.equal(rows[0].amount, 540);
    assert.equal(rows[0].merchant, 'Zomato');
    assert.equal(rows[1].type, 'INCOME');
    assert.equal(rows[1].amount, 125000);
  });

  await t.test('XLSX parser parses real Excel workbook buffer', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { Date: '2026-03-05', Description: 'Amazon India Hardware', Debit: 3200, Credit: '', Ref: 'AMZ991' },
      { Date: '2026-03-06', Description: 'Client Advisory Fee Credit', Debit: '', Credit: 45000, Ref: 'INV882' },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Statement');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const rows = parseXlsxStatement(buf);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].merchant, 'Amazon India');
    assert.equal(rows[0].amount, 3200);
    assert.equal(rows[1].type, 'INCOME');
    assert.equal(rows[1].amount, 45000);
  });

  await t.test('PDF parser extracts transactions from real generated PDF text', async () => {
    const pdfBuf = await generateSimplePdfBuffer([
      '2026-03-10 Uber India Airport Ride Dr Rs. 780.00',
      '2026-03-11 Consulting Retainer Deposit Cr Rs. 35000.00',
    ]);
    const rows = await parsePdfStatement(pdfBuf);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].type, 'EXPENSE');
    assert.equal(rows[0].amount, 780);
    assert.equal(rows[1].type, 'INCOME');
    assert.equal(rows[1].amount, 35000);
  });

  await t.test('SMS parser extracts amount, type, merchant, account, and reference', () => {
    const sms = 'Rs. 1,450.50 debited from A/C XX4321 to Swiggy on 12/03/2026 Ref UPI98765432';
    const parsed = parseBankSMS(sms);
    assert.equal(parsed.amount, 1450.5);
    assert.equal(parsed.type, 'EXPENSE');
    assert.equal(parsed.merchant, 'Swiggy');
    assert.equal(parsed.referenceId, 'UPI98765432');
    assert.equal(parsed.transactionDate, '2026-03-12');
  });

  await t.test('Versioned Indian Income Tax engine & GSTIN / multi-rate invoice math', () => {
    const fy25 = calculateIndianTax(700000, 0, 'NEW', '2025-26');
    assert.equal(fy25.totalTax, 0);
    assert.equal(fy25.rulesetVersion, 'CBDT v2025.2');

    const fy24 = calculateIndianTax(6000000, 0, 'NEW', '2024-25');
    assert.equal(fy24.rulesetVersion, 'CBDT v2024.1');
    assert.ok(fy24.surcharge > 0, 'Surcharge should apply above ₹50L');

    assert.equal(validateGSTIN('29AAACF9876K1ZP'), true);
    assert.equal(validateGSTIN('INVALID_GST'), false);

    const intra = calculateInvoiceTotals(
      [
        { quantity: 1, unitPrice: 10000, taxRate: 18 },
        { quantity: 2, unitPrice: 5000, taxRate: 5 },
      ],
      false
    );
    assert.equal(intra.taxableAmount, 20000);
    assert.equal(intra.totalGst, 2300); // 1800 + 500
    assert.equal(intra.cgst, 1150);
    assert.equal(intra.sgst, 1150);
    assert.equal(intra.igst, 0);
    assert.equal(intra.totalInvoiceAmount, 22300);
  });

  await t.test('Real NSE OHLCV candle backtest executes deterministically', () => {
    const { historyBySymbol } = generateHistoricalMarketCatalog();
    const candles = historyBySymbol['NIFTY 50'] || [];
    assert.ok(candles.length >= 100);
    const result = runHistoricalBacktest(candles, {
      startingCapital: 100000,
      stopLossPct: 3,
      targetPct: 6,
      strategyType: 'Moving Average Crossover',
    });
    assert.ok(Number.isFinite(result.finalCapital));
    assert.ok((result.equityCurve || []).length > 0);
  });
});

test('Full-Stack Integration: Statement Import, Vault Security, Markets, Tax, Business PDF, Gemini AI & Admin', async (t) => {
  const tempVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'finsight-vault-test-'));
  const tokens = new Map<string, DecodedIdToken>([
    ['tok-alice', makeToken('uid-alice', 'alice@finsight.in')],
    ['tok-bob', makeToken('uid-bob', 'bob@finsight.in')],
    ['tok-admin', makeToken('uid-admin', 'admin@finsight.in', { admin: true, role: 'ADMIN' })],
  ]);

  let aiShouldFailNotConfigured = false;
  const store = createInitialStore();
  const { app } = createApp({
    store,
    vaultRootDir: tempVaultDir,
    verifyToken: async tok => {
      const hit = tokens.get(tok);
      if (!hit) throw new Error('Invalid test token');
      return hit;
    },
    fraudAnalyzer: async (_uid, text) => {
      if (aiShouldFailNotConfigured) {
        throw new AIServiceError('Gemini AI is not configured on the server.', 503, 'AI_NOT_CONFIGURED');
      }
      return {
        riskScore: text.toLowerCase().includes('kyc') ? 92 : 12,
        riskLevel: text.toLowerCase().includes('kyc') ? 'CRITICAL' : 'LOW',
        summary: 'Structured Gemini 4 Hydrogen fraud evaluation.',
        suspiciousKeywords: text.toLowerCase().includes('kyc') ? ['KYC', 'urgent'] : [],
        findings: ['Analyzed sender intent and urgency markers.'],
        recommendedActions: ['Verify inside official bank app.'],
      };
    },
    aiResponder: async (_uid, message, moduleContext) => {
      if (aiShouldFailNotConfigured) {
        throw new AIServiceError('Gemini AI is not configured on the server.', 503, 'AI_NOT_CONFIGURED');
      }
      return {
        reply: `Grounded answer (${moduleContext}): ${message.slice(0, 60)}`,
        model: GEMINI_MODEL,
      };
    },
  });

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;

  try {
    await t.test('Health endpoint reports real provider readiness', async () => {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      assert.equal(res.status, 200);
      const json = (await res.json()) as {
        success: boolean;
        data: { integrations: { geminiAi: { model: string }; marketData: { status: string } } };
      };
      assert.equal(json.success, true);
      assert.equal(json.data.integrations.geminiAi.model, GEMINI_MODEL);
      assert.equal(json.data.integrations.marketData.status, 'verified_nse_archive');

      const aliasRes = await fetch(`${baseUrl}/api/health`);
      assert.equal(aliasRes.status, 200);
      const aliasJson = (await aliasRes.json()) as { success: boolean; data: { status: string } };
      assert.equal(aliasJson.success, true);
      assert.equal(aliasJson.data.status, 'ok');

      const notFoundRes = await fetch(`${baseUrl}/api/nonexistent-route`);
      assert.equal(notFoundRes.status, 404);
      const notFoundJson = (await notFoundRes.json()) as { success: boolean; error: { code: string } };
      assert.equal(notFoundJson.success, false);
      assert.equal(notFoundJson.error.code, 'API_ROUTE_NOT_FOUND');
    });

    await t.test('Statement preview -> duplicate detection -> import -> import-history workflow', async () => {
      const csvContent = [
        'Date,Description,Debit,Credit,Reference',
        '2026-03-01,Zomato Dinner,650,,REFZOM1',
        '2026-03-02,Salary March,,95000,REFSAL1',
      ].join('\n');

      const preview1 = await fetch(`${baseUrl}/api/v1/transactions/preview`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'march.csv',
          mimeType: 'text/csv',
          fileBase64: Buffer.from(csvContent, 'utf-8').toString('base64'),
        }),
      });
      assert.equal(preview1.status, 200);
      const p1Json = (await preview1.json()) as { data: { transactions: Array<{ isDuplicate: boolean }> } };
      assert.equal(p1Json.data.transactions.length, 2);
      assert.equal(p1Json.data.transactions.every(c => c.isDuplicate === false), true);

      const importRes = await fetch(`${baseUrl}/api/v1/transactions/import`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'march.csv',
          format: 'CSV',
          fileSizeBytes: csvContent.length,
          transactions: p1Json.data.transactions,
        }),
      });
      assert.equal(importRes.status, 201);

      // Second preview should flag both rows as duplicates
      const preview2 = await fetch(`${baseUrl}/api/v1/transactions/preview`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'march.csv',
          mimeType: 'text/csv',
          fileBase64: Buffer.from(csvContent, 'utf-8').toString('base64'),
        }),
      });
      const p2Json = (await preview2.json()) as { data: { duplicateCount: number } };
      assert.equal(p2Json.data.duplicateCount, 2);

      const histRes = await fetch(`${baseUrl}/api/v1/transactions/import-history`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(histRes.status, 200);
      const histJson = (await histRes.json()) as { data: Array<{ importedCount: number }> };
      assert.equal(histJson.data[0].importedCount, 2);
    });

    await t.test('Markets OHLCV history, watchlist CRUD, candle backtest & paper trading sell guard', async () => {
      const histRes = await fetch(`${baseUrl}/api/v1/markets/history/NIFTY%2050?days=140`);
      assert.equal(histRes.status, 200);
      const histJson = (await histRes.json()) as { data: { candles: Array<{ close: number }> } };
      assert.ok(histJson.data.candles.length >= 100);

      const watchAdd = await fetch(`${baseUrl}/api/v1/watchlist`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'TCS', notes: 'IT LargeCap' }),
      });
      assert.equal(watchAdd.status, 201);

      const btRes = await fetch(`${baseUrl}/api/v1/backtests`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyName: 'Nifty Momentum Test',
          symbol: 'NIFTY 50',
          startingCapital: 100000,
          stopLossPct: 3,
          targetPct: 6,
          strategyType: 'Moving Average Crossover',
        }),
      });
      assert.equal(btRes.status, 201);
      const btJson = (await btRes.json()) as { data: { dataSource: string; equityCurve: unknown[] } };
      assert.equal(btJson.data.dataSource, 'VERIFIED_NSE_ARCHIVE');
      assert.ok(btJson.data.equityCurve.length > 0);

      // Selling unheld symbol must return 400
      const invalidSell = await fetch(`${baseUrl}/api/v1/paper-trading/trades`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'RELIANCE', action: 'SELL', quantity: 5 }),
      });
      assert.equal(invalidSell.status, 400);

      // Buy then reset
      const validBuy = await fetch(`${baseUrl}/api/v1/paper-trading/trades`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'RELIANCE', action: 'BUY', quantity: 2 }),
      });
      assert.equal(validBuy.status, 201);

      const resetRes = await fetch(`${baseUrl}/api/v1/paper-trading/reset`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(resetRes.status, 200);
      const resetJson = (await resetRes.json()) as { data: { account: { availableVirtualBalance: number } } };
      assert.equal(resetJson.data.account.availableVirtualBalance, 1000000);
    });

    await t.test('Tax calculation audit + Document Vault validation & cross-tenant 403', async () => {
      const calcRes = await fetch(`${baseUrl}/api/v1/tax/calculate`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ grossIncome: 1500000, deductions: 200000, financialYear: '2025-26' }),
      });
      assert.equal(calcRes.status, 201);

      // Reject dangerous .exe / .svg upload
      const badUpload = await fetch(`${baseUrl}/api/v1/tax/documents`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'payload.svg',
          mimeType: 'image/svg+xml',
          fileBase64: Buffer.from('<svg></svg>').toString('base64'),
          category: 'Form 16',
        }),
      });
      assert.equal(badUpload.status, 400);

      // Upload valid PDF document
      const pdfBytes = await generateSimplePdfBuffer(['Form 16 Part B - Alice FY 2025-26']);
      const goodUpload = await fetch(`${baseUrl}/api/v1/tax/documents`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'form16.pdf',
          mimeType: 'application/pdf',
          fileBase64: pdfBytes.toString('base64'),
          category: 'Form 16',
          financialYear: '2025-26',
        }),
      });
      assert.equal(goodUpload.status, 201);
      const docJson = (await goodUpload.json()) as { data: { id: string } };

      // Bob cannot download or delete Alice's tax document
      const bobDownload = await fetch(`${baseUrl}/api/v1/tax/documents/${docJson.data.id}/download`, {
        headers: { Authorization: 'Bearer tok-bob' },
      });
      assert.equal(bobDownload.status, 403);

      const aliceDownload = await fetch(`${baseUrl}/api/v1/tax/documents/${docJson.data.id}/download`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(aliceDownload.status, 200);
      const downloadedBuf = Buffer.from(await aliceDownload.arrayBuffer());
      assert.equal(downloadedBuf.subarray(0, 4).toString('ascii'), '%PDF');
    });

    await t.test('Business GST Invoice multi-rate, partial payment, binary PDF & cash flow forecast', async () => {
      const invRes = await fetch(`${baseUrl}/api/v1/business/invoices`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Acme India Pvt Ltd',
          clientGstin: '29AABCC1234D1Z5',
          placeOfSupply: '29 - Karnataka (Intrastate)',
          lineItems: [
            { description: 'Cloud Audit', quantity: 1, unitPrice: 10000, taxRate: 18 },
            { description: 'Compliance Pack', quantity: 1, unitPrice: 10000, taxRate: 5 },
          ],
        }),
      });
      assert.equal(invRes.status, 201);
      const invJson = (await invRes.json()) as { data: { id: string; total: number; cgst: number; sgst: number } };
      assert.equal(invJson.data.total, 22300);
      assert.equal(invJson.data.cgst, 1150);
      assert.equal(invJson.data.sgst, 1150);

      // Binary PDF generation check
      const pdfRes = await fetch(`${baseUrl}/api/v1/business/invoices/${invJson.data.id}/pdf`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(pdfRes.status, 200);
      assert.equal(pdfRes.headers.get('content-type'), 'application/pdf');
      const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
      assert.equal(pdfBuf.subarray(0, 4).toString('ascii'), '%PDF');

      // Partial payment
      const payRes = await fetch(`${baseUrl}/api/v1/business/invoices/${invJson.data.id}/payment`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 10000 }),
      });
      assert.equal(payRes.status, 200);
      const payJson = (await payRes.json()) as { data: { status: string; balanceDue: number } };
      assert.equal(payJson.data.status, 'PARTIALLY_PAID');
      assert.equal(payJson.data.balanceDue, 12300);

      // Cash flow forecast reflects unpaid receivables
      const cfRes = await fetch(`${baseUrl}/api/v1/business/cash-flow`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(cfRes.status, 200);
      const cfJson = (await cfRes.json()) as { data: { confirmedReceivables: number } };
      assert.equal(cfJson.data.confirmedReceivables, 12300);
    });

    await t.test('Gemini AI honest 503 when unconfigured vs persisted 200 conversation + admin endpoints', async () => {
      aiShouldFailNotConfigured = true;
      const errChat = await fetch(`${baseUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Check my budget', moduleContext: 'Budgeting' }),
      });
      assert.equal(errChat.status, 503);
      const errJson = (await errChat.json()) as { error: { code: string } };
      assert.equal(errJson.error.code, 'AI_NOT_CONFIGURED');

      aiShouldFailNotConfigured = false;
      const okChat = await fetch(`${baseUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { Authorization: 'Bearer tok-alice', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Summarize my savings', moduleContext: 'Dashboard' }),
      });
      assert.equal(okChat.status, 200);

      const convRes = await fetch(`${baseUrl}/api/v1/ai/conversations`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(convRes.status, 200);
      const convJson = (await convRes.json()) as { data: Array<{ role: string }> };
      assert.equal(convJson.data.length, 2);

      // Admin endpoints
      const adminDash = await fetch(`${baseUrl}/api/v1/admin/dashboard`, {
        headers: { Authorization: 'Bearer tok-admin' },
      });
      assert.equal(adminDash.status, 200);
      const adminJson = (await adminDash.json()) as { data: { aiModel: string } };
      assert.equal(adminJson.data.aiModel, GEMINI_MODEL);

      const nonAdmin = await fetch(`${baseUrl}/api/v1/admin/settings`, {
        headers: { Authorization: 'Bearer tok-alice' },
      });
      assert.equal(nonAdmin.status, 403);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
    fs.rmSync(tempVaultDir, { recursive: true, force: true });
  }
});
