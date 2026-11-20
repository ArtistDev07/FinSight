import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { createServer as createViteServer } from 'vite';
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, DecodedIdToken } from 'firebase-admin/auth';
import {
  UserProfile,
  UserPreferences,
  Transaction,
  Budget,
  Portfolio,
  Holding,
  BacktestRecord,
  PaperTrade,
  PaperAccount,
  TaxDeduction,
  TaxDocument,
  TaxProfile,
  TaxCalculationRecord,
  FraudAnalysis,
  Client,
  Invoice,
  InvoiceItem,
  BusinessExpense,
  BusinessProfile,
  EMIPlan,
  AuditLog,
  WatchlistItem,
  ImportJobRecord,
  ManualAssetLiability,
  MoneyGoal,
  MoneyCalendarEvent,
  CreditCard,
  CreditCardStatement,
  RecurringPayment,
  FinancialHealthSnapshot,
  BusinessReconciliationRun,
  PaymentFollowUp,
  InvestmentJournalEntry,
  TaxReadinessItem,
} from './src/types';
import {
  calculateBudgetMetrics,
  calculateGST,
  calculateIndianTax,
  calculateInvoiceTotals,
  runHistoricalBacktest,
  validateGSTIN,
} from './src/utils/financialMath';
import {
  buildCashFlowRadar,
  classifyInboxTransaction,
  computeCreditCardSummary,
  computeDebtPayoffSchedule,
  computeFinancialHealthSummary,
  computeGoalProjection,
  computePortfolioRiskAnalytics,
  computeReceivablesAging,
  detectRecurringPayments,
  inspectFraudSignals,
  isDoubleCountExcluded,
  runDeterministicReconciliation,
  simulateCreditCardPayment,
} from './src/utils/financialIntelligence';
import {
  flagDuplicateCandidates,
  parseBankSMS,
  parseCsvStatement,
  parsePdfStatement,
  parsePlainTextLines,
  parseXlsxStatement,
} from './src/utils/statementParser';
import { createInitialStore, FinSightStore, loadOrInitializeDiskStore } from './src/server/store';
import { getMarketDataProviderStatus } from './src/server/marketData';
import {
  AIServiceError,
  GEMINI_MODEL,
  analyzeFraudWithGemini,
  generateFinancialAssistantReply,
  getGeminiStatus,
} from './src/server/geminiService';
import { createVaultStore, validateFileUpload } from './src/server/fileVault';
import { generateInvoicePdfBuffer } from './src/server/invoicePdf';
import { generateHealthReportPdfBuffer } from './src/server/healthReportPdf';

dotenv.config();

export { createInitialStore };
export type { FinSightStore };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFirebaseConfig(): { projectId: string; storageBucket?: string; firestoreDatabaseId?: string } {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as {
      projectId?: string;
      storageBucket?: string;
      firestoreDatabaseId?: string;
    };
    return {
      projectId: process.env.FIREBASE_PROJECT_ID || raw.projectId || 'gen-lang-client-0419535639',
      storageBucket: raw.storageBucket,
      firestoreDatabaseId: raw.firestoreDatabaseId,
    };
  } catch {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0419535639',
    };
  }
}

const FIREBASE_CONFIG = loadFirebaseConfig();

if (getAdminApps().length === 0) {
  initializeAdminApp({
    projectId: FIREBASE_CONFIG.projectId,
    storageBucket: FIREBASE_CONFIG.storageBucket,
  });
}

// Server-controlled admin allowlists (never client-controlled)
const BOOTSTRAPPED_ADMIN_EMAILS = new Set(
  [
    'yogesh.devhub@gmail.com',
    ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : []),
  ]
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
);

const BOOTSTRAPPED_ADMIN_UIDS = new Set(
  (process.env.ADMIN_UIDS ? process.env.ADMIN_UIDS.split(',') : [])
    .map(u => u.trim())
    .filter(Boolean)
);

// Server-side revocation timestamps (epoch seconds) for explicit sign-out / revocation enforcement
export const revokedBeforeSecondsByUid = new Map<string, number>();

export interface VerifiedAuthContext {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  isAdmin: boolean;
  claims: Record<string, unknown>;
}

declare global {
  namespace Express {
    interface Request {
      auth?: VerifiedAuthContext;
    }
  }
}

export type TokenVerifier = (token: string) => Promise<DecodedIdToken>;

export async function verifyFirebaseIdToken(token: string): Promise<DecodedIdToken> {
  const adminAuth = getAdminAuth(getAdminApp());
  // Verify signature, expiry, issuer, and audience using Google public certificates
  // (checkRevoked=true calls Identity Toolkit getUser and requires cross-project IAM).
  const decoded = await adminAuth.verifyIdToken(token);

  const revokedBefore = revokedBeforeSecondsByUid.get(decoded.uid);
  if (revokedBefore !== undefined && typeof decoded.auth_time === 'number' && decoded.auth_time <= revokedBefore) {
    const revokedErr = new Error('Firebase ID token has been revoked.') as Error & { code?: string };
    revokedErr.code = 'auth/id-token-revoked';
    throw revokedErr;
  }

  return decoded;
}

export function isTrustedAdminToken(decoded: DecodedIdToken): boolean {
  if (decoded.admin === true || decoded.role === 'ADMIN') {
    return true;
  }
  if (BOOTSTRAPPED_ADMIN_UIDS.has(decoded.uid)) {
    return true;
  }
  if (decoded.email && decoded.email_verified === true && BOOTSTRAPPED_ADMIN_EMAILS.has(decoded.email.toLowerCase())) {
    return true;
  }
  return false;
}

export interface CreateAppOptions {
  store?: FinSightStore;
  onSave?: () => void;
  vaultRootDir?: string;
  verifyToken?: TokenVerifier;
  fraudAnalyzer?: (uid: string, text: string, sourceType: string) => Promise<{
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    summary: string;
    suspiciousKeywords: string[];
    findings: string[];
    recommendedActions: string[];
  }>;
  aiResponder?: (
    uid: string,
    message: string,
    moduleContext: string,
    userSummaryContext: Record<string, unknown>
  ) => Promise<{ reply: string; model: string }>;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const db = options.store || createInitialStore();
  const saveStore = options.onSave || (() => undefined);
  const vault = createVaultStore(options.vaultRootDir);
  const verifyToken = options.verifyToken || verifyFirebaseIdToken;
  const runFraudAnalyzer = options.fraudAnalyzer || analyzeFraudWithGemini;
  const runAiResponder = options.aiResponder || generateFinancialAssistantReply;

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Basic HTTP API rate limit per IP for DoS resilience
  const apiHitsByIp = new Map<string, number[]>();
  app.use('/api/v1', (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const hits = (apiHitsByIp.get(ip) || []).filter(t => now - t < 60_000);
    if (hits.length > 300) {
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
      });
    }
    hits.push(now);
    apiHitsByIp.set(ip, hits);
    next();
  });

  function recordAuditLog(
    actorId: string,
    actorEmail: string,
    action: string,
    resourceType: string,
    resourceId: string,
    outcome: AuditLog['outcome'],
    metadata?: string
  ) {
    db.auditLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      actorId,
      actorEmail,
      action,
      resourceType,
      resourceId,
      outcome,
      createdAt: new Date().toISOString(),
      metadata,
    });
    if (db.auditLogs.length > 250) {
      db.auditLogs.length = 250;
    }
    saveStore();
  }

  function ensureUserProfile(authCtx: VerifiedAuthContext): UserProfile {
    let profile = db.users.find(u => u.uid === authCtx.uid);
    const derivedRole: 'USER' | 'ADMIN' = authCtx.isAdmin ? 'ADMIN' : 'USER';

    if (!profile) {
      profile = {
        uid: authCtx.uid,
        fullName: authCtx.name || (authCtx.email ? authCtx.email.split('@')[0] : 'FinSight Member'),
        email: authCtx.email,
        photoURL: authCtx.picture,
        role: derivedRole,
        accountStatus: 'ACTIVE',
        onboardingCompleted: false,
        country: 'India',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        language: 'English',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.users.push(profile);
      saveStore();
    } else {
      profile.role = derivedRole;
      if (authCtx.email) profile.email = authCtx.email;
      if (authCtx.picture) profile.photoURL = authCtx.picture;
    }

    return profile;
  }

  function ensureUserPreferences(uid: string): UserPreferences {
    let pref = db.userPreferences.find(p => p.ownerId === uid);
    if (!pref) {
      pref = {
        id: `pref-${uid}`,
        ownerId: uid,
        financialYear: db.systemSettings.defaultFinancialYear,
        currency: 'INR',
        language: 'English',
        theme: 'light',
        numberFormat: 'INDIAN',
        experienceLevel: 'Intermediate',
        explanationLevel: 'Balanced',
        selectedFeatures: [
          'Smart Budgeting',
          'Investing & Portfolio Guide',
          'Trading & Market Insights',
          'Tax Helper',
          'Scam & Fraud Detector',
          'Small Business Finance',
        ],
        notificationPreferences: {
          budgetAlerts: true,
          spendingAlerts: true,
          securityAlerts: true,
          taxReminders: true,
          businessReminders: true,
          productUpdates: false,
        },
        updatedAt: new Date().toISOString(),
      };
      db.userPreferences.push(pref);
      saveStore();
    }
    if (!pref.theme) pref.theme = 'light';
    return pref;
  }

  function ensureTaxProfile(uid: string): TaxProfile {
    let tp = db.taxProfiles.find(p => p.ownerId === uid);
    if (!tp) {
      tp = {
        id: `tp-${uid}`,
        ownerId: uid,
        financialYear: '2025-26',
        assessmentYear: '2026-27',
        annualSalary: 0,
        otherIncome: 0,
        ageCategory: 'BELOW_60',
        preferredRegime: 'NEW',
        updatedAt: new Date().toISOString(),
      };
      db.taxProfiles.push(tp);
      saveStore();
    }
    return tp;
  }

  function ensureBusinessProfile(uid: string): BusinessProfile {
    let bp = db.businessProfiles.find(b => b.ownerId === uid);
    if (!bp) {
      bp = {
        id: `bp-${uid}`,
        ownerId: uid,
        businessName: 'My Business Workspace',
        stateCode: '29 - Karnataka',
        address: 'Bengaluru, Karnataka',
        openingCashBalance: 0,
        updatedAt: new Date().toISOString(),
      };
      db.businessProfiles.push(bp);
      saveStore();
    }
    return bp;
  }

  function getOrCreatePaperAccount(uid: string): PaperAccount {
    let account = db.paperAccounts.find(pa => pa.ownerId === uid);
    if (!account) {
      account = {
        id: `pa-${uid}`,
        ownerId: uid,
        initialVirtualCapital: 1000000,
        availableVirtualBalance: 1000000,
        simulatedPortfolioValue: 0,
        positions: {},
        createdAt: new Date().toISOString(),
      };
      db.paperAccounts.push(account);
      saveStore();
    }
    if (!account.positions) account.positions = {};
    // Recompute live mark-to-market simulated portfolio value from current archive prices
    let m2m = 0;
    for (const [sym, pos] of Object.entries(account.positions)) {
      if (pos.quantity > 0) {
        const inst = db.marketInstruments.find(m => m.symbol === sym);
        m2m += pos.quantity * (inst ? inst.currentPrice : pos.avgPrice);
      }
    }
    account.simulatedPortfolioValue = Math.round(m2m * 100) / 100;
    return account;
  }

  function buildUserFinancialSummary(uid: string) {
    const txs = db.transactions.filter(t => t.ownerId === uid);
    const activeTxs = txs.filter(t => !isDoubleCountExcluded(t));
    const budgets = db.budgets.filter(b => b.ownerId === uid);
    const holdings = db.holdings.filter(h => h.ownerId === uid);
    const taxDed = db.taxDeductions.filter(d => d.ownerId === uid);
    const taxProf = db.taxProfiles.find(p => p.ownerId === uid);
    const invoices = db.invoices.filter(i => i.ownerId === uid);
    const bizExp = db.businessExpenses.filter(e => e.ownerId === uid);
    const creditCards = db.creditCards.filter(c => c.ownerId === uid);
    const goals = db.moneyGoals.filter(g => g.ownerId === uid);
    const manualItems = db.manualAssetsLiabilities.filter(m => m.ownerId === uid);
    const recurring = db.recurringPayments.filter(r => r.ownerId === uid && r.status !== 'CANCELLED' && r.status !== 'IGNORED');
    const bp = db.businessProfiles.find(b => b.ownerId === uid);

    const budgetMetrics = calculateBudgetMetrics(activeTxs, budgets.reduce((s, b) => s + b.allocatedAmount, 0));
    const portfolioCurrent = holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
    const portfolioCost = holdings.reduce((s, h) => s + h.quantity * h.purchasePrice, 0);
    const health = computeFinancialHealthSummary({
      transactions: txs,
      holdings,
      creditCards,
      goals,
      manualItems,
      openingCashBalance: bp?.openingCashBalance || 0,
    });
    const cardSummary = computeCreditCardSummary(creditCards);
    const receivables = computeReceivablesAging(invoices);

    return {
      transactionCount: txs.length,
      needsReviewCount: txs.filter(t => t.inboxStatus === 'NEEDS_REVIEW').length,
      totalIncome: budgetMetrics.totalIncome,
      totalExpenses: budgetMetrics.totalExpenses,
      savings: budgetMetrics.savings,
      savingsRatePct: budgetMetrics.savingsRate,
      budgetsCount: budgets.length,
      holdingsCount: holdings.length,
      portfolioValue: Math.round(portfolioCurrent * 100) / 100,
      portfolioCostBasis: Math.round(portfolioCost * 100) / 100,
      financialHealthIndex: health.compositeIndex,
      estimatedNetWorth: health.estimatedNetWorth,
      emergencyFundMonths: health.emergencyFundCoverageMonths,
      goalsCount: goals.length,
      creditCardsCount: creditCards.length,
      creditCardBalance: cardSummary.totalOutstandingBalance,
      creditCardUtilizationPct: cardSummary.overallUtilizationPct,
      activeRecurringCount: recurring.length,
      monthlyRecurringEstimate: Math.round(recurring.reduce((s, r) => s + r.estimatedAmount, 0)),
      taxProfile: taxProf
        ? { financialYear: taxProf.financialYear, annualSalary: taxProf.annualSalary, otherIncome: taxProf.otherIncome }
        : null,
      taxDeductionsTotal: taxDed.reduce((s, d) => s + d.claimedAmount, 0),
      invoicesCount: invoices.length,
      totalInvoiced: invoices.reduce((s, i) => s + i.total, 0),
      outstandingReceivables: receivables.totalOutstanding,
      overdueReceivables: receivables.overdueAmount,
      businessExpensesTotal: bizExp.reduce((s, e) => s + e.amount, 0),
    };
  }

  // Centralized Firebase Authentication Middleware
  async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_MISSING_TOKEN',
          message: 'Authentication required. Provide a valid Authorization: Bearer <token> header.',
        },
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_EMPTY_TOKEN',
          message: 'Authentication required. Bearer token is empty.',
        },
      });
    }

    try {
      const decoded = await verifyToken(token);
      if (!decoded || !decoded.uid) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_INVALID_TOKEN',
            message: 'Invalid Firebase authentication token.',
          },
        });
      }

      const profile = db.users.find(u => u.uid === decoded.uid);
      if (profile?.accountStatus === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: 'This account has been suspended by an administrator.',
          },
        });
      }

      const authCtx: VerifiedAuthContext = {
        uid: decoded.uid,
        email: decoded.email || '',
        emailVerified: Boolean(decoded.email_verified),
        name: typeof decoded.name === 'string' ? decoded.name : undefined,
        picture: typeof decoded.picture === 'string' ? decoded.picture : undefined,
        isAdmin: isTrustedAdminToken(decoded),
        claims: decoded as Record<string, unknown>,
      };

      req.auth = authCtx;
      next();
    } catch (err) {
      const code = (err as { code?: string })?.code || 'AUTH_INVALID_TOKEN';
      const isExpired = code === 'auth/id-token-expired';
      const isRevoked = code === 'auth/id-token-revoked';
      return res.status(401).json({
        success: false,
        error: {
          code: isExpired ? 'AUTH_TOKEN_EXPIRED' : isRevoked ? 'AUTH_TOKEN_REVOKED' : 'AUTH_INVALID_TOKEN',
          message: isExpired
            ? 'Firebase ID token has expired. Refresh your session.'
            : isRevoked
            ? 'Firebase ID token has been revoked. Please sign in again.'
            : 'Invalid or unverifiable Firebase ID token.',
        },
      });
    }
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.auth) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required.' },
      });
    }
    if (!req.auth.isAdmin) {
      recordAuditLog(req.auth.uid, req.auth.email, 'ADMIN_ACCESS_DENIED', 'ADMIN', req.path, 'DENIED');
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN_ADMIN_REQUIRED', message: 'Access denied: Verified administrator privileges required.' },
      });
    }
    next();
  }

  // ----------------- PUBLIC API ROUTES ----------------- //

  function buildHealthPayload() {
    const gemini = getGeminiStatus();
    const market = getMarketDataProviderStatus();
    return {
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        integrations: {
          firebaseAuth: { status: 'connected', projectId: FIREBASE_CONFIG.projectId },
          firestoreDatabase: {
            status: 'rules_deployed_local_persistence',
            databaseId: FIREBASE_CONFIG.firestoreDatabaseId || 'default',
            note: 'Firestore security rules deployed; server persistence backed by isolated local store when GCP ADC is absent.',
          },
          documentVault: {
            status: 'connected',
            storageBucket: FIREBASE_CONFIG.storageBucket || 'local-vault',
            maxUploadMb: db.systemSettings.maxUploadMb,
          },
          geminiAi: {
            status: gemini.configured ? 'connected' : 'unconfigured',
            model: gemini.model,
            configured: gemini.configured,
          },
          marketData: {
            status: market.liveProviderConfigured ? 'connected_external' : 'verified_nse_archive',
            liveProviderConfigured: market.liveProviderConfigured,
            archiveCutoffDate: market.archiveCutoffDate,
          },
          taxRuleset: {
            status: 'connected',
            activeVersions: db.taxRules.filter(r => r.active).map(r => `${r.financialYear} (${r.version})`),
          },
        },
      },
    };
  }

  app.get('/api/health', (_req, res) => {
    res.json(buildHealthPayload());
  });

  app.get('/api/v1/health', (_req, res) => {
    res.json(buildHealthPayload());
  });

  app.get('/api/v1/markets/instruments', (_req, res) => {
    res.json({
      success: true,
      data: db.marketInstruments,
      meta: getMarketDataProviderStatus(),
    });
  });

  app.get('/api/v1/instruments', (_req, res) => {
    res.json({
      success: true,
      data: db.marketInstruments,
      meta: getMarketDataProviderStatus(),
    });
  });

  app.get('/api/v1/markets/history/:symbol', (req, res) => {
    const rawSymbol = decodeURIComponent(req.params.symbol).toUpperCase();
    const candles = db.marketHistory[rawSymbol];
    if (!candles || candles.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'INSTRUMENT_NOT_FOUND', message: `No historical market archive found for "${rawSymbol}".` },
      });
    }
    const days = Math.min(candles.length, Math.max(10, parseInt(String(req.query.days || '90'), 10) || 90));
    const slice = candles.slice(-days);
    const instrument = db.marketInstruments.find(m => m.symbol === rawSymbol);
    res.json({
      success: true,
      data: {
        symbol: rawSymbol,
        instrument,
        provenance: 'VERIFIED_NSE_ARCHIVE',
        liveProviderConfigured: getMarketDataProviderStatus().liveProviderConfigured,
        candles: slice,
      },
    });
  });

  // ----------------- AUTH, PREFERENCES & ONBOARDING ----------------- //

  app.get('/api/v1/auth/me', requireAuth, (req, res) => {
    const profile = ensureUserProfile(req.auth!);
    const preferences = ensureUserPreferences(req.auth!.uid);
    res.json({ success: true, data: profile, preferences });
  });

  app.put('/api/v1/profile', requireAuth, (req, res) => {
    const profile = ensureUserProfile(req.auth!);
    const { fullName, phone, language, country, currency, onboardingCompleted, occupation } = req.body || {};

    if (typeof fullName === 'string' && fullName.trim().length > 0) profile.fullName = fullName.trim().slice(0, 120);
    if (typeof phone === 'string') profile.phone = phone.trim().slice(0, 40);
    if (typeof language === 'string') profile.language = language.trim().slice(0, 40);
    if (typeof country === 'string') profile.country = country.trim().slice(0, 80);
    if (typeof currency === 'string') profile.currency = currency.trim().slice(0, 10);
    if (typeof occupation === 'string') profile.occupation = occupation.trim().slice(0, 80);
    if (typeof onboardingCompleted === 'boolean') profile.onboardingCompleted = onboardingCompleted;
    profile.updatedAt = new Date().toISOString();
    saveStore();

    res.json({ success: true, data: profile, message: 'Profile updated successfully' });
  });

  app.get('/api/v1/preferences', requireAuth, (req, res) => {
    const pref = ensureUserPreferences(req.auth!.uid);
    res.json({ success: true, data: pref });
  });

  app.put('/api/v1/preferences', requireAuth, (req, res) => {
    const pref = ensureUserPreferences(req.auth!.uid);
    const body = req.body || {};
    if (typeof body.financialYear === 'string') pref.financialYear = body.financialYear;
    if (typeof body.currency === 'string') pref.currency = body.currency.slice(0, 10);
    if (typeof body.language === 'string') pref.language = body.language.slice(0, 40);
    if (body.theme === 'light' || body.theme === 'dark') pref.theme = body.theme;
    if (body.numberFormat === 'INDIAN' || body.numberFormat === 'INTERNATIONAL') pref.numberFormat = body.numberFormat;
    if (['Beginner', 'Intermediate', 'Advanced'].includes(body.experienceLevel)) pref.experienceLevel = body.experienceLevel;
    if (['Simple', 'Balanced', 'Detailed'].includes(body.explanationLevel)) pref.explanationLevel = body.explanationLevel;
    if (Array.isArray(body.selectedFeatures)) pref.selectedFeatures = body.selectedFeatures.map(String).slice(0, 12);
    if (body.notificationPreferences && typeof body.notificationPreferences === 'object') {
      pref.notificationPreferences = {
        ...pref.notificationPreferences,
        ...body.notificationPreferences,
      };
    }
    pref.updatedAt = new Date().toISOString();
    saveStore();
    res.json({ success: true, data: pref, message: 'Preferences saved successfully' });
  });

  app.post('/api/v1/onboarding/complete', requireAuth, (req, res) => {
    const profile = ensureUserProfile(req.auth!);
    const pref = ensureUserPreferences(req.auth!.uid);
    const body = req.body || {};

    if (typeof body.fullName === 'string' && body.fullName.trim()) profile.fullName = body.fullName.trim().slice(0, 120);
    if (typeof body.country === 'string' && body.country.trim()) profile.country = body.country.trim().slice(0, 80);
    if (typeof body.currency === 'string' && body.currency.trim()) {
      profile.currency = body.currency.trim().slice(0, 10);
      pref.currency = profile.currency;
    }
    if (typeof body.occupation === 'string') profile.occupation = body.occupation.trim().slice(0, 80);
    if (Number.isFinite(Number(body.monthlyIncomeEstimate))) profile.monthlyIncomeEstimate = Number(body.monthlyIncomeEstimate);
    if (Number.isFinite(Number(body.monthlyExpenseEstimate))) profile.monthlyExpenseEstimate = Number(body.monthlyExpenseEstimate);
    profile.onboardingCompleted = true;
    profile.updatedAt = new Date().toISOString();

    if (typeof body.financialYear === 'string') pref.financialYear = body.financialYear;
    if (typeof body.language === 'string') {
      pref.language = body.language;
      profile.language = body.language;
    }
    if (['Beginner', 'Intermediate', 'Advanced'].includes(body.experienceLevel)) pref.experienceLevel = body.experienceLevel;
    if (['Simple', 'Balanced', 'Detailed'].includes(body.explanationLevel)) pref.explanationLevel = body.explanationLevel;
    if (Array.isArray(body.selectedFeatures)) pref.selectedFeatures = body.selectedFeatures.map(String);
    pref.updatedAt = new Date().toISOString();

    saveStore();
    res.json({ success: true, data: { profile, preferences: pref }, message: 'Onboarding completed' });
  });

  app.post('/api/v1/auth/revoke', requireAuth, (req, res) => {
    const uid = req.auth!.uid;
    revokedBeforeSecondsByUid.set(uid, Math.floor(Date.now() / 1000));
    recordAuditLog(uid, req.auth!.email, 'SESSION_TOKENS_REVOKED', 'AUTH', uid, 'SUCCESS');
    res.json({ success: true, message: 'Session tokens revoked' });
  });

  // ----------------- DASHBOARD ----------------- //

  app.get('/api/v1/dashboard/summary', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const allUserTransactions = db.transactions.filter(t => t.ownerId === userId);
    const activeTransactions = allUserTransactions.filter(t => !isDoubleCountExcluded(t));
    const userBudgets = db.budgets.filter(b => b.ownerId === userId);
    const userHoldings = db.holdings.filter(h => h.ownerId === userId);

    const totalAllocated = userBudgets.reduce((s, b) => s + b.allocatedAmount, 0);
    const budgetMetrics = calculateBudgetMetrics(activeTransactions, totalAllocated);

    let portfolioValue = 0;
    let investedAmount = 0;
    for (const h of userHoldings) {
      investedAmount += h.quantity * h.purchasePrice;
      portfolioValue += h.quantity * h.currentPrice;
    }

    res.json({
      success: true,
      data: {
        metrics: {
          totalIncome: budgetMetrics.totalIncome,
          totalExpenses: budgetMetrics.totalExpenses,
          savings: budgetMetrics.savings,
          savingsRate: budgetMetrics.savingsRate,
          allocatedBudget: Math.round(totalAllocated * 100) / 100,
          remainingBudget: budgetMetrics.remainingBudget,
          activeGoals: userBudgets.length,
          portfolioValue: Math.round(portfolioValue * 100) / 100,
          investedAmount: Math.round(investedAmount * 100) / 100,
          unrealizedGain: Math.round((portfolioValue - investedAmount) * 100) / 100,
          transactionCount: allUserTransactions.length,
          needsReviewCount: allUserTransactions.filter(t => t.inboxStatus === 'NEEDS_REVIEW').length,
          excludedTransfersCount: allUserTransactions.filter(t => isDoubleCountExcluded(t)).length,
        },
        recentTransactions: allUserTransactions.slice(0, 6),
      },
    });
  });

  app.get('/api/v1/dashboard/cash-flow', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const txs = db.transactions.filter(t => t.ownerId === userId && !isDoubleCountExcluded(t));
    const budgets = db.budgets.filter(b => b.ownerId === userId);
    const totalAllocated = budgets.reduce((s, b) => s + b.allocatedAmount, 0);
    const metrics = calculateBudgetMetrics(txs, totalAllocated);

    const byMonth = new Map<string, { month: string; income: number; expenses: number }>();
    for (const tx of txs) {
      const month = (tx.transactionDate || '').slice(0, 7) || '2026-03';
      const entry = byMonth.get(month) || { month, income: 0, expenses: 0 };
      if (tx.type === 'INCOME') entry.income += tx.amount;
      else entry.expenses += tx.amount;
      byMonth.set(month, entry);
    }

    res.json({
      success: true,
      data: {
        inflow: metrics.totalIncome,
        outflow: metrics.totalExpenses,
        surplus: metrics.savings,
        allocatedBudget: totalAllocated,
        remainingBudget: metrics.remainingBudget,
        monthlySeries: Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
      },
    });
  });

  app.get('/api/v1/dashboard/spending', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const expenses = db.transactions.filter(
      t => t.ownerId === userId && t.type === 'EXPENSE' && !isDoubleCountExcluded(t)
    );
    const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
    const byCat = new Map<string, number>();
    for (const tx of expenses) {
      byCat.set(tx.category, (byCat.get(tx.category) || 0) + tx.amount);
    }
    const breakdown = Array.from(byCat.entries())
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100,
        percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    res.json({ success: true, data: { totalSpent, categories: breakdown } });
  });

  app.get('/api/v1/dashboard/insights', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const summary = buildUserFinancialSummary(userId);
    const insights: Array<{ id: string; title: string; body: string; tone: 'positive' | 'warning' | 'info' }> = [];

    if (summary.transactionCount === 0) {
      insights.push({
        id: 'ins-empty',
        title: 'Import or Log Your First Transactions',
        body: 'No transactions are recorded yet under your account. Upload a CSV/XLSX/PDF bank statement or paste an SMS alert to compute real cash flow and category breakdowns.',
        tone: 'info',
      });
    } else {
      insights.push({
        id: 'ins-savings',
        title: summary.savingsRatePct >= 20 ? 'Healthy Monthly Savings Rate' : 'Savings Rate Optimization Window',
        body: `Based on ${summary.transactionCount} recorded transactions, your net surplus is ₹${summary.savings.toLocaleString('en-IN')} (${summary.savingsRatePct}% savings rate).`,
        tone: summary.savingsRatePct >= 20 ? 'positive' : 'warning',
      });
    }

    if (summary.holdingsCount > 0) {
      const gain = summary.portfolioValue - summary.portfolioCostBasis;
      insights.push({
        id: 'ins-portfolio',
        title: 'Portfolio Cost vs Valuation',
        body: `Across ${summary.holdingsCount} holdings, total tracked value is ₹${summary.portfolioValue.toLocaleString('en-IN')} with unrealized ${gain >= 0 ? 'gain' : 'loss'} of ₹${Math.abs(Math.round(gain)).toLocaleString('en-IN')}.`,
        tone: gain >= 0 ? 'positive' : 'warning',
      });
    }

    if (summary.taxDeductionsTotal > 0) {
      insights.push({
        id: 'ins-tax',
        title: 'Tax Deduction Claims Tracked',
        body: `You have logged ₹${summary.taxDeductionsTotal.toLocaleString('en-IN')} in Chapter VI-A deductions. Compare Old vs New Regime in Tax Helper before filing.`,
        tone: 'info',
      });
    }

    res.json({ success: true, data: insights });
  });

  // ----------------- TRANSACTIONS & STATEMENT PROCESSING ----------------- //

  app.get('/api/v1/transactions', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.transactions.filter(t => t.ownerId === userId) });
  });

  app.get('/api/v1/transactions/import-history', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.importJobs.filter(j => j.ownerId === userId) });
  });

  app.get('/api/v1/transactions/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const tx = db.transactions.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ success: false, error: { message: 'Transaction not found' } });
    if (tx.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this transaction' } });
    res.json({ success: true, data: tx });
  });

  app.post('/api/v1/transactions', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { description, merchant, amount, type, category, account, transactionDate, notes, referenceId, source } = req.body || {};
    const parsedAmount = Number(amount);
    if (!description || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !type || !category) {
      return res.status(400).json({ success: false, error: { message: 'Missing or invalid transaction fields' } });
    }

    const allowedSources = new Set(['MANUAL', 'CSV', 'XLSX', 'PDF', 'SMS', 'STATEMENT']);
    const txSource = allowedSources.has(String(source)) ? source : 'MANUAL';

    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      description: String(description).slice(0, 200),
      merchant: String(merchant || description).slice(0, 120),
      amount: Math.round(parsedAmount * 100) / 100,
      currency: 'INR',
      type: type === 'INCOME' ? 'INCOME' : 'EXPENSE',
      category: String(category).slice(0, 60),
      account: String(account || 'Primary Bank Account').slice(0, 100),
      transactionDate: String(transactionDate || new Date().toISOString().split('T')[0]),
      referenceId: typeof referenceId === 'string' && referenceId.trim() ? referenceId.trim().slice(0, 60) : undefined,
      source: txSource,
      notes: typeof notes === 'string' ? notes.slice(0, 500) : undefined,
      createdAt: new Date().toISOString(),
    };

    db.transactions.unshift(newTx);
    saveStore();
    res.status(201).json({ success: true, data: newTx, message: 'Transaction created successfully' });
  });

  app.put('/api/v1/transactions/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const tx = db.transactions.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ success: false, error: { message: 'Transaction not found' } });
    if (tx.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this transaction' } });

    const { description, merchant, amount, type, category, account, transactionDate, notes } = req.body || {};
    if (typeof description === 'string' && description.trim()) tx.description = description.trim().slice(0, 200);
    if (typeof merchant === 'string' && merchant.trim()) tx.merchant = merchant.trim().slice(0, 120);
    if (amount !== undefined && Number.isFinite(Number(amount)) && Number(amount) > 0) tx.amount = Math.round(Number(amount) * 100) / 100;
    if (type === 'INCOME' || type === 'EXPENSE') tx.type = type;
    if (typeof category === 'string' && category.trim()) tx.category = category.trim().slice(0, 60);
    if (typeof account === 'string' && account.trim()) tx.account = account.trim().slice(0, 100);
    if (typeof transactionDate === 'string' && transactionDate.trim()) tx.transactionDate = transactionDate.trim();
    if (notes !== undefined) tx.notes = typeof notes === 'string' ? notes.slice(0, 500) : undefined;

    saveStore();
    res.json({ success: true, data: tx, message: 'Transaction updated successfully' });
  });

  app.delete('/api/v1/transactions/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.transactions.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Transaction not found' } });
    if (db.transactions[idx].ownerId !== userId) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this transaction' } });
    }
    db.transactions.splice(idx, 1);
    saveStore();
    res.json({ success: true, message: 'Transaction deleted successfully' });
  });

  app.post('/api/v1/transactions/check-duplicate', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { amount, transactionDate, merchant, description, referenceId } = req.body || {};
    const numAmt = parseFloat(amount) || 0;
    const cleanMerchant = String(merchant || '').trim().toLowerCase();
    const cleanDesc = String(description || '').trim().toLowerCase();

    const duplicateMatch = db.transactions.find(t => {
      if (t.ownerId !== userId) return false;
      if (referenceId && t.referenceId && String(referenceId).toLowerCase() === t.referenceId.toLowerCase()) {
        return true;
      }
      const sameAmt = Math.abs(t.amount - numAmt) < 0.01;
      const sameDate = !transactionDate || t.transactionDate === transactionDate;
      const sameMerchant = cleanMerchant && t.merchant.toLowerCase().includes(cleanMerchant);
      const sameDesc = cleanDesc && t.description.toLowerCase().includes(cleanDesc);
      return sameAmt && sameDate && (sameMerchant || sameDesc);
    });

    res.json({
      success: true,
      isDuplicate: !!duplicateMatch,
      duplicateMatch: duplicateMatch || null,
    });
  });

  app.patch('/api/v1/transactions/:id/inbox-action', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const tx = db.transactions.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ success: false, error: { message: 'Transaction not found' } });
    if (tx.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });

    const { action, category, splitItems } = req.body || {};
    if (action === 'CONFIRM') {
      tx.inboxStatus = 'CATEGORIZED';
      if (typeof category === 'string' && category.trim()) tx.category = category.trim().slice(0, 60);
      tx.confidence = 100;
      tx.suggestionReason = 'Confirmed by user in Money Inbox.';
    } else if (action === 'MARK_TRANSFER') {
      tx.isInternalTransfer = true;
      tx.inboxStatus = 'CATEGORIZED';
      tx.category = 'Transfer';
      tx.suggestionReason = 'Marked as internal transfer by user (excluded from net expense/income double-counting).';
    } else if (action === 'MARK_CARD_PAYMENT') {
      tx.isCreditCardSettlement = true;
      tx.inboxStatus = 'CATEGORIZED';
      tx.category = 'Credit Card Payment';
      tx.suggestionReason = 'Marked as credit card bill settlement by user (excluded from double-counting).';
    } else if (action === 'MARK_REFUND') {
      tx.isRefund = true;
      tx.inboxStatus = 'CATEGORIZED';
      tx.category = 'Refund';
      tx.suggestionReason = 'Marked as refund / reversal by user.';
    } else if (action === 'IGNORE') {
      tx.inboxStatus = 'IGNORED';
      tx.suggestionReason = 'Ignored by user in Money Inbox.';
    } else if (action === 'SPLIT' && Array.isArray(splitItems) && splitItems.length > 1) {
      const normalized = splitItems
        .map((s: any) => ({
          category: String(s?.category || 'Other').slice(0, 60),
          amount: Math.round((Number(s?.amount) || 0) * 100) / 100,
          notes: s?.notes ? String(s.notes).slice(0, 120) : undefined,
        }))
        .filter((s: { amount: number }) => s.amount > 0);
      const sum = normalized.reduce((s: number, item: { amount: number }) => s + item.amount, 0);
      if (normalized.length < 2 || Math.abs(sum - tx.amount) > 1) {
        return res.status(400).json({
          success: false,
          error: { message: `Split amounts (₹${sum}) must equal original transaction amount (₹${tx.amount}).` },
        });
      }
      tx.splitItems = normalized;
      tx.category = normalized[0].category;
      tx.inboxStatus = 'CATEGORIZED';
      tx.suggestionReason = `Split into ${normalized.length} categories by user.`;
    } else {
      return res.status(400).json({ success: false, error: { message: 'Unsupported inbox action.' } });
    }

    saveStore();
    res.json({ success: true, data: tx });
  });

  app.post('/api/v1/transactions/parse-sms', requireAuth, (req, res) => {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: { message: 'SMS text is required.' } });
    }
    try {
      const parsed = parseBankSMS(text);
      const existing = db.transactions.filter(t => t.ownerId === req.auth!.uid);
      const flagged = flagDuplicateCandidates([parsed], existing)[0];
      const classification = classifyInboxTransaction(flagged, existing);
      res.json({
        success: true,
        data: {
          parsed: {
            ...flagged,
            ...classification,
            inboxStatus: flagged.isDuplicate ? 'DUPLICATE' : classification.inboxStatus,
          },
        },
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Unable to parse SMS text.' },
      });
    }
  });

  app.post('/api/v1/transactions/preview', requireAuth, async (req, res) => {
    const userId = req.auth!.uid;
    const { fileName, mimeType, fileBase64, textContent } = req.body || {};

    try {
      let candidates = [];
      let format: ImportJobRecord['format'] = 'CSV';
      let sizeBytes = 0;

      if (typeof textContent === 'string' && textContent.trim() && !fileBase64) {
        format = 'TXT';
        sizeBytes = Buffer.byteLength(textContent, 'utf8');
        candidates = parsePlainTextLines(textContent, 'STATEMENT');
      } else {
        if (!fileName || !fileBase64) {
          return res.status(400).json({
            success: false,
            error: { message: 'Provide a CSV, XLSX, PDF, or TXT file for statement parsing.' },
          });
        }
        const validated = validateFileUpload(String(fileName), String(mimeType || ''), String(fileBase64));
        sizeBytes = validated.sizeBytes;
        if (validated.extension === '.csv') {
          format = 'CSV';
          candidates = parseCsvStatement(validated.buffer.toString('utf8'));
        } else if (validated.extension === '.xlsx') {
          format = 'XLSX';
          candidates = parseXlsxStatement(validated.buffer);
        } else if (validated.extension === '.pdf') {
          format = 'PDF';
          candidates = await parsePdfStatement(validated.buffer);
        } else if (validated.extension === '.txt') {
          format = 'TXT';
          candidates = parsePlainTextLines(validated.buffer.toString('utf8'), 'STATEMENT');
        } else {
          return res.status(400).json({
            success: false,
            error: { message: 'Only CSV, XLSX, PDF, and TXT files are supported for bank statement parsing.' },
          });
        }
      }

      if (candidates.length === 0) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'NO_TRANSACTIONS_PARSED',
            message: 'No valid transactions could be extracted from this file. Verify column headers (Date, Description, Debit/Credit/Amount).',
          },
        });
      }

      const existing = db.transactions.filter(t => t.ownerId === userId);
      const staged = flagDuplicateCandidates(candidates, existing).map(c => {
        const cls = classifyInboxTransaction(c, existing);
        return {
          ...c,
          category: cls.category,
          inboxStatus: c.isDuplicate ? ('DUPLICATE' as const) : cls.inboxStatus,
          confidence: cls.confidence,
          suggestionReason: c.isDuplicate
            ? 'Possible duplicate of an existing transaction on the same date & amount.'
            : cls.suggestionReason,
          isInternalTransfer: cls.isInternalTransfer,
          isCreditCardSettlement: cls.isCreditCardSettlement,
          isRefund: cls.isRefund,
        };
      });
      const duplicateCount = staged.filter(c => c.isDuplicate).length;

      res.json({
        success: true,
        data: {
          fileName: String(fileName || 'pasted-statement.txt'),
          format,
          fileSizeBytes: sizeBytes,
          totalParsed: staged.length,
          duplicateCount,
          transactions: staged,
        },
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { message: err instanceof Error ? err.message : 'Statement parsing failed.' },
      });
    }
  });

  app.post('/api/v1/transactions/import', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { fileName, format, fileSizeBytes, transactions, skipDuplicates } = req.body || {};

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No staged transactions supplied for import.' } });
    }

    const jobId = `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let importedCount = 0;
    let skippedDuplicatesCount = 0;
    const created: Transaction[] = [];
    const existing = db.transactions.filter(t => t.ownerId === userId);

    for (const raw of transactions.slice(0, 1000)) {
      const amount = Number(raw?.amount);
      if (!raw?.description || !Number.isFinite(amount) || amount <= 0) continue;

      const flagged = flagDuplicateCandidates(
        [
          {
            description: String(raw.description),
            merchant: String(raw.merchant || raw.description),
            amount,
            type: raw.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
            category: String(raw.category || 'General Expense'),
            account: String(raw.account || 'Imported Account'),
            transactionDate: String(raw.transactionDate || new Date().toISOString().split('T')[0]),
            referenceId: raw.referenceId ? String(raw.referenceId) : undefined,
            source: raw.source || 'CSV',
          },
        ],
        [...existing, ...created]
      )[0];

      if (skipDuplicates !== false && flagged.isDuplicate) {
        skippedDuplicatesCount++;
        continue;
      }

      const cls = classifyInboxTransaction(flagged, existing);
      const newTx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ownerId: userId,
        description: flagged.description.slice(0, 200),
        merchant: flagged.merchant.slice(0, 120),
        amount: Math.round(flagged.amount * 100) / 100,
        currency: 'INR',
        type: flagged.type,
        category: String(raw.category || cls.category).slice(0, 60),
        account: flagged.account.slice(0, 100),
        transactionDate: flagged.transactionDate,
        referenceId: flagged.referenceId,
        source: flagged.source,
        importJobId: jobId,
        inboxStatus: flagged.isDuplicate ? 'DUPLICATE' : (raw.inboxStatus || cls.inboxStatus),
        suggestionReason: raw.suggestionReason || cls.suggestionReason,
        confidence: raw.confidence || cls.confidence,
        isInternalTransfer: Boolean(raw.isInternalTransfer ?? cls.isInternalTransfer),
        isCreditCardSettlement: Boolean(raw.isCreditCardSettlement ?? cls.isCreditCardSettlement),
        isRefund: Boolean(raw.isRefund ?? cls.isRefund),
        createdAt: new Date().toISOString(),
      };
      created.push(newTx);
      db.transactions.unshift(newTx);
      importedCount++;
    }

    const job: ImportJobRecord = {
      id: jobId,
      ownerId: userId,
      fileName: String(fileName || 'manual-batch').slice(0, 120),
      format: ['CSV', 'XLSX', 'PDF', 'TXT', 'SMS'].includes(String(format)) ? format : 'CSV',
      fileSizeBytes: Number(fileSizeBytes) || 0,
      totalRowsParsed: transactions.length,
      importedCount,
      skippedDuplicatesCount,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };
    db.importJobs.unshift(job);
    saveStore();

    res.status(201).json({
      success: true,
      data: { job, importedTransactions: created },
      message: `Imported ${importedCount} transactions (${skippedDuplicatesCount} duplicates skipped).`,
    });
  });

  // ----------------- BUDGETS ----------------- //

  app.get('/api/v1/budgets', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const userExpenses = db.transactions.filter(t => t.ownerId === userId && t.type === 'EXPENSE');
    const budgets = db.budgets
      .filter(b => b.ownerId === userId)
      .map(b => {
        const dynamicSpent = userExpenses
          .filter(t => t.category.toLowerCase() === b.category.toLowerCase())
          .reduce((s, t) => s + t.amount, 0);
        return {
          ...b,
          spentAmount: Math.round(dynamicSpent * 100) / 100,
          status: dynamicSpent > b.allocatedAmount ? ('EXCEEDED' as const) : b.status,
        };
      });
    res.json({ success: true, data: budgets });
  });

  app.post('/api/v1/budgets', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { name, category, allocatedAmount, alertThreshold, startDate, endDate } = req.body || {};
    const parsedAllocated = Number(allocatedAmount);
    if (!category || !Number.isFinite(parsedAllocated) || parsedAllocated <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Valid category and allocatedAmount are required' } });
    }

    const newBudget: Budget = {
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      name: String(name || `${category} Budget`).slice(0, 80),
      category: String(category).slice(0, 60),
      allocatedAmount: Math.round(parsedAllocated * 100) / 100,
      spentAmount: 0,
      startDate: String(startDate || new Date().toISOString().slice(0, 7) + '-01'),
      endDate: String(endDate || '2026-03-31'),
      alertThreshold: Math.min(100, Math.max(10, Number(alertThreshold) || 80)),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    db.budgets.push(newBudget);
    saveStore();
    res.status(201).json({ success: true, data: newBudget, message: 'Budget created successfully' });
  });

  app.delete('/api/v1/budgets/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.budgets.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Budget not found' } });
    if (db.budgets[idx].ownerId !== userId) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this budget' } });
    }
    db.budgets.splice(idx, 1);
    saveStore();
    res.json({ success: true, message: 'Budget deleted successfully' });
  });

  // ----------------- PORTFOLIOS & HOLDINGS ----------------- //

  app.get('/api/v1/portfolios', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    let list = db.portfolios.filter(p => p.ownerId === userId);
    if (list.length === 0) {
      const def: Portfolio = {
        id: `port-${userId}`,
        ownerId: userId,
        name: 'Core Wealth Portfolio',
        description: 'Primary investment tracker',
        currency: 'INR',
        createdAt: new Date().toISOString(),
      };
      db.portfolios.push(def);
      saveStore();
      list = [def];
    }
    res.json({ success: true, data: list });
  });

  app.post('/api/v1/portfolios', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { name, description } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Portfolio name is required.' } });
    }
    const portfolio: Portfolio = {
      id: `port-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      name: name.trim().slice(0, 80),
      description: typeof description === 'string' ? description.trim().slice(0, 200) : undefined,
      currency: 'INR',
      createdAt: new Date().toISOString(),
    };
    db.portfolios.push(portfolio);
    saveStore();
    res.status(201).json({ success: true, data: portfolio });
  });

  app.get('/api/v1/holdings', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.holdings.filter(h => h.ownerId === userId) });
  });

  app.get('/api/v1/holdings/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const holding = db.holdings.find(h => h.id === req.params.id);
    if (!holding) return res.status(404).json({ success: false, error: { message: 'Holding not found' } });
    if (holding.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this holding' } });
    res.json({ success: true, data: holding });
  });

  app.post('/api/v1/holdings', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { instrumentSymbol, instrumentName, assetType, quantity, purchasePrice, currentPrice, portfolioId, purchaseDate } = req.body || {};
    const qty = Number(quantity);
    const buyPx = Number(purchasePrice);
    const curPx = Number(currentPrice ?? purchasePrice);

    if (!instrumentSymbol || !assetType || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(buyPx) || buyPx <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Invalid holding fields' } });
    }

    const sym = String(instrumentSymbol).trim().toUpperCase().slice(0, 30);
    const archiveInst = db.marketInstruments.find(m => m.symbol === sym);

    const newHolding: Holding = {
      id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      portfolioId: typeof portfolioId === 'string' && portfolioId ? portfolioId : `port-${userId}`,
      instrumentSymbol: sym,
      instrumentName: String(instrumentName || archiveInst?.name || sym).slice(0, 120),
      assetType,
      quantity: qty,
      purchasePrice: buyPx,
      purchaseDate: String(purchaseDate || new Date().toISOString().split('T')[0]),
      currentPrice: Number.isFinite(curPx) && curPx > 0 ? curPx : archiveInst?.currentPrice || buyPx,
      currency: 'INR',
      updatedAt: new Date().toISOString(),
    };
    db.holdings.push(newHolding);
    saveStore();
    res.status(201).json({ success: true, data: newHolding, message: 'Holding added successfully' });
  });

  app.put('/api/v1/holdings/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const holding = db.holdings.find(h => h.id === req.params.id);
    if (!holding) return res.status(404).json({ success: false, error: { message: 'Holding not found' } });
    if (holding.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this holding' } });

    const { instrumentSymbol, instrumentName, assetType, quantity, purchasePrice, currentPrice } = req.body || {};
    if (instrumentSymbol) holding.instrumentSymbol = String(instrumentSymbol).toUpperCase().slice(0, 30);
    if (instrumentName) holding.instrumentName = String(instrumentName).slice(0, 120);
    if (assetType) holding.assetType = assetType;
    if (quantity !== undefined && Number.isFinite(Number(quantity)) && Number(quantity) > 0) holding.quantity = Number(quantity);
    if (purchasePrice !== undefined && Number.isFinite(Number(purchasePrice)) && Number(purchasePrice) > 0) holding.purchasePrice = Number(purchasePrice);
    if (currentPrice !== undefined && Number.isFinite(Number(currentPrice)) && Number(currentPrice) > 0) holding.currentPrice = Number(currentPrice);
    holding.updatedAt = new Date().toISOString();

    saveStore();
    res.json({ success: true, data: holding, message: 'Holding updated successfully' });
  });

  app.delete('/api/v1/holdings/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.holdings.findIndex(h => h.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Holding not found' } });
    if (db.holdings[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this holding' } });
    db.holdings.splice(idx, 1);
    saveStore();
    res.json({ success: true, message: 'Holding deleted successfully' });
  });

  // ----------------- WATCHLIST, BACKTESTING & PAPER TRADING ----------------- //

  app.get('/api/v1/watchlist', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const items = db.watchlists.filter(w => w.ownerId === userId);
    const enriched = items.map(item => ({
      ...item,
      instrument: db.marketInstruments.find(m => m.symbol === item.symbol) || null,
    }));
    res.json({ success: true, data: enriched });
  });

  app.post('/api/v1/watchlist', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const rawSym = String(req.body?.symbol || '').trim().toUpperCase();
    const inst = db.marketInstruments.find(m => m.symbol === rawSym);
    if (!inst) {
      return res.status(400).json({ success: false, error: { message: `Instrument "${rawSym}" is not in the verified NSE catalog.` } });
    }
    const existing = db.watchlists.find(w => w.ownerId === userId && w.symbol === rawSym);
    if (existing) {
      return res.json({ success: true, data: { ...existing, instrument: inst }, message: 'Already on watchlist' });
    }
    const item: WatchlistItem = {
      id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      symbol: rawSym,
      notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 120) : undefined,
      createdAt: new Date().toISOString(),
    };
    db.watchlists.push(item);
    saveStore();
    res.status(201).json({ success: true, data: { ...item, instrument: inst }, message: 'Added to watchlist' });
  });

  app.delete('/api/v1/watchlist/:symbol', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const sym = decodeURIComponent(req.params.symbol).toUpperCase();
    const idx = db.watchlists.findIndex(w => w.ownerId === userId && w.symbol === sym);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Watchlist entry not found' } });
    db.watchlists.splice(idx, 1);
    saveStore();
    res.json({ success: true, message: 'Removed from watchlist' });
  });

  app.get('/api/v1/backtests', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.backtests.filter(b => b.ownerId === userId) });
  });

  app.post('/api/v1/backtests', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { strategyName, symbol, startingCapital, strategyType, stopLossPct, targetPct } = req.body || {};
    const targetSymbol = String(symbol || 'NIFTY 50').trim().toUpperCase();
    const candles = db.marketHistory[targetSymbol];
    if (!candles || candles.length < 25) {
      return res.status(400).json({
        success: false,
        error: { message: `Insufficient historical data coverage for "${targetSymbol}".` },
      });
    }

    const sl = Number(stopLossPct);
    const tp = Number(targetPct);
    const capital = Number(startingCapital);
    if (!Number.isFinite(capital) || capital < 1000 || !Number.isFinite(sl) || sl <= 0 || !Number.isFinite(tp) || tp <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Valid capital (>=1000), stop-loss (>0), and target (>0) are required.' } });
    }

    const sim = runHistoricalBacktest(candles, {
      startingCapital: capital,
      stopLossPct: sl,
      targetPct: tp,
      strategyType: String(strategyType || 'Moving Average Crossover'),
    });

    const newBacktest: BacktestRecord = {
      id: `bt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      strategyName: String(strategyName || `${strategyType} on ${targetSymbol}`).slice(0, 120),
      symbol: targetSymbol,
      startDate: candles[0].date,
      endDate: candles[candles.length - 1].date,
      startingCapital: capital,
      strategyType: strategyType || 'Moving Average Crossover',
      stopLossPct: sl,
      targetPct: tp,
      totalReturnPct: sim.totalReturnPct,
      maximumDrawdownPct: sim.maximumDrawdownPct,
      winRatePct: sim.winRatePct,
      tradeCount: sim.tradeCount,
      finalCapital: sim.finalCapital,
      dataSource: 'VERIFIED_NSE_ARCHIVE',
      equityCurve: sim.equityCurve,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };

    db.backtests.unshift(newBacktest);
    saveStore();
    res.status(201).json({ success: true, data: newBacktest, message: 'Historical backtest completed' });
  });

  app.delete('/api/v1/backtests/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.backtests.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Backtest not found' } });
    if (db.backtests[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.backtests.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  app.get('/api/v1/paper-trading/account', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const account = getOrCreatePaperAccount(userId);
    const userTrades = db.paperTrades.filter(pt => pt.ownerId === userId);
    res.json({
      success: true,
      data: {
        account,
        trades: userTrades,
      },
    });
  });

  app.post('/api/v1/paper-trading/trades', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { symbol, action, quantity, simulatedPrice } = req.body || {};
    const sym = String(symbol || '').trim().toUpperCase();
    const qty = Number(quantity);
    const inst = db.marketInstruments.find(m => m.symbol === sym);
    const price = Number(simulatedPrice) || inst?.currentPrice || 0;

    if (!sym || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Valid symbol, positive quantity, and positive price are required.' } });
    }

    const account = getOrCreatePaperAccount(userId);
    const positions = account.positions!;
    const cost = Math.round(qty * price * 100) / 100;

    if (action === 'SELL') {
      const heldQty = positions[sym]?.quantity || 0;
      if (heldQty < qty) {
        return res.status(400).json({
          success: false,
          error: { message: `Insufficient simulated ${sym} units to sell (held: ${heldQty}). Buy units first in paper trading.` },
        });
      }
      positions[sym].quantity = Math.round((heldQty - qty) * 10000) / 10000;
      if (positions[sym].quantity <= 0) delete positions[sym];
      account.availableVirtualBalance = Math.round((account.availableVirtualBalance + cost) * 100) / 100;
    } else {
      if (account.availableVirtualBalance < cost) {
        return res.status(400).json({ success: false, error: { message: 'Insufficient simulated virtual capital' } });
      }
      const prev = positions[sym] || { quantity: 0, avgPrice: 0 };
      const newQty = prev.quantity + qty;
      const newAvg = (prev.quantity * prev.avgPrice + cost) / newQty;
      positions[sym] = { quantity: newQty, avgPrice: Math.round(newAvg * 100) / 100 };
      account.availableVirtualBalance = Math.round((account.availableVirtualBalance - cost) * 100) / 100;
    }

    // Recalculate simulated portfolio value
    const updatedAccount = getOrCreatePaperAccount(userId);
    const trade: PaperTrade = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      symbol: sym,
      action: action === 'SELL' ? 'SELL' : 'BUY',
      quantity: qty,
      simulatedPrice: price,
      historicalReferenceDate: inst?.lastUpdatedDate || new Date().toISOString().split('T')[0],
      cashImpact: action === 'SELL' ? cost : -cost,
      status: 'EXECUTED_SIMULATED',
      createdAt: new Date().toISOString(),
    };

    db.paperTrades.unshift(trade);
    saveStore();
    res.status(201).json({ success: true, data: { trade, account: updatedAccount }, message: 'Simulated paper trade executed' });
  });

  app.post('/api/v1/paper-trading/reset', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    db.paperAccounts = db.paperAccounts.filter(pa => pa.ownerId !== userId);
    db.paperTrades = db.paperTrades.filter(pt => pt.ownerId !== userId);
    const fresh = getOrCreatePaperAccount(userId);
    saveStore();
    res.json({ success: true, data: { account: fresh, trades: [] }, message: 'Virtual paper account reset to ₹10,00,000' });
  });

  // ----------------- TAX ENGINE & DOCUMENTS ----------------- //

  app.get('/api/v1/tax/rules', requireAuth, (_req, res) => {
    res.json({ success: true, data: db.taxRules.filter(r => r.active) });
  });

  app.get('/api/v1/tax/profile', requireAuth, (req, res) => {
    const profile = ensureTaxProfile(req.auth!.uid);
    res.json({ success: true, data: profile });
  });

  app.put('/api/v1/tax/profile', requireAuth, (req, res) => {
    const tp = ensureTaxProfile(req.auth!.uid);
    const { financialYear, annualSalary, otherIncome, ageCategory, preferredRegime } = req.body || {};
    if (financialYear === '2025-26' || financialYear === '2024-25') {
      tp.financialYear = financialYear;
      tp.assessmentYear = financialYear === '2025-26' ? '2026-27' : '2025-26';
    }
    if (Number.isFinite(Number(annualSalary)) && Number(annualSalary) >= 0) tp.annualSalary = Number(annualSalary);
    if (Number.isFinite(Number(otherIncome)) && Number(otherIncome) >= 0) tp.otherIncome = Number(otherIncome);
    if (['BELOW_60', 'SENIOR_60_80', 'SUPER_SENIOR_80_PLUS'].includes(ageCategory)) tp.ageCategory = ageCategory;
    if (preferredRegime === 'NEW' || preferredRegime === 'OLD') tp.preferredRegime = preferredRegime;
    tp.updatedAt = new Date().toISOString();
    saveStore();
    res.json({ success: true, data: tp });
  });

  app.post('/api/v1/tax/compare', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const body = req.body || {};
    const financialYear = body.financialYear === '2024-25' ? '2024-25' : '2025-26';
    const grossIncome = Number(body.grossIncome);
    if (!Number.isFinite(grossIncome) || grossIncome < 0) {
      return res.status(400).json({ success: false, error: { message: 'Valid grossIncome >= 0 is required.' } });
    }
    const userDeductions = db.taxDeductions.filter(td => td.ownerId === userId && td.financialYear === financialYear);
    const claimedTotal =
      body.deductions !== undefined
        ? Math.max(0, Number(body.deductions) || 0)
        : userDeductions.reduce((s, d) => s + Math.min(d.claimedAmount, d.applicableLimit), 0);

    const oldRegime = calculateIndianTax(grossIncome, claimedTotal, 'OLD', financialYear);
    const newRegime = calculateIndianTax(grossIncome, claimedTotal, 'NEW', financialYear);
    const recommendedRegime = newRegime.totalTax <= oldRegime.totalTax ? 'NEW' : 'OLD';
    const estimatedSavings = Math.abs(oldRegime.totalTax - newRegime.totalTax);

    res.json({
      success: true,
      data: {
        financialYear,
        rulesetVersion: newRegime.rulesetVersion,
        oldRegime,
        newRegime,
        recommendedRegime,
        estimatedSavings,
      },
    });
  });

  app.post('/api/v1/tax/calculate', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const body = req.body || {};
    const financialYear = body.financialYear === '2024-25' ? '2024-25' : '2025-26';
    const grossIncome = Number(body.grossIncome);
    if (!Number.isFinite(grossIncome) || grossIncome < 0) {
      return res.status(400).json({ success: false, error: { message: 'Valid grossIncome >= 0 is required.' } });
    }

    const userDeductions = db.taxDeductions.filter(td => td.ownerId === userId && td.financialYear === financialYear);
    const claimedTotal =
      body.deductions !== undefined
        ? Math.max(0, Number(body.deductions) || 0)
        : userDeductions.reduce((s, d) => s + Math.min(d.claimedAmount, d.applicableLimit), 0);

    const oldRegime = calculateIndianTax(grossIncome, claimedTotal, 'OLD', financialYear);
    const newRegime = calculateIndianTax(grossIncome, claimedTotal, 'NEW', financialYear);
    const recommendedRegime = newRegime.totalTax <= oldRegime.totalTax ? 'NEW' : 'OLD';
    const estimatedSavings = Math.abs(oldRegime.totalTax - newRegime.totalTax);

    const record: TaxCalculationRecord = {
      id: `tcalc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      financialYear,
      rulesetVersion: newRegime.rulesetVersion,
      grossIncome,
      deductionsClaimed: claimedTotal,
      oldRegimeTotalTax: oldRegime.totalTax,
      newRegimeTotalTax: newRegime.totalTax,
      recommendedRegime,
      estimatedSavings,
      createdAt: new Date().toISOString(),
    };
    db.taxCalculations.unshift(record);
    saveStore();

    res.status(201).json({
      success: true,
      data: {
        record,
        oldRegime,
        newRegime,
      },
      message: 'Tax calculation saved to audit history',
    });
  });

  app.get('/api/v1/tax/calculations', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.taxCalculations.filter(c => c.ownerId === userId) });
  });

  app.get('/api/v1/tax/deductions', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.taxDeductions.filter(td => td.ownerId === userId) });
  });

  app.post('/api/v1/tax/deductions', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { category, description, claimedAmount, applicableLimit, financialYear } = req.body || {};
    const amt = Number(claimedAmount);
    if (!category || !Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Valid category and positive claimedAmount are required.' } });
    }
    const deduction: TaxDeduction = {
      id: `td-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      category,
      description: String(description || category).slice(0, 140),
      claimedAmount: Math.round(amt * 100) / 100,
      applicableLimit: Number(applicableLimit) || (category === 'Section 80C' ? 150000 : category === 'Section 24(b) Home Loan' ? 200000 : 50000),
      financialYear: financialYear === '2024-25' ? '2024-25' : '2025-26',
      verificationStatus: 'VERIFIED',
      createdAt: new Date().toISOString(),
    };
    db.taxDeductions.push(deduction);
    saveStore();
    res.status(201).json({ success: true, data: deduction, message: 'Tax deduction saved' });
  });

  app.delete('/api/v1/tax/deductions/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.taxDeductions.findIndex(td => td.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Deduction not found' } });
    if (db.taxDeductions[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.taxDeductions.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  app.get('/api/v1/tax/documents', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.taxDocuments.filter(d => d.ownerId === userId) });
  });

  app.post('/api/v1/tax/documents', requireAuth, async (req, res) => {
    const userId = req.auth!.uid;
    const { fileName, mimeType, fileBase64, category, financialYear } = req.body || {};
    try {
      const validated = validateFileUpload(String(fileName || ''), String(mimeType || ''), String(fileBase64 || ''));
      if (!['.pdf', '.png', '.jpg', '.jpeg'].includes(validated.extension)) {
        return res.status(400).json({ success: false, error: { message: 'Tax documents must be PDF, PNG, or JPG files.' } });
      }
      const storageKey = await vault.saveFile(userId, 'tax', validated);
      const docRecord: TaxDocument = {
        id: `tdoc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId: userId,
        name: validated.safeName,
        category: category || 'Form 16',
        financialYear: financialYear === '2024-25' ? '2024-25' : '2025-26',
        mimeType: validated.mimeType,
        fileSizeBytes: validated.sizeBytes,
        fileSize: validated.sizeLabel,
        storageKey,
        uploadedAt: new Date().toISOString(),
      };
      db.taxDocuments.unshift(docRecord);
      saveStore();
      res.status(201).json({ success: true, data: docRecord, message: 'Tax document stored securely.' });
    } catch (err) {
      res.status(400).json({ success: false, error: { message: err instanceof Error ? err.message : 'Upload failed.' } });
    }
  });

  app.get('/api/v1/tax/documents/:id/download', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const docRecord = db.taxDocuments.find(d => d.id === req.params.id);
    if (!docRecord) return res.status(404).json({ success: false, error: { message: 'Document not found' } });
    if (docRecord.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    const buf = vault.readFileForOwner(userId, docRecord.storageKey);
    if (!buf) return res.status(404).json({ success: false, error: { message: 'Stored file payload not found' } });

    res.setHeader('Content-Type', docRecord.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${docRecord.name}"`);
    res.send(buf);
  });

  app.delete('/api/v1/tax/documents/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.taxDocuments.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Document not found' } });
    if (db.taxDocuments[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    vault.deleteFileForOwner(userId, db.taxDocuments[idx].storageKey);
    db.taxDocuments.splice(idx, 1);
    saveStore();
    res.json({ success: true, message: 'Tax document deleted' });
  });

  // ----------------- FRAUD & SCAM DETECTOR ----------------- //

  app.post('/api/v1/fraud/analyze', requireAuth, async (req, res) => {
    const userId = req.auth!.uid;
    const { text, sourceType } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim().length < 5) {
      return res.status(400).json({ success: false, error: { message: 'Message text must be at least 5 characters.' } });
    }
    if (!db.systemSettings.aiEnabled) {
      return res.status(503).json({ success: false, error: { code: 'AI_DISABLED', message: 'AI analysis is currently disabled by administrator settings.' } });
    }

    const start = Date.now();
    try {
      const output = await runFraudAnalyzer(userId, text.trim(), String(sourceType || 'SMS'));
      const deterministicSignals = inspectFraudSignals(text.trim());
      const analysisResult: FraudAnalysis = {
        id: `fa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ownerId: userId,
        inputText: text.trim().slice(0, 4000),
        sourceType: (['SMS', 'WhatsApp', 'Email', 'UPI App', 'Website', 'Other'].includes(String(sourceType))
          ? sourceType
          : 'SMS') as FraudAnalysis['sourceType'],
        riskScore: output.riskScore,
        riskLevel: output.riskLevel,
        summary: output.summary,
        suspiciousKeywords: output.suspiciousKeywords,
        findings: Array.from(new Set([...deterministicSignals.deterministicEvidence, ...output.findings])).slice(0, 12),
        recommendedActions: output.recommendedActions,
        modelUsed: GEMINI_MODEL,
        createdAt: new Date().toISOString(),
      };

      db.fraudAnalyses.unshift(analysisResult);
      db.aiUsageLogs.unshift({
        id: `aiu-${Date.now()}`,
        ownerId: userId,
        endpoint: '/api/v1/fraud/analyze',
        model: GEMINI_MODEL,
        status: 'SUCCESS',
        latencyMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      });
      saveStore();
      res.json({ success: true, data: { ...analysisResult, urlInspection: deterministicSignals.urls } });
    } catch (err) {
      const status = err instanceof AIServiceError ? err.statusCode : 500;
      const code = err instanceof AIServiceError ? err.code : 'AI_PROVIDER_ERROR';
      const message = err instanceof Error ? err.message : 'Unable to complete Gemini AI fraud analysis.';
      console.error('[FinSight Fraud AI Error]', code, message);
      db.aiUsageLogs.unshift({
        id: `aiu-${Date.now()}`,
        ownerId: userId,
        endpoint: '/api/v1/fraud/analyze',
        model: GEMINI_MODEL,
        status: status === 429 ? 'RATE_LIMITED' : 'ERROR',
        latencyMs: Date.now() - start,
        errorCode: code,
        createdAt: new Date().toISOString(),
      });
      saveStore();
      res.status(status).json({ success: false, message, error: { code, message } });
    }
  });

  app.get('/api/v1/fraud/analyses', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.fraudAnalyses.filter(fa => fa.ownerId === userId) });
  });

  app.get('/api/v1/fraud/reports', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.fraudAnalyses.filter(fa => fa.ownerId === userId) });
  });

  app.delete('/api/v1/fraud/analyses/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.fraudAnalyses.findIndex(fa => fa.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Analysis not found' } });
    if (db.fraudAnalyses[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.fraudAnalyses.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  // ----------------- SMALL BUSINESS & GST ----------------- //

  app.get('/api/v1/business', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const profile = ensureBusinessProfile(userId);
    const invoices = db.invoices.filter(i => i.ownerId === userId);
    const expenses = db.businessExpenses.filter(e => e.ownerId === userId);
    const clients = db.clients.filter(c => c.ownerId === userId);
    res.json({
      success: true,
      data: {
        profile,
        totalBilled: invoices.reduce((s, i) => s + i.total, 0),
        totalReceived: invoices.reduce((s, i) => s + i.amountPaid, 0),
        totalOutstanding: invoices.reduce((s, i) => s + i.balanceDue, 0),
        totalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
        clientsCount: clients.length,
        invoicesCount: invoices.length,
      },
    });
  });

  app.put('/api/v1/business/profile', requireAuth, (req, res) => {
    const profile = ensureBusinessProfile(req.auth!.uid);
    const { businessName, gstin, stateCode, address, openingCashBalance } = req.body || {};
    if (gstin && !validateGSTIN(String(gstin))) {
      return res.status(400).json({ success: false, error: { message: 'Invalid Indian GSTIN format (expected 15-char GSTIN e.g. 29AAACF9876K1ZP).' } });
    }
    if (typeof businessName === 'string' && businessName.trim()) profile.businessName = businessName.trim().slice(0, 120);
    if (typeof gstin === 'string') profile.gstin = gstin.trim().toUpperCase();
    if (typeof stateCode === 'string') profile.stateCode = stateCode.trim();
    if (typeof address === 'string') profile.address = address.trim().slice(0, 240);
    if (Number.isFinite(Number(openingCashBalance)) && Number(openingCashBalance) >= 0) {
      profile.openingCashBalance = Number(openingCashBalance);
    }
    profile.updatedAt = new Date().toISOString();
    saveStore();
    res.json({ success: true, data: profile });
  });

  app.get('/api/v1/business/invoices', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.invoices.filter(i => i.ownerId === userId) });
  });

  app.get('/api/v1/business/invoices/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const inv = db.invoices.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });
    if (inv.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this invoice' } });
    res.json({ success: true, data: inv });
  });

  app.get('/api/v1/business/invoices/:id/pdf', requireAuth, async (req, res) => {
    const userId = req.auth!.uid;
    const inv = db.invoices.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });
    if (inv.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this invoice' } });

    const profile = ensureBusinessProfile(userId);
    const pdfBuf = await generateInvoicePdfBuffer(inv, {
      businessName: profile.businessName,
      gstin: profile.gstin,
      address: profile.address,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.invoiceNumber}.pdf"`);
    res.send(pdfBuf);
  });

  app.post('/api/v1/business/invoices', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { clientId, clientName, clientGstin, placeOfSupply, lineItems, notes, dueDate } = req.body || {};

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'At least one invoice line item is required.' } });
    }
    if (clientGstin && !validateGSTIN(String(clientGstin))) {
      return res.status(400).json({ success: false, error: { message: 'Invalid client GSTIN format.' } });
    }

    const normalizedItems: InvoiceItem[] = lineItems.map((it: any, idx: number) => {
      const qty = Math.max(0.01, Number(it.quantity) || 1);
      const price = Math.max(0, Number(it.unitPrice) || 0);
      const rate = [0, 5, 12, 18, 28].includes(Number(it.taxRate)) ? Number(it.taxRate) : 18;
      return {
        id: String(it.id || `li-${idx + 1}`),
        description: String(it.description || 'Service').slice(0, 200),
        quantity: qty,
        unitPrice: price,
        taxRate: rate,
        lineTotal: Math.round(qty * price * 100) / 100,
      };
    });

    const business = ensureBusinessProfile(userId);
    const supply = String(placeOfSupply || '29 - Karnataka (Intrastate)');
    const sellerPrefix = (business.stateCode || '29').slice(0, 2);
    const supplyPrefix = supply.slice(0, 2);
    const isInterState = /^\d{2}$/.test(supplyPrefix) ? supplyPrefix !== sellerPrefix : !supply.includes('Karnataka');

    const totals = calculateInvoiceTotals(normalizedItems, isInterState);
    const userInvoices = db.invoices.filter(i => i.ownerId === userId);
    const matchedClient = db.clients.find(c => c.ownerId === userId && (c.id === clientId || c.companyName === clientName));

    const invoice: Invoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      clientId: matchedClient?.id || String(clientId || ''),
      clientName: String(clientName || matchedClient?.companyName || 'Client').slice(0, 120),
      clientGstin: clientGstin ? String(clientGstin).toUpperCase() : matchedClient?.gstin,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(userInvoices.length + 1).padStart(4, '0')}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: String(dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
      placeOfSupply: supply,
      lineItems: normalizedItems,
      subtotal: totals.taxableAmount,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      totalGst: totals.totalGst,
      total: totals.totalInvoiceAmount,
      amountPaid: 0,
      balanceDue: totals.totalInvoiceAmount,
      status: 'UNPAID',
      notes: typeof notes === 'string' ? notes.slice(0, 500) : undefined,
      createdAt: new Date().toISOString(),
    };

    db.invoices.unshift(invoice);
    saveStore();
    res.status(201).json({ success: true, data: invoice, message: 'Invoice generated successfully' });
  });

  app.post('/api/v1/business/invoices/:id/payment', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const inv = db.invoices.find(i => i.id === req.params.id);
    if (!inv) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });
    if (inv.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this invoice' } });

    const payAmt = req.body?.amount !== undefined ? Number(req.body.amount) : inv.balanceDue;
    if (!Number.isFinite(payAmt) || payAmt <= 0 || payAmt > inv.balanceDue + 0.01) {
      return res.status(400).json({
        success: false,
        error: { message: `Payment amount must be greater than 0 and not exceed balance due (₹${inv.balanceDue}).` },
      });
    }

    inv.amountPaid = Math.round((inv.amountPaid + payAmt) * 100) / 100;
    inv.balanceDue = Math.max(0, Math.round((inv.total - inv.amountPaid) * 100) / 100);
    inv.status = inv.balanceDue === 0 ? 'PAID' : 'PARTIALLY_PAID';
    saveStore();

    res.json({ success: true, data: inv, message: 'Payment recorded successfully' });
  });

  app.delete('/api/v1/business/invoices/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.invoices.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });
    if (db.invoices[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this invoice' } });
    db.invoices.splice(idx, 1);
    saveStore();
    res.json({ success: true, message: 'Invoice deleted successfully' });
  });

  app.get('/api/v1/business/clients', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.clients.filter(c => c.ownerId === userId) });
  });

  app.post('/api/v1/business/clients', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { clientName, companyName, email, phone, gstin, billingAddress } = req.body || {};
    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Company name is required' } });
    }
    if (gstin && !validateGSTIN(String(gstin))) {
      return res.status(400).json({ success: false, error: { message: 'Invalid GSTIN format (15 characters, e.g. 29AABCC1234D1Z5).' } });
    }

    const newClient: Client = {
      id: `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      clientName: String(clientName || companyName).trim().slice(0, 100),
      companyName: companyName.trim().slice(0, 120),
      email: String(email || '').trim().slice(0, 120),
      phone: String(phone || '').trim().slice(0, 40),
      gstin: gstin ? String(gstin).trim().toUpperCase() : undefined,
      billingAddress: String(billingAddress || '').trim().slice(0, 200),
      createdAt: new Date().toISOString(),
    };

    db.clients.push(newClient);
    saveStore();
    res.status(201).json({ success: true, data: newClient, message: 'Client added successfully' });
  });

  app.delete('/api/v1/business/clients/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.clients.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Client not found' } });
    if (db.clients[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.clients.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  app.get('/api/v1/business/expenses', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.businessExpenses.filter(be => be.ownerId === userId) });
  });

  app.post('/api/v1/business/expenses', requireAuth, async (req, res) => {
    const userId = req.auth!.uid;
    const { name, category, amount, vendor, paymentMethod, notes, expenseDate, receiptFile } = req.body || {};
    const parsedAmt = Number(amount);
    if (!name || !category || !Number.isFinite(parsedAmt) || parsedAmt <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Valid expense name, category, and positive amount are required.' } });
    }

    let receiptName: string | undefined;
    let receiptStorageKey: string | undefined;
    let receiptMimeType: string | undefined;

    if (receiptFile && receiptFile.fileName && receiptFile.fileBase64) {
      try {
        const validated = validateFileUpload(String(receiptFile.fileName), String(receiptFile.mimeType || ''), String(receiptFile.fileBase64));
        receiptStorageKey = await vault.saveFile(userId, 'receipts', validated);
        receiptName = validated.safeName;
        receiptMimeType = validated.mimeType;
      } catch (err) {
        return res.status(400).json({ success: false, error: { message: err instanceof Error ? err.message : 'Invalid receipt file.' } });
      }
    }

    const expense: BusinessExpense = {
      id: `be-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      name: String(name).trim().slice(0, 120),
      category,
      amount: Math.round(parsedAmt * 100) / 100,
      expenseDate: String(expenseDate || new Date().toISOString().split('T')[0]),
      vendor: String(vendor || 'Direct Vendor').slice(0, 100),
      paymentMethod: String(paymentMethod || 'Corporate Account').slice(0, 60),
      notes: typeof notes === 'string' ? notes.slice(0, 300) : undefined,
      receiptName,
      receiptStorageKey,
      receiptMimeType,
      createdAt: new Date().toISOString(),
    };
    db.businessExpenses.unshift(expense);
    saveStore();
    res.status(201).json({ success: true, data: expense, message: 'Business expense logged' });
  });

  app.get('/api/v1/business/expenses/:id/receipt', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const exp = db.businessExpenses.find(e => e.id === req.params.id);
    if (!exp) return res.status(404).json({ success: false, error: { message: 'Expense not found' } });
    if (exp.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    if (!exp.receiptStorageKey) return res.status(404).json({ success: false, error: { message: 'No receipt attached' } });
    const buf = vault.readFileForOwner(userId, exp.receiptStorageKey);
    if (!buf) return res.status(404).json({ success: false, error: { message: 'Receipt payload missing' } });
    res.setHeader('Content-Type', exp.receiptMimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${exp.receiptName || 'receipt'}"`);
    res.send(buf);
  });

  app.delete('/api/v1/business/expenses/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.businessExpenses.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Expense not found' } });
    if (db.businessExpenses[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    if (db.businessExpenses[idx].receiptStorageKey) {
      vault.deleteFileForOwner(userId, db.businessExpenses[idx].receiptStorageKey!);
    }
    db.businessExpenses.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  app.get('/api/v1/business/cash-flow', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const bp = ensureBusinessProfile(userId);
    const invoices = db.invoices.filter(i => i.ownerId === userId);
    const expenses = db.businessExpenses.filter(e => e.ownerId === userId);
    const emis = db.emiPlans.filter(p => p.ownerId === userId);

    const paidRevenue = invoices.reduce((s, i) => s + i.amountPaid, 0);
    const confirmedReceivables = invoices.reduce((s, i) => s + i.balanceDue, 0);
    const loggedExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const monthlyEmiCommitment = emis.reduce((s, p) => s + p.monthlyEMI, 0);

    const openingBalance = Math.round((bp.openingCashBalance + paidRevenue) * 100) / 100;
    const committedOutflows = Math.round((loggedExpenses + monthlyEmiCommitment) * 100) / 100;
    const projectedClosingBalance = Math.round((openingBalance + confirmedReceivables - committedOutflows) * 100) / 100;
    const monthlyBurnRate = committedOutflows;
    const runwayMonths = monthlyBurnRate > 0 ? Math.round((Math.max(0, openingBalance) / monthlyBurnRate) * 10) / 10 : 0;

    const forecast = {
      id: `cf-${userId}`,
      ownerId: userId,
      openingBalance,
      confirmedReceivables: Math.round(confirmedReceivables * 100) / 100,
      committedOutflows,
      projectedClosingBalance,
      monthlyBurnRate,
      runwayMonths,
      monthlyProjection: [
        { month: 'Month 1', inflow: confirmedReceivables, outflow: committedOutflows, closingBalance: projectedClosingBalance },
        {
          month: 'Month 2',
          inflow: Math.round(paidRevenue * 0.5),
          outflow: committedOutflows,
          closingBalance: Math.round(projectedClosingBalance + paidRevenue * 0.5 - committedOutflows),
        },
        {
          month: 'Month 3',
          inflow: Math.round(paidRevenue * 0.5),
          outflow: committedOutflows,
          closingBalance: Math.round(projectedClosingBalance + paidRevenue - committedOutflows * 2),
        },
      ],
      generatedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: forecast });
  });

  app.get('/api/v1/business/emi', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.emiPlans.filter(p => p.ownerId === userId) });
  });

  app.post('/api/v1/business/emi', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { planName, loanAmount, annualInterestRate, tenureMonths, monthlyEMI, totalInterest, totalPayment } = req.body || {};
    if (!Number.isFinite(Number(loanAmount)) || Number(loanAmount) <= 0 || !Number.isFinite(Number(tenureMonths)) || Number(tenureMonths) <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Valid loanAmount and tenureMonths are required.' } });
    }
    const plan: EMIPlan = {
      id: `emi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      planName: String(planName || 'Commercial Loan Plan').slice(0, 100),
      loanAmount: Number(loanAmount),
      annualInterestRate: Number(annualInterestRate) || 0,
      tenureMonths: parseInt(String(tenureMonths), 10),
      monthlyEMI: Number(monthlyEMI) || 0,
      totalInterest: Number(totalInterest) || 0,
      totalPayment: Number(totalPayment) || 0,
      createdAt: new Date().toISOString(),
    };
    db.emiPlans.push(plan);
    saveStore();
    res.status(201).json({ success: true, data: plan, message: 'EMI scenario saved' });
  });

  app.delete('/api/v1/business/emi/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.emiPlans.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'EMI plan not found' } });
    if (db.emiPlans[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.emiPlans.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  // ----------------- FINSIGHT 2.0 INTELLIGENCE MODULES ----------------- //

  // 1) Financial Health Summary, Snapshots, Manual Assets/Liabilities & PDF/JSON Reports
  function computeHealthBundleForUser(uid: string) {
    const txs = db.transactions.filter(t => t.ownerId === uid);
    const holdings = db.holdings.filter(h => h.ownerId === uid);
    const creditCards = db.creditCards.filter(c => c.ownerId === uid);
    const goals = db.moneyGoals.filter(g => g.ownerId === uid);
    const manualItems = db.manualAssetsLiabilities.filter(m => m.ownerId === uid);
    const bp = db.businessProfiles.find(b => b.ownerId === uid);
    const summary = computeFinancialHealthSummary({
      transactions: txs,
      holdings,
      creditCards,
      goals,
      manualItems,
      openingCashBalance: bp?.openingCashBalance || 0,
    });
    return { summary, manualItems };
  }

  app.get('/api/v1/financial-health/summary', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { summary, manualItems } = computeHealthBundleForUser(userId);
    res.json({ success: true, data: { ...summary, manualItems } });
  });

  app.get('/api/v1/financial-health/history', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({
      success: true,
      data: db.financialHealthSnapshots.filter(s => s.ownerId === userId),
    });
  });

  app.post('/api/v1/financial-health/snapshot', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { summary } = computeHealthBundleForUser(userId);
    const snap: FinancialHealthSnapshot = {
      id: `fhs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      period: new Date().toISOString().slice(0, 7),
      ...summary,
      supportingDataReferences: [
        `${db.transactions.filter(t => t.ownerId === userId).length} transactions`,
        `${db.holdings.filter(h => h.ownerId === userId).length} holdings`,
        `${db.creditCards.filter(c => c.ownerId === userId).length} credit cards`,
        `${db.moneyGoals.filter(g => g.ownerId === userId).length} goals`,
      ],
      calculatedAt: new Date().toISOString(),
    };
    db.financialHealthSnapshots.unshift(snap);
    saveStore();
    res.status(201).json({ success: true, data: snap, message: 'Financial health snapshot saved' });
  });

  app.get('/api/v1/financial-health/report', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { summary } = computeHealthBundleForUser(userId);
    const profile = ensureUserProfile(req.auth!);
    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        user: { fullName: profile.fullName, email: profile.email, currency: profile.currency },
        ...summary,
      },
    });
  });

  app.get('/api/v1/financial-health/report/pdf', requireAuth, async (req, res) => {
    const userId = req.auth!.uid;
    const { summary } = computeHealthBundleForUser(userId);
    const profile = ensureUserProfile(req.auth!);
    const pdfBuf = await generateHealthReportPdfBuffer({
      userName: profile.fullName,
      userEmail: profile.email,
      generatedAt: new Date().toISOString(),
      summary,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FinSight-Health-Report-${new Date().toISOString().slice(0, 10)}.pdf"`);
    res.send(pdfBuf);
  });

  app.post('/api/v1/financial-health/assets-liabilities', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { name, kind, category, amount, included, notes } = req.body || {};
    const numAmt = Number(amount);
    if (!name || !['ASSET', 'LIABILITY'].includes(String(kind)) || !Number.isFinite(numAmt) || numAmt < 0) {
      return res.status(400).json({ success: false, error: { message: 'Valid name, kind (ASSET/LIABILITY), and non-negative amount required.' } });
    }
    const item: ManualAssetLiability = {
      id: `mal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      name: String(name).trim().slice(0, 100),
      kind: kind === 'LIABILITY' ? 'LIABILITY' : 'ASSET',
      category: String(category || (kind === 'LIABILITY' ? 'Loan' : 'Cash Reserve')).slice(0, 60),
      amount: Math.round(numAmt * 100) / 100,
      included: included !== false,
      notes: typeof notes === 'string' ? notes.slice(0, 200) : undefined,
      createdAt: new Date().toISOString(),
    };
    db.manualAssetsLiabilities.unshift(item);
    saveStore();
    res.status(201).json({ success: true, data: item });
  });

  app.delete('/api/v1/financial-health/assets-liabilities/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.manualAssetsLiabilities.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Record not found' } });
    if (db.manualAssetsLiabilities[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.manualAssetsLiabilities.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  // 2) Financial Goals
  app.get('/api/v1/goals', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const list = db.moneyGoals
      .filter(g => g.ownerId === userId)
      .map(g => ({ ...g, projection: computeGoalProjection(g) }));
    res.json({ success: true, data: list });
  });

  app.post('/api/v1/goals', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { title, category, targetAmount, currentAmount, targetDate, monthlyContribution, priority } = req.body || {};
    const target = Number(targetAmount);
    const current = Math.max(0, Number(currentAmount) || 0);
    const monthly = Math.max(0, Number(monthlyContribution) || 0);
    if (!title || !Number.isFinite(target) || target <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Valid goal title and positive targetAmount required.' } });
    }
    const goal: MoneyGoal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      title: String(title).trim().slice(0, 100),
      category: ([
        'Emergency Fund',
        'Education',
        'Travel',
        'Vehicle',
        'Home',
        'Family',
        'Retirement',
        'Custom Goal',
      ].includes(String(category))
        ? category
        : 'Custom Goal') as MoneyGoal['category'],
      targetAmount: Math.round(target * 100) / 100,
      currentAmount: Math.round(current * 100) / 100,
      targetDate: String(targetDate || new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]),
      monthlyContribution: Math.round(monthly * 100) / 100,
      priority: ['HIGH', 'MEDIUM', 'LOW'].includes(String(priority)) ? priority : 'MEDIUM',
      status: current >= target ? 'COMPLETED' : 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.moneyGoals.unshift(goal);
    saveStore();
    res.status(201).json({ success: true, data: { ...goal, projection: computeGoalProjection(goal) } });
  });

  app.get('/api/v1/goals/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const g = db.moneyGoals.find(item => item.id === req.params.id);
    if (!g) return res.status(404).json({ success: false, error: { message: 'Goal not found' } });
    if (g.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    res.json({ success: true, data: { ...g, projection: computeGoalProjection(g) } });
  });

  app.put('/api/v1/goals/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const g = db.moneyGoals.find(item => item.id === req.params.id);
    if (!g) return res.status(404).json({ success: false, error: { message: 'Goal not found' } });
    if (g.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });

    const { title, targetAmount, currentAmount, targetDate, monthlyContribution, priority, status } = req.body || {};
    if (typeof title === 'string' && title.trim()) g.title = title.trim().slice(0, 100);
    if (targetAmount !== undefined && Number.isFinite(Number(targetAmount)) && Number(targetAmount) > 0) g.targetAmount = Number(targetAmount);
    if (currentAmount !== undefined && Number.isFinite(Number(currentAmount)) && Number(currentAmount) >= 0) g.currentAmount = Number(currentAmount);
    if (typeof targetDate === 'string' && targetDate.trim()) g.targetDate = targetDate.trim();
    if (monthlyContribution !== undefined && Number.isFinite(Number(monthlyContribution)) && Number(monthlyContribution) >= 0) g.monthlyContribution = Number(monthlyContribution);
    if (['HIGH', 'MEDIUM', 'LOW'].includes(String(priority))) g.priority = priority;
    if (['ACTIVE', 'COMPLETED', 'PAUSED'].includes(String(status))) g.status = status;
    else if (g.currentAmount >= g.targetAmount) g.status = 'COMPLETED';
    g.updatedAt = new Date().toISOString();
    saveStore();
    res.json({ success: true, data: { ...g, projection: computeGoalProjection(g) } });
  });

  app.delete('/api/v1/goals/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.moneyGoals.findIndex(item => item.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Goal not found' } });
    if (db.moneyGoals[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.moneyGoals.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  // 3) Money Calendar & Cash-Flow Radar
  function collectUserRadarEvents(uid: string): MoneyCalendarEvent[] {
    const manualEvents = db.moneyCalendarEvents.filter(e => e.ownerId === uid);
    const derived: MoneyCalendarEvent[] = [...manualEvents];
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    // Synthesize upcoming credit card dues if user has cards
    for (const card of db.creditCards.filter(c => c.ownerId === uid && c.currentBalance > 0)) {
      const dueDay = Math.min(28, Math.max(1, card.dueDate || 15));
      let due = new Date(y, m, dueDay);
      if (due.getTime() < now.getTime() - 86400000) due = new Date(y, m + 1, dueDay);
      derived.push({
        id: `derived-cc-${card.id}`,
        ownerId: uid,
        title: `${card.nickname} (*${card.lastFourDigits}) Card Bill`,
        eventType: 'CREDIT_CARD',
        dueDate: due.toISOString().split('T')[0],
        amount: card.currentBalance,
        direction: 'OUTFLOW',
        relatedResourceId: card.id,
        recurrence: 'MONTHLY',
        reminderPreference: card.reminderPreference,
        status: 'UPCOMING',
        createdAt: card.createdAt,
      });
    }

    // Synthesize confirmed recurring payments
    for (const rec of db.recurringPayments.filter(r => r.ownerId === uid && r.status === 'CONFIRMED')) {
      derived.push({
        id: `derived-rec-${rec.id}`,
        ownerId: uid,
        title: `${rec.merchant} (${rec.frequency.toLowerCase()})`,
        eventType: 'SUBSCRIPTION',
        dueDate: rec.nextEstimatedDate,
        amount: rec.estimatedAmount,
        direction: 'OUTFLOW',
        relatedResourceId: rec.id,
        recurrence: rec.frequency === 'WEEKLY' ? 'MONTHLY' : rec.frequency,
        reminderPreference: '3_DAYS_BEFORE',
        status: 'UPCOMING',
        createdAt: rec.createdAt,
      });
    }

    return derived.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  app.get('/api/v1/calendar/events', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: collectUserRadarEvents(userId) });
  });

  app.post('/api/v1/calendar/events', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { title, eventType, dueDate, amount, direction, recurrence, reminderPreference } = req.body || {};
    const amt = Number(amount);
    if (!title || !dueDate || !Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, error: { message: 'Title, dueDate, and positive amount required.' } });
    }
    const ev: MoneyCalendarEvent = {
      id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      title: String(title).trim().slice(0, 120),
      eventType: (eventType || 'BILL') as MoneyCalendarEvent['eventType'],
      dueDate: String(dueDate),
      amount: Math.round(amt * 100) / 100,
      direction: direction === 'INFLOW' ? 'INFLOW' : 'OUTFLOW',
      recurrence: ['ONCE', 'MONTHLY', 'QUARTERLY', 'YEARLY'].includes(String(recurrence)) ? recurrence : 'ONCE',
      reminderPreference: ['NONE', '3_DAYS_BEFORE', '7_DAYS_BEFORE'].includes(String(reminderPreference))
        ? reminderPreference
        : '3_DAYS_BEFORE',
      status: 'UPCOMING',
      createdAt: new Date().toISOString(),
    };
    db.moneyCalendarEvents.push(ev);
    saveStore();
    res.status(201).json({ success: true, data: ev });
  });

  app.put('/api/v1/calendar/events/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const ev = db.moneyCalendarEvents.find(e => e.id === req.params.id);
    if (!ev) return res.status(404).json({ success: false, error: { message: 'Calendar event not found' } });
    if (ev.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    const { title, dueDate, amount, status, direction } = req.body || {};
    if (typeof title === 'string' && title.trim()) ev.title = title.trim().slice(0, 120);
    if (typeof dueDate === 'string' && dueDate.trim()) ev.dueDate = dueDate.trim();
    if (amount !== undefined && Number.isFinite(Number(amount)) && Number(amount) > 0) ev.amount = Number(amount);
    if (['UPCOMING', 'PAID', 'OVERDUE'].includes(String(status))) ev.status = status;
    if (direction === 'INFLOW' || direction === 'OUTFLOW') ev.direction = direction;
    saveStore();
    res.json({ success: true, data: ev });
  });

  app.delete('/api/v1/calendar/events/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.moneyCalendarEvents.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Event not found' } });
    if (db.moneyCalendarEvents[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.moneyCalendarEvents.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  app.get('/api/v1/calendar/radar', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const horizonRaw = Number(req.query.horizon);
    const horizonDays: 7 | 30 | 90 = horizonRaw === 7 ? 7 : horizonRaw === 90 ? 90 : 30;
    const whatIfExtraExpense = Math.max(0, Number(req.query.whatIfExpense) || 0);
    const activeTxs = db.transactions.filter(t => t.ownerId === userId && !isDoubleCountExcluded(t));
    const txNet = activeTxs.reduce((s, t) => s + (t.type === 'INCOME' ? t.amount : -t.amount), 0);
    const manualCash = db.manualAssetsLiabilities
      .filter(m => m.ownerId === userId && m.included && m.kind === 'ASSET' && /cash|bank|savings/i.test(m.category + m.name))
      .reduce((s, m) => s + m.amount, 0);
    const openingOverride = req.query.openingBalance !== undefined && Number.isFinite(Number(req.query.openingBalance))
      ? Number(req.query.openingBalance)
      : Math.max(0, txNet + manualCash);

    const radar = buildCashFlowRadar({
      openingBalance: openingOverride,
      events: collectUserRadarEvents(userId),
      horizonDays,
      whatIfExtraExpense,
    });
    res.json({ success: true, data: radar });
  });

  // 4) Credit Card & Debt Command Center (strictly rejects sensitive card PAN, CVV, PIN, OTP)
  function containsForbiddenSensitiveCardData(body: Record<string, unknown>): string | null {
    const sensitiveKeys = ['cardNumber', 'fullCardNumber', 'pan', 'cvv', 'cvc', 'pin', 'otp', 'password'];
    for (const k of sensitiveKeys) {
      if (body[k] !== undefined && String(body[k]).trim() !== '') {
        return `Sensitive credential "${k}" must never be submitted or stored. Only non-sensitive lastFourDigits are accepted.`;
      }
    }
    const last4 = String(body.lastFourDigits || '').trim();
    if (last4 && !/^\d{4}$/.test(last4)) {
      return 'lastFourDigits must be exactly 4 digits.';
    }
    return null;
  }

  app.get('/api/v1/credit-cards', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const cards = db.creditCards.filter(c => c.ownerId === userId);
    const summary = computeCreditCardSummary(cards);
    res.json({ success: true, data: { cards, summary } });
  });

  app.post('/api/v1/credit-cards', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const body = (req.body || {}) as Record<string, unknown>;
    const errMsg = containsForbiddenSensitiveCardData(body);
    if (errMsg) return res.status(400).json({ success: false, error: { message: errMsg } });

    const limit = Number(body.creditLimit);
    const balance = Math.max(0, Number(body.currentBalance) || 0);
    const minDue = Math.max(0, Number(body.minimumDue) || Math.round(balance * 0.05));
    if (!body.nickname || !body.issuer || !body.lastFourDigits || !Number.isFinite(limit) || limit <= 0) {
      return res.status(400).json({ success: false, error: { message: 'nickname, issuer, lastFourDigits (4 digits), and positive creditLimit required.' } });
    }

    const card: CreditCard = {
      id: `cc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      nickname: String(body.nickname).trim().slice(0, 60),
      issuer: String(body.issuer).trim().slice(0, 60),
      lastFourDigits: String(body.lastFourDigits).trim(),
      creditLimit: Math.round(limit * 100) / 100,
      currentBalance: Math.round(balance * 100) / 100,
      minimumDue: Math.round(minDue * 100) / 100,
      statementDate: Math.min(28, Math.max(1, Number(body.statementDate) || 1)),
      dueDate: Math.min(28, Math.max(1, Number(body.dueDate) || 18)),
      annualInterestRate: Math.max(0, Math.min(60, Number(body.annualInterestRate) || 36)),
      reminderPreference: ['3_DAYS_BEFORE', '7_DAYS_BEFORE', 'NONE'].includes(String(body.reminderPreference))
        ? (body.reminderPreference as CreditCard['reminderPreference'])
        : '3_DAYS_BEFORE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.creditCards.unshift(card);
    saveStore();
    res.status(201).json({ success: true, data: card });
  });

  app.put('/api/v1/credit-cards/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const card = db.creditCards.find(c => c.id === req.params.id);
    if (!card) return res.status(404).json({ success: false, error: { message: 'Credit card not found' } });
    if (card.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    const body = (req.body || {}) as Record<string, unknown>;
    const errMsg = containsForbiddenSensitiveCardData(body);
    if (errMsg) return res.status(400).json({ success: false, error: { message: errMsg } });

    if (typeof body.nickname === 'string' && body.nickname.trim()) card.nickname = body.nickname.trim().slice(0, 60);
    if (body.creditLimit !== undefined && Number(body.creditLimit) > 0) card.creditLimit = Number(body.creditLimit);
    if (body.currentBalance !== undefined && Number(body.currentBalance) >= 0) card.currentBalance = Number(body.currentBalance);
    if (body.minimumDue !== undefined && Number(body.minimumDue) >= 0) card.minimumDue = Number(body.minimumDue);
    if (body.annualInterestRate !== undefined && Number(body.annualInterestRate) >= 0) card.annualInterestRate = Number(body.annualInterestRate);
    card.updatedAt = new Date().toISOString();
    saveStore();
    res.json({ success: true, data: card });
  });

  app.delete('/api/v1/credit-cards/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.creditCards.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Credit card not found' } });
    if (db.creditCards[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.creditCards.splice(idx, 1);
    db.creditCardStatements = db.creditCardStatements.filter(s => s.creditCardId !== req.params.id);
    saveStore();
    res.json({ success: true });
  });

  app.get('/api/v1/credit-cards/:id/statements', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const card = db.creditCards.find(c => c.id === req.params.id);
    if (!card) return res.status(404).json({ success: false, error: { message: 'Credit card not found' } });
    if (card.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    const statements = db.creditCardStatements.filter(s => s.creditCardId === card.id && s.ownerId === userId);
    const sim = simulateCreditCardPayment({
      balance: card.currentBalance,
      annualInterestRate: card.annualInterestRate || 36,
      extraMonthlyPayment: Math.max(0, Number(req.query.extraMonthly) || 2000),
    });
    res.json({ success: true, data: { card, statements, paymentSimulation: sim } });
  });

  app.post('/api/v1/credit-cards/:id/statements', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const card = db.creditCards.find(c => c.id === req.params.id);
    if (!card) return res.status(404).json({ success: false, error: { message: 'Credit card not found' } });
    if (card.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });

    const { statementPeriod, totalDue, minimumDue, dueDate, fees, interestCharges, emiComponents, transactions } = req.body || {};
    const total = Math.max(0, Number(totalDue) || 0);
    const stmt: CreditCardStatement = {
      id: `ccs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      creditCardId: card.id,
      statementPeriod: String(statementPeriod || new Date().toISOString().slice(0, 7)),
      totalDue: total,
      minimumDue: Math.max(0, Number(minimumDue) || Math.round(total * 0.05)),
      dueDate: String(dueDate || new Date().toISOString().split('T')[0]),
      transactions: Array.isArray(transactions) ? transactions.slice(0, 100) : [],
      fees: Math.max(0, Number(fees) || 0),
      interestCharges: Math.max(0, Number(interestCharges) || 0),
      emiComponents: Math.max(0, Number(emiComponents) || 0),
      verificationStatus: 'NEEDS_REVIEW',
      createdAt: new Date().toISOString(),
    };
    db.creditCardStatements.unshift(stmt);
    card.currentBalance = total;
    card.minimumDue = stmt.minimumDue;
    card.updatedAt = new Date().toISOString();
    saveStore();
    res.status(201).json({ success: true, data: stmt });
  });

  app.put('/api/v1/credit-cards/statements/:statementId/verify', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const stmt = db.creditCardStatements.find(s => s.id === req.params.statementId);
    if (!stmt) return res.status(404).json({ success: false, error: { message: 'Statement not found' } });
    if (stmt.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    stmt.verificationStatus = 'VERIFIED';
    saveStore();
    res.json({ success: true, data: stmt });
  });

  app.post('/api/v1/credit-cards/payoff-compare', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const monthlyBudget = Math.max(0, Number(req.body?.monthlyBudget) || 15000);
    const debts = [
      ...db.creditCards
        .filter(c => c.ownerId === userId && c.currentBalance > 0)
        .map(c => ({
          id: c.id,
          name: `${c.nickname} (*${c.lastFourDigits})`,
          balance: c.currentBalance,
          annualInterestRate: c.annualInterestRate || 36,
          minimumPayment: Math.max(500, c.minimumDue),
        })),
      ...db.emiPlans
        .filter(e => e.ownerId === userId && e.loanAmount > 0)
        .map(e => ({
          id: e.id,
          name: e.planName,
          balance: e.loanAmount,
          annualInterestRate: e.annualInterestRate,
          minimumPayment: e.monthlyEMI,
        })),
    ];
    const avalanche = computeDebtPayoffSchedule(debts, monthlyBudget, 'AVALANCHE');
    const snowball = computeDebtPayoffSchedule(debts, monthlyBudget, 'SNOWBALL');
    res.json({ success: true, data: { debtsCount: debts.length, monthlyBudget, avalanche, snowball } });
  });

  // 5) Recurring Payments & Subscription Intelligence
  app.get('/api/v1/recurring-payments', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.recurringPayments.filter(r => r.ownerId === userId) });
  });

  app.post('/api/v1/recurring-payments/detect', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const userTxs = db.transactions.filter(t => t.ownerId === userId);
    const existing = db.recurringPayments.filter(r => r.ownerId === userId);
    const newlyDetected = detectRecurringPayments(userTxs, existing, userId);
    for (const item of newlyDetected) {
      db.recurringPayments.unshift(item);
    }
    if (newlyDetected.length > 0) saveStore();
    res.json({
      success: true,
      data: db.recurringPayments.filter(r => r.ownerId === userId),
      newlyDetectedCount: newlyDetected.length,
    });
  });

  app.put('/api/v1/recurring-payments/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const rec = db.recurringPayments.find(r => r.id === req.params.id);
    if (!rec) return res.status(404).json({ success: false, error: { message: 'Recurring payment not found' } });
    if (rec.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    const { status, estimatedAmount, nextEstimatedDate } = req.body || {};
    if (['DETECTED', 'CONFIRMED', 'CANCELLED', 'IGNORED'].includes(String(status))) {
      rec.status = status;
      if (status === 'CONFIRMED') rec.userConfirmed = true;
    }
    if (estimatedAmount !== undefined && Number(estimatedAmount) > 0) rec.estimatedAmount = Number(estimatedAmount);
    if (typeof nextEstimatedDate === 'string' && nextEstimatedDate.trim()) rec.nextEstimatedDate = nextEstimatedDate.trim();
    rec.updatedAt = new Date().toISOString();
    saveStore();
    res.json({ success: true, data: rec });
  });

  app.delete('/api/v1/recurring-payments/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.recurringPayments.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Recurring payment not found' } });
    if (db.recurringPayments[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.recurringPayments.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  // 6) Portfolio Risk Analytics & Investment Decision Journal
  app.get('/api/v1/investments/risk', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const holdings = db.holdings.filter(h => h.ownerId === userId);
    res.json({ success: true, data: computePortfolioRiskAnalytics(holdings) });
  });

  app.get('/api/v1/investments/journal', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.investmentJournal.filter(j => j.ownerId === userId) });
  });

  app.post('/api/v1/investments/journal', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { investmentName, reasonForResearch, expectedHoldingPeriod, risksConsidered, userNotes, reviewDate } = req.body || {};
    if (!investmentName || !reasonForResearch) {
      return res.status(400).json({ success: false, error: { message: 'investmentName and reasonForResearch are required.' } });
    }
    const entry: InvestmentJournalEntry = {
      id: `ij-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      investmentName: String(investmentName).trim().slice(0, 100),
      reasonForResearch: String(reasonForResearch).trim().slice(0, 400),
      expectedHoldingPeriod: String(expectedHoldingPeriod || '3–5 Years').slice(0, 60),
      risksConsidered: String(risksConsidered || '').slice(0, 300),
      userNotes: String(userNotes || '').slice(0, 400),
      reviewDate: String(reviewDate || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]),
      createdAt: new Date().toISOString(),
    };
    db.investmentJournal.unshift(entry);
    saveStore();
    res.status(201).json({ success: true, data: entry });
  });

  app.delete('/api/v1/investments/journal/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const idx = db.investmentJournal.findIndex(j => j.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { message: 'Journal entry not found' } });
    if (db.investmentJournal[idx].ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    db.investmentJournal.splice(idx, 1);
    saveStore();
    res.json({ success: true });
  });

  // 7) Tax Readiness Checklist
  app.get('/api/v1/tax/readiness', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const fy = req.query.fy === '2024-25' ? '2024-25' : '2025-26';
    let items = db.taxReadinessItems.filter(i => i.ownerId === userId && i.financialYear === fy);
    if (items.length === 0) {
      const defaults: Array<{ title: string; category: TaxReadinessItem['category'] }> = [
        { title: 'Form 16 (Employer TDS Certificate)', category: 'INCOME' },
        { title: 'Salary Slips & Bonus Breakdown', category: 'INCOME' },
        { title: 'Interest Certificates (Savings / FD)', category: 'INCOME' },
        { title: 'Section 80C / PPF / ELSS Investment Proofs', category: 'DEDUCTION' },
        { title: 'Section 80D Health Insurance Receipts', category: 'DEDUCTION' },
        { title: 'Compare Old vs New Regime & Confirm Choice', category: 'REGIME' },
      ];
      items = defaults.map((d, idx) => ({
        id: `tr-${userId}-${fy}-${idx}`,
        ownerId: userId,
        financialYear: fy,
        title: d.title,
        category: d.category,
        status: 'NOT_UPLOADED',
        updatedAt: new Date().toISOString(),
      }));
      db.taxReadinessItems.push(...items);
      saveStore();
    }
    res.json({ success: true, data: items });
  });

  app.put('/api/v1/tax/readiness/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const item = db.taxReadinessItems.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ success: false, error: { message: 'Checklist item not found' } });
    if (item.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    const status = req.body?.status;
    if (!['NOT_UPLOADED', 'UPLOADED', 'NEEDS_REVIEW', 'VERIFIED_BY_USER'].includes(String(status))) {
      return res.status(400).json({ success: false, error: { message: 'Invalid status' } });
    }
    item.status = status;
    item.updatedAt = new Date().toISOString();
    saveStore();
    res.json({ success: true, data: item });
  });

  // 8) Business Receivables Aging, Follow-Ups (Copy-Only Drafts) & Reconciliation Assistant
  app.get('/api/v1/business/receivables', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const invoices = db.invoices.filter(i => i.ownerId === userId);
    const aging = computeReceivablesAging(invoices);
    const followUps = db.paymentFollowUps.filter(f => f.ownerId === userId);
    res.json({ success: true, data: { ...aging, invoices, followUps } });
  });

  app.post('/api/v1/business/receivables/follow-up', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const { invoiceId, reminderType } = req.body || {};
    const inv = db.invoices.find(i => i.id === invoiceId);
    if (!inv) return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });
    if (inv.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });

    const rType: PaymentFollowUp['reminderType'] = ['FRIENDLY', 'DUE_SOON', 'OVERDUE', 'FINAL'].includes(String(reminderType))
      ? reminderType
      : 'FRIENDLY';
    const bp = ensureBusinessProfile(userId);
    const dueStr = inv.balanceDue.toLocaleString('en-IN');
    const templates: Record<PaymentFollowUp['reminderType'], string> = {
      FRIENDLY: `Hi ${inv.clientName} team,\n\nSharing a gentle note regarding Invoice ${inv.invoiceNumber} for ₹${dueStr} (Due Date: ${inv.dueDate}). Please let us know if you need any supporting documents or GST confirmation.\n\nWarm regards,\n${bp.businessName}`,
      DUE_SOON: `Hi ${inv.clientName} team,\n\nReminder that Invoice ${inv.invoiceNumber} (₹${dueStr}) is due on ${inv.dueDate}. Kindly schedule settlement as per terms.\n\nRegards,\n${bp.businessName}`,
      OVERDUE: `Hi ${inv.clientName} accounts team,\n\nInvoice ${inv.invoiceNumber} for ₹${dueStr} is past its due date (${inv.dueDate}). Could you please share an updated payment remittance date?\n\nRegards,\n${bp.businessName}`,
      FINAL: `Dear ${inv.clientName} team,\n\nFinal follow-up on overdue Invoice ${inv.invoiceNumber} for ₹${dueStr} (originally due ${inv.dueDate}). Requesting priority clearance or immediate confirmation.\n\nRegards,\n${bp.businessName}`,
    };

    const followUp: PaymentFollowUp = {
      id: `pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      invoiceId: inv.id,
      clientId: inv.clientId,
      clientName: inv.clientName,
      invoiceNumber: inv.invoiceNumber,
      amountDue: inv.balanceDue,
      reminderType: rType,
      generatedMessage: templates[rType],
      status: 'DRAFT_COPY_ONLY',
      createdAt: new Date().toISOString(),
    };
    db.paymentFollowUps.unshift(followUp);
    saveStore();
    res.status(201).json({ success: true, data: followUp });
  });

  app.patch('/api/v1/business/receivables/follow-up/:id', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const item = db.paymentFollowUps.find(f => f.id === req.params.id);
    if (!item) return res.status(404).json({ success: false, error: { message: 'Follow-up draft not found' } });
    if (item.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    if (req.body?.status === 'MARKED_SENT_EXTERNALLY') {
      item.status = 'MARKED_SENT_EXTERNALLY';
      item.sentAt = new Date().toISOString();
    }
    saveStore();
    res.json({ success: true, data: item });
  });

  app.get('/api/v1/business/reconciliation', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.businessReconciliationRuns.filter(r => r.ownerId === userId) });
  });

  app.post('/api/v1/business/reconciliation/run', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const bp = ensureBusinessProfile(userId);
    const invoices = db.invoices.filter(i => i.ownerId === userId);
    const transactions = db.transactions.filter(t => t.ownerId === userId);
    const expenses = db.businessExpenses.filter(e => e.ownerId === userId);
    const result = runDeterministicReconciliation({ invoices, transactions, expenses });

    const run: BusinessReconciliationRun = {
      id: `recrun-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: userId,
      businessId: bp.id,
      sourceType: ['BANK_VS_INVOICES', 'EXPENSES_VS_BANK', 'FULL_LEDGER'].includes(String(req.body?.sourceType))
        ? req.body.sourceType
        : 'FULL_LEDGER',
      period: String(req.body?.period || new Date().toISOString().slice(0, 7)),
      ...result,
      status: 'PENDING_REVIEW',
      createdAt: new Date().toISOString(),
    };
    db.businessReconciliationRuns.unshift(run);
    saveStore();
    res.status(201).json({ success: true, data: run });
  });

  app.post('/api/v1/business/reconciliation/:id/confirm', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const run = db.businessReconciliationRuns.find(r => r.id === req.params.id);
    if (!run) return res.status(404).json({ success: false, error: { message: 'Reconciliation run not found' } });
    if (run.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    run.status = 'CONFIRMED';
    run.matchedRecords.forEach(m => {
      m.verifiedByUser = true;
    });
    saveStore();
    res.json({ success: true, data: run });
  });

  // 9) AI Monthly Money Review Brief
  app.post('/api/v1/ai/monthly-review', requireAuth, async (req, res) => {
    const userId = req.auth!.uid;
    if (!db.systemSettings.aiEnabled) {
      return res.status(503).json({ success: false, error: { code: 'AI_DISABLED', message: 'AI Assistant is currently disabled.' } });
    }
    const summaryContext = buildUserFinancialSummary(userId);
    const start = Date.now();
    try {
      const { reply, model } = await runAiResponder(
        userId,
        'Generate my Monthly Money Review with: 1) Key financial summary from my actual records, 2) Upcoming bill/goal priorities, 3) Any concentration or tax readiness watch-outs, and 4) Three realistic next steps I can take this month.',
        'Monthly Money Review & Health Summary',
        summaryContext
      );
      db.aiUsageLogs.unshift({
        id: `aiu-${Date.now()}`,
        ownerId: userId,
        endpoint: '/api/v1/ai/monthly-review',
        model,
        status: 'SUCCESS',
        latencyMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      });
      saveStore();
      res.json({ success: true, data: { review: reply, model, generatedAt: new Date().toISOString() } });
    } catch (err) {
      const status = err instanceof AIServiceError ? err.statusCode : 500;
      const code = err instanceof AIServiceError ? err.code : 'AI_PROVIDER_ERROR';
      const errMsg = err instanceof Error ? err.message : 'Unable to generate Monthly Money Review.';
      res.status(status).json({ success: false, message: errMsg, error: { code, message: errMsg } });
    }
  });

  // ----------------- AI ASSISTANT & GROUNDED MODULE INSIGHTS ----------------- //

  app.get('/api/v1/ai/conversations', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({
      success: true,
      data: db.aiConversations.filter(m => m.ownerId === userId).slice(-60),
    });
  });

  app.delete('/api/v1/ai/conversations', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    db.aiConversations = db.aiConversations.filter(m => m.ownerId !== userId);
    saveStore();
    res.json({ success: true, message: 'Conversation history cleared.' });
  });

  app.post('/api/v1/ai/chat', requireAuth, async (req, res) => {
    const userId = req.auth!.uid;
    const { message, moduleContext } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: { message: 'Message is required.' } });
    }
    if (!db.systemSettings.aiEnabled) {
      return res.status(503).json({ success: false, error: { code: 'AI_DISABLED', message: 'AI Assistant is currently disabled by administrator settings.' } });
    }

    const start = Date.now();
    const ctx = String(moduleContext || 'General Indian Financial Intelligence').slice(0, 120);
    const summaryContext = buildUserFinancialSummary(userId);

    try {
      const { reply, model } = await runAiResponder(userId, message.trim(), ctx, summaryContext);

      const userEntry = {
        id: `aic-${Date.now()}-u`,
        ownerId: userId,
        role: 'user' as const,
        text: message.trim().slice(0, 2000),
        moduleContext: ctx,
        createdAt: new Date().toISOString(),
      };
      const assistantEntry = {
        id: `aic-${Date.now() + 1}-a`,
        ownerId: userId,
        role: 'assistant' as const,
        text: reply,
        moduleContext: ctx,
        modelUsed: model,
        createdAt: new Date().toISOString(),
      };

      db.aiConversations.push(userEntry, assistantEntry);
      db.aiUsageLogs.unshift({
        id: `aiu-${Date.now()}`,
        ownerId: userId,
        endpoint: '/api/v1/ai/chat',
        model,
        status: 'SUCCESS',
        latencyMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      });
      saveStore();

      res.json({ success: true, data: { reply, model, messageRecord: assistantEntry } });
    } catch (err) {
      const status = err instanceof AIServiceError ? err.statusCode : 500;
      const code = err instanceof AIServiceError ? err.code : 'AI_PROVIDER_ERROR';
      const errMsg = err instanceof Error ? err.message : 'Unable to generate Gemini AI reply.';
      console.error('[FinSight AI Chat Error]', code, errMsg);
      db.aiUsageLogs.unshift({
        id: `aiu-${Date.now()}`,
        ownerId: userId,
        endpoint: '/api/v1/ai/chat',
        model: GEMINI_MODEL,
        status: status === 429 ? 'RATE_LIMITED' : 'ERROR',
        latencyMs: Date.now() - start,
        errorCode: code,
        createdAt: new Date().toISOString(),
      });
      saveStore();
      res.status(status).json({ success: false, message: errMsg, error: { code, message: errMsg } });
    }
  });

  app.post('/api/v1/ai/module-insight', requireAuth, async (req, res) => {
    const userId = req.auth!.uid;
    const { module, question } = req.body || {};
    const modName = String(module || 'General');
    const summaryContext = buildUserFinancialSummary(userId);
    const defaultQuestion = `Provide a clear, practical 3-bullet analysis of my current ${modName} numbers in FinSight.`;
    const start = Date.now();

    try {
      const { reply, model } = await runAiResponder(
        userId,
        typeof question === 'string' && question.trim() ? question.trim() : defaultQuestion,
        modName,
        summaryContext
      );
      db.aiUsageLogs.unshift({
        id: `aiu-${Date.now()}`,
        ownerId: userId,
        endpoint: '/api/v1/ai/module-insight',
        model,
        status: 'SUCCESS',
        latencyMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      });
      saveStore();
      res.json({ success: true, data: { insight: reply, model, generatedAt: new Date().toISOString() } });
    } catch (err) {
      const status = err instanceof AIServiceError ? err.statusCode : 500;
      const code = err instanceof AIServiceError ? err.code : 'AI_PROVIDER_ERROR';
      const errMsg = err instanceof Error ? err.message : 'Gemini AI insight unavailable.';
      console.error('[FinSight AI Module Insight Error]', code, errMsg);
      res.status(status).json({ success: false, message: errMsg, error: { code, message: errMsg } });
    }
  });

  // ----------------- NOTIFICATIONS & USER DATA EXPORT / DELETE ----------------- //

  app.get('/api/v1/notifications', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    res.json({ success: true, data: db.notifications.filter(n => n.ownerId === userId) });
  });

  app.patch('/api/v1/notifications/:id/read', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const n = db.notifications.find(item => item.id === req.params.id);
    if (!n) return res.status(404).json({ success: false, error: { message: 'Notification not found' } });
    if (n.ownerId !== userId) return res.status(403).json({ success: false, error: { message: 'Forbidden: you do not own this notification' } });
    n.read = true;
    saveStore();
    res.json({ success: true, data: n });
  });

  app.post('/api/v1/notifications/read-all', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    db.notifications.forEach(n => {
      if (n.ownerId === userId) n.read = true;
    });
    saveStore();
    res.json({ success: true });
  });

  app.get('/api/v1/user/export', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    const profile = ensureUserProfile(req.auth!);
    res.json({
      success: true,
      data: {
        profile,
        preferences: ensureUserPreferences(userId),
        transactions: db.transactions.filter(t => t.ownerId === userId),
        budgets: db.budgets.filter(b => b.ownerId === userId),
        portfolios: db.portfolios.filter(p => p.ownerId === userId),
        holdings: db.holdings.filter(h => h.ownerId === userId),
        watchlists: db.watchlists.filter(w => w.ownerId === userId),
        backtests: db.backtests.filter(b => b.ownerId === userId),
        paperTrades: db.paperTrades.filter(pt => pt.ownerId === userId),
        taxProfile: db.taxProfiles.find(tp => tp.ownerId === userId) || null,
        taxDeductions: db.taxDeductions.filter(td => td.ownerId === userId),
        taxCalculations: db.taxCalculations.filter(tc => tc.ownerId === userId),
        taxDocuments: db.taxDocuments.filter(td => td.ownerId === userId),
        fraudAnalyses: db.fraudAnalyses.filter(fa => fa.ownerId === userId),
        clients: db.clients.filter(c => c.ownerId === userId),
        invoices: db.invoices.filter(i => i.ownerId === userId),
        businessExpenses: db.businessExpenses.filter(be => be.ownerId === userId),
        emiPlans: db.emiPlans.filter(p => p.ownerId === userId),
        manualAssetsLiabilities: db.manualAssetsLiabilities.filter(m => m.ownerId === userId),
        moneyGoals: db.moneyGoals.filter(g => g.ownerId === userId),
        moneyCalendarEvents: db.moneyCalendarEvents.filter(e => e.ownerId === userId),
        creditCards: db.creditCards.filter(c => c.ownerId === userId),
        creditCardStatements: db.creditCardStatements.filter(s => s.ownerId === userId),
        recurringPayments: db.recurringPayments.filter(r => r.ownerId === userId),
        financialHealthSnapshots: db.financialHealthSnapshots.filter(s => s.ownerId === userId),
        businessReconciliationRuns: db.businessReconciliationRuns.filter(r => r.ownerId === userId),
        paymentFollowUps: db.paymentFollowUps.filter(f => f.ownerId === userId),
        investmentJournal: db.investmentJournal.filter(j => j.ownerId === userId),
        taxReadinessItems: db.taxReadinessItems.filter(i => i.ownerId === userId),
      },
    });
  });

  app.delete('/api/v1/user/records', requireAuth, (req, res) => {
    const userId = req.auth!.uid;
    for (const doc of db.taxDocuments.filter(d => d.ownerId === userId)) {
      vault.deleteFileForOwner(userId, doc.storageKey);
    }
    for (const exp of db.businessExpenses.filter(e => e.ownerId === userId && e.receiptStorageKey)) {
      vault.deleteFileForOwner(userId, exp.receiptStorageKey!);
    }

    db.transactions = db.transactions.filter(t => t.ownerId !== userId);
    db.importJobs = db.importJobs.filter(j => j.ownerId !== userId);
    db.budgets = db.budgets.filter(b => b.ownerId !== userId);
    db.portfolios = db.portfolios.filter(p => p.ownerId !== userId);
    db.holdings = db.holdings.filter(h => h.ownerId !== userId);
    db.watchlists = db.watchlists.filter(w => w.ownerId !== userId);
    db.backtests = db.backtests.filter(b => b.ownerId !== userId);
    db.paperAccounts = db.paperAccounts.filter(pa => pa.ownerId !== userId);
    db.paperTrades = db.paperTrades.filter(pt => pt.ownerId !== userId);
    db.taxProfiles = db.taxProfiles.filter(tp => tp.ownerId !== userId);
    db.taxDeductions = db.taxDeductions.filter(td => td.ownerId !== userId);
    db.taxCalculations = db.taxCalculations.filter(tc => tc.ownerId !== userId);
    db.taxDocuments = db.taxDocuments.filter(td => td.ownerId !== userId);
    db.fraudAnalyses = db.fraudAnalyses.filter(fa => fa.ownerId !== userId);
    db.businessProfiles = db.businessProfiles.filter(bp => bp.ownerId !== userId);
    db.clients = db.clients.filter(c => c.ownerId !== userId);
    db.invoices = db.invoices.filter(i => i.ownerId !== userId);
    db.businessExpenses = db.businessExpenses.filter(be => be.ownerId !== userId);
    db.emiPlans = db.emiPlans.filter(e => e.ownerId !== userId);
    db.aiConversations = db.aiConversations.filter(a => a.ownerId !== userId);
    db.notifications = db.notifications.filter(n => n.ownerId !== userId);
    db.manualAssetsLiabilities = db.manualAssetsLiabilities.filter(m => m.ownerId !== userId);
    db.moneyGoals = db.moneyGoals.filter(g => g.ownerId !== userId);
    db.moneyCalendarEvents = db.moneyCalendarEvents.filter(e => e.ownerId !== userId);
    db.creditCards = db.creditCards.filter(c => c.ownerId !== userId);
    db.creditCardStatements = db.creditCardStatements.filter(s => s.ownerId !== userId);
    db.recurringPayments = db.recurringPayments.filter(r => r.ownerId !== userId);
    db.financialHealthSnapshots = db.financialHealthSnapshots.filter(s => s.ownerId !== userId);
    db.businessReconciliationRuns = db.businessReconciliationRuns.filter(r => r.ownerId !== userId);
    db.paymentFollowUps = db.paymentFollowUps.filter(f => f.ownerId !== userId);
    db.investmentJournal = db.investmentJournal.filter(j => j.ownerId !== userId);
    db.taxReadinessItems = db.taxReadinessItems.filter(i => i.ownerId !== userId);
    recordAuditLog(userId, req.auth!.email, 'USER_RECORDS_PURGED', 'USER_DATA', userId, 'SUCCESS');
    saveStore();

    res.json({ success: true, message: 'All financial records associated with your account have been permanently deleted.' });
  });

  // ----------------- ADMIN MANAGEMENT ENDPOINTS ----------------- //

  app.use('/api/v1/admin', requireAuth, requireAdmin);

  app.get('/api/v1/admin/dashboard', (req, res) => {
    recordAuditLog(req.auth!.uid, req.auth!.email, 'ADMIN_DASHBOARD_VIEW', 'ADMIN', 'dashboard', 'SUCCESS');
    const aiRequests = db.aiUsageLogs.length;
    const systemErrors = db.aiUsageLogs.filter(l => l.status === 'ERROR').length;
    res.json({
      success: true,
      data: {
        totalUsers: db.users.length,
        activeUsers: db.users.filter(u => u.accountStatus === 'ACTIVE').length,
        aiRequests,
        aiModel: GEMINI_MODEL,
        geminiConfigured: getGeminiStatus().configured,
        fileProcessingJobs: db.importJobs.length + db.taxDocuments.length,
        systemErrors,
        activeTaxRuleset: db.taxRules.find(r => r.active)?.version || 'CBDT v2025.2',
        recentAuditLogs: db.auditLogs.slice(0, 50),
      },
    });
  });

  app.get('/api/v1/admin/users', (_req, res) => {
    res.json({ success: true, data: db.users });
  });

  app.patch('/api/v1/admin/users/:uid/status', (req, res) => {
    const target = db.users.find(u => u.uid === req.params.uid);
    if (!target) return res.status(404).json({ success: false, error: { message: 'User not found' } });
    const status = req.body?.accountStatus;
    if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
      return res.status(400).json({ success: false, error: { message: 'accountStatus must be ACTIVE or SUSPENDED' } });
    }
    target.accountStatus = status;
    target.updatedAt = new Date().toISOString();
    recordAuditLog(req.auth!.uid, req.auth!.email, `USER_STATUS_${status}`, 'USER', target.uid, 'SUCCESS');
    saveStore();
    res.json({ success: true, data: target });
  });

  app.get('/api/v1/admin/audit-logs', (_req, res) => {
    res.json({ success: true, data: db.auditLogs });
  });

  app.get('/api/v1/admin/tax-rules', (_req, res) => {
    res.json({ success: true, data: db.taxRules });
  });

  app.put('/api/v1/admin/tax-rules/:id', (req, res) => {
    const rule = db.taxRules.find(r => r.id === req.params.id);
    if (!rule) return res.status(404).json({ success: false, error: { message: 'Tax rule not found' } });
    if (typeof req.body?.active === 'boolean') rule.active = req.body.active;
    if (typeof req.body?.sourceNote === 'string') rule.sourceNote = req.body.sourceNote.slice(0, 200);
    rule.updatedAt = new Date().toISOString();
    recordAuditLog(req.auth!.uid, req.auth!.email, 'TAX_RULE_UPDATED', 'TAX_RULE', rule.id, 'SUCCESS');
    saveStore();
    res.json({ success: true, data: rule });
  });

  app.get('/api/v1/admin/market-data', (_req, res) => {
    res.json({
      success: true,
      data: {
        providerStatus: getMarketDataProviderStatus(),
        instrumentCount: db.marketInstruments.length,
        instruments: db.marketInstruments,
      },
    });
  });

  app.get('/api/v1/admin/ai-usage', (_req, res) => {
    res.json({
      success: true,
      data: {
        model: GEMINI_MODEL,
        configured: getGeminiStatus().configured,
        totalRequests: db.aiUsageLogs.length,
        logs: db.aiUsageLogs.slice(0, 100),
      },
    });
  });

  app.get('/api/v1/admin/settings', (_req, res) => {
    res.json({ success: true, data: db.systemSettings });
  });

  app.put('/api/v1/admin/settings', (req, res) => {
    const body = req.body || {};
    if (typeof body.aiEnabled === 'boolean') db.systemSettings.aiEnabled = body.aiEnabled;
    if (typeof body.maintenanceMode === 'boolean') db.systemSettings.maintenanceMode = body.maintenanceMode;
    if (Number.isFinite(Number(body.maxUploadMb)) && Number(body.maxUploadMb) >= 1 && Number(body.maxUploadMb) <= 25) {
      db.systemSettings.maxUploadMb = Number(body.maxUploadMb);
    }
    if (body.defaultFinancialYear === '2025-26' || body.defaultFinancialYear === '2024-25') {
      db.systemSettings.defaultFinancialYear = body.defaultFinancialYear;
    }
    recordAuditLog(req.auth!.uid, req.auth!.email, 'SYSTEM_SETTINGS_UPDATED', 'SETTINGS', 'global', 'SUCCESS');
    saveStore();
    res.json({ success: true, data: db.systemSettings });
  });

  // Ensure unmatched /api/* requests and runtime errors always return JSON (never SPA HTML)
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'API_ROUTE_NOT_FOUND',
        message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      },
    });
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number; statusCode?: number })?.statusCode
      || (err as { status?: number })?.status
      || 500;
    const message = err instanceof Error ? err.message : 'Unexpected internal server error.';
    console.error(`[FinSight API Error] ${req.method} ${req.originalUrl} -> HTTP ${status}:`, err);
    if (res.headersSent) {
      return;
    }
    res.status(status).json({
      success: false,
      error: {
        code: status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
        message,
      },
    });
  });

  return { app, db };
}

async function startServer() {
  try {
    const { store, save } = loadOrInitializeDiskStore();
    const { app } = createApp({ store, onSave: save });
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    const distDir = path.join(__dirname, 'dist');
    const distIndex = path.join(distDir, 'index.html');
    const isProduction = process.env.NODE_ENV === 'production' && existsSync(distIndex);

    if (isProduction) {
      app.use(express.static(distDir));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
          return next();
        }
        res.sendFile(distIndex);
      });
    } else {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
      const gemini = getGeminiStatus();
      console.log(
        `FinSight server running on http://0.0.0.0:${PORT} (mode=${isProduction ? 'production' : 'development'}, geminiConfigured=${gemini.configured})`
      );
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[FinSight Startup Error] Port ${PORT} is already in use (EADDRINUSE).`);
      } else {
        console.error('[FinSight Server Error]', err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('[FinSight Fatal Startup Error]', err);
    process.exit(1);
  }
}

const isEntrypoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntrypoint) {
  process.on('unhandledRejection', reason => {
    console.error('[FinSight UnhandledRejection]', reason);
  });
  process.on('uncaughtException', err => {
    console.error('[FinSight UncaughtException]', err);
  });
  void startServer();
}
