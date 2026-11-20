/**
 * FinSight Application Types & Models
 */

export type UserRole = 'USER' | 'ADMIN';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  photoURL?: string;
  role: UserRole;
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  onboardingCompleted: boolean;
  country: string;
  currency: string;
  timezone: string;
  language: string;
  occupation?: string;
  monthlyIncomeEstimate?: number;
  monthlyExpenseEstimate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  id: string;
  ownerId: string;
  financialYear: string;
  currency: string;
  language: string;
  numberFormat: 'INDIAN' | 'INTERNATIONAL';
  experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  explanationLevel: 'Simple' | 'Balanced' | 'Detailed';
  selectedFeatures: string[];
  notificationPreferences: {
    budgetAlerts: boolean;
    spendingAlerts: boolean;
    securityAlerts: boolean;
    taxReminders: boolean;
    businessReminders: boolean;
    productUpdates: boolean;
  };
  updatedAt?: string;
}

export interface FinancialAccount {
  id: string;
  ownerId: string;
  accountName: string;
  institution: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'CREDIT_CARD' | 'UPI_WALLET';
  maskedNumber: string;
  balance: number;
  currency: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  ownerId: string;
  description: string;
  merchant: string;
  amount: number;
  currency: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  account: string;
  transactionDate: string;
  referenceId?: string;
  source: 'MANUAL' | 'CSV' | 'XLSX' | 'PDF' | 'SMS' | 'STATEMENT';
  notes?: string;
  importJobId?: string;
  createdAt: string;
}

export interface ImportJobRecord {
  id: string;
  ownerId: string;
  fileName: string;
  format: 'CSV' | 'XLSX' | 'PDF' | 'TXT' | 'SMS';
  fileSizeBytes: number;
  totalRowsParsed: number;
  importedCount: number;
  skippedDuplicatesCount: number;
  status: 'COMPLETED' | 'FAILED';
  createdAt: string;
}

export interface Budget {
  id: string;
  ownerId: string;
  name: string;
  category: string;
  allocatedAmount: number;
  spentAmount: number;
  startDate: string;
  endDate: string;
  alertThreshold: number; // e.g. 80%
  status: 'ACTIVE' | 'PAUSED' | 'EXCEEDED';
  createdAt: string;
}

export interface Portfolio {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  currency: string;
  createdAt: string;
}

export interface Holding {
  id: string;
  ownerId: string;
  portfolioId: string;
  instrumentSymbol: string;
  instrumentName: string;
  assetType: 'Equity' | 'Mutual Funds' | 'Index Funds' | 'Fixed Deposits' | 'ETFs' | 'Bonds' | 'Cash and Other Assets';
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
  currentPrice: number;
  currency: string;
  updatedAt: string;
}

export interface MarketInstrument {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  category: 'Index' | 'LargeCap' | 'MidCap' | 'ETF' | 'Government Bond';
  currentPrice: number;
  changeDay: number;
  changePct: number;
  high52w: number;
  low52w: number;
  lastUpdatedDate: string;
  historicalStatus: 'VERIFIED_NSE_ARCHIVE' | 'LIVE_PROVIDER' | 'SIMULATED_TEST';
}

export interface MarketCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WatchlistItem {
  id: string;
  ownerId: string;
  symbol: string;
  notes?: string;
  createdAt: string;
}

export interface BacktestRecord {
  id: string;
  ownerId: string;
  strategyName: string;
  symbol: string;
  startDate: string;
  endDate: string;
  startingCapital: number;
  strategyType: 'Moving Average Crossover' | 'RSI-Based Strategy' | 'Breakout Strategy' | 'Custom Rule-Based Strategy';
  stopLossPct: number;
  targetPct: number;
  totalReturnPct: number;
  maximumDrawdownPct: number;
  winRatePct: number;
  tradeCount: number;
  finalCapital: number;
  dataSource: 'VERIFIED_NSE_ARCHIVE';
  equityCurve?: Array<{ date: string; equity: number }>;
  status: 'COMPLETED';
  createdAt: string;
}

export interface PaperTrade {
  id: string;
  ownerId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  simulatedPrice: number;
  historicalReferenceDate: string;
  cashImpact: number;
  status: 'EXECUTED_SIMULATED';
  createdAt: string;
}

export interface PaperAccount {
  id: string;
  ownerId: string;
  initialVirtualCapital: number;
  availableVirtualBalance: number;
  simulatedPortfolioValue: number;
  positions?: Record<string, { quantity: number; avgPrice: number }>;
  createdAt: string;
}

export interface TaxProfile {
  id: string;
  ownerId: string;
  financialYear: '2025-26' | '2024-25';
  assessmentYear: string;
  annualSalary: number;
  otherIncome: number;
  ageCategory: 'BELOW_60' | 'SENIOR_60_80' | 'SUPER_SENIOR_80_PLUS';
  preferredRegime: 'NEW' | 'OLD';
  updatedAt: string;
}

export interface TaxRuleSet {
  id: string;
  financialYear: '2025-26' | '2024-25';
  assessmentYear: string;
  version: string;
  newRegimeStandardDeduction: number;
  oldRegimeStandardDeduction: number;
  newRegimeRebateLimit: number;
  oldRegimeRebateLimit: number;
  cessRatePct: number;
  sourceNote: string;
  active: boolean;
  updatedAt: string;
}

export interface TaxCalculationRecord {
  id: string;
  ownerId: string;
  financialYear: string;
  rulesetVersion: string;
  grossIncome: number;
  deductionsClaimed: number;
  oldRegimeTotalTax: number;
  newRegimeTotalTax: number;
  recommendedRegime: 'NEW' | 'OLD';
  estimatedSavings: number;
  createdAt: string;
}

export interface TaxDeduction {
  id: string;
  ownerId: string;
  category: 'Section 80C' | 'Section 80D' | 'Section 80CCD (NPS)' | 'Section 24(b) Home Loan' | 'Section 80E' | 'Other';
  description: string;
  claimedAmount: number;
  applicableLimit: number;
  financialYear: string;
  verificationStatus: 'VERIFIED' | 'PENDING_DOCUMENT';
  createdAt?: string;
}

export interface TaxDocument {
  id: string;
  ownerId: string;
  name: string;
  category: 'Form 16' | 'Salary Slips' | 'Investment Proofs' | 'Interest Certificates' | 'Other';
  financialYear: string;
  mimeType: string;
  fileSizeBytes: number;
  fileSize: string;
  storageKey: string;
  uploadedAt: string;
}

export interface FraudAnalysis {
  id: string;
  ownerId: string;
  inputText: string;
  sourceType: 'SMS' | 'WhatsApp' | 'Email' | 'UPI App' | 'Website' | 'Other';
  riskScore: number; // 0 - 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  suspiciousKeywords: string[];
  findings: string[];
  recommendedActions: string[];
  modelUsed: string;
  createdAt: string;
}

export interface BusinessProfile {
  id: string;
  ownerId: string;
  businessName: string;
  gstin?: string;
  stateCode: string;
  address: string;
  openingCashBalance: number;
  updatedAt: string;
}

export interface Client {
  id: string;
  ownerId: string;
  clientName: string;
  companyName: string;
  email: string;
  phone: string;
  gstin?: string;
  billingAddress: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number; // 0, 5, 12, 18, 28
  lineTotal: number;
}

export interface Invoice {
  id: string;
  ownerId: string;
  clientId: string;
  clientName: string;
  clientGstin?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  placeOfSupply: string;
  lineItems: InvoiceItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  status: 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  notes?: string;
  createdAt: string;
}

export interface BusinessExpense {
  id: string;
  ownerId: string;
  name: string;
  category: 'Rent' | 'Salaries' | 'Marketing' | 'Utilities' | 'Equipment' | 'Travel' | 'Software' | 'Other';
  amount: number;
  expenseDate: string;
  vendor: string;
  paymentMethod: string;
  notes?: string;
  receiptName?: string;
  receiptStorageKey?: string;
  receiptMimeType?: string;
  createdAt: string;
}

export interface CashFlowForecast {
  id: string;
  ownerId: string;
  openingBalance: number;
  confirmedReceivables: number;
  committedOutflows: number;
  projectedClosingBalance: number;
  monthlyBurnRate: number;
  runwayMonths: number;
  monthlyProjection: Array<{
    month: string;
    inflow: number;
    outflow: number;
    closingBalance: number;
  }>;
  generatedAt: string;
}

export interface EMIPlan {
  id: string;
  ownerId: string;
  planName: string;
  loanAmount: number;
  annualInterestRate: number;
  tenureMonths: number;
  monthlyEMI: number;
  totalInterest: number;
  totalPayment: number;
  createdAt: string;
}

export interface AIConversationMessage {
  id: string;
  ownerId: string;
  role: 'user' | 'assistant';
  text: string;
  moduleContext: string;
  modelUsed?: string;
  createdAt: string;
}

export interface AIUsageLog {
  id: string;
  ownerId: string;
  endpoint: string;
  model: string;
  status: 'SUCCESS' | 'ERROR' | 'RATE_LIMITED';
  latencyMs: number;
  errorCode?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  ownerId: string;
  title: string;
  message: string;
  type: 'ALERT' | 'INFO' | 'SUCCESS' | 'WARNING';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  createdAt: string;
  metadata?: string;
}
