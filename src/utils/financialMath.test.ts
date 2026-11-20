import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBudgetMetrics,
  calculateHoldingValuation,
  calculateEMI,
  calculateGST,
  calculateIndianTax,
  formatINR,
  simulateStrategyBacktest,
} from './financialMath.ts';

test('calculateBudgetMetrics computes totals and savings rate correctly', () => {
  const transactions: Array<{ amount: number; type: 'INCOME' | 'EXPENSE' }> = [
    { amount: 50000, type: 'INCOME' },
    { amount: 15000, type: 'EXPENSE' },
    { amount: 5000, type: 'EXPENSE' },
  ];
  const metrics = calculateBudgetMetrics(transactions, 25000);

  assert.equal(metrics.totalIncome, 50000);
  assert.equal(metrics.totalExpenses, 20000);
  assert.equal(metrics.savings, 30000);
  assert.equal(metrics.savingsRate, 60.0);
  assert.equal(metrics.remainingBudget, 5000);
});

test('calculateBudgetMetrics handles boundary condition of zero income & empty transactions', () => {
  const emptyMetrics = calculateBudgetMetrics([], 10000);
  assert.equal(emptyMetrics.totalIncome, 0);
  assert.equal(emptyMetrics.totalExpenses, 0);
  assert.equal(emptyMetrics.savings, 0);
  assert.equal(emptyMetrics.savingsRate, 0);
  assert.equal(emptyMetrics.remainingBudget, 10000);
});

test('calculateHoldingValuation calculates cost basis, gains and boundary conditions', () => {
  const valuation = calculateHoldingValuation(10, 2500, 3000);
  assert.equal(valuation.costBasis, 25000);
  assert.equal(valuation.estimatedValue, 30000);
  assert.equal(valuation.unrealizedGainLoss, 5000);
  assert.equal(valuation.returnPercentage, 20.0);

  // Negative return (unrealized loss)
  const lossValuation = calculateHoldingValuation(100, 50, 40);
  assert.equal(lossValuation.costBasis, 5000);
  assert.equal(lossValuation.estimatedValue, 4000);
  assert.equal(lossValuation.unrealizedGainLoss, -1000);
  assert.equal(lossValuation.returnPercentage, -20.0);
});

test('calculateEMI computes reducing balance correctly for zero, positive, and large loans', () => {
  // Zero interest loan
  const zeroRate = calculateEMI(120000, 0, 12);
  assert.equal(zeroRate.monthlyEMI, 10000);
  assert.equal(zeroRate.totalInterest, 0);

  // Standard loan 10L at 8.5% for 60 months
  const standard = calculateEMI(1000000, 8.5, 60);
  assert.ok(standard.monthlyEMI > 20000 && standard.monthlyEMI < 21000);
  assert.ok(standard.totalInterest > 200000);
  assert.equal(standard.amortizationSchedule.length, 60);

  // Boundary check: zero principal or negative months
  assert.equal(calculateEMI(0, 10, 12).monthlyEMI, 0);
  assert.equal(calculateEMI(10000, 10, 0).monthlyEMI, 0);
});

test('calculateGST splits CGST/SGST intrastate and IGST interstate correctly with rounding', () => {
  const intra = calculateGST(10000, 18, false);
  assert.equal(intra.taxableAmount, 10000);
  assert.equal(intra.cgst, 900);
  assert.equal(intra.sgst, 900);
  assert.equal(intra.igst, 0);
  assert.equal(intra.totalInvoiceAmount, 11800);

  const inter = calculateGST(10000, 18, true);
  assert.equal(inter.igst, 1800);
  assert.equal(inter.cgst, 0);
  assert.equal(inter.sgst, 0);
  assert.equal(inter.totalInvoiceAmount, 11800);

  // Boundary zero
  const zeroGst = calculateGST(0, 18, false);
  assert.equal(zeroGst.totalInvoiceAmount, 0);
});

test('calculateIndianTax handles rebates and slabs for new regime and old regime', () => {
  // Below 7 Lakhs in new regime should be tax free with Section 87A rebate
  const lowIncome = calculateIndianTax(600000, 0, 'NEW');
  assert.equal(lowIncome.totalTax, 0);

  // 12 Lakhs income in new regime
  const highIncome = calculateIndianTax(1200000, 0, 'NEW');
  assert.ok(highIncome.totalTax > 0);
  assert.equal(highIncome.deductions, 75000); // Salaried standard deduction in FY 25-26

  // Old Regime with Section 80C deductions (1.5 Lakhs)
  const oldRegime = calculateIndianTax(1200000, 150000, 'OLD');
  assert.equal(oldRegime.deductions, 200000); // 50k standard deduction + 1.5L 80C
  assert.ok(oldRegime.totalTax > 0);
});

test('simulateStrategyBacktest outputs valid win rate and drawdown bounds', () => {
  const res = simulateStrategyBacktest(500000, 3.5, 8.0, 'Moving Average Crossover');
  assert.ok(res.winRatePct >= 40 && res.winRatePct <= 85);
  assert.ok(res.tradeCount > 0);
  assert.ok(res.maximumDrawdownPct > 0);
  assert.ok(res.finalCapital > 0);
});

test('formatINR formats numbers in Indian numbering system with negative and boundary cases', () => {
  assert.equal(formatINR(123456.78), '₹1,23,456.78');
  assert.equal(formatINR(10000000), '₹1,00,00,000');
  assert.equal(formatINR(500), '₹500');
  assert.equal(formatINR(-45000), '-₹45,000');
  assert.equal(formatINR(0), '₹0');
});
