import React from 'react';
import {
  ShieldCheck,
  TrendingUp,
  Wallet,
  ReceiptText,
  ShieldAlert,
  Building2,
  ArrowRight,
  PieChart,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { PublicFooter } from '../../components/layout/PublicFooter';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-[#0B1C19] text-[#F5F7F5] flex flex-col">
      <PublicHeader currentPath="/" onNavigate={onNavigate} />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 border-b border-[#28443C]">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-[#16352E] border border-[#28443C] text-xs font-semibold text-[#A8E6CE]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A8E6CE]" />
              AI FOR FINANCE
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#F5F7F5] leading-[1.15]">
              Make better money decisions with AI.
            </h1>
            <p className="text-base sm:text-lg text-[#A7C1B8] max-w-xl leading-relaxed">
              Turn your financial data into clarity. Understand spending, investments, markets, taxes, and business finances with one intelligent platform.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => onNavigate('/auth/sign-up')}
                className="flex items-center gap-2 rounded-xl bg-[#A8E6CE] px-6 py-3.5 text-sm font-bold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors shadow-lg"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => onNavigate('/features')}
                className="rounded-xl border border-[#28443C] bg-[#102722] px-6 py-3.5 text-sm font-semibold text-[#F5F7F5] hover:bg-[#16352E] hover:border-[#72C8B0] transition-colors"
              >
                Explore Features
              </button>
            </div>
            <div className="pt-4 text-xs font-medium text-[#718D83]">
              One workspace. Six powerful financial tools. Designed for India.
            </div>
          </div>

          {/* Right Column: Hero Financial Preview Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-[#28443C] pb-4">
                <div>
                  <div className="text-xs text-[#718D83] uppercase tracking-wider">Financial Health Index</div>
                  <div className="text-2xl font-bold text-[#F5F7F5]">88 / 100 · Strong</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#55C99A]">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#0B1C19] border border-[#28443C] p-3.5">
                  <div className="text-[11px] text-[#718D83]">Monthly Savings Rate</div>
                  <div className="text-lg font-bold text-[#55C99A] tabular-nums">48.2%</div>
                  <div className="text-[10px] text-[#718D83]">+5.4% from Feb</div>
                </div>
                <div className="rounded-xl bg-[#0B1C19] border border-[#28443C] p-3.5">
                  <div className="text-[11px] text-[#718D83]">Tax Optimization</div>
                  <div className="text-lg font-bold text-[#A8E6CE] tabular-nums">₹46,800</div>
                  <div className="text-[10px] text-[#718D83]">Saved under Sec 80C</div>
                </div>
              </div>

              {/* Sample Insight */}
              <div className="rounded-xl bg-[#16352E]/70 border border-[#28443C] p-4 text-xs text-[#A7C1B8] space-y-1">
                <div className="font-semibold text-[#F5F7F5] flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#A8E6CE]" />
                  FinSight AI Observation
                </div>
                <p className="text-[11px] text-[#A7C1B8]">
                  Your recurring discretionary subscriptions are down 12% this month. Your emergency fund now covers 5.2 months of living expenses.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Financial Intelligence */}
      <section className="py-20 border-b border-[#28443C]">
        <div className="mx-auto max-w-7xl px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-[#F5F7F5]">
              Your finances deserve more than spreadsheets.
            </h2>
            <p className="text-sm text-[#A7C1B8]">
              Bring fragmented financial information together and understand the bigger picture.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
              <div className="h-10 w-10 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[#F5F7F5]">1. Understand Your Money</h3>
              <p className="text-xs text-[#A7C1B8] leading-relaxed">
                Connect UPI statements and bank alerts. Transform raw transaction rows into automated budgets, categorized living costs, and predictive cash flow.
              </p>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
              <div className="h-10 w-10 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
                <PieChart className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[#F5F7F5]">2. Learn Before You Invest</h3>
              <p className="text-xs text-[#A7C1B8] leading-relaxed">
                Master compounding, SIPs, Nifty index funds, and asset allocation with zero financial jargon. Backtest strategies on verified historical NSE datasets.
              </p>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
              <div className="h-10 w-10 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[#F5F7F5]">3. Protect Your Decisions</h3>
              <p className="text-xs text-[#A7C1B8] leading-relaxed">
                Analyze suspicious SMS alerts, fake UPI collect links, and impersonation attempts with Gemini AI risk assessment before sharing credentials or clicking links.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Six Core Features Grid */}
      <section className="py-20 border-b border-[#28443C] bg-[#0B1C19]/60">
        <div className="mx-auto max-w-7xl px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-[#F5F7F5]">
              Everything you need to understand your finances.
            </h2>
            <p className="text-sm text-[#A7C1B8]">
              Six intelligent tools. One connected financial workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
                  <Wallet className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#F5F7F5]">Smart Budgeting</h3>
                <p className="text-xs text-[#A7C1B8] leading-relaxed">
                  Transform transactions and bank alerts into organized budgets and spending insights.
                </p>
              </div>
              <button
                onClick={() => onNavigate('/app/budgeting')}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#A8E6CE] hover:text-[#72C8B0] transition-colors"
              >
                Explore Budgeting <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
                  <PieChart className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#F5F7F5]">Investing & Portfolio Guide</h3>
                <p className="text-xs text-[#A7C1B8] leading-relaxed">
                  Understand SIPs, index funds, fixed deposits, diversification, and portfolio risk.
                </p>
              </div>
              <button
                onClick={() => onNavigate('/app/investments')}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#A8E6CE] hover:text-[#72C8B0] transition-colors"
              >
                Explore Investing <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#F5F7F5]">Trading & Market Insights</h3>
                <p className="text-xs text-[#A7C1B8] leading-relaxed">
                  Study historical market data, backtest strategies, and practice with paper trading.
                </p>
              </div>
              <button
                onClick={() => onNavigate('/app/markets')}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#A8E6CE] hover:text-[#72C8B0] transition-colors"
              >
                Explore Markets <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Card 4 */}
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#F5F7F5]">Tax Helper</h3>
                <p className="text-xs text-[#A7C1B8] leading-relaxed">
                  Understand tax regimes, deductions, and indicative tax calculations.
                </p>
              </div>
              <button
                onClick={() => onNavigate('/app/tax')}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#A8E6CE] hover:text-[#72C8B0] transition-colors"
              >
                Explore Tax Tools <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Card 5 */}
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#F5F7F5]">Scam & Fraud Detector</h3>
                <p className="text-xs text-[#A7C1B8] leading-relaxed">
                  Identify suspicious messages, payment requests, and possible financial scams.
                </p>
              </div>
              <button
                onClick={() => onNavigate('/app/fraud')}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#A8E6CE] hover:text-[#72C8B0] transition-colors"
              >
                Check for Scams <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Card 6 */}
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="h-10 w-10 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#F5F7F5]">Small Business Finance</h3>
                <p className="text-xs text-[#A7C1B8] leading-relaxed">
                  Manage invoices, expenses, cash flow, and EMI planning.
                </p>
              </div>
              <button
                onClick={() => onNavigate('/app/business')}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#A8E6CE] hover:text-[#72C8B0] transition-colors"
              >
                Explore Business Tools <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: How It Works */}
      <section className="py-20 border-b border-[#28443C]">
        <div className="mx-auto max-w-7xl px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-[#F5F7F5]">
              From financial data to informed decisions.
            </h2>
            <p className="text-sm text-[#A7C1B8]">
              A simple three-step process to financial clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="text-3xl font-extrabold text-[#A8E6CE]">01.</div>
              <h3 className="text-base font-bold text-[#F5F7F5]">Connect or Upload Your Data</h3>
              <p className="text-xs text-[#A7C1B8] leading-relaxed">
                Add bank alerts via SMS paste, upload statement CSVs, or enter holdings manually without sharing sensitive banking passwords.
              </p>
            </div>
            <div className="space-y-3">
              <div className="text-3xl font-extrabold text-[#A8E6CE]">02.</div>
              <h3 className="text-base font-bold text-[#F5F7F5]">Let AI Understand the Information</h3>
              <p className="text-xs text-[#A7C1B8] leading-relaxed">
                FinSight's deterministic finance engine and Gemini model classify transactions, calculate taxes, and evaluate risk objectively.
              </p>
            </div>
            <div className="space-y-3">
              <div className="text-3xl font-extrabold text-[#A8E6CE]">03.</div>
              <h3 className="text-base font-bold text-[#F5F7F5]">Explore Insights and Take Action</h3>
              <p className="text-xs text-[#A7C1B8] leading-relaxed">
                Take command of monthly budgets, test simulated trading strategies, optimize tax deductions, and issue GST compliant invoices.
              </p>
            </div>
          </div>

          <div className="text-center pt-4">
            <button
              onClick={() => onNavigate('/auth/sign-up')}
              className="rounded-xl bg-[#A8E6CE] px-6 py-3.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors"
            >
              Start Exploring
            </button>
          </div>
        </div>
      </section>

      {/* Section 6: Trust & Security */}
      <section className="py-20 border-b border-[#28443C] bg-[#102722]/40">
        <div className="mx-auto max-w-7xl px-6 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-bold tracking-tight text-[#F5F7F5]">
              Your financial information deserves care.
            </h2>
            <p className="text-sm text-[#A7C1B8]">
              Security and transparency built into every layer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-xl border border-[#28443C] bg-[#102722] p-5 space-y-2">
              <Lock className="h-5 w-5 text-[#A8E6CE]" />
              <h4 className="text-sm font-bold text-[#F5F7F5]">Secure Data Handling</h4>
              <p className="text-xs text-[#A7C1B8]">Owner-isolated database security rules prevent unauthorized multi-tenant record access.</p>
            </div>
            <div className="rounded-xl border border-[#28443C] bg-[#102722] p-5 space-y-2">
              <ShieldCheck className="h-5 w-5 text-[#A8E6CE]" />
              <h4 className="text-sm font-bold text-[#F5F7F5]">Private Financial Records</h4>
              <p className="text-xs text-[#A7C1B8]">No banking passwords, card PINs, or UPI PINs are ever requested or stored.</p>
            </div>
            <div className="rounded-xl border border-[#28443C] bg-[#102722] p-5 space-y-2">
              <CheckCircle2 className="h-5 w-5 text-[#A8E6CE]" />
              <h4 className="text-sm font-bold text-[#F5F7F5]">Transparent Explanations</h4>
              <p className="text-xs text-[#A7C1B8]">Calculations are reproducible with visible formulas for old/new tax regimes and loans.</p>
            </div>
            <div className="rounded-xl border border-[#28443C] bg-[#102722] p-5 space-y-2">
              <TrendingUp className="h-5 w-5 text-[#A8E6CE]" />
              <h4 className="text-sm font-bold text-[#F5F7F5]">No Real-Money Trading</h4>
              <p className="text-xs text-[#A7C1B8]">All trading features exclusively use historical NSE data or virtual paper simulation.</p>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => onNavigate('/security')}
              className="text-xs font-semibold text-[#A8E6CE] hover:underline"
            >
              Explore Security Architecture →
            </button>
          </div>
        </div>
      </section>

      {/* Section 7: Final CTA */}
      <section className="py-24 text-center">
        <div className="mx-auto max-w-3xl px-6 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7F5]">
            Take control of your financial picture.
          </h2>
          <p className="text-sm sm:text-base text-[#A7C1B8]">
            Start with one financial question. Discover a clearer way to understand your money.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('/auth/sign-up')}
              className="w-full sm:w-auto rounded-xl bg-[#A8E6CE] px-8 py-3.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors shadow-lg"
            >
              Create Your Account
            </button>
            <button
              onClick={() => onNavigate('/auth/sign-in')}
              className="text-xs font-medium text-[#A7C1B8] hover:text-[#F5F7F5]"
            >
              Already have an account? Sign In
            </button>
          </div>
        </div>
      </section>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  );
};
