import React, { useState } from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { PublicFooter } from '../../components/layout/PublicFooter';
import { FeatureIllustration } from '../../components/brand/FinSightArtwork';

interface PublicStaticPageProps {
  page: 'features' | 'how-it-works' | 'security' | 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer';
  onNavigate: (path: string) => void;
}

export const PublicStaticPage: React.FC<PublicStaticPageProps> = ({ page, onNavigate }) => {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('General Inquiry');
  const [contactMsg, setContactMsg] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMsg) return;
    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
      setContactName('');
      setContactEmail('');
      setContactMsg('');
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-[var(--fs-bg)] text-[var(--fs-text)] flex flex-col transition-colors">
      <PublicHeader currentPath={`/${page}`} onNavigate={onNavigate} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 md:py-16 space-y-12">
        {page === 'features' && (
          <div className="space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">Platform Capabilities</p>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--fs-text)]">
                Connected intelligence across personal and business finance.
              </h1>
              <p className="text-sm text-[var(--fs-text-body)]">
                Explore the six core workspaces plus Financial Health Index, Cash-Flow Radar, Credit Cards, Recurring Payments, Goals, Receivables, and Ledger Reconciliation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { kind: 'budgeting' as const, title: 'Smart Budgeting & Money Inbox', desc: 'Turn UPI alerts and bank statements into clean budgets with automatic internal transfer and card settlement exclusions.', path: '/app/budgeting' },
                { kind: 'investing' as const, title: 'Investing, Risk Drift & Journal', desc: 'Monitor portfolio concentration, 10% market shock impact, asset mix, and record calm research journal entries.', path: '/app/investments' },
                { kind: 'markets' as const, title: 'NSE Markets & Paper Trading', desc: 'Analyze historical NSE price candles, test Moving Average & RSI strategies, and practice trading virtually.', path: '/app/markets' },
                { kind: 'tax' as const, title: 'Indian Tax Center & Readiness', desc: 'Compare CBDT Old vs New Regimes, organize 80C/80D/24(b) claims, and track Form 16 readiness.', path: '/app/tax' },
                { kind: 'fraud' as const, title: 'Scam & Fraud Shield', desc: 'Inspect SMS/WhatsApp/Email messages, suspicious URLs, lookalike bank domains, and UPI collect patterns.', path: '/app/fraud' },
                { kind: 'business' as const, title: 'Small Business, GST & Receivables', desc: 'Issue GST tax invoices, manage aging receivables, draft follow-ups, and run bank-vs-ledger reconciliation.', path: '/app/business' },
              ].map(feat => (
                <div key={feat.title} className="fs-card p-6 space-y-4">
                  <FeatureIllustration kind={feat.kind} />
                  <h3 className="text-lg font-bold text-[var(--fs-text)]">{feat.title}</h3>
                  <p className="text-xs text-[var(--fs-text-body)] leading-relaxed">{feat.desc}</p>
                  <button
                    onClick={() => onNavigate(feat.path)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[var(--fs-accent)] hover:underline"
                  >
                    Open {feat.title} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {page === 'how-it-works' && (
          <div className="space-y-8 max-w-3xl mx-auto">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">Workflow</p>
              <h1 className="text-3xl font-extrabold text-[var(--fs-text)]">How FinSight turns raw numbers into clarity.</h1>
              <p className="text-sm text-[var(--fs-text-body)]">Bring your statements or manual entries together and review transparent calculations.</p>
            </div>

            <div className="space-y-4">
              {[
                { step: 'Step 01', title: 'Organize accounts & preferences', body: 'Choose your Financial Year (FY 2025-26 / FY 2024-25), language (English or हिन्दी), and light/dark comfort mode.' },
                { step: 'Step 02', title: 'Import & triage in Money Inbox', body: 'Upload CSV/XLSX/PDF statements or parse SMS alerts. Review suggested categories, split mixed bills, and exclude double-counted transfers.' },
                { step: 'Step 03', title: 'Predict cash flow & stress-test plans', body: 'Use Cash-Flow Radar, Card Minimum vs Extra Payment Simulator, and Tax Regime Comparison before committing funds.' },
              ].map(item => (
                <div key={item.step} className="fs-card p-6 space-y-2">
                  <span className="text-xs font-mono font-bold text-[var(--fs-accent)]">{item.step}</span>
                  <h3 className="text-base font-bold text-[var(--fs-text)]">{item.title}</h3>
                  <p className="text-xs text-[var(--fs-text-body)] leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {page === 'security' && (
          <div className="space-y-8 max-w-3xl mx-auto">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">Security &amp; Privacy</p>
              <h1 className="text-3xl font-extrabold text-[var(--fs-text)]">Your financial information belongs strictly to you.</h1>
              <p className="text-sm text-[var(--fs-text-body)]">Verified authentication, strict per-user isolation, and transparent calculation logic.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: 'Token-Derived Tenant Isolation', desc: 'Every backend request verifies Firebase ID tokens and derives ownerId server-side. Cross-account access returns 403 Forbidden.' },
                { title: 'Zero Credential Collection', desc: 'We reject full credit card numbers, CVVs, UPI PINs, OTPs, and net-banking passwords—only last 4 card digits are ever accepted.' },
                { title: 'Deterministic Financial Engine', desc: 'Tax slabs, GST splits, reducing-balance EMIs, and health indices execute in audited TypeScript code with full formula disclosure.' },
                { title: 'No Autonomous Money Movement', desc: 'FinSight cannot execute bank transfers, bill payments, stock trades, or send messages to clients automatically.' },
              ].map(card => (
                <div key={card.title} className="fs-card p-5 space-y-2">
                  <h3 className="text-sm font-bold text-[var(--fs-text)]">{card.title}</h3>
                  <p className="text-xs text-[var(--fs-text-body)] leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {page === 'about' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">About FinSight</p>
            <h1 className="text-3xl font-extrabold text-[var(--fs-text)]">Financial clarity should be calm, honest, and accessible.</h1>
            <p className="text-sm text-[var(--fs-text-body)] leading-relaxed">
              FinSight brings personal budgeting, net worth readiness, cash-flow forecasting, investment education, historical NSE analysis, Indian tax planning, scam detection, and small-business GST accounting into one cohesive application.
            </p>
            <div className="fs-card p-6 space-y-3">
              <h3 className="text-sm font-bold text-[var(--fs-text)]">Our Transparency Commitment</h3>
              <p className="text-xs text-[var(--fs-text-body)] leading-relaxed">
                Financial tools must never fabricate numbers or hide assumptions. FinSight always distinguishes verified user records from model estimates, cites CBDT rulesets and archive dates, and never guarantees investment outcomes.
              </p>
            </div>
          </div>
        )}

        {page === 'contact' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-[var(--fs-text)]">How can we help?</h1>
              <p className="text-xs text-[var(--fs-text-body)]">Send us your question, feedback, or technical support request.</p>
            </div>

            {sentSuccess && (
              <div className="p-4 rounded-xl bg-[var(--fs-success)]/10 border border-[var(--fs-success)]/40 text-xs text-[var(--fs-success)] flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span>Message recorded. Our support team will follow up via your registered email.</span>
              </div>
            )}

            <form onSubmit={handleContactSubmit} className="fs-card p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Full Name</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Enter your full name"
                  className="fs-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Email Address</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="fs-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Subject</label>
                <select
                  value={contactSubject}
                  onChange={e => setContactSubject(e.target.value)}
                  className="fs-input"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Account and Security">Account and Security</option>
                  <option value="Feedback">Feedback</option>
                  <option value="Business Inquiry">Business Inquiry</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Message</label>
                <textarea
                  rows={4}
                  value={contactMsg}
                  onChange={e => setContactMsg(e.target.value)}
                  placeholder="Tell us how we can help..."
                  className="fs-input"
                  required
                />
              </div>
              <button type="submit" className="w-full fs-btn-primary py-3 text-xs">
                Send Message
              </button>
            </form>
          </div>
        )}

        {(page === 'privacy' || page === 'terms' || page === 'disclaimer') && (
          <div className="space-y-6 max-w-3xl mx-auto text-xs text-[var(--fs-text-body)] leading-relaxed">
            <h1 className="text-3xl font-extrabold text-[var(--fs-text)]">
              {page === 'privacy' && 'Privacy Policy'}
              {page === 'terms' && 'Terms of Service'}
              {page === 'disclaimer' && 'Financial Disclaimer'}
            </h1>
            <p className="font-mono text-[11px] text-[var(--fs-text-muted)]">Updated 2026 · Jurisdiction: India</p>
            <div className="fs-card p-6 space-y-4 text-xs">
              <p>
                FinSight provides educational tools, personal budgeting summaries, historical backtesting, cash-flow simulations, and indicative tax models. FinSight is not registered as an investment adviser with SEBI, nor does it operate as an RBI-licensed bank or NBFC.
              </p>
              <p>
                Paper trading operates strictly on historical market archives and virtual balances. No live broker execution or real-money order routing is performed.
              </p>
              <p>
                Tax computations use published CBDT slab rulesets for informational comparison; always verify filings with a qualified Chartered Accountant.
              </p>
            </div>
          </div>
        )}
      </main>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  );
};
