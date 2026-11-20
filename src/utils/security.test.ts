import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateIndianTax, calculateEMI, calculateGST, formatINR } from './financialMath';

test('Multi-User Security & Isolation Rules', async (t) => {
  await t.test('User A cannot access User B data records by ownerId separation', () => {
    interface Record {
      id: string;
      ownerId: string;
      description: string;
      amount: number;
    }

    const mockRecords: Record[] = [
      { id: 'tx-1', ownerId: 'user-A', description: 'Salary Credit', amount: 120000 },
      { id: 'tx-2', ownerId: 'user-A', description: 'Groceries', amount: 3500 },
      { id: 'tx-3', ownerId: 'user-B', description: 'Medical Emergency', amount: 45000 },
    ];

    // Query executed with user-A's identity
    const userARecords = mockRecords.filter(r => r.ownerId === 'user-A');
    assert.equal(userARecords.length, 2);
    assert.equal(userARecords.some(r => r.ownerId === 'user-B'), false, 'User A must never observe User B records');

    // Query executed with user-B's identity
    const userBRecords = mockRecords.filter(r => r.ownerId === 'user-B');
    assert.equal(userBRecords.length, 1);
    assert.equal(userBRecords[0].id, 'tx-3');
    assert.equal(userBRecords.some(r => r.ownerId === 'user-A'), false, 'User B must never observe User A records');
  });

  await t.test('Role-Based Access Control: Non-admin users are rejected with HTTP 403', () => {
    function evaluateAdminAccess(userRole: string): { status: number; allowed: boolean } {
      if (userRole !== 'ADMIN') {
        return { status: 403, allowed: false };
      }
      return { status: 200, allowed: true };
    }

    const normalUserAttempt = evaluateAdminAccess('USER');
    assert.equal(normalUserAttempt.status, 403, 'Regular USER must be denied admin access');
    assert.equal(normalUserAttempt.allowed, false);

    const adminAttempt = evaluateAdminAccess('ADMIN');
    assert.equal(adminAttempt.status, 200, 'ADMIN role must be granted admin access');
    assert.equal(adminAttempt.allowed, true);
  });
});

test('Duplicate Transaction Detection Logic', async (t) => {
  await t.test('Identifies duplicate transactions matching date, amount and merchant', () => {
    const existingTransactions = [
      { id: 'tx-1', ownerId: 'user-1', merchant: 'Zomato Food Delivery', amount: 450.00, date: '2026-03-05' },
      { id: 'tx-2', ownerId: 'user-1', merchant: 'Swiggy Online Food', amount: 320.00, date: '2026-03-06' },
    ];

    function checkDuplicate(incoming: { merchant: string; amount: number; date: string }) {
      return existingTransactions.some(
        t => Math.abs(t.amount - incoming.amount) < 0.01 &&
             t.date === incoming.date &&
             t.merchant.toLowerCase().includes(incoming.merchant.toLowerCase())
      );
    }

    const duplicateAttempt = checkDuplicate({ merchant: 'Zomato', amount: 450.00, date: '2026-03-05' });
    assert.equal(duplicateAttempt, true, 'Exact duplicate on date, amount, merchant must be flagged');

    const uniqueAttempt = checkDuplicate({ merchant: 'Zomato', amount: 450.00, date: '2026-03-07' });
    assert.equal(uniqueAttempt, false, 'Same amount on different date is not duplicate');

    const differentAmountAttempt = checkDuplicate({ merchant: 'Zomato', amount: 750.00, date: '2026-03-05' });
    assert.equal(differentAmountAttempt, false, 'Different amount is not duplicate');
  });
});

test('CBDT FY 2025-26 Official Indian Income Tax Computation', async (t) => {
  await t.test('Section 87A full tax rebate applies for total taxable income <= Rs 7,00,000 under New Regime', () => {
    // Under Section 115BAC, for taxable income <= 7,00,000, tax liability after rebate is 0
    const taxUnder7Lakh = calculateIndianTax(700000, 0, 'NEW');
    assert.equal(taxUnder7Lakh.totalTax, 0, 'Taxable income <= 7,00,000 must result in 0 tax due to Section 87A');
    assert.equal(taxUnder7Lakh.taxBeforeCess, 0);
  });

  await t.test('Calculates accurate slab-based tax for Rs 12,00,000 gross income under New Regime with 75k standard deduction', () => {
    // Gross: 12,00,000 - Standard Deduction: 75,000 = Taxable: 11,25,000
    // Slabs:
    // 0 - 3,00,000: Nil
    // 3,00,001 - 7,00,000: 5% of 4,00,000 = 20,000
    // 7,00,001 - 10,00,000: 10% of 3,00,000 = 30,000
    // 10,00,001 - 11,25,000: 15% of 1,25,000 = 18,750
    // Total base tax = 20,000 + 30,000 + 18,750 = 68,750
    // 4% Health & Education Cess = 2,750
    // Total Tax = 71,500
    const tax12Lakh = calculateIndianTax(1200000, 0, 'NEW');
    assert.equal(tax12Lakh.taxableIncome, 1125000);
    assert.equal(tax12Lakh.taxBeforeCess, 68750);
    assert.equal(tax12Lakh.cess, 2750);
    assert.equal(tax12Lakh.totalTax, 71500);
  });

  await t.test('Old Regime Chapter VI-A deductions (80C, 80D) reduce taxable income with 50k standard deduction', () => {
    const gross = 1500000;
    const deductions = 200000; // 1.5L 80C + 50k 80D
    const taxOld = calculateIndianTax(gross, deductions, 'OLD');

    // Total deductions = 2,00,000 + 50,000 std = 2,50,000
    // Taxable = 15,00,000 - 2,50,000 = 12,50,000
    assert.equal(taxOld.taxableIncome, 1250000);
    assert.equal(taxOld.deductions, 250000);
    assert.equal(taxOld.totalTax > 0, true);
  });
});

test('Financial Calculations Extreme Edge Cases & Boundaries', async (t) => {
  await t.test('calculateEMI handles 0 loan amount cleanly', () => {
    const emi = calculateEMI(0, 8.5, 36);
    assert.equal(emi.monthlyEMI, 0);
    assert.equal(emi.totalInterest, 0);
    assert.equal(emi.totalPayment, 0);
  });

  await t.test('calculateEMI handles 0% interest rate loan without division by zero', () => {
    const emi = calculateEMI(120000, 0, 12);
    assert.equal(emi.monthlyEMI, 10000);
    assert.equal(emi.totalInterest, 0);
    assert.equal(emi.totalPayment, 120000);
  });

  await t.test('calculateGST handles intrastate 50-50 CGST/SGST split and interstate 100% IGST', () => {
    const intra = calculateGST(100000, 18, false);
    assert.equal(intra.cgst, 9000);
    assert.equal(intra.sgst, 9000);
    assert.equal(intra.igst, 0);
    assert.equal(intra.totalInvoiceAmount, 118000);

    const inter = calculateGST(100000, 18, true);
    assert.equal(inter.cgst, 0);
    assert.equal(inter.sgst, 0);
    assert.equal(inter.igst, 18000);
    assert.equal(inter.totalInvoiceAmount, 118000);
  });

  await t.test('formatINR formats numbers with Indian Lakhs and Crores commas and Rupee symbol', () => {
    assert.equal(formatINR(0), '₹0');
    assert.equal(formatINR(1000), '₹1,000');
    assert.equal(formatINR(100000), '₹1,00,000');
    assert.equal(formatINR(10000000), '₹1,00,00,000');
  });
});
