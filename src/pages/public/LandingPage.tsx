import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Calculator,
  Sparkles,
  Calendar,
  CreditCard,
  Activity,
  Repeat,
  Target,
  Clock,
} from 'lucide-react';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { FeatureIllustration, HeroConnectedFinanceArtwork } from '../../components/brand/FinSightArtwork';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const pillars = [
    {
      kind: 'budgeting' as const,
      title: 'Smart Budgeting & Money Inbox',
      summary: 'Turn CSV, XLSX, PDF statements, and UPI alerts into clean monthly budgets with automatic transfer exclusion.',
      path: '/app/budgeting',
    },
    {
      kind: 'investing' as const,
      title: 'Portfolio Guide & Risk Drift',
      summary: 'Inspect equity vs index concentration, 10% market shock stress tests, and keep an Investment Decision Journal.',
      path: '/app/investments',
    },
    {
      kind: 'markets' as const,
      title: 'NSE Markets & Paper Trading',
      summary: 'Study historical NSE price candles, run deterministic strategy backtests, and practice with virtual capital.',
      path: '/app/markets',
    },
    {
      kind: 'tax' as const,
      title: 'Tax Center & Readiness',
      summary: 'Compare CBDT Old vs New Regimes, organize 80C/80D/24(b) proofs, and track ITR filing readiness.',
      path: '/app/tax',
    },
    {
      kind: 'fraud' as const,
      title: 'Scam & Fraud Shield',
      summary: 'Inspect suspicious SMS, WhatsApp messages, URLs, lookalike bank domains, and UPI collect requests.',
      path: '/app/fraud',
    },
    {
      kind: 'business' as const,
      title: 'Small Business, GST & Receivables',
      summary: 'Generate GST PDF invoices, monitor aging buckets (1–90+ days), and reconcile bank credits with ledgers.',
      path: '/app/business',
    },
  ];

  const differentiators = [
    {
      icon: Activity,
      title: 'Financial Health Index',
      desc: 'Net worth breakdown, emergency reserve runway in months, transparent 5-dimension formula, and downloadable PDF snapshots.',
      path: '/app/financial-health',
    },
    {
      icon: Calendar,
      title: 'Cash-Flow Radar & Calendar',
      desc: 'See upcoming salary, rent, EMI, and card bills on a 7/30/90-day horizon with shortfall date warnings and what-if testing.',
      path: '/app/money-calendar',
    },
    {
      icon: CreditCard,
      title: 'Credit Card & Debt Command',
      desc: 'Track card utilization, compare Minimum Due vs Full Payment interest cost, and run Avalanche vs Snowball payoff plans.',
      path: '/app/credit-cards',
    },
    {
      icon: Repeat,
      title: 'Subscription & Recurring Intelligence',
      desc: 'Spot recurring OTT, cloud, and utility charges from transaction patterns and estimate monthly and annual run rates.',
      path: '/app/recurring-payments',
    },
    {
      icon: Target,
      title: 'Goal-Based Financial Planning',
      desc: 'Calculate exact monthly savings needed for an Emergency Fund, Home, or Education target with what-if timeline shifts.',
      path: '/app/goals',
    },
    {
      icon: Clock,
      title: 'Receivables & Ledger Reconciliation',
      desc: 'Identify overdue client invoices, draft polite follow-up messages, and match bank credits against business books.',
      path: '/app/business/receivables',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--fs-bg)] text-[var(--fs-text)] flex flex-col transition-colors">
      <PublicHeader currentPath="/" onNavigate={onNavigate} />

      <main className="flex-1">
        {/* SECTION 1 — Hero */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fs-accent)]">
                Intelligence for every rupee
              </p>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--fs-text)] leading-[1.08]">
                Your financial life. Finally, in focus.
              </h1>
              <p className="text-base sm:text-lg text-[var(--fs-text-body)] leading-relaxed max-w-xl">
                Track expenses, anticipate upcoming bills, compare Indian tax regimes, monitor credit card utilization, guard against UPI scams, and manage small-business GST ledgers from one calm, transparent workspace.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => onNavigate('/auth/sign-up')}
                  className="fs-btn-primary px-6 py-3 text-sm inline-flex items-center gap-2"
                >
                  <span>Start Free Workspace</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onNavigate('/features')}
                  className="fs-btn-secondary px-5 py-3 text-sm"
                >
                  Explore Platform
                </button>
              </div>

              <div className="pt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--fs-text-muted)]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--fs-success)]" /> No bank passwords or UPI PINs requested
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--fs-success)]" /> Transparent formulas, zero mock data
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--fs-success)]" /> English &amp; हिन्दी support
                </span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <HeroConnectedFinanceArtwork />
            </div>
          </div>
        </section>

        {/* SECTION 2 — Real Problems People Face */}
        <section className="border-y border-[var(--fs-border)] bg-[var(--fs-surface)] py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-2xl space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--fs-accent)]">
                Why existing tools fall short
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--fs-text)]">
                Most money apps show past charts. Real life requires forward clarity.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  label: '01 · Double Counting & Messy Statements',
                  title: 'Bank transfers & card payments distort spending',
                  body: 'Ordinary trackers count credit card bill payments as brand-new expenses. FinSight identifies internal transfers and card settlements cleanly in Money Inbox.',
                },
                {
                  label: '02 · Mid-Month Cash-Flow Surprises',
                  title: 'Bills arrive faster than static monthly averages',
                  body: 'Knowing last month’s average does not prevent an unexpected EMI or insurance squeeze. Cash-Flow Radar projects exact upcoming obligations 7, 30, and 90 days ahead.',
                },
                {
                  label: '03 · Fragmented Tax, Debt & Business Records',
                  title: 'Spreadsheets break when you need one decision',
                  body: 'From deciding Old vs New CBDT tax regimes to chasing overdue client invoices, FinSight keeps personal, investment, tax, and business context connected.',
                },
              ].map(card => (
                <div key={card.label} className="fs-card p-6 space-y-2.5 bg-[var(--fs-bg)]">
                  <div className="text-[11px] font-mono font-semibold text-[var(--fs-accent)]">{card.label}</div>
                  <h3 className="text-base font-bold text-[var(--fs-text)]">{card.title}</h3>
                  <p className="text-xs leading-relaxed text-[var(--fs-text-body)]">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3 — Track -> Understand -> Predict -> Act */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="rounded-2xl border border-[var(--fs-border)] bg-[var(--fs-surface)] p-6 sm:p-10">
            <div className="max-w-2xl space-y-2 mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--fs-accent)]">
                Connected Financial Architecture
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--fs-text)]">
                Track Money → Understand Money → Predict Impact → Take Better Actions
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { step: '01 · TRACK', heading: 'Organize statements cleanly', copy: 'Upload CSV, XLSX, or PDF statements, or paste bank SMS alerts with duplicate & transfer triage.' },
                { step: '02 · UNDERSTAND', heading: 'Measure true financial health', copy: 'Compute net worth, savings rate, credit card utilization, and 5-dimension health scores with disclosed formulas.' },
                { step: '03 · PREDICT', heading: 'Test decisions before spending', copy: 'Simulate card minimum vs extra payments, market 10% shocks, cash-flow shortfall dates, and Avalanche vs Snowball payoff.' },
                { step: '04 · ACT', heading: 'Prioritize practical next steps', copy: 'Review tax filing readiness, draft overdue invoice reminders, inspect suspicious UPI links, and save snapshot reports.' },
              ].map(item => (
                <div key={item.step} className="p-5 rounded-xl border border-[var(--fs-border)] bg-[var(--fs-bg)] space-y-2">
                  <div className="text-[11px] font-mono font-bold text-[var(--fs-accent)]">{item.step}</div>
                  <h3 className="text-sm font-bold text-[var(--fs-text)]">{item.heading}</h3>
                  <p className="text-xs text-[var(--fs-text-body)] leading-relaxed">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4 — Six Core Financial Pillars */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--fs-accent)]">
                Six Core Modules
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--fs-text)]">
                Built around Indian financial reality.
              </h2>
            </div>
            <button
              onClick={() => onNavigate('/features')}
              className="text-xs font-semibold text-[var(--fs-brand)] dark:text-[#A8E6CE] hover:underline inline-flex items-center gap-1"
            >
              View all capabilities <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map(p => (
              <div key={p.title} className="fs-card p-6 flex flex-col justify-between gap-5">
                <div className="space-y-3">
                  <FeatureIllustration kind={p.kind} />
                  <h3 className="text-base font-bold text-[var(--fs-text)]">{p.title}</h3>
                  <p className="text-xs text-[var(--fs-text-body)] leading-relaxed">{p.summary}</p>
                </div>
                <button
                  onClick={() => onNavigate(p.path)}
                  className="text-xs font-semibold text-[var(--fs-accent)] hover:underline inline-flex items-center gap-1 self-start"
                >
                  Open Module <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5 — Differentiating Intelligence Features */}
        <section className="border-y border-[var(--fs-border)] bg-[var(--fs-surface)] py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--fs-accent)]">
                FinSight 2.0 Intelligence Suite
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--fs-text)]">
                Practical tools beyond ordinary dashboards.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {differentiators.map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="p-5 rounded-xl border border-[var(--fs-border)] bg-[var(--fs-bg)] space-y-3">
                    <div className="h-9 w-9 rounded-lg bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] flex items-center justify-center text-[var(--fs-accent)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-[var(--fs-text)]">{item.title}</h3>
                    <p className="text-xs text-[var(--fs-text-body)] leading-relaxed">{item.desc}</p>
                    <button
                      onClick={() => onNavigate(item.path)}
                      className="text-xs font-semibold text-[var(--fs-brand)] dark:text-[#A8E6CE] hover:underline inline-flex items-center gap-1"
                    >
                      Explore <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 6 — AI Assistant Preview */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--fs-accent)]">
                FinSight AI · Understand your money
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--fs-text)]">
                Explanations grounded in your actual numbers, never generic guesses.
              </h2>
              <p className="text-sm text-[var(--fs-text-body)] leading-relaxed">
                Ask why your savings rate shifted, compare Old vs New Regime tax liabilities, or check if a suspicious payment link is impersonating an Indian bank. FinSight AI cites verified records separately from estimates.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="fs-card p-6 space-y-4 bg-[var(--fs-surface)]">
                <div className="flex items-center justify-between border-b border-[var(--fs-border)] pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--fs-accent)]" />
                    <span className="text-xs font-bold text-[var(--fs-text)]">Illustrative Copilot Response</span>
                  </div>
                  <span className="text-[11px] font-mono text-[var(--fs-text-muted)]">Sample walkthrough</span>
                </div>
                <div className="p-3 rounded-lg bg-[var(--fs-brand)] text-white text-xs self-end max-w-md ml-auto">
                  Can I afford a ₹45,000 laptop upgrade this month without hurting my upcoming card bill?
                </div>
                <div className="p-4 rounded-lg bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] text-xs text-[var(--fs-text)] space-y-2">
                  <p className="font-semibold">What your records show (verified):</p>
                  <p className="text-[var(--fs-text-body)]">
                    Current monthly surplus is <span className="font-mono font-semibold">₹1,08,150</span> with upcoming rent (<span className="font-mono">₹32,000</span>) and card due (<span className="font-mono">₹18,400</span>) scheduled in the next 14 days.
                  </p>
                  <p className="font-semibold pt-1">Estimated impact &amp; next step:</p>
                  <p className="text-[var(--fs-text-body)]">
                    Paying ₹45,000 upfront leaves an estimated <span className="font-mono font-semibold">₹12,750</span> buffer for the remaining cycle. Testing it in Cash-Flow Radar confirms zero shortfall dates if groceries stay under budget.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7 — Security & Trust */}
        <section className="border-t border-[var(--fs-border)] bg-[var(--fs-surface)] py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--fs-accent)]">
                Trust &amp; Architectural Safeguards
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--fs-text)]">
                Designed to protect your privacy and prevent unauthorized actions.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Verified Owner Isolation',
                  body: 'Every database record, document vault file, and report derives ownership strictly from verified Firebase Auth tokens.',
                },
                {
                  icon: Lock,
                  title: 'Zero Sensitive Credentials',
                  body: 'FinSight never collects full credit card numbers, CVVs, UPI PINs, OTPs, or internet banking passwords.',
                },
                {
                  icon: Calculator,
                  title: 'Deterministic Financial Math',
                  body: 'Income tax slabs, GST invoices, EMI schedules, and payoff projections run in audited TypeScript—never LLM guesswork.',
                },
                {
                  icon: Sparkles,
                  title: 'User-Confirmed Actions Only',
                  body: 'FinSight never initiates payments, transfers, trades, or reminders automatically. Every record stays in your control.',
                },
              ].map(card => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="p-5 rounded-xl border border-[var(--fs-border)] bg-[var(--fs-bg)] space-y-2.5">
                    <Icon className="h-5 w-5 text-[var(--fs-accent)]" />
                    <h3 className="text-sm font-bold text-[var(--fs-text)]">{card.title}</h3>
                    <p className="text-xs text-[var(--fs-text-body)] leading-relaxed">{card.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 8 — Closing Conversion Band */}
        <section className="bg-[#123D32] text-white py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center space-y-5">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Bring clarity to every rupee you earn, save, invest, and protect.
            </h2>
            <p className="text-sm sm:text-base text-[#D3E7DD] max-w-2xl mx-auto">
              Create your private FinSight workspace in under a minute and explore all financial intelligence tools at your own pace.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => onNavigate('/auth/sign-up')}
                className="rounded-lg bg-[#BCE8D3] text-[#123D32] px-6 py-3 text-sm font-bold hover:bg-white transition-colors inline-flex items-center gap-2"
              >
                <span>Create Free Account</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => onNavigate('/security')}
                className="rounded-lg border border-white/25 px-5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                Read Security Architecture
              </button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  );
};
