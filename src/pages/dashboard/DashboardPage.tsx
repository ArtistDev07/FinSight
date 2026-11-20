import React, { useEffect, useState, useCallback } from 'react';
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Plus,
  Upload,
  ShieldCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { formatINR } from '../../utils/financialMath';
import { useAuth } from '../../contexts/AuthContext';
import { Transaction } from '../../types';
import { apiFetch, parseApiResponse } from '../../utils/api';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

interface DashboardSummaryData {
  metrics: {
    totalIncome: number;
    totalExpenses: number;
    savings: number;
    savingsRate: number;
    allocatedBudget: number;
    remainingBudget: number;
    activeGoals: number;
    portfolioValue: number;
    investedAmount: number;
    unrealizedGain: number;
    transactionCount: number;
  };
  recentTransactions: Transaction[];
}

interface CashFlowData {
  inflow: number;
  outflow: number;
  surplus: number;
  allocatedBudget: number;
  remainingBudget: number;
}

interface SpendingData {
  totalSpent: number;
  categories: Array<{ category: string; amount: number; percentage: number }>;
}

interface InsightItem {
  id: string;
  title: string;
  body: string;
  tone: 'positive' | 'warning' | 'info';
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenAI }) => {
  const { user, preferences } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryData | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
  const [spending, setSpending] = useState<SpendingData | null>(null);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, cfRes, spRes, insRes] = await Promise.all([
        apiFetch('/api/v1/dashboard/summary'),
        apiFetch('/api/v1/dashboard/cash-flow'),
        apiFetch('/api/v1/dashboard/spending'),
        apiFetch('/api/v1/dashboard/insights'),
      ]);

      const [sumJson, cfJson, spJson, insJson] = await Promise.all([
        sumRes.json(),
        cfRes.json(),
        spRes.json(),
        insRes.json(),
      ]);

      if (!sumRes.ok || !sumJson.success) {
        throw new Error(sumJson?.error?.message || 'Unable to load dashboard summary.');
      }

      setSummary(sumJson.data);
      if (cfJson.success) setCashFlow(cfJson.data);
      if (spJson.success) setSpending(spJson.data);
      if (insJson.success) setInsights(insJson.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRequestAiInsight = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiFetch('/api/v1/ai/module-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'Dashboard Overview',
          question: 'Summarize my current income, expense ratio, savings rate, and portfolio standing with 3 practical next steps.',
        }),
      });
      const parsed = await parseApiResponse<{ success: boolean; data?: { insight?: string } }>(res);
      if (!parsed.ok || !parsed.json?.data?.insight) {
        throw new Error(parsed.errorMessage || 'Gemini AI insight unavailable.');
      }
      setAiInsight(parsed.json.data.insight);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate AI insight.');
    } finally {
      setAiLoading(false);
    }
  };

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const m = summary?.metrics || {
    totalIncome: 0,
    totalExpenses: 0,
    savings: 0,
    savingsRate: 0,
    allocatedBudget: 0,
    remainingBudget: 0,
    activeGoals: 0,
    portfolioValue: 0,
    investedAmount: 0,
    unrealizedGain: 0,
    transactionCount: 0,
  };

  const inflow = cashFlow?.inflow ?? m.totalIncome;
  const outflow = cashFlow?.outflow ?? m.totalExpenses;
  const surplus = cashFlow?.surplus ?? m.savings;
  const maxBar = Math.max(inflow, outflow, Math.abs(surplus), 1);
  const outflowPct = Math.min(100, Math.round((outflow / maxBar) * 100));
  const surplusPct = surplus > 0 ? Math.min(100, Math.round((surplus / maxBar) * 100)) : 0;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#28443C] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7F5] tracking-tight">
            Welcome, {user?.fullName?.split(' ')[0] || 'Member'}
          </h1>
          <p className="text-xs text-[#A7C1B8] mt-1">
            Financial Year {preferences?.financialYear || '2025-26'} · Asia/Kolkata · Updated {currentDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/app/budgeting/import')}
            className="flex items-center gap-1.5 rounded-lg bg-[#16352E] border border-[#28443C] px-3.5 py-2 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0] transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import Statement</span>
          </button>
          <button
            onClick={() => onNavigate('/app/budgeting/transactions')}
            className="flex items-center gap-1.5 rounded-lg bg-[#A8E6CE] px-3.5 py-2 text-xs font-semibold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[#EB7676]/40 bg-[#EB7676]/10 p-4 flex items-center justify-between text-xs text-[#EB7676]">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadDashboard}
            className="flex items-center gap-1 rounded-lg border border-[#EB7676]/40 px-3 py-1 font-semibold hover:bg-[#EB7676]/20"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Four Key Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#718D83]">
            <span>Total Recorded Income</span>
            <span className="p-1.5 rounded-lg bg-[#16352E] text-[#55C99A]">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[#F5F7F5] tabular-nums">
            {loading ? '...' : formatINR(m.totalIncome)}
          </div>
          <div className="text-[11px] text-[#718D83]">
            From {m.transactionCount} tracked transaction{m.transactionCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#718D83]">
            <span>Total Expenses</span>
            <span className="p-1.5 rounded-lg bg-[#16352E] text-[#EB7676]">
              <ArrowDownRight className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[#F5F7F5] tabular-nums">
            {loading ? '...' : formatINR(m.totalExpenses)}
          </div>
          <div className="text-[11px] text-[#A7C1B8]">
            {m.allocatedBudget > 0
              ? `${Math.min(999, Math.round((m.totalExpenses / m.allocatedBudget) * 100))}% of allocated budget`
              : `${m.activeGoals} active budget${m.activeGoals === 1 ? '' : 's'}`}
          </div>
        </div>

        <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#718D83]">
            <span>Net Monthly Savings</span>
            <span className="p-1.5 rounded-lg bg-[#16352E] text-[#A8E6CE]">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <div className={`text-2xl font-bold tabular-nums ${m.savings >= 0 ? 'text-[#A8E6CE]' : 'text-[#EB7676]'}`}>
            {loading ? '...' : formatINR(m.savings)}
          </div>
          <div className="text-[11px] text-[#A7C1B8]">
            Savings rate: {loading ? '...' : `${m.savingsRate}%`}
          </div>
        </div>

        <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#718D83]">
            <span>Portfolio Value</span>
            <span className="p-1.5 rounded-lg bg-[#16352E] text-[#7BB9DC]">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-[#F5F7F5] tabular-nums">
            {loading ? '...' : formatINR(m.portfolioValue)}
          </div>
          <div className={`text-[11px] ${m.unrealizedGain >= 0 ? 'text-[#55C99A]' : 'text-[#EB7676]'}`}>
            Unrealized {m.unrealizedGain >= 0 ? 'gain' : 'loss'}: {loading ? '...' : formatINR(m.unrealizedGain)}
          </div>
        </div>
      </div>

      {/* Cash Flow & Spending Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#F5F7F5]">Your Cash Flow</h2>
              <p className="text-xs text-[#718D83]">Live inflow vs outflow from your recorded transactions</p>
            </div>
            <button
              onClick={() => onNavigate('/app/budgeting/insights')}
              className="text-xs font-semibold text-[#A8E6CE] hover:underline"
            >
              Detailed Insights →
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#A7C1B8]">Total Inflow (Income)</span>
                <span className="font-semibold text-[#55C99A] tabular-nums">{formatINR(inflow)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-[#0B1C19] overflow-hidden">
                <div className="h-full bg-[#55C99A] rounded-full transition-all" style={{ width: inflow > 0 ? `${Math.round((inflow / maxBar) * 100)}%` : '0%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#A7C1B8]">Total Outflow (Expenses)</span>
                <span className="font-semibold text-[#EB7676] tabular-nums">{formatINR(outflow)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-[#0B1C19] overflow-hidden">
                <div className="h-full bg-[#EB7676] rounded-full transition-all" style={{ width: `${outflowPct}%` }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#A7C1B8]">Net Surplus Retained</span>
                <span className="font-semibold text-[#A8E6CE] tabular-nums">{formatINR(surplus)}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-[#0B1C19] overflow-hidden">
                <div className="h-full bg-[#A8E6CE] rounded-full transition-all" style={{ width: `${surplusPct}%` }} />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0B1C19] border border-[#28443C] flex items-center justify-between text-xs">
            <span className="text-[#A7C1B8]">Remaining Allocated Budget:</span>
            <span className="font-bold text-[#F5F7F5] tabular-nums">
              {formatINR(m.remainingBudget)} of {formatINR(m.allocatedBudget)}
            </span>
          </div>
        </div>

        {/* Spending Breakdown */}
        <div className="lg:col-span-5 rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#F5F7F5]">Where Your Money Goes</h2>
            <span className="text-xs text-[#718D83]">Total: {formatINR(spending?.totalSpent || 0)}</span>
          </div>

          <div className="space-y-3 pt-2">
            {!spending || spending.categories.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#0B1C19] border border-[#28443C] text-center text-xs text-[#718D83]">
                No expense categories recorded yet. Add a transaction or import a bank statement to view your category breakdown.
              </div>
            ) : (
              spending.categories.slice(0, 5).map(item => (
                <div key={item.category} className="flex items-center justify-between text-xs py-1 border-b border-[#28443C]/50 last:border-0">
                  <span className="text-[#A7C1B8]">{item.category}</span>
                  <div className="text-right">
                    <div className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(item.amount)}</div>
                    <div className="text-[10px] text-[#718D83]">{item.percentage}%</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => onNavigate('/app/budgeting/budgets')}
            className="w-full text-center py-2 text-xs font-semibold text-[#A8E6CE] rounded-lg border border-[#28443C] hover:bg-[#16352E] transition-colors"
          >
            Manage Category Budgets
          </button>
        </div>
      </div>

      {/* Recent Activity & AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#F5F7F5]">Recent Activity</h2>
            <button
              onClick={() => onNavigate('/app/budgeting/transactions')}
              className="text-xs font-semibold text-[#A8E6CE] hover:underline"
            >
              View All ({m.transactionCount}) →
            </button>
          </div>

          <div className="overflow-x-auto">
            {(!summary?.recentTransactions || summary.recentTransactions.length === 0) ? (
              <div className="p-8 rounded-xl bg-[#0B1C19] border border-[#28443C] text-center space-y-3">
                <p className="text-xs text-[#718D83]">No transactions recorded yet under your account.</p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => onNavigate('/app/budgeting/transactions')}
                    className="rounded-lg bg-[#A8E6CE] px-3 py-1.5 text-xs font-bold text-[#0B1C19]"
                  >
                    Add Transaction
                  </button>
                  <button
                    onClick={() => onNavigate('/app/budgeting/import')}
                    className="rounded-lg border border-[#28443C] px-3 py-1.5 text-xs text-[#A8E6CE]"
                  >
                    Import Statement
                  </button>
                </div>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#28443C] text-[#718D83]">
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#28443C]/40">
                  {summary.recentTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-[#16352E]/30 transition-colors">
                      <td className="py-2.5 font-medium text-[#F5F7F5]">
                        <div className="truncate max-w-[180px]">{tx.description}</div>
                        <div className="text-[10px] text-[#718D83]">{tx.account}</div>
                      </td>
                      <td className="py-2.5 text-[#A7C1B8]">{tx.category}</td>
                      <td className="py-2.5 text-[#718D83] whitespace-nowrap">{tx.transactionDate}</td>
                      <td className={`py-2.5 text-right font-semibold tabular-nums whitespace-nowrap ${
                        tx.type === 'INCOME' ? 'text-[#55C99A]' : 'text-[#F5F7F5]'
                      }`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatINR(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Insights Card */}
        <div className="lg:col-span-5 rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#A8E6CE]" />
              <h2 className="text-base font-bold text-[#F5F7F5]">Insights for You</h2>
            </div>
            <span className="text-[11px] text-[#A8E6CE] font-mono">Gemini 4 Hydrogen</span>
          </div>

          <div className="space-y-3">
            {insights.map(item => (
              <div key={item.id} className="p-3.5 rounded-xl bg-[#0B1C19] border border-[#28443C] space-y-1.5">
                <div className="text-xs font-semibold text-[#F5F7F5]">{item.title}</div>
                <p className="text-[11px] text-[#A7C1B8] leading-relaxed">{item.body}</p>
              </div>
            ))}

            {aiInsight && (
              <div className="p-3.5 rounded-xl bg-[#16352E]/60 border border-[#A8E6CE]/40 space-y-1.5">
                <div className="text-xs font-bold text-[#A8E6CE]">Live Gemini Financial Brief</div>
                <div className="text-[11px] text-[#F5F7F5] whitespace-pre-wrap leading-relaxed">{aiInsight}</div>
              </div>
            )}

            {aiError && (
              <div className="p-3 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-[11px] text-[#EB7676] flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={handleRequestAiInsight}
              disabled={aiLoading}
              className="py-2.5 px-3 text-xs font-semibold text-[#A8E6CE] bg-[#16352E] border border-[#28443C] hover:border-[#72C8B0] rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{aiLoading ? 'Generating...' : 'Generate AI Brief'}</span>
            </button>
            <button
              onClick={onOpenAI}
              className="py-2.5 px-3 text-xs font-bold text-[#0B1C19] bg-[#A8E6CE] hover:bg-[#72C8B0] rounded-xl transition-colors shadow-md flex items-center justify-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ask FinSight AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
        <h3 className="text-sm font-bold text-[#F5F7F5] uppercase tracking-wider">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => onNavigate('/app/budgeting/import')}
            className="p-3 rounded-xl border border-[#28443C] bg-[#0B1C19] hover:bg-[#16352E] hover:border-[#A8E6CE] text-xs font-medium text-[#A7C1B8] hover:text-[#F5F7F5] text-left transition-colors"
          >
            Import Transactions
          </button>
          <button
            onClick={() => onNavigate('/app/markets/paper-trading')}
            className="p-3 rounded-xl border border-[#28443C] bg-[#0B1C19] hover:bg-[#16352E] hover:border-[#A8E6CE] text-xs font-medium text-[#A7C1B8] hover:text-[#F5F7F5] text-left transition-colors"
          >
            Paper Trading
          </button>
          <button
            onClick={() => onNavigate('/app/tax/compare')}
            className="p-3 rounded-xl border border-[#28443C] bg-[#0B1C19] hover:bg-[#16352E] hover:border-[#A8E6CE] text-xs font-medium text-[#A7C1B8] hover:text-[#F5F7F5] text-left transition-colors"
          >
            Tax Regime Check
          </button>
          <button
            onClick={() => onNavigate('/app/fraud/analyze')}
            className="p-3 rounded-xl border border-[#28443C] bg-[#0B1C19] hover:bg-[#16352E] hover:border-[#A8E6CE] text-xs font-medium text-[#A7C1B8] hover:text-[#F5F7F5] text-left transition-colors"
          >
            Analyze Suspicious SMS
          </button>
          <button
            onClick={() => onNavigate('/app/business/invoices/new')}
            className="p-3 rounded-xl border border-[#28443C] bg-[#0B1C19] hover:bg-[#16352E] hover:border-[#A8E6CE] text-xs font-medium text-[#A7C1B8] hover:text-[#F5F7F5] text-left transition-colors"
          >
            Create GST Invoice
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#28443C] bg-[#16352E]/30 p-4 text-xs text-[#718D83] flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-[#A8E6CE] shrink-0" />
        <p>
          FinSight provides educational information and analytical tools. It does not execute financial transactions or replace qualified financial advice.
        </p>
      </div>
    </div>
  );
};
