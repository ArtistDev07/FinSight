import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDoubleCountExcluded,
  classifyInboxTransaction,
  computeFinancialHealthSummary,
  computeCreditCardSummary,
  simulateCreditCardPayment,
  computeDebtPayoffSchedule,
  buildCashFlowRadar,
  detectRecurringPayments,
  computeGoalProjection,
  computePortfolioRiskAnalytics,
  computeReceivablesAging,
  runDeterministicReconciliation,
  inspectFraudSignals,
} from './financialIntelligence';
import type { Transaction, Holding, CreditCard, MoneyGoal, Invoice } from '../types';

test('FinSight 2.0 Deterministic Financial Intelligence Engines', async (t) => {
  await t.test('Double-count exclusion & Money Inbox transaction classification', () => {
    assert.equal(isDoubleCountExcluded({ isInternalTransfer: true }), true);
    assert.equal(isDoubleCountExcluded({ isCreditCardSettlement: true }), true);
    assert.equal(isDoubleCountExcluded({ inboxStatus: 'IGNORED' }), true);
    assert.equal(isDoubleCountExcluded({ inboxStatus: 'DUPLICATE' }), true);
    assert.equal(isDoubleCountExcluded({ inboxStatus: 'CATEGORIZED' }), false);

    const ccSettle = classifyInboxTransaction({
      description: 'CRED Pay HDFC Credit Card Bill',
      amount: 18500,
      type: 'EXPENSE',
    });
    assert.equal(ccSettle.isCreditCardSettlement, true);
    assert.equal(ccSettle.category, 'Credit Card Payment');
    assert.equal(ccSettle.inboxStatus, 'CATEGORIZED');

    const selfTransfer = classifyInboxTransaction({
      description: 'NEFT Self Transfer to Savings',
      amount: 25000,
      type: 'EXPENSE',
    });
    assert.equal(selfTransfer.isInternalTransfer, true);
    assert.equal(selfTransfer.category, 'Transfer');

    const food = classifyInboxTransaction({
      description: 'Swiggy Order #9912',
      merchant: 'Swiggy',
      amount: 420,
      type: 'EXPENSE',
    });
    assert.equal(food.category, 'Food & Dining');
    assert.ok(food.confidence >= 85);

    const matchedPrev = classifyInboxTransaction(
      { description: 'Local Kirana Mart', merchant: 'Kirana Mart', amount: 850, type: 'EXPENSE' },
      [
        {
          id: 'tx-prev',
          ownerId: 'u1',
          description: 'Kirana Mart',
          merchant: 'Kirana Mart',
          amount: 600,
          currency: 'INR',
          type: 'EXPENSE',
          category: 'Groceries',
          account: 'UPI',
          transactionDate: '2026-03-01',
          source: 'MANUAL',
          inboxStatus: 'CATEGORIZED',
          createdAt: '2026-03-01T00:00:00Z',
        },
      ]
    );
    assert.equal(matchedPrev.category, 'Groceries');
    assert.equal(matchedPrev.confidence, 94);
  });

  await t.test('Financial Health Composite Score excludes transfers & card settlements', () => {
    const txs: Transaction[] = [
      {
        id: 't1',
        ownerId: 'u1',
        description: 'Monthly Salary',
        merchant: 'TechCorp',
        amount: 100000,
        currency: 'INR',
        type: 'INCOME',
        category: 'Salary',
        account: 'NEFT',
        transactionDate: '2026-03-01',
        source: 'MANUAL',
        createdAt: '2026-03-01T00:00:00Z',
      },
      {
        id: 't2',
        ownerId: 'u1',
        description: 'House Rent',
        merchant: 'Owner',
        amount: 30000,
        currency: 'INR',
        type: 'EXPENSE',
        category: 'Housing & Utilities',
        account: 'UPI',
        transactionDate: '2026-03-02',
        source: 'MANUAL',
        createdAt: '2026-03-02T00:00:00Z',
      },
      {
        id: 't3',
        ownerId: 'u1',
        description: 'HDFC Credit Card Bill',
        merchant: 'HDFC Card',
        amount: 20000,
        currency: 'INR',
        type: 'EXPENSE',
        category: 'Credit Card Payment',
        account: 'NEFT',
        transactionDate: '2026-03-05',
        source: 'MANUAL',
        isCreditCardSettlement: true,
        createdAt: '2026-03-05T00:00:00Z',
      },
      {
        id: 't4',
        ownerId: 'u1',
        description: 'Self transfer to Savings',
        merchant: 'Self',
        amount: 15000,
        currency: 'INR',
        type: 'EXPENSE',
        category: 'Transfer',
        account: 'IMPS',
        transactionDate: '2026-03-06',
        source: 'MANUAL',
        isInternalTransfer: true,
        createdAt: '2026-03-06T00:00:00Z',
      },
    ];

    const holdings: Holding[] = [
      {
        id: 'h1',
        portfolioId: 'p1',
        ownerId: 'u1',
        instrumentName: 'Nifty 50 Index Fund',
        instrumentSymbol: 'NIFTYBEES',
        assetType: 'Index Funds',
        quantity: 100,
        purchasePrice: 200,
        currentPrice: 250,
        purchaseDate: '2025-01-01',
        currency: 'INR',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'h2',
        portfolioId: 'p1',
        ownerId: 'u1',
        instrumentName: 'FD Reserve',
        instrumentSymbol: 'HDFCFD',
        assetType: 'Fixed Deposits',
        quantity: 1,
        purchasePrice: 100000,
        currentPrice: 100000,
        purchaseDate: '2025-01-01',
        currency: 'INR',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const cards: CreditCard[] = [
      {
        id: 'c1',
        ownerId: 'u1',
        nickname: 'HDFC Regalia',
        issuer: 'HDFC',
        lastFourDigits: '4321',
        creditLimit: 200000,
        currentBalance: 20000,
        minimumDue: 1000,
        statementDate: 1,
        dueDate: 18,
        annualInterestRate: 36,
        reminderPreference: '3_DAYS_BEFORE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const goals: MoneyGoal[] = [
      {
        id: 'g1',
        ownerId: 'u1',
        title: 'Emergency Buffer',
        category: 'Emergency Fund',
        targetAmount: 180000,
        currentAmount: 120000,
        targetDate: '2026-12-31',
        monthlyContribution: 10000,
        priority: 'HIGH',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];

    const summary = computeFinancialHealthSummary({
      transactions: txs,
      holdings,
      creditCards: cards,
      goals,
      manualItems: [{ id: 'm1', ownerId: 'u1', name: 'Personal Gold Bond', kind: 'ASSET', category: 'Gold', amount: 40000, included: true, createdAt: '2026-01-01T00:00:00Z' }],
      openingCashBalance: 30000,
    });

    assert.equal(summary.monthlyIncome, 100000);
    assert.equal(summary.monthlyExpenses, 30000);
    assert.equal(summary.monthlySavings, 70000);
    assert.equal(summary.savingsRate, 70);
    assert.equal(summary.totalAssets, 315000);
    assert.equal(summary.totalLiabilities, 20000);
    assert.equal(summary.estimatedNetWorth, 295000);
    assert.equal(summary.dimensions.length, 5);
    assert.ok(summary.compositeIndex >= 60 && summary.compositeIndex <= 100);
  });

  await t.test('Credit Card Summary, Payment Simulator & Avalanche vs Snowball Payoff', () => {
    const cards: CreditCard[] = [
      {
        id: 'c1',
        ownerId: 'u1',
        nickname: 'Card A',
        issuer: 'HDFC',
        lastFourDigits: '1111',
        creditLimit: 100000,
        currentBalance: 40000,
        minimumDue: 2000,
        statementDate: 1,
        dueDate: 18,
        annualInterestRate: 42,
        reminderPreference: '3_DAYS_BEFORE',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'c2',
        ownerId: 'u1',
        nickname: 'Card B',
        issuer: 'ICICI',
        lastFourDigits: '2222',
        creditLimit: 100000,
        currentBalance: 10000,
        minimumDue: 500,
        statementDate: 5,
        dueDate: 22,
        annualInterestRate: 18,
        reminderPreference: '3_DAYS_BEFORE',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const summary = computeCreditCardSummary(cards);
    assert.equal(summary.totalOutstandingBalance, 50000);
    assert.equal(summary.totalCreditLimit, 200000);
    assert.equal(summary.overallUtilizationPct, 25);

    const sim = simulateCreditCardPayment({ balance: 50000, annualInterestRate: 36, extraMonthlyPayment: 5000 });
    assert.equal(sim.fullPay.totalInterest, 0);
    assert.ok(sim.withExtra.months < sim.minimumOnly.months);
    assert.ok(sim.withExtra.totalInterest < sim.minimumOnly.totalInterest);

    const avalanche = computeDebtPayoffSchedule(
      [
        { id: 'd1', name: 'High APR Card', balance: 40000, annualInterestRate: 42, minimumPayment: 2000 },
        { id: 'd2', name: 'Small Balance Loan', balance: 12000, annualInterestRate: 14, minimumPayment: 1000 },
      ],
      8000,
      'AVALANCHE'
    );
    const snowball = computeDebtPayoffSchedule(
      [
        { id: 'd1', name: 'High APR Card', balance: 40000, annualInterestRate: 42, minimumPayment: 2000 },
        { id: 'd2', name: 'Small Balance Loan', balance: 12000, annualInterestRate: 14, minimumPayment: 1000 },
      ],
      8000,
      'SNOWBALL'
    );
    assert.ok(avalanche.totalInterest <= snowball.totalInterest);
    assert.equal(snowball.payoffOrder[0], 'Small Balance Loan');
  });

  await t.test('Cash Flow Radar detects shortfall dates and ignores PAID events', () => {
    const radar = buildCashFlowRadar({
      openingBalance: 10000,
      horizonDays: 30,
      referenceDate: '2026-04-01',
      whatIfExtraExpense: 2000,
      events: [
        {
          id: 'e1',
          ownerId: 'u1',
          title: 'Paid Utility',
          eventType: 'BILL',
          dueDate: '2026-04-03',
          amount: 5000,
          direction: 'OUTFLOW',
          recurrence: 'ONCE',
          reminderPreference: 'NONE',
          status: 'PAID',
          createdAt: '',
        },
        {
          id: 'e2',
          ownerId: 'u1',
          title: 'Rent Due',
          eventType: 'BILL',
          dueDate: '2026-04-05',
          amount: 12000,
          direction: 'OUTFLOW',
          recurrence: 'MONTHLY',
          reminderPreference: '3_DAYS_BEFORE',
          status: 'UPCOMING',
          createdAt: '',
        },
        {
          id: 'e3',
          ownerId: 'u1',
          title: 'Client Settlement',
          eventType: 'INVOICE_DUE',
          dueDate: '2026-04-10',
          amount: 20000,
          direction: 'INFLOW',
          recurrence: 'ONCE',
          reminderPreference: 'NONE',
          status: 'UPCOMING',
          createdAt: '',
        },
      ],
    });

    assert.equal(radar.expectedInflows, 20000);
    assert.equal(radar.expectedOutflows, 14000);
    assert.equal(radar.projectedClosingBalance, 16000);
    assert.equal(radar.shortfallDates.length, 1);
    assert.equal(radar.shortfallDates[0].eventTitle, 'Rent Due');
    assert.equal(radar.shortfallDates[0].projectedBalance, -4000);
  });

  await t.test('Recurring payment detector, Goal projection & Portfolio Risk analytics', () => {
    const detected = detectRecurringPayments(
      [
        {
          id: 'r1',
          ownerId: 'u1',
          description: 'Netflix India',
          merchant: 'Netflix',
          amount: 649,
          currency: 'INR',
          type: 'EXPENSE',
          category: 'Subscriptions',
          account: 'Card',
          transactionDate: '2026-02-10',
          source: 'MANUAL',
          createdAt: '',
        },
        {
          id: 'r2',
          ownerId: 'u1',
          description: 'Netflix India',
          merchant: 'Netflix',
          amount: 649,
          currency: 'INR',
          type: 'EXPENSE',
          category: 'Subscriptions',
          account: 'Card',
          transactionDate: '2026-03-12',
          source: 'MANUAL',
          createdAt: '',
        },
      ],
      [],
      'u1'
    );
    assert.equal(detected.length, 1);
    assert.equal(detected[0].frequency, 'MONTHLY');
    assert.equal(detected[0].estimatedAmount, 649);

    const proj = computeGoalProjection(
      { targetAmount: 100000, currentAmount: 40000, targetDate: '2027-03-01', monthlyContribution: 5000 },
      5000
    );
    assert.equal(proj.remainingAmount, 60000);
    assert.equal(proj.progressPct, 40);
    assert.equal(proj.estimatedMonthsToComplete, 6);

    const risk = computePortfolioRiskAnalytics([
      {
        id: 'h1',
        portfolioId: 'p1',
        ownerId: 'u1',
        instrumentName: 'TCS',
        instrumentSymbol: 'TCS',
        assetType: 'Equity',
        quantity: 20,
        purchasePrice: 3500,
        currentPrice: 4000,
        purchaseDate: '2025-01-01',
        currency: 'INR',
        updatedAt: '',
      },
      {
        id: 'h2',
        portfolioId: 'p1',
        ownerId: 'u1',
        instrumentName: 'SBI Liquid',
        instrumentSymbol: 'LIQUIDBEES',
        assetType: 'Cash and Other Assets',
        quantity: 20,
        purchasePrice: 1000,
        currentPrice: 1000,
        purchaseDate: '2025-01-01',
        currency: 'INR',
        updatedAt: '',
      },
    ]);
    assert.equal(risk.totalValue, 100000);
    assert.equal(risk.topHoldingConcentrationPct, 80);
    assert.equal(risk.tenPctShockImpact, -10000);
    assert.equal(risk.shockedPortfolioValue, 90000);
  });

  await t.test('Receivables Aging, Ledger Reconciliation & Fraud Signal Inspector', () => {
    const invoices: Invoice[] = [
      {
        id: 'inv1',
        ownerId: 'u1',
        clientId: 'cli-1',
        invoiceNumber: 'INV-001',
        clientName: 'Alpha Co',
        invoiceDate: '2026-01-01',
        dueDate: '2026-01-20',
        placeOfSupply: '29 - Karnataka',
        lineItems: [],
        subtotal: 10000,
        cgst: 900,
        sgst: 900,
        igst: 0,
        totalGst: 1800,
        total: 11800,
        amountPaid: 0,
        balanceDue: 11800,
        status: 'OVERDUE',
        createdAt: '',
      },
      {
        id: 'inv2',
        ownerId: 'u1',
        clientId: 'cli-2',
        invoiceNumber: 'INV-002',
        clientName: 'Beta Co',
        invoiceDate: '2026-03-25',
        dueDate: '2026-04-04',
        placeOfSupply: '29 - Karnataka',
        lineItems: [],
        subtotal: 20000,
        cgst: 1800,
        sgst: 1800,
        igst: 0,
        totalGst: 3600,
        total: 23600,
        amountPaid: 0,
        balanceDue: 23600,
        status: 'UNPAID',
        createdAt: '',
      },
    ];

    const aging = computeReceivablesAging(invoices, '2026-04-01');
    assert.equal(aging.totalOutstanding, 35400);
    assert.equal(aging.overdueAmount, 11800);
    assert.equal(aging.agingBuckets.days61To90, 11800);
    assert.equal(aging.dueThisWeek, 23600);

    const recon = runDeterministicReconciliation({
      invoices,
      transactions: [
        {
          id: 'tx-match',
          ownerId: 'u1',
          description: 'NEFT Beta Co Invoice 002',
          merchant: 'Beta Co',
          amount: 23600,
          currency: 'INR',
          type: 'INCOME',
          category: 'Business Income',
          account: 'NEFT',
          transactionDate: '2026-03-29',
          source: 'MANUAL',
          createdAt: '',
        },
        {
          id: 'tx-unmatched',
          ownerId: 'u1',
          description: 'Unknown Credit',
          merchant: 'Mystery Sender',
          amount: 5500,
          currency: 'INR',
          type: 'INCOME',
          category: 'Other',
          account: 'IMPS',
          transactionDate: '2026-03-30',
          source: 'MANUAL',
          createdAt: '',
        },
      ],
      expenses: [],
    });
    assert.equal(recon.matchedRecords.length, 1);
    assert.equal(recon.matchedRecords[0].invoiceOrExpenseId, 'inv2');
    assert.ok(recon.exceptions.some(e => e.type === 'OUTSTANDING_PAYMENT'));
    assert.ok(recon.exceptions.some(e => e.type === 'UNMATCHED_PAYMENT'));

    const fraud = inspectFraudSignals(
      'URGENT: SBI KYC suspended! Click https://sbi-kyc-verify.top/login and enter OTP & UPI PIN to receive ₹5000 cashback.'
    );
    assert.equal(fraud.urls.length, 1);
    assert.ok(fraud.urls[0].lookalikeWarning);
    assert.ok(fraud.deterministicEvidence.length >= 3);
  });
});
