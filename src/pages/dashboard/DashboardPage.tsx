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
  Calendar,
  Target,
  Activity,
  CheckCircle2,
  Sun,
  Moon,
  Inbox,
} from 'lucide-react';
import { formatINR } from '../../utils/financialMath';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslations } from '../../utils/i18n';
import {
  Transaction,
  MoneyCalendarEvent,
  MoneyGoal,
  FinancialHealthSnapshot,
} from '../../types';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { CashFlowTrendChart } from '../../components/charts/FinSightCharts';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';

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
    needsReviewCount?: number;
    excludedTransfersCount?: number;
  };
  recentTransactions: Transaction[];
}

interface CashFlowData {
  inflow: number;
  outflow: number;
  surplus: number;
  allocatedBudget: number;
  remainingBudget: number;
  monthlySeries?: Array<{ month: string; income: number; expenses: number }>;
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

interface RiskSummary {
  totalValue: number;
  totalCost: number;
  topHoldingConcentrationPct: number;
  topAssetClass: string;
  topAssetClassPct: number;
  estimatedAnnualVolatilityPct: number;
  tenPctShockImpact: number;
  classBreakdown: Array<{ assetType: string; value: number; sharePct: number }>;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenAI }) => {
  const { user, preferences } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations(preferences?.language);

  const [summary, setSummary] = useState<DashboardSummaryData | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
  const [spending, setSpending] = useState<SpendingData | null>(null);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [health, setHealth] = useState<FinancialHealthSnapshot | null>(null);
  const [events, setEvents] = useState<MoneyCalendarEvent[]>([]);
  const [goals, setGoals] = useState<MoneyGoal[]>([]);
  const [risk, setRisk] = useState<RiskSummary | null>(null);

  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '3m' | '6m' | '1y'>('6m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [monthlyReview, setMonthlyReview] = useState<string | null>(null);
  const [reviewCompleted, setReviewCompleted] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, cfRes, spRes, insRes, fhRes, calRes, goalRes, riskRes] = await Promise.all([
        apiFetch('/api/v1/dashboard/summary'),
        apiFetch('/api/v1/dashboard/cash-flow'),
        apiFetch('/api/v1/dashboard/spending'),
        apiFetch('/api/v1/dashboard/insights'),
        apiFetch('/api/v1/financial-health/summary'),
        apiFetch('/api/v1/calendar/events'),
        apiFetch('/api/v1/goals'),
        apiFetch('/api/v1/investments/risk'),
      ]);

      const [sumJson, cfJson, spJson, insJson, fhJson, calJson, goalJson, riskJson] = await Promise.all([
        sumRes.json(),
        cfRes.json(),
        spRes.json(),
        insRes.json(),
        fhRes.json(),
        calRes.json(),
        goalRes.json(),
        riskRes.json(),
      ]);

      if (!sumRes.ok || !sumJson.success) {
        throw new Error(sumJson?.error?.message || 'Unable to load dashboard summary.');
      }

      setSummary(sumJson.data);
      if (cfJson.success) setCashFlow(cfJson.data);
      if (spJson.success) setSpending(spJson.data);
      if (insJson.success) setInsights(insJson.data || []);
      if (fhJson.success && fhJson.data) setHealth(fhJson.data);
      if (calJson.success) setEvents(calJson.data || []);
      if (goalJson.success) setGoals(goalJson.data || []);
      if (riskJson.success) setRisk(riskJson.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleGenerateMonthlyReview = async () => {
    setAiLoading(true);
    setAiError(null);
    setReviewDismissed(false);
    setReviewCompleted(false);
    try {
      const res = await apiFetch('/api/v1/ai/monthly-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const parsed = await parseApiResponse<{ success: boolean; data?: { review?: string } }>(res);
      if (!parsed.ok || !parsed.json?.data?.review) {
        throw new Error(parsed.errorMessage || 'Gemini Monthly Review unavailable.');
      }
      setMonthlyReview(parsed.json.data.review);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate Monthly Money Review.');
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
    needsReviewCount: 0,
    excludedTransfersCount: 0,
  };

  const rawSeries = cashFlow?.monthlySeries || [];
  const sliceCount = timeframe === '7d' || timeframe === '30d' ? 2 : timeframe === '3m' ? 3 : timeframe === '6m' ? 6 : 12;
  const chartSeries = rawSeries.slice(-sliceCount).map(pt => ({
    label: pt.month,
    inflow: pt.income,
    outflow: pt.expenses,
    net: pt.income - pt.expenses,
  }));

  const upcomingCommitments = [...events]
    .filter(e => e.status !== 'PAID')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);

  const activeGoalsList = goals.filter(g => g.status !== 'PAUSED').slice(0, 4);

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--fs-border)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] tracking-tight">
            {t.greetingMorning}, {user?.fullName?.split(' ')[0] || 'Member'}
          </h1>
          <p className="text-xs text-[var(--fs-text-body)] mt-1">
            {t.greetingSubtitle} · FY {preferences?.financialYear || '2025-26'} · {preferences?.currency || 'INR'} · Updated {currentDate}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-surface)] px-3 py-2 text-xs font-medium text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-2)] transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{theme === 'dark' ? t.darkTheme : t.lightTheme}</span>
          </button>
          <button
            type="button"
            onClick={onOpenAI}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-surface)] px-3 py-2 text-xs font-semibold text-[var(--fs-brand)] hover:bg-[var(--fs-surface-2)] transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
            <span>{t.askFinSightAI}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/app/budgeting/import')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--fs-text)] hover:bg-[var(--fs-surface-2)] transition-colors whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{t.importStatement}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/app/budgeting/transactions')}
            className="fs-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t.addTransaction}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--fs-danger)]/40 bg-[var(--fs-danger)]/10 p-4 flex items-center justify-between text-xs text-[var(--fs-danger)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadDashboard}
            className="flex items-center gap-1 rounded-lg border border-[var(--fs-danger)]/40 px-3 py-1 font-semibold"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* 2. Top Financial Snapshot (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('/app/financial-health')}
          className="fs-card p-5 space-y-2.5 text-left hover:border-[var(--fs-accent)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-[var(--fs-text-muted)]">
            <span>{t.netWorth}</span>
            <span className="p-1.5 rounded-lg bg-[var(--fs-surface-2)] text-[var(--fs-accent)]">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <div className="font-mono-num text-2xl font-bold text-[var(--fs-text)]">
            {loading ? '...' : formatINR(health?.estimatedNetWorth ?? m.portfolioValue + m.savings)}
          </div>
          <div className="text-[11px] text-[var(--fs-text-body)]">
            Assets {formatINR(health?.totalAssets ?? m.portfolioValue)} · Debt {formatINR(health?.totalLiabilities ?? 0)}
          </div>
        </button>

        <div className="fs-card p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[var(--fs-text-muted)]">
            <span>{t.monthlyIncome} / Outflow</span>
            <span className="p-1.5 rounded-lg bg-[var(--fs-surface-2)] text-[var(--fs-success)]">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
          <div className="font-mono-num text-2xl font-bold text-[var(--fs-text)]">
            {loading ? '...' : formatINR(cashFlow?.inflow ?? m.totalIncome)}
          </div>
          <div className="text-[11px] text-[var(--fs-text-body)] flex items-center gap-1">
            <ArrowDownRight className="h-3 w-3 text-[var(--fs-danger)]" />
            <span>Spent {formatINR(cashFlow?.outflow ?? m.totalExpenses)} ({m.transactionCount} txns)</span>
          </div>
        </div>

        <div className="fs-card p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[var(--fs-text-muted)]">
            <span>Net Surplus & Savings Rate</span>
            <span className="p-1.5 rounded-lg bg-[var(--fs-surface-2)] text-[var(--fs-info)]">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className={`font-mono-num text-2xl font-bold ${m.savings >= 0 ? 'text-[var(--fs-success)]' : 'text-[var(--fs-danger)]'}`}>
            {loading ? '...' : formatINR(cashFlow?.surplus ?? m.savings)}
          </div>
          <div className="text-[11px] text-[var(--fs-text-body)]">
            Savings rate: <strong className="font-mono-num">{loading ? '...' : `${m.savingsRate}%`}</strong>
            {(m.excludedTransfersCount ?? 0) > 0 && ` · ${m.excludedTransfersCount} transfer excluded`}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/app/financial-health')}
          className="fs-card p-5 space-y-2.5 text-left hover:border-[var(--fs-accent)] transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-[var(--fs-text-muted)]">
            <span>{t.financialHealth} Index</span>
            <span className="p-1.5 rounded-lg bg-[var(--fs-surface-2)] text-[var(--fs-accent)]">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="font-mono-num text-2xl font-bold text-[var(--fs-text)]">
            {loading ? '...' : `${health?.compositeIndex ?? 0}/100`}
          </div>
          <div className="text-[11px] text-[var(--fs-text-body)]">
            Emergency runway: <strong className="font-mono-num">{health?.emergencyFundCoverageMonths ?? 0} mo</strong>
          </div>
        </button>
      </div>

      {/* 3. Cash Flow Timeline + 4. Coming Up Commitments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 fs-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[var(--fs-text)]">{t.moneyInMotion}</h2>
              <p className="text-xs text-[var(--fs-text-muted)]">
                Inflow vs outflow timeline (internal transfers & card settlements excluded)
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-[var(--fs-surface-2)] p-1 border border-[var(--fs-border)]">
              {(['7d', '30d', '3m', '6m', '1y'] as const).map(tf => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-1 rounded text-[11px] font-mono-num font-semibold transition-colors ${
                    timeframe === tf
                      ? 'bg-[var(--fs-brand)] text-white dark:text-[#0A1815]'
                      : 'text-[var(--fs-text-body)] hover:text-[var(--fs-text)]'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {chartSeries.length > 0 ? (
            <CashFlowTrendChart series={chartSeries} />
          ) : (
            <EmptyStateCard
              variant="transactions"
              title="No cash-flow timeline yet"
              description="Add transactions or import a bank statement to visualize monthly income, expenses, and retained surplus."
              actionLabel={t.importStatement}
              onAction={() => onNavigate('/app/budgeting/import')}
            />
          )}

          <div className="p-3.5 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] flex items-center justify-between text-xs">
            <span className="text-[var(--fs-text-body)]">Remaining Allocated Budget</span>
            <span className="font-mono-num font-bold text-[var(--fs-text)]">
              {formatINR(m.remainingBudget)} of {formatINR(m.allocatedBudget)}
            </span>
          </div>
        </div>

        {/* 4. Coming Up Commitments */}
        <div className="lg:col-span-5 fs-card p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--fs-accent)]" />
                <h2 className="font-display text-base font-bold text-[var(--fs-text)]">{t.comingUp}</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/app/money-calendar')}
                className="text-xs font-semibold text-[var(--fs-accent)] hover:underline"
              >
                Money Calendar →
              </button>
            </div>

            {upcomingCommitments.length === 0 ? (
              <EmptyStateCard
                variant="recurring"
                title="No upcoming bills logged"
                description="Add EMIs, rent, credit card due dates, or salary dates to unlock 30/90-day Cash-Flow Radar alerts."
                actionLabel="Open Money Calendar"
                onAction={() => onNavigate('/app/money-calendar')}
              />
            ) : (
              <div className="divide-y divide-[var(--fs-border)]">
                {upcomingCommitments.map(ev => (
                  <div key={ev.id} className="py-3 flex items-center justify-between text-xs gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--fs-text)] truncate">{ev.title}</div>
                      <div className="text-[11px] text-[var(--fs-text-muted)]">
                        Due {ev.dueDate} · {ev.eventType.replace('_', ' ')}
                      </div>
                    </div>
                    <div className={`font-mono-num font-bold shrink-0 ${
                      ev.direction === 'INFLOW' ? 'text-[var(--fs-success)]' : 'text-[var(--fs-text)]'
                    }`}>
                      {ev.direction === 'INFLOW' ? '+' : '-'}{formatINR(ev.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/app/credit-cards')}
            className="w-full py-2 text-xs font-semibold rounded-lg border border-[var(--fs-border)] text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-2)] transition-colors"
          >
            Manage Credit Cards & Recurring Bills
          </button>
        </div>
      </div>

      {/* 5. Active Goals + 6. Spending Intelligence + 7. Investment Picture */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 5. Goals */}
        <div className="lg:col-span-4 fs-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[var(--fs-accent)]" />
              <h2 className="font-display text-base font-bold text-[var(--fs-text)]">{t.progressWorthTracking}</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/app/goals')}
              className="text-xs font-semibold text-[var(--fs-accent)] hover:underline"
            >
              All Goals →
            </button>
          </div>

          {activeGoalsList.length === 0 ? (
            <EmptyStateCard
              variant="goals"
              title="Set your first savings milestone"
              description="Track Emergency Fund, Home Down Payment, Education, or Travel with clear monthly required targets."
              actionLabel={t.addGoal}
              onAction={() => onNavigate('/app/goals')}
            />
          ) : (
            <div className="space-y-3.5">
              {activeGoalsList.map(g => {
                const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
                return (
                  <div key={g.id} className="p-3.5 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--fs-text)] truncate">{g.title}</span>
                      <span className="font-mono-num font-bold text-[var(--fs-accent)]">{pct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--fs-bg)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--fs-accent)]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-[var(--fs-text-muted)] font-mono-num">
                      <span>{formatINR(g.currentAmount)}</span>
                      <span>Target {formatINR(g.targetAmount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. Spending Intelligence */}
        <div className="lg:col-span-4 fs-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[var(--fs-text)]">{t.whereYourMoneyGoes}</h2>
            <span className="font-mono-num text-xs text-[var(--fs-text-muted)]">{formatINR(spending?.totalSpent || 0)}</span>
          </div>

          {!spending || spending.categories.length === 0 ? (
            <EmptyStateCard
              variant="budgets"
              title="No expense categories yet"
              description="Categorized expenses appear here automatically once you add or import UPI & card transactions."
              actionLabel="Manage Budgets"
              onAction={() => onNavigate('/app/budgeting/budgets')}
            />
          ) : (
            <div className="space-y-3">
              {spending.categories.slice(0, 5).map(item => (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--fs-text-body)] truncate">{item.category}</span>
                    <span className="font-mono-num font-semibold text-[var(--fs-text)]">
                      {formatINR(item.amount)} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[var(--fs-surface-2)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--fs-brand)]" style={{ width: `${Math.min(100, item.percentage)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => onNavigate('/app/budgeting/budgets')}
            className="w-full py-2 text-xs font-semibold rounded-lg border border-[var(--fs-border)] text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-2)] transition-colors"
          >
            Manage Category Budgets
          </button>
        </div>

        {/* 7. Investment Picture */}
        <div className="lg:col-span-4 fs-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[var(--fs-text)]">{t.investmentPicture}</h2>
            <button
              type="button"
              onClick={() => onNavigate('/app/investments')}
              className="text-xs font-semibold text-[var(--fs-accent)] hover:underline"
            >
              Portfolio →
            </button>
          </div>

          {m.portfolioValue <= 0 && (!risk || risk.classBreakdown.length === 0) ? (
            <EmptyStateCard
              variant="portfolio"
              title="No holdings added yet"
              description="Log Indian equity, ETF, mutual fund, or FD holdings to inspect concentration & drawdown exposure."
              actionLabel="Add Holdings"
              onAction={() => onNavigate('/app/investments')}
            />
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-[var(--fs-text-muted)]">Portfolio Value</div>
                  <div className="font-mono-num text-xl font-bold text-[var(--fs-text)]">{formatINR(m.portfolioValue)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-[var(--fs-text-muted)]">Unrealized P&L</div>
                  <div className={`font-mono-num text-xs font-bold ${m.unrealizedGain >= 0 ? 'text-[var(--fs-success)]' : 'text-[var(--fs-danger)]'}`}>
                    {m.unrealizedGain >= 0 ? '+' : ''}{formatINR(m.unrealizedGain)}
                  </div>
                </div>
              </div>

              {risk && (
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl border border-[var(--fs-border)]">
                    <div className="text-[10px] text-[var(--fs-text-muted)]">Top Holding Share</div>
                    <div className="font-mono-num font-bold text-[var(--fs-text)] mt-0.5">{risk.topHoldingConcentrationPct}%</div>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--fs-border)]">
                    <div className="text-[10px] text-[var(--fs-text-muted)]">Est. Annual Volatility</div>
                    <div className="font-mono-num font-bold text-[var(--fs-text)] mt-0.5">{risk.estimatedAnnualVolatilityPct}%</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 8. AI Monthly Money Review + 9. Financial Data Quality & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 fs-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--fs-accent)]" />
              <h2 className="font-display text-base font-bold text-[var(--fs-text)]">{t.monthlyReview}</h2>
            </div>
            <span className="text-[11px] font-mono-num text-[var(--fs-text-muted)]">Gemini 4 Hydrogen</span>
          </div>

          <div className="space-y-2.5">
            {insights.map(item => (
              <div key={item.id} className="p-3.5 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] space-y-1">
                <div className="text-xs font-semibold text-[var(--fs-text)]">{item.title}</div>
                <p className="text-xs text-[var(--fs-text-body)] leading-relaxed">{item.body}</p>
              </div>
            ))}

            {monthlyReview && !reviewDismissed && (
              <div className="p-4 rounded-xl border border-[var(--fs-accent)]/40 bg-[var(--fs-surface-2)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--fs-brand)]">
                    {reviewCompleted ? 'Review Marked Completed' : 'Live Monthly Money Review'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewCompleted(true)}
                      className="text-[11px] font-semibold text-[var(--fs-success)] hover:underline inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Complete</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewDismissed(true)}
                      className="text-[11px] text-[var(--fs-text-muted)] hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <div className="text-xs text-[var(--fs-text)] whitespace-pre-wrap leading-relaxed">{monthlyReview}</div>
              </div>
            )}

            {aiError && (
              <div className="p-3 rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/40 text-xs text-[var(--fs-danger)] flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerateMonthlyReview}
              disabled={aiLoading}
              className="fs-btn-primary px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{aiLoading ? 'Generating Monthly Review...' : 'Generate Monthly Money Review'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenAI}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--fs-border)] text-[var(--fs-text)] hover:bg-[var(--fs-surface-2)]"
            >
              {t.askFinSightAI}
            </button>
          </div>
        </div>

        {/* 9. Financial Data Quality & Quick Actions */}
        <div className="lg:col-span-5 fs-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[var(--fs-text)]">{t.financialDataQuality}</h2>
            {(m.needsReviewCount ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('/app/budgeting/import')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--fs-warning)] hover:underline"
              >
                <Inbox className="h-3.5 w-3.5" />
                <span>{m.needsReviewCount} to review</span>
              </button>
            )}
          </div>

          {health?.missingDataNotes && health.missingDataNotes.length > 0 ? (
            <ul className="space-y-1.5 text-xs text-[var(--fs-text-body)]">
              {health.missingDataNotes.slice(0, 3).map((note, idx) => (
                <li key={idx} className="p-2.5 rounded-lg bg-[var(--fs-surface-2)] border border-[var(--fs-border)]">
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--fs-success)]">All core personal finance signals are connected.</p>
          )}

          <div className="pt-2 border-t border-[var(--fs-border)] space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--fs-text-muted)]">
              {t.quickActions}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Money Inbox', path: '/app/budgeting/import' },
                { label: 'Cash-Flow Radar', path: '/app/money-calendar' },
                { label: 'Tax Regime Check', path: '/app/tax/compare' },
                { label: 'Analyze Scam SMS', path: '/app/fraud/analyze' },
                { label: 'Business Receivables', path: '/app/business/receivables' },
                { label: 'Download Health PDF', path: '/app/financial-health' },
              ].map(qa => (
                <button
                  key={qa.path}
                  type="button"
                  onClick={() => onNavigate(qa.path)}
                  className="p-2.5 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-bg)] hover:bg-[var(--fs-surface-2)] text-xs font-medium text-[var(--fs-text)] text-left transition-colors"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--fs-border)] bg-[var(--fs-surface-2)]/60 p-4 text-xs text-[var(--fs-text-body)] flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-[var(--fs-accent)] shrink-0" />
        <p>
          FinSight calculates balances deterministically from your recorded accounts and uses AI strictly for explanation. It never executes live bank payments or market orders.
        </p>
      </div>
    </div>
  );
};
