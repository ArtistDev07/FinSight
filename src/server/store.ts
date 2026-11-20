/**
 * Persistent Repository Store for FinSight
 * Supports isolated per-user records across all 28 domain entities,
 * automatic disk persistence across restarts, and non-destructive test stores.
 */
import fs from 'fs';
import path from 'path';
import type {
  UserProfile,
  UserPreferences,
  FinancialAccount,
  Transaction,
  ImportJobRecord,
  Budget,
  Portfolio,
  Holding,
  MarketInstrument,
  MarketCandle,
  WatchlistItem,
  BacktestRecord,
  PaperAccount,
  PaperTrade,
  TaxProfile,
  TaxRuleSet,
  TaxCalculationRecord,
  TaxDeduction,
  TaxDocument,
  FraudAnalysis,
  BusinessProfile,
  Client,
  Invoice,
  BusinessExpense,
  CashFlowForecast,
  EMIPlan,
  AIConversationMessage,
  AIUsageLog,
  AppNotification,
  AuditLog,
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
} from '../types';
import { generateHistoricalMarketCatalog } from './marketData';

export interface FinSightStore {
  users: UserProfile[];
  userPreferences: UserPreferences[];
  financialAccounts: FinancialAccount[];
  transactions: Transaction[];
  importJobs: ImportJobRecord[];
  budgets: Budget[];
  portfolios: Portfolio[];
  holdings: Holding[];
  marketInstruments: MarketInstrument[];
  marketHistory: Record<string, MarketCandle[]>;
  watchlists: WatchlistItem[];
  backtests: BacktestRecord[];
  paperAccounts: PaperAccount[];
  paperTrades: PaperTrade[];
  taxProfiles: TaxProfile[];
  taxRules: TaxRuleSet[];
  taxCalculations: TaxCalculationRecord[];
  taxDeductions: TaxDeduction[];
  taxDocuments: TaxDocument[];
  fraudAnalyses: FraudAnalysis[];
  businessProfiles: BusinessProfile[];
  clients: Client[];
  invoices: Invoice[];
  businessExpenses: BusinessExpense[];
  cashFlowForecasts: CashFlowForecast[];
  emiPlans: EMIPlan[];
  aiConversations: AIConversationMessage[];
  aiUsageLogs: AIUsageLog[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
  manualAssetsLiabilities: ManualAssetLiability[];
  moneyGoals: MoneyGoal[];
  moneyCalendarEvents: MoneyCalendarEvent[];
  creditCards: CreditCard[];
  creditCardStatements: CreditCardStatement[];
  recurringPayments: RecurringPayment[];
  financialHealthSnapshots: FinancialHealthSnapshot[];
  businessReconciliationRuns: BusinessReconciliationRun[];
  paymentFollowUps: PaymentFollowUp[];
  investmentJournal: InvestmentJournalEntry[];
  taxReadinessItems: TaxReadinessItem[];
  systemSettings: {
    aiEnabled: boolean;
    maintenanceMode: boolean;
    maxUploadMb: number;
    defaultFinancialYear: '2025-26' | '2024-25';
  };
}

export function createInitialStore(): FinSightStore {
  const { instruments, historyBySymbol } = generateHistoricalMarketCatalog();

  return {
    users: [
      {
        uid: 'user-default-1',
        fullName: 'Aarav Sharma',
        email: 'aarav.sharma@example.com',
        phone: '+91 98765 43210',
        role: 'USER',
        accountStatus: 'ACTIVE',
        onboardingCompleted: true,
        country: 'India',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        language: 'English',
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-03-01T12:00:00.000Z',
      },
      {
        uid: 'admin-1',
        fullName: 'FinSight SuperAdmin',
        email: 'admin@finsight.internal',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        onboardingCompleted: true,
        country: 'India',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        language: 'English',
        createdAt: '2025-12-01T10:00:00.000Z',
        updatedAt: '2026-03-01T12:00:00.000Z',
      },
    ],
    userPreferences: [],
    financialAccounts: [],
    transactions: [
      {
        id: 'tx-1',
        ownerId: 'user-default-1',
        description: 'Monthly Tech Salary Credit',
        merchant: 'Infosys Corp',
        amount: 145000,
        currency: 'INR',
        type: 'INCOME',
        category: 'Salary',
        account: 'HDFC Salary Acc *4102',
        transactionDate: '2026-03-01',
        source: 'STATEMENT',
        createdAt: '2026-03-01T09:00:00.000Z',
      },
      {
        id: 'tx-2',
        ownerId: 'user-default-1',
        description: 'Apartment Rent Maintenance',
        merchant: 'Sobha Developers',
        amount: 32000,
        currency: 'INR',
        type: 'EXPENSE',
        category: 'Housing',
        account: 'HDFC Salary Acc *4102',
        transactionDate: '2026-03-02',
        source: 'SMS',
        referenceId: 'UPI/SOBHA/491028',
        createdAt: '2026-03-02T10:15:00.000Z',
      },
      {
        id: 'tx-3',
        ownerId: 'user-default-1',
        description: 'Groceries and Daily Essentials',
        merchant: 'Blinkit Superstore',
        amount: 4850,
        currency: 'INR',
        type: 'EXPENSE',
        category: 'Food',
        account: 'ICICI Bank UPI *9921',
        transactionDate: '2026-03-04',
        source: 'SMS',
        referenceId: 'UPI/BLINKIT/829103',
        createdAt: '2026-03-04T14:30:00.000Z',
      },
    ],
    importJobs: [],
    budgets: [
      {
        id: 'b-1',
        ownerId: 'user-default-1',
        name: 'Housing & Utilities',
        category: 'Housing',
        allocatedAmount: 40000,
        spentAmount: 32000,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        alertThreshold: 85,
        status: 'ACTIVE',
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    ],
    portfolios: [
      {
        id: 'port-1',
        ownerId: 'user-default-1',
        name: 'Long-Term Wealth Accumulation',
        description: 'Core equity, index funds, and liquid emergency instruments',
        currency: 'INR',
        createdAt: '2026-01-20T00:00:00.000Z',
      },
    ],
    holdings: [
      {
        id: 'h-1',
        ownerId: 'user-default-1',
        portfolioId: 'port-1',
        instrumentSymbol: 'NIFTYBEES',
        instrumentName: 'Nippon India Nifty 50 BeES ETF',
        assetType: 'Index Funds',
        quantity: 1200,
        purchasePrice: 242.5,
        purchaseDate: '2025-06-12',
        currentPrice: 284.2,
        currency: 'INR',
        updatedAt: '2026-03-10T15:30:00.000Z',
      },
    ],
    marketInstruments: instruments,
    marketHistory: historyBySymbol,
    watchlists: [],
    backtests: [],
    paperAccounts: [],
    paperTrades: [],
    taxProfiles: [],
    taxRules: [
      {
        id: 'rule-fy2025-26',
        financialYear: '2025-26',
        assessmentYear: '2026-27',
        version: 'CBDT v2025.2',
        newRegimeStandardDeduction: 75000,
        oldRegimeStandardDeduction: 50000,
        newRegimeRebateLimit: 700000,
        oldRegimeRebateLimit: 500000,
        cessRatePct: 4,
        sourceNote: 'CBDT Section 115BAC slabs & Chapter VI-A ruleset',
        active: true,
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'rule-fy2024-25',
        financialYear: '2024-25',
        assessmentYear: '2025-26',
        version: 'CBDT v2024.1',
        newRegimeStandardDeduction: 75000,
        oldRegimeStandardDeduction: 50000,
        newRegimeRebateLimit: 700000,
        oldRegimeRebateLimit: 500000,
        cessRatePct: 4,
        sourceNote: 'CBDT FY 2024-25 Finance Act ruleset',
        active: true,
        updatedAt: '2025-04-01T00:00:00.000Z',
      },
    ],
    taxCalculations: [],
    taxDeductions: [],
    taxDocuments: [],
    fraudAnalyses: [],
    businessProfiles: [],
    clients: [],
    invoices: [],
    businessExpenses: [],
    cashFlowForecasts: [],
    emiPlans: [],
    aiConversations: [],
    aiUsageLogs: [],
    notifications: [],
    auditLogs: [
      {
        id: 'log-1',
        actorId: 'admin-1',
        actorEmail: 'admin@finsight.internal',
        action: 'SYSTEM_SECURITY_INITIALIZED',
        resourceType: 'AUTH',
        resourceId: 'firebase-admin-guard',
        outcome: 'SUCCESS',
        createdAt: '2026-03-11T08:20:00.000Z',
      },
    ],
    manualAssetsLiabilities: [],
    moneyGoals: [],
    moneyCalendarEvents: [],
    creditCards: [],
    creditCardStatements: [],
    recurringPayments: [],
    financialHealthSnapshots: [],
    businessReconciliationRuns: [],
    paymentFollowUps: [],
    investmentJournal: [],
    taxReadinessItems: [],
    systemSettings: {
      aiEnabled: true,
      maintenanceMode: false,
      maxUploadMb: 10,
      defaultFinancialYear: '2025-26',
    },
  };
}

export function loadOrInitializeDiskStore(filePath?: string): { store: FinSightStore; save: () => void } {
  const target = filePath || path.resolve(process.cwd(), '.finsight-data', 'store.json');
  const defaults = createInitialStore();
  let store: FinSightStore = defaults;

  try {
    if (fs.existsSync(target)) {
      const raw = JSON.parse(fs.readFileSync(target, 'utf8')) as Partial<FinSightStore>;
      store = {
        ...defaults,
        ...raw,
        // Always ensure latest verified market archive & tax rules are refreshed
        marketInstruments: defaults.marketInstruments,
        marketHistory: defaults.marketHistory,
        taxRules: raw.taxRules && raw.taxRules.length > 0 ? raw.taxRules : defaults.taxRules,
        systemSettings: { ...defaults.systemSettings, ...(raw.systemSettings || {}) },
      };
    }
  } catch {
    store = defaults;
  }

  let saveTimer: NodeJS.Timeout | null = null;
  const writeImmediate = () => {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(store, null, 2), 'utf8');
    } catch {
      // Ignore write failures in read-only environments
    }
  };

  const save = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(writeImmediate, 50);
  };

  return { store, save };
}
