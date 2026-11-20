/**
 * Deterministic Financial Intelligence Engines for FinSight 2.0
 * Every numerical metric, schedule, projection, aging bucket, and risk indicator
 * is computed deterministically with transparent formulas and zero invented data.
 */

import type {
  Transaction,
  Holding,
  CreditCard,
  MoneyGoal,
  MoneyCalendarEvent,
  RecurringPayment,
  Invoice,
  BusinessExpense,
  ManualAssetLiability,
  FinancialHealthDimension,
} from '../types';

export function isDoubleCountExcluded(tx: Pick<Transaction, 'isInternalTransfer' | 'isCreditCardSettlement' | 'inboxStatus'>): boolean {
  return Boolean(tx.isInternalTransfer || tx.isCreditCardSettlement || tx.inboxStatus === 'IGNORED' || tx.inboxStatus === 'DUPLICATE');
}

export function classifyInboxTransaction(
  tx: { description: string; merchant?: string; amount: number; type: 'INCOME' | 'EXPENSE'; category?: string },
  existingTransactions: Transaction[] = []
): {
  category: string;
  inboxStatus: 'CATEGORIZED' | 'NEEDS_REVIEW' | 'DUPLICATE';
  confidence: number;
  suggestionReason: string;
  isInternalTransfer: boolean;
  isCreditCardSettlement: boolean;
  isRefund: boolean;
} {
  const raw = `${tx.description} ${tx.merchant || ''}`.toLowerCase();

  const isCreditCardSettlement =
    /\b(credit card|card bill|hdfc card|icici card|sbi card|axis card|amex|cred pay|billdesk cc)\b/.test(raw);
  const isInternalTransfer =
    !isCreditCardSettlement &&
    /\b(self transfer|own account|neft self|imps self|internal transfer|wallet topup|to savings)\b/.test(raw);
  const isRefund =
    tx.type === 'INCOME' && /\b(refund|reversal|cashback|returned|chargeback)\b/.test(raw);

  // Check for previously confirmed merchant match
  const normMerchant = (tx.merchant || tx.description).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
  const matchedPrev = existingTransactions.find(prev => {
    const prevNorm = (prev.merchant || prev.description).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
    return normMerchant.length >= 4 && prevNorm === normMerchant && prev.inboxStatus !== 'NEEDS_REVIEW';
  });

  if (matchedPrev) {
    return {
      category: matchedPrev.category,
      inboxStatus: 'CATEGORIZED',
      confidence: 94,
      suggestionReason: `Merchant pattern matched previously confirmed "${matchedPrev.merchant || matchedPrev.description}" (${matchedPrev.category}).`,
      isInternalTransfer,
      isCreditCardSettlement,
      isRefund,
    };
  }

  let suggestedCategory = tx.category || (tx.type === 'INCOME' ? 'Salary' : 'Other');
  let confidence = 62;
  let reason = 'General keyword heuristics; please review before confirming.';

  if (isCreditCardSettlement) {
    suggestedCategory = 'Credit Card Payment';
    confidence = 91;
    reason = 'Detected credit-card bill settlement keywords; excluded from double-counting against card spend.';
  } else if (isInternalTransfer) {
    suggestedCategory = 'Transfer';
    confidence = 89;
    reason = 'Detected self/internal transfer phrasing; excluded from net income/expense totals.';
  } else if (isRefund) {
    suggestedCategory = 'Refund';
    confidence = 88;
    reason = 'Detected merchant refund or reversal credit.';
  } else if (/\b(swiggy|zomato|blinkit|zepto|instamart|dmart|bigbasket|restaurant|cafe)\b/.test(raw)) {
    suggestedCategory = 'Food & Dining';
    confidence = 92;
    reason = 'Matched Indian food delivery / grocery merchant keyword.';
  } else if (/\b(uber|ola|rapido|metro|irctc|indigo|petrol|fuel|fastag|shell)\b/.test(raw)) {
    suggestedCategory = 'Transport';
    confidence = 90;
    reason = 'Matched Indian transit / fuel merchant keyword.';
  } else if (/\b(rent|sobha|prestige|nobroker|electricity|bescom|tata power|water|broadband|jio|airtel)\b/.test(raw)) {
    suggestedCategory = 'Housing & Utilities';
    confidence = 88;
    reason = 'Matched rent, utility, or telecom provider pattern.';
  } else if (/\b(netflix|spotify|prime|hotstar|apple|google one|adobe|notion|gym)\b/.test(raw)) {
    suggestedCategory = 'Subscriptions';
    confidence = 87;
    reason = 'Matched recurring subscription merchant.';
  } else if (/\b(salary|payroll|infosys|tcs|wipro|stipend|dividend)\b/.test(raw)) {
    suggestedCategory = 'Salary';
    confidence = 90;
    reason = 'Matched payroll or income descriptor.';
  } else if (/\b(zerodha|groww|kuvera|coin|sip|mutual fund|ppf|nps)\b/.test(raw)) {
    suggestedCategory = 'Investments';
    confidence = 88;
    reason = 'Matched investment or SIP broker pattern.';
  }

  return {
    category: suggestedCategory,
    inboxStatus: confidence >= 85 ? 'CATEGORIZED' : 'NEEDS_REVIEW',
    confidence,
    suggestionReason: reason,
    isInternalTransfer,
    isCreditCardSettlement,
    isRefund,
  };
}

export function computeFinancialHealthSummary(input: {
  transactions: Transaction[];
  holdings: Holding[];
  creditCards: CreditCard[];
  goals: MoneyGoal[];
  manualItems: ManualAssetLiability[];
  openingCashBalance?: number;
}) {
  const validTxs = input.transactions.filter(t => !isDoubleCountExcluded(t));
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  for (const t of validTxs) {
    if (t.type === 'INCOME') monthlyIncome += t.amount;
    else if (t.type === 'EXPENSE') monthlyExpenses += t.amount;
  }

  const portfolioValue = input.holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
  const emergencyGoalSaved = input.goals
    .filter(g => g.category === 'Emergency Fund')
    .reduce((s, g) => s + g.currentAmount, 0);
  const otherGoalsSaved = input.goals
    .filter(g => g.category !== 'Emergency Fund')
    .reduce((s, g) => s + g.currentAmount, 0);

  const manualAssets = input.manualItems
    .filter(m => m.included && m.kind === 'ASSET')
    .reduce((s, m) => s + m.amount, 0);
  const manualLiabilities = input.manualItems
    .filter(m => m.included && m.kind === 'LIABILITY')
    .reduce((s, m) => s + m.amount, 0);

  const cardLiabilities = input.creditCards.reduce((s, c) => s + Math.max(0, c.currentBalance), 0);
  const cashReserve = Math.max(0, input.openingCashBalance || 0) + emergencyGoalSaved + otherGoalsSaved;

  const totalAssets = Math.round((portfolioValue + cashReserve + manualAssets) * 100) / 100;
  const totalLiabilities = Math.round((cardLiabilities + manualLiabilities) * 100) / 100;
  const estimatedNetWorth = Math.round((totalAssets - totalLiabilities) * 100) / 100;
  const monthlySavings = Math.round((monthlyIncome - monthlyExpenses) * 100) / 100;
  const savingsRate = monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 1000) / 10 : 0;

  const essentialMonthlyBurn = monthlyExpenses > 0 ? monthlyExpenses : 1;
  const liquidForEmergency = emergencyGoalSaved + Math.max(0, input.openingCashBalance || 0) + manualAssets * 0.25;
  const emergencyFundCoverageMonths =
    monthlyExpenses > 0 ? Math.round((liquidForEmergency / essentialMonthlyBurn) * 10) / 10 : 0;

  // Transparent dimensions
  const cashFlowScore = monthlyIncome <= 0 ? 40 : Math.max(15, Math.min(100, Math.round(50 + savingsRate)));
  const savingsScore = monthlyIncome <= 0 ? 35 : Math.max(10, Math.min(100, Math.round((Math.max(0, savingsRate) / 30) * 100)));
  const totalLimit = input.creditCards.reduce((s, c) => s + Math.max(0, c.creditLimit), 0);
  const utilizationPct = totalLimit > 0 ? (cardLiabilities / totalLimit) * 100 : 0;
  const debtScore =
    totalLiabilities === 0
      ? 95
      : Math.max(15, Math.min(100, Math.round(100 - utilizationPct * 0.9 - (monthlyIncome > 0 ? (totalLiabilities / (monthlyIncome * 12)) * 30 : 20))));
  const emergencyScore = Math.max(10, Math.min(100, Math.round((emergencyFundCoverageMonths / 6) * 100)));

  const assetClasses = new Set(input.holdings.map(h => h.assetType));
  const maxHoldingShare =
    portfolioValue > 0
      ? Math.max(...input.holdings.map(h => (h.quantity * h.currentPrice) / portfolioValue))
      : 1;
  const diversificationScore =
    input.holdings.length === 0
      ? 30
      : Math.max(25, Math.min(100, Math.round(assetClasses.size * 22 + (1 - maxHoldingShare) * 55)));

  const dimensions: FinancialHealthDimension[] = [
    {
      key: 'CASH_FLOW',
      label: 'Cash Flow Stability',
      score: cashFlowScore,
      weight: 0.25,
      status: cashFlowScore >= 75 ? 'STRONG' : cashFlowScore >= 50 ? 'MODERATE' : 'ATTENTION',
      formulaSummary: '50 + Savings Rate %, clamped to 15–100',
      evidenceText: `Income ₹${Math.round(monthlyIncome).toLocaleString('en-IN')} minus non-transfer expenses ₹${Math.round(monthlyExpenses).toLocaleString('en-IN')}.`,
    },
    {
      key: 'SAVINGS',
      label: 'Savings Progress',
      score: savingsScore,
      weight: 0.2,
      status: savingsScore >= 70 ? 'STRONG' : savingsScore >= 45 ? 'MODERATE' : 'ATTENTION',
      formulaSummary: '(Savings Rate % / 30% benchmark) × 100',
      evidenceText: `Current net savings rate is ${savingsRate}% against a 30% planning benchmark.`,
    },
    {
      key: 'DEBT',
      label: 'Debt Pressure',
      score: debtScore,
      weight: 0.2,
      status: debtScore >= 75 ? 'STRONG' : debtScore >= 50 ? 'MODERATE' : 'ATTENTION',
      formulaSummary: '100 − (0.9 × Credit Utilization %) − Liability-to-Annual-Income ratio',
      evidenceText: `Tracked liabilities total ₹${Math.round(totalLiabilities).toLocaleString('en-IN')} (${Math.round(utilizationPct)}% credit card utilization).`,
    },
    {
      key: 'EMERGENCY_FUND',
      label: 'Emergency Fund Readiness',
      score: emergencyScore,
      weight: 0.2,
      status: emergencyScore >= 75 ? 'STRONG' : emergencyScore >= 45 ? 'MODERATE' : 'ATTENTION',
      formulaSummary: '(Emergency Reserves / 6 months recorded expenses) × 100',
      evidenceText: `Liquid reserve covers ~${emergencyFundCoverageMonths} months of recorded expenses.`,
    },
    {
      key: 'DIVERSIFICATION',
      label: 'Investment Diversification',
      score: diversificationScore,
      weight: 0.15,
      status: diversificationScore >= 70 ? 'STRONG' : diversificationScore >= 45 ? 'MODERATE' : 'ATTENTION',
      formulaSummary: '(Distinct Asset Classes × 22) + (1 − Largest Holding Share) × 55',
      evidenceText: `${input.holdings.length} holdings across ${assetClasses.size} asset classes.`,
    },
  ];

  const compositeIndex = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)
  );

  const missingDataNotes: string[] = [];
  if (monthlyIncome === 0) missingDataNotes.push('No recorded income transactions yet.');
  if (input.holdings.length === 0) missingDataNotes.push('No investment holdings recorded yet.');
  if (input.goals.filter(g => g.category === 'Emergency Fund').length === 0) {
    missingDataNotes.push('Add an Emergency Fund goal to refine runway accuracy.');
  }
  if (input.creditCards.length === 0) missingDataNotes.push('No credit cards tracked; card utilization defaults to 0%.');

  const observations: Array<{ id: string; title: string; calculation: string; severity: 'info' | 'warning' | 'positive' }> = [];
  if (monthlyExpenses > 0 && emergencyFundCoverageMonths < 3) {
    observations.push({
      id: 'obs-ef',
      title: `Emergency savings cover approximately ${emergencyFundCoverageMonths} months of recorded expenses`,
      calculation: `Liquid Reserve ₹${Math.round(liquidForEmergency).toLocaleString('en-IN')} ÷ Monthly Expenses ₹${Math.round(monthlyExpenses).toLocaleString('en-IN')} = ${emergencyFundCoverageMonths} months (3–6 month benchmark).`,
      severity: 'warning',
    });
  } else if (monthlyExpenses > 0) {
    observations.push({
      id: 'obs-ef-ok',
      title: `Emergency reserves cover ${emergencyFundCoverageMonths} months of expenses`,
      calculation: `Liquid Reserve ₹${Math.round(liquidForEmergency).toLocaleString('en-IN')} ÷ Monthly Expenses ₹${Math.round(monthlyExpenses).toLocaleString('en-IN')}.`,
      severity: 'positive',
    });
  }
  if (utilizationPct > 30) {
    observations.push({
      id: 'obs-util',
      title: `Overall credit card utilization is ${Math.round(utilizationPct)}%`,
      calculation: `Card Balance ₹${Math.round(cardLiabilities).toLocaleString('en-IN')} ÷ Total Limit ₹${Math.round(totalLimit).toLocaleString('en-IN')}. Keeping utilization under 30% reduces interest pressure.`,
      severity: 'warning',
    });
  }
  if (input.holdings.length > 0 && maxHoldingShare > 0.65) {
    observations.push({
      id: 'obs-conc',
      title: 'Portfolio is concentrated in a single position',
      calculation: `Top holding represents ${Math.round(maxHoldingShare * 100)}% of total portfolio value ₹${Math.round(portfolioValue).toLocaleString('en-IN')}.`,
      severity: 'info',
    });
  }
  if (monthlyIncome > 0) {
    observations.push({
      id: 'obs-sav',
      title: `Net savings rate is ${savingsRate}%`,
      calculation: `(Income ₹${Math.round(monthlyIncome).toLocaleString('en-IN')} − Expenses ₹${Math.round(monthlyExpenses).toLocaleString('en-IN')}) ÷ Income.`,
      severity: savingsRate >= 20 ? 'positive' : 'warning',
    });
  }

  return {
    totalAssets,
    totalLiabilities,
    estimatedNetWorth,
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
    monthlySavings,
    savingsRate,
    emergencyFundCoverageMonths,
    compositeIndex,
    formulaDisclosure:
      'Composite Index = 25% Cash Flow + 20% Savings + 20% Debt Pressure + 20% Emergency Readiness + 15% Diversification. Internal transfers and credit-card settlements are excluded from double counting.',
    missingDataNotes,
    dimensions,
    observations,
  };
}

export function computeCreditCardSummary(cards: CreditCard[]) {
  const totalBalance = cards.reduce((s, c) => s + Math.max(0, c.currentBalance), 0);
  const totalLimit = cards.reduce((s, c) => s + Math.max(0, c.creditLimit), 0);
  const totalMinimumDue = cards.reduce((s, c) => s + Math.max(0, c.minimumDue), 0);
  const utilizationPct = totalLimit > 0 ? Math.round((totalBalance / totalLimit) * 1000) / 10 : 0;

  return {
    totalOutstandingBalance: Math.round(totalBalance * 100) / 100,
    totalCreditLimit: Math.round(totalLimit * 100) / 100,
    overallUtilizationPct: utilizationPct,
    totalMinimumDue: Math.round(totalMinimumDue * 100) / 100,
    totalStatementDue: Math.round(totalBalance * 100) / 100,
  };
}

export function simulateCreditCardPayment(input: {
  balance: number;
  annualInterestRate: number;
  minimumDuePct?: number;
  extraMonthlyPayment?: number;
}) {
  const balance = Math.max(0, input.balance);
  const apr = Math.max(0, input.annualInterestRate);
  const monthlyRate = apr / 100 / 12;
  const minPct = Math.max(0.02, (input.minimumDuePct ?? 5) / 100);

  const simulateSchedule = (fixedPayment: number | null) => {
    let rem = balance;
    let months = 0;
    let totalInterest = 0;
    while (rem > 1 && months < 240) {
      months++;
      const interest = rem * monthlyRate;
      totalInterest += interest;
      const minDue = Math.max(500, rem * minPct);
      const payment = fixedPayment !== null ? Math.min(rem + interest, Math.max(minDue, fixedPayment)) : Math.min(rem + interest, minDue);
      if (payment <= interest && monthlyRate > 0) {
        return { months: 240, totalInterest: Math.round(totalInterest), capped: true };
      }
      rem = rem + interest - payment;
    }
    return { months, totalInterest: Math.round(totalInterest), capped: false };
  };

  const fullPay = { months: balance > 0 ? 1 : 0, totalInterest: 0, label: 'Pay Full Statement Balance' };
  const minimumOnly = simulateSchedule(null);
  const extraAmount = Math.max(0, input.extraMonthlyPayment || 0);
  const withExtra = simulateSchedule(Math.max(500, balance * minPct) + extraAmount);

  return {
    fullPay,
    minimumOnly: { ...minimumOnly, label: 'Minimum Due Only' },
    withExtra: { ...withExtra, label: `Minimum + ₹${Math.round(extraAmount).toLocaleString('en-IN')}/mo` },
    assumptions: `Assumes constant ${apr}% APR compounded monthly and no new revolving purchases.`,
  };
}

export function computeDebtPayoffSchedule(
  debts: Array<{ id: string; name: string; balance: number; annualInterestRate: number; minimumPayment: number }>,
  monthlyBudget: number,
  strategy: 'AVALANCHE' | 'SNOWBALL'
) {
  const active = debts
    .filter(d => d.balance > 0)
    .map(d => ({ ...d, rem: d.balance }));
  if (active.length === 0) {
    return { strategy, months: 0, totalInterest: 0, payoffOrder: [] as string[] };
  }

  const ordered = [...active].sort((a, b) =>
    strategy === 'AVALANCHE' ? b.annualInterestRate - a.annualInterestRate : a.balance - b.balance
  );
  const minSum = ordered.reduce((s, d) => s + Math.max(0, d.minimumPayment), 0);
  const budget = Math.max(monthlyBudget, minSum);

  let months = 0;
  let totalInterest = 0;
  const payoffOrder: string[] = [];

  while (ordered.some(d => d.rem > 0.5) && months < 240) {
    months++;
    let remainingBudget = budget;

    for (const d of ordered) {
      if (d.rem <= 0) continue;
      const interest = (d.rem * (d.annualInterestRate / 100)) / 12;
      totalInterest += interest;
      d.rem += interest;
      const minPay = Math.min(d.rem, Math.max(0, d.minimumPayment));
      d.rem -= minPay;
      remainingBudget -= minPay;
      if (d.rem <= 0.5 && !payoffOrder.includes(d.name)) {
        d.rem = 0;
        payoffOrder.push(d.name);
      }
    }

    // Apply surplus to highest priority target
    for (const d of ordered) {
      if (d.rem <= 0 || remainingBudget <= 0) continue;
      const extra = Math.min(d.rem, remainingBudget);
      d.rem -= extra;
      remainingBudget -= extra;
      if (d.rem <= 0.5 && !payoffOrder.includes(d.name)) {
        d.rem = 0;
        payoffOrder.push(d.name);
      }
    }
  }

  return {
    strategy,
    months,
    totalInterest: Math.round(totalInterest),
    payoffOrder,
  };
}

export function buildCashFlowRadar(input: {
  openingBalance: number;
  events: MoneyCalendarEvent[];
  horizonDays: 7 | 30 | 90;
  whatIfExtraExpense?: number;
  referenceDate?: string;
}) {
  const start = input.referenceDate ? new Date(input.referenceDate) : new Date();
  const end = new Date(start.getTime() + input.horizonDays * 86400000);
  const startMs = start.getTime();
  const endMs = end.getTime();

  const windowEvents = input.events
    .filter(ev => {
      const t = new Date(ev.dueDate).getTime();
      return Number.isFinite(t) && t >= startMs - 86400000 && t <= endMs;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  let running = input.openingBalance;
  let expectedInflows = 0;
  let expectedOutflows = Math.max(0, input.whatIfExtraExpense || 0);
  const shortfallDates: Array<{ date: string; projectedBalance: number; eventTitle: string }> = [];
  const timeline: Array<{ label: string; balance: number }> = [
    { label: 'Start', balance: Math.round(running) },
  ];

  if (input.whatIfExtraExpense && input.whatIfExtraExpense > 0) {
    running -= input.whatIfExtraExpense;
  }

  for (const ev of windowEvents) {
    if (ev.status === 'PAID') continue;
    if (ev.direction === 'INFLOW') {
      expectedInflows += ev.amount;
      running += ev.amount;
    } else {
      expectedOutflows += ev.amount;
      running -= ev.amount;
    }
    if (running < 0) {
      shortfallDates.push({
        date: ev.dueDate,
        projectedBalance: Math.round(running),
        eventTitle: ev.title,
      });
    }
    timeline.push({ label: ev.dueDate.slice(5), balance: Math.round(running) });
  }

  const projectedClosingBalance =
    Math.round((input.openingBalance + expectedInflows - expectedOutflows) * 100) / 100;

  return {
    horizonDays: input.horizonDays,
    openingBalance: Math.round(input.openingBalance * 100) / 100,
    expectedInflows: Math.round(expectedInflows * 100) / 100,
    expectedOutflows: Math.round(expectedOutflows * 100) / 100,
    projectedClosingBalance,
    shortfallDates,
    timeline,
    eventsInWindow: windowEvents,
    formula: 'Opening Balance + Expected Inflows − Expected Outflows = Projected Closing Balance',
  };
}

export function detectRecurringPayments(
  transactions: Transaction[],
  existingRecurring: RecurringPayment[],
  ownerId: string
): RecurringPayment[] {
  const expenses = transactions.filter(t => t.type === 'EXPENSE' && !isDoubleCountExcluded(t));
  const groups = new Map<string, Transaction[]>();

  for (const tx of expenses) {
    const key = (tx.merchant || tx.description)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(' ');
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(tx);
    groups.set(key, list);
  }

  const detected: RecurringPayment[] = [];
  const existingKeys = new Set(existingRecurring.map(r => r.merchant.toLowerCase()));

  for (const [, list] of groups.entries()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const merchantName = latest.merchant || latest.description;
    if (existingKeys.has(merchantName.toLowerCase())) continue;

    const avgDays =
      (new Date(latest.transactionDate).getTime() - new Date(sorted[0].transactionDate).getTime()) /
      86400000 /
      Math.max(1, sorted.length - 1);

    let frequency: RecurringPayment['frequency'] = 'MONTHLY';
    if (avgDays <= 10) frequency = 'WEEKLY';
    else if (avgDays >= 70 && avgDays <= 110) frequency = 'QUARTERLY';
    else if (avgDays > 300) frequency = 'YEARLY';

    const addDays = frequency === 'WEEKLY' ? 7 : frequency === 'QUARTERLY' ? 90 : frequency === 'YEARLY' ? 365 : 30;
    const nextDate = new Date(new Date(latest.transactionDate).getTime() + addDays * 86400000)
      .toISOString()
      .split('T')[0];

    const amtRatio = prev.amount > 0 ? Math.abs(latest.amount - prev.amount) / prev.amount : 0;
    const confidence = Math.max(60, Math.min(96, Math.round(92 - amtRatio * 40)));

    detected.push({
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId,
      merchant: merchantName,
      category: latest.category,
      estimatedAmount: latest.amount,
      previousAmount: prev.amount,
      frequency,
      lastObservedDate: latest.transactionDate,
      nextEstimatedDate: nextDate,
      confidence,
      status: 'DETECTED',
      userConfirmed: false,
      sourceTransactionIds: sorted.map(s => s.id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return detected;
}

export function computeGoalProjection(goal: Pick<MoneyGoal, 'targetAmount' | 'currentAmount' | 'targetDate' | 'monthlyContribution'>, extraMonthly = 0) {
  const target = Math.max(0, goal.targetAmount);
  const current = Math.max(0, goal.currentAmount);
  const remaining = Math.max(0, target - current);
  const progressPct = target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0;

  const now = new Date();
  const targetDt = new Date(goal.targetDate);
  const monthsRemaining = Number.isFinite(targetDt.getTime())
    ? Math.max(1, Math.ceil((targetDt.getTime() - now.getTime()) / (30.4375 * 86400000)))
    : 12;

  const requiredMonthlyContribution = remaining > 0 ? Math.ceil(remaining / monthsRemaining) : 0;
  const activeMonthly = Math.max(0, (goal.monthlyContribution || 0) + extraMonthly);
  const estimatedMonthsToComplete = remaining === 0 ? 0 : activeMonthly > 0 ? Math.ceil(remaining / activeMonthly) : null;
  const estimatedCompletionDate =
    estimatedMonthsToComplete !== null
      ? new Date(now.getTime() + estimatedMonthsToComplete * 30.4375 * 86400000).toISOString().split('T')[0]
      : null;

  return {
    remainingAmount: Math.round(remaining * 100) / 100,
    progressPct,
    monthsRemaining,
    requiredMonthlyContribution,
    estimatedMonthsToComplete,
    estimatedCompletionDate,
  };
}

export function computePortfolioRiskAnalytics(holdings: Holding[]) {
  const totalValue = holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
  const totalCost = holdings.reduce((s, h) => s + h.quantity * h.purchasePrice, 0);
  if (holdings.length === 0 || totalValue <= 0) {
    return {
      totalValue: 0,
      totalCost: 0,
      topHoldingConcentrationPct: 0,
      topAssetClass: 'None',
      topAssetClassPct: 0,
      estimatedAnnualVolatilityPct: 0,
      estimatedMaxDrawdownPct: 0,
      tenPctShockImpact: 0,
      shockedPortfolioValue: 0,
      classBreakdown: [] as Array<{ assetType: string; value: number; sharePct: number }>,
    };
  }

  const classMap = new Map<string, number>();
  let maxSingleHolding = 0;
  for (const h of holdings) {
    const val = h.quantity * h.currentPrice;
    if (val > maxSingleHolding) maxSingleHolding = val;
    classMap.set(h.assetType, (classMap.get(h.assetType) || 0) + val);
  }

  const classBreakdown = Array.from(classMap.entries())
    .map(([assetType, value]) => ({
      assetType,
      value: Math.round(value * 100) / 100,
      sharePct: Math.round((value / totalValue) * 1000) / 10,
    }))
    .sort((a, b) => b.value - a.value);

  const volWeightMap: Record<string, number> = {
    Equity: 19,
    'Mutual Funds': 15,
    'Index Funds': 14,
    ETFs: 14,
    'Fixed Deposits': 1,
    Bonds: 5,
    'Cash and Other Assets': 1,
  };
  const weightedVol = classBreakdown.reduce(
    (s, c) => s + (c.sharePct / 100) * (volWeightMap[c.assetType] ?? 12),
    0
  );

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    topHoldingConcentrationPct: Math.round((maxSingleHolding / totalValue) * 1000) / 10,
    topAssetClass: classBreakdown[0]?.assetType || 'None',
    topAssetClassPct: classBreakdown[0]?.sharePct || 0,
    estimatedAnnualVolatilityPct: Math.round(weightedVol * 10) / 10,
    estimatedMaxDrawdownPct: Math.round(weightedVol * 1.45 * 10) / 10,
    tenPctShockImpact: Math.round(-totalValue * 0.1 * 100) / 100,
    shockedPortfolioValue: Math.round(totalValue * 0.9 * 100) / 100,
    classBreakdown,
  };
}

export function computeReceivablesAging(invoices: Invoice[], referenceDate?: string) {
  const now = referenceDate ? new Date(referenceDate) : new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

  const buckets = {
    notDue: 0,
    days1To30: 0,
    days31To60: 0,
    days61To90: 0,
    over90: 0,
  };
  let totalOutstanding = 0;
  let overdueAmount = 0;
  let dueThisWeek = 0;
  const collectionDays: number[] = [];

  for (const inv of invoices) {
    if (inv.status === 'PAID') {
      const d1 = new Date(inv.invoiceDate).getTime();
      const d2 = new Date(inv.dueDate).getTime();
      if (Number.isFinite(d1) && Number.isFinite(d2) && d2 >= d1) {
        collectionDays.push(Math.round((d2 - d1) / 86400000));
      }
      continue;
    }
    const dueBal = Math.max(0, inv.balanceDue ?? inv.total - inv.amountPaid);
    if (dueBal <= 0) continue;
    totalOutstanding += dueBal;

    const dueDt = new Date(inv.dueDate);
    const diffDays = Math.floor((now.getTime() - dueDt.getTime()) / 86400000);

    if (diffDays <= 0) {
      buckets.notDue += dueBal;
      if (dueDt.getTime() <= weekAhead.getTime()) {
        dueThisWeek += dueBal;
      }
    } else {
      overdueAmount += dueBal;
      if (diffDays <= 30) buckets.days1To30 += dueBal;
      else if (diffDays <= 60) buckets.days31To60 += dueBal;
      else if (diffDays <= 90) buckets.days61To90 += dueBal;
      else buckets.over90 += dueBal;
    }
  }

  const avgCollectionPeriodDays =
    collectionDays.length > 0
      ? Math.round(collectionDays.reduce((s, d) => s + d, 0) / collectionDays.length)
      : null;

  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    dueThisWeek: Math.round(dueThisWeek * 100) / 100,
    expectedCollections: Math.round((totalOutstanding - buckets.over90) * 100) / 100,
    avgCollectionPeriodDays,
    agingBuckets: {
      notDue: Math.round(buckets.notDue * 100) / 100,
      days1To30: Math.round(buckets.days1To30 * 100) / 100,
      days31To60: Math.round(buckets.days31To60 * 100) / 100,
      days61To90: Math.round(buckets.days61To90 * 100) / 100,
      over90: Math.round(buckets.over90 * 100) / 100,
    },
  };
}

export function runDeterministicReconciliation(input: {
  invoices: Invoice[];
  transactions: Transaction[];
  expenses: BusinessExpense[];
}) {
  const matchedRecords: Array<{
    invoiceOrExpenseId: string;
    transactionId: string;
    label: string;
    amount: number;
    confidence: number;
    verifiedByUser: boolean;
  }> = [];
  const matchedTxIds = new Set<string>();
  const matchedInvIds = new Set<string>();
  const exceptions: Array<{
    id: string;
    type:
      | 'POSSIBLE_MISSING_INVOICE'
      | 'UNMATCHED_PAYMENT'
      | 'DUPLICATE_INVOICE'
      | 'GST_MISMATCH'
      | 'AMOUNT_MISMATCH'
      | 'OUTSTANDING_PAYMENT';
    description: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    verifiedByUser: boolean;
  }> = [];

  const incomeTxs = input.transactions.filter(t => t.type === 'INCOME' && !isDoubleCountExcluded(t));
  for (const inv of input.invoices) {
    const exactMatch = incomeTxs.find(
      t => !matchedTxIds.has(t.id) && Math.abs(t.amount - inv.total) <= 1
    );
    if (exactMatch) {
      matchedTxIds.add(exactMatch.id);
      matchedInvIds.add(inv.id);
      matchedRecords.push({
        invoiceOrExpenseId: inv.id,
        transactionId: exactMatch.id,
        label: `${inv.invoiceNumber} ↔ ${exactMatch.merchant || exactMatch.description}`,
        amount: inv.total,
        confidence: 95,
        verifiedByUser: false,
      });
    } else if (inv.status !== 'PAID') {
      exceptions.push({
        id: `exc-inv-${inv.id}`,
        type: 'OUTSTANDING_PAYMENT',
        description: `Invoice ${inv.invoiceNumber} (${inv.clientName}) has ₹${Math.round(inv.balanceDue).toLocaleString('en-IN')} unpaid with no matched bank credit.`,
        severity: inv.status === 'OVERDUE' ? 'HIGH' : 'MEDIUM',
        verifiedByUser: false,
      });
    }
  }

  // Detect duplicate invoice numbers
  const seenInvNums = new Set<string>();
  for (const inv of input.invoices) {
    if (seenInvNums.has(inv.invoiceNumber)) {
      exceptions.push({
        id: `exc-dup-${inv.id}`,
        type: 'DUPLICATE_INVOICE',
        description: `Duplicate invoice number detected: ${inv.invoiceNumber}.`,
        severity: 'HIGH',
        verifiedByUser: false,
      });
    }
    seenInvNums.add(inv.invoiceNumber);
  }

  const unmatchedRecords: Array<{
    recordId: string;
    recordType: 'INVOICE' | 'TRANSACTION' | 'EXPENSE';
    label: string;
    amount: number;
    date: string;
  }> = [];

  for (const t of incomeTxs) {
    if (!matchedTxIds.has(t.id)) {
      unmatchedRecords.push({
        recordId: t.id,
        recordType: 'TRANSACTION',
        label: t.description,
        amount: t.amount,
        date: t.transactionDate,
      });
      exceptions.push({
        id: `exc-tx-${t.id}`,
        type: 'UNMATCHED_PAYMENT',
        description: `Bank credit of ₹${Math.round(t.amount).toLocaleString('en-IN')} (${t.merchant || t.description}) has no matching business invoice.`,
        severity: 'MEDIUM',
        verifiedByUser: false,
      });
    }
  }

  for (const inv of input.invoices) {
    if (!matchedInvIds.has(inv.id)) {
      unmatchedRecords.push({
        recordId: inv.id,
        recordType: 'INVOICE',
        label: `${inv.invoiceNumber} · ${inv.clientName}`,
        amount: inv.total,
        date: inv.invoiceDate,
      });
    }
  }

  return { matchedRecords, unmatchedRecords, exceptions };
}

export function inspectFraudSignals(text: string) {
  const urls = Array.from(text.matchAll(/https?:\/\/[^\s"'<>]+/gi)).map(m => m[0]);
  const parsedDomains: Array<{ url: string; hostname: string; lookalikeWarning?: string }> = [];

  const knownBrands = ['sbi', 'hdfc', 'icici', 'axis', 'kotak', 'npci', 'paytm', 'phonepe', 'gpay', 'incometax'];
  const officialHosts = ['sbi.co.in', 'onlinesbi.sbi', 'hdfcbank.com', 'icicibank.com', 'axisbank.com', 'npci.org.in', 'incometax.gov.in'];

  for (const rawUrl of urls) {
    try {
      const u = new URL(rawUrl);
      const host = u.hostname.toLowerCase();
      let lookalikeWarning: string | undefined;
      if (!officialHosts.some(oh => host === oh || host.endsWith(`.${oh}`))) {
        const brandHit = knownBrands.find(b => host.includes(b));
        if (brandHit) {
          lookalikeWarning = `Domain "${host}" mentions "${brandHit}" but is not an official ${brandHit.toUpperCase()} domain.`;
        } else if (/\.(top|xyz|tk|click|zip|loan|online)$/.test(host) || host.startsWith('xn--')) {
          lookalikeWarning = `High-risk or obfuscated domain TLD detected (${host}).`;
        }
      }
      parsedDomains.push({ url: rawUrl, hostname: host, lookalikeWarning });
    } catch {
      parsedDomains.push({ url: rawUrl, hostname: 'invalid-url', lookalikeWarning: 'Malformed URL structure.' });
    }
  }

  const evidence: string[] = [];
  if (/upi\s*pin|enter\s*pin|receive\s*(money|prize|cashback).*pin/i.test(text)) {
    evidence.push('Requests UPI PIN under the pretext of receiving money or rewards (a PIN only authorizes outgoing payments).');
  }
  if (/kyc|pan\s*update|account\s*(suspend|block|freeze)/i.test(text)) {
    evidence.push('Uses urgent KYC or account-suspension threat to induce panic.');
  }
  if (/lottery|prize|reward|won\s*₹|claim\s*now/i.test(text)) {
    evidence.push('Promises unsolicited lottery, cashback, or prize money.');
  }
  if (/immediately|today\s*only|within\s*\d+\s*(min|hour)|9:30\s*pm|disconnect/i.test(text)) {
    evidence.push('Creates artificial time urgency to bypass verification.');
  }
  if (/otp|cvv|netbanking\s*password/i.test(text)) {
    evidence.push('Solicits confidential OTP, CVV, or banking password.');
  }
  parsedDomains.forEach(d => {
    if (d.lookalikeWarning) evidence.push(d.lookalikeWarning);
  });

  return { urls: parsedDomains, deterministicEvidence: evidence };
}
