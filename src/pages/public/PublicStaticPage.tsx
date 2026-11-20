import React, { useState } from 'react';
import { ShieldCheck, Mail, ArrowRight, CheckCircle } from 'lucide-react';
import { PublicHeader } from '../../components/layout/PublicHeader';
import { PublicFooter } from '../../components/layout/PublicFooter';

interface PublicStaticPageProps {
  page: 'features' | 'how-it-works' | 'security' | 'about' | 'contact' | 'privacy' | 'terms' | 'disclaimer';
  onNavigate: (path: string) => void;
}

export const PublicStaticPage: React.FC<PublicStaticPageProps> = ({ page, onNavigate }) => {
  // Contact form state
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
    <div className="min-h-screen bg-[#0B1C19] text-[#F5F7F5] flex flex-col">
      <PublicHeader currentPath={`/${page}`} onNavigate={onNavigate} />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 md:py-16 space-y-12">
        {/* FEATURES PAGE */}
        {page === 'features' && (
          <div className="space-y-12">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F5F7F5]">
                Six tools. One financial intelligence platform.
              </h1>
              <p className="text-sm text-[#A7C1B8]">
                Explore the capabilities designed to make Indian personal and business finances easier to understand and manage.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: 'Smart Budgeting', desc: 'Turn UPI transaction records and bank SMS alerts into organized monthly budgets with living expense limits.', path: '/app/budgeting' },
                { title: 'Investing and Portfolio Guide', desc: 'Understand SIPs, Nifty index funds, asset allocation, and investment risk in simple language.', path: '/app/investments' },
                { title: 'Trading and Market Insights', desc: 'Analyze historical NSE market behavior, backtest trading strategies, and practice paper trading without risk.', path: '/app/markets' },
                { title: 'Tax Helper', desc: 'Compare Old vs New Tax Regimes under Section 115BAC, calculate liabilities, and organize 80C/80D proofs.', path: '/app/tax' },
                { title: 'Scam and Fraud Detector', desc: 'Detect suspicious UPI collect requests, fake KYC SMS alerts, and phishing messages before clicking.', path: '/app/fraud' },
                { title: 'Small Business Finance', desc: 'Issue GST compliant invoices, track deductible expenses, forecast cash flow, and plan reducing-balance EMIs.', path: '/app/business' },
              ].map(feat => (
                <div key={feat.title} className="p-6 rounded-2xl border border-[#28443C] bg-[#102722] space-y-4">
                  <h3 className="text-lg font-bold text-[#F5F7F5]">{feat.title}</h3>
                  <p className="text-xs text-[#A7C1B8] leading-relaxed">{feat.desc}</p>
                  <button
                    onClick={() => onNavigate(feat.path)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#A8E6CE] hover:underline"
                  >
                    Open {feat.title} Module <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HOW IT WORKS */}
        {page === 'how-it-works' && (
          <div className="space-y-10 max-w-3xl mx-auto">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-extrabold text-[#F5F7F5]">A smarter way to understand finance.</h1>
              <p className="text-xs text-[#A7C1B8]">Bring your information together and let FinSight help explain what it means.</p>
            </div>

            <div className="space-y-6 pt-4">
              <div className="p-6 rounded-2xl border border-[#28443C] bg-[#102722] space-y-2">
                <span className="text-xs font-mono font-bold text-[#A8E6CE]">Step 01</span>
                <h3 className="text-base font-bold text-[#F5F7F5]">Start with your financial goals</h3>
                <p className="text-xs text-[#A7C1B8] leading-relaxed">
                  Choose the financial pillars you need—whether you are a salaried professional comparing tax regimes, a beginner learning index funds, or an entrepreneur issuing GST invoices.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-[#28443C] bg-[#102722] space-y-2">
                <span className="text-xs font-mono font-bold text-[#A8E6CE]">Step 02</span>
                <h3 className="text-base font-bold text-[#F5F7F5]">Bring in your data securely</h3>
                <p className="text-xs text-[#A7C1B8] leading-relaxed">
                  Paste bank SMS alerts or upload transaction CSVs. FinSight isolates your records under your own verified credentials without ever asking for passwords or banking PINs.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-[#28443C] bg-[#102722] space-y-2">
                <span className="text-xs font-mono font-bold text-[#A8E6CE]">Step 03</span>
                <h3 className="text-base font-bold text-[#F5F7F5]">Ask FinSight AI for clarity</h3>
                <p className="text-xs text-[#A7C1B8] leading-relaxed">
                  Contextual AI powered by Gemini explains your financial numbers in plain English and Hindi without hallucinations.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SECURITY */}
        {page === 'security' && (
          <div className="space-y-8 max-w-3xl mx-auto">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-extrabold text-[#F5F7F5]">Your financial information is yours.</h1>
              <p className="text-xs text-[#A7C1B8]">Understand how FinSight handles data, permissions, and AI-powered financial analysis.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="p-5 rounded-2xl border border-[#28443C] bg-[#102722] space-y-2">
                <h3 className="text-sm font-bold text-[#F5F7F5]">Data Isolation & Privacy</h3>
                <p className="text-xs text-[#A7C1B8]">Owner-based Firestore rules prevent any cross-tenant data leakage. Only you can read or edit your financial records.</p>
              </div>
              <div className="p-5 rounded-2xl border border-[#28443C] bg-[#102722] space-y-2">
                <h3 className="text-sm font-bold text-[#F5F7F5]">Zero Banking Credential Storage</h3>
                <p className="text-xs text-[#A7C1B8]">We never prompt for or store UPI PINs, net banking passwords, or card CVVs. All data entry is observational or statement-based.</p>
              </div>
              <div className="p-5 rounded-2xl border border-[#28443C] bg-[#102722] space-y-2">
                <h3 className="text-sm font-bold text-[#F5F7F5]">Deterministic Mathematical Calculations</h3>
                <p className="text-xs text-[#A7C1B8]">Arithmetic for taxes, GST, and reducing-balance EMIs is executed in deterministic code rather than left to language model guessing.</p>
              </div>
              <div className="p-5 rounded-2xl border border-[#28443C] bg-[#102722] space-y-2">
                <h3 className="text-sm font-bold text-[#F5F7F5]">No Real-Money Trading Exposure</h3>
                <p className="text-xs text-[#A7C1B8]">Paper trading exclusively utilizes simulated virtual balances. No live broker bridges or exchange order execution exist.</p>
              </div>
            </div>
          </div>
        )}

        {/* ABOUT */}
        {page === 'about' && (
          <div className="space-y-8 max-w-3xl mx-auto">
            <h1 className="text-3xl font-extrabold text-[#F5F7F5]">Financial clarity should be easier to access.</h1>
            <p className="text-xs text-[#A7C1B8] leading-relaxed">
              FinSight brings personal budgeting, investment literacy, historical NSE analysis, Indian tax planning, scam detection, and small business accounting into a single cohesive interface.
            </p>
            <div className="p-6 rounded-2xl border border-[#28443C] bg-[#102722] space-y-3">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Responsible AI Approach</h3>
              <p className="text-xs text-[#A7C1B8] leading-relaxed">
                We believe financial tools must be honest about uncertainty. Whenever market data or tax calculations are presented, FinSight clearly cites the applied ruleset version, historical reference dates, and probabilistic nature of scam detection.
              </p>
            </div>
          </div>
        )}

        {/* CONTACT */}
        {page === 'contact' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-extrabold text-[#F5F7F5]">How can we help?</h1>
              <p className="text-xs text-[#A7C1B8]">Send us your question, feedback, or technical support request.</p>
            </div>

            {sentSuccess && (
              <div className="p-4 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/40 text-xs text-[#55C99A] flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <span>Message sent! Our support team in India will reply within 24 hours.</span>
              </div>
            )}

            <form onSubmit={handleContactSubmit} className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Full Name</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Email Address</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Subject</label>
                <select
                  value={contactSubject}
                  onChange={e => setContactSubject(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2 text-xs text-[#F5F7F5]"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Technical Support">Technical Support</option>
                  <option value="Account and Security">Account and Security</option>
                  <option value="Feedback">Feedback</option>
                  <option value="Business Inquiry">Business Inquiry</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Message</label>
                <textarea
                  rows={4}
                  value={contactMsg}
                  onChange={e => setContactMsg(e.target.value)}
                  placeholder="Tell us how we can help..."
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] p-3 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#A8E6CE] py-3 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
              >
                Send Message
              </button>
            </form>
          </div>
        )}

        {/* LEGAL: PRIVACY, TERMS, DISCLAIMER */}
        {(page === 'privacy' || page === 'terms' || page === 'disclaimer') && (
          <div className="space-y-6 max-w-3xl mx-auto text-xs text-[#A7C1B8] leading-relaxed">
            <h1 className="text-3xl font-extrabold text-[#F5F7F5]">
              {page === 'privacy' && 'Privacy Policy'}
              {page === 'terms' && 'Terms of Service'}
              {page === 'disclaimer' && 'Financial Disclaimer'}
            </h1>
            <p>Last updated: March 2026 · Jurisdiction: India</p>
            <div className="p-6 rounded-2xl border border-[#28443C] bg-[#102722] space-y-4 text-xs">
              <p>
                FinSight provides educational tools, personal budgeting summaries, historical backtesting, and indicative tax models. FinSight is not registered as an investment adviser with the Securities and Exchange Board of India (SEBI), nor does it operate as an RBI licensed bank or NBFC.
              </p>
              <p>
                All trading functionality operates strictly on historical market archives or simulated virtual paper trading balances. No real funds are at risk and no live order routing is conducted.
              </p>
              <p>
                Tax computations are indicative demonstrations based on published CBDT slab rates and require verification against professional chartered accountant advice.
              </p>
            </div>
          </div>
        )}
      </main>

      <PublicFooter onNavigate={onNavigate} />
    </div>
  );
};
