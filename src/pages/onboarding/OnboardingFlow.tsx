import React, { useState } from 'react';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/api';
import { FinSightLogo } from '../../components/brand/FinSightArtwork';

interface OnboardingFlowProps {
  onNavigate: (path: string) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onNavigate }) => {
  const { user, refreshUserProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [country] = useState('India');
  const [currency, setCurrency] = useState('INR');
  const [financialYear, setFinancialYear] = useState('2025-26');
  const [occupation, setOccupation] = useState('Salaried Professional');

  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [monthlyExpenses, setMonthlyExpenses] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');

  const [language, setLanguage] = useState('English');
  const [explanationLevel, setExplanationLevel] = useState<'Simple' | 'Balanced' | 'Detailed'>('Balanced');

  const [selectedTools, setSelectedTools] = useState<string[]>([
    'Smart Budgeting',
    'Investing & Portfolio Guide',
    'Trading & Market Insights',
    'Tax Helper',
    'Scam & Fraud Detector',
    'Small Business Finance',
  ]);

  const toggleTool = (tool: string) => {
    setSelectedTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  const handleComplete = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch('/api/v1/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim() || user?.fullName || 'FinSight Member',
          country,
          currency,
          financialYear,
          occupation,
          monthlyIncomeEstimate: monthlyIncome ? Number(monthlyIncome) : undefined,
          monthlyExpenseEstimate: monthlyExpenses ? Number(monthlyExpenses) : undefined,
          experienceLevel,
          language,
          explanationLevel,
          selectedFeatures: selectedTools,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Unable to complete onboarding.');
      }
      await refreshUserProfile();
      onNavigate('/app/dashboard');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save onboarding preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--fs-bg)] text-[var(--fs-text)] flex flex-col items-center justify-center p-6 py-12 transition-colors">
      <div className="w-full max-w-2xl fs-card p-8 shadow-xl space-y-8">
        <div className="flex items-center justify-between border-b border-[var(--fs-border)] pb-4">
          <FinSightLogo size="sm" />
          <div className="text-xs font-mono text-[var(--fs-text-muted)]">
            Step {step} of 6
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6 text-center py-6">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] flex items-center justify-center text-[var(--fs-accent)]">
              <Sparkles className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-[var(--fs-text)]">Welcome to your financial workspace.</h1>
              <p className="text-sm text-[var(--fs-text-body)] max-w-md mx-auto">
                Let&apos;s personalize FinSight around the way you manage money in India.
              </p>
            </div>
            <button onClick={() => setStep(2)} className="fs-btn-primary inline-flex items-center gap-2 px-7 py-3 text-xs">
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--fs-text)]">Tell us a little about yourself.</h2>
              <p className="text-xs text-[var(--fs-text-body)]">These settings configure default Indian tax rules and currency formatting.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Full Name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="fs-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Country</label>
                <input type="text" value={country} disabled className="fs-input opacity-70" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Preferred Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="fs-input">
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Financial Year</label>
                <select value={financialYear} onChange={e => setFinancialYear(e.target.value)} className="fs-input">
                  <option value="2025-26">FY 2025-26 (AY 2026-27)</option>
                  <option value="2024-25">FY 2024-25 (AY 2025-26)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Occupation / Profile</label>
                <input
                  type="text"
                  value={occupation}
                  onChange={e => setOccupation(e.target.value)}
                  className="fs-input"
                  placeholder="e.g. Salaried Employee, Freelancer, Small Business Owner"
                />
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(1)} className="text-xs text-[var(--fs-text-muted)] hover:text-[var(--fs-text)]">Back</button>
              <button onClick={() => setStep(3)} className="fs-btn-primary px-6 py-2.5 text-xs">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--fs-text)]">Understand your starting point.</h2>
              <p className="text-xs text-[var(--fs-text-body)]">Optional baselines stored strictly under your private account.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Estimated Monthly Income (₹)</label>
                <input type="number" value={monthlyIncome} onChange={e => setMonthlyIncome(e.target.value)} className="fs-input" placeholder="e.g. 145000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Estimated Monthly Expenses (₹)</label>
                <input type="number" value={monthlyExpenses} onChange={e => setMonthlyExpenses(e.target.value)} className="fs-input" placeholder="e.g. 65000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-2">Financial Experience</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Beginner', 'Intermediate', 'Advanced'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setExperienceLevel(lvl)}
                      className={`p-3 rounded-lg border text-xs font-semibold text-center transition-colors ${
                        experienceLevel === lvl
                          ? 'bg-[var(--fs-brand)] text-white border-[var(--fs-brand)]'
                          : 'bg-[var(--fs-bg)] border-[var(--fs-border)] text-[var(--fs-text-body)]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(2)} className="text-xs text-[var(--fs-text-muted)] hover:text-[var(--fs-text)]">Back</button>
              <button onClick={() => setStep(4)} className="fs-btn-primary px-6 py-2.5 text-xs">Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--fs-text)]">Choose how FinSight speaks to you.</h2>
              <p className="text-xs text-[var(--fs-text-body)]">Configure bilingual language and AI explanation depth.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Preferred Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="fs-input">
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिन्दी)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-2">AI Explanation Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Simple', 'Balanced', 'Detailed'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setExplanationLevel(lvl)}
                      className={`p-3 rounded-lg border text-xs font-semibold text-center transition-colors ${
                        explanationLevel === lvl
                          ? 'bg-[var(--fs-brand)] text-white border-[var(--fs-brand)]'
                          : 'bg-[var(--fs-bg)] border-[var(--fs-border)] text-[var(--fs-text-body)]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(3)} className="text-xs text-[var(--fs-text-muted)] hover:text-[var(--fs-text)]">Back</button>
              <button onClick={() => setStep(5)} className="fs-btn-primary px-6 py-2.5 text-xs">Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--fs-text)]">Select your primary workspace tools.</h2>
              <p className="text-xs text-[var(--fs-text-body)]">You can enable or access all modules anytime from the sidebar.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: 'Smart Budgeting', desc: 'UPI alerts, Money Inbox & monthly limits' },
                { name: 'Investing & Portfolio Guide', desc: 'Holdings, risk drift & decision journal' },
                { name: 'Trading & Market Insights', desc: 'NSE historical charts & paper trading' },
                { name: 'Tax Helper', desc: 'Old vs New regime & ITR readiness' },
                { name: 'Scam & Fraud Detector', desc: 'Phishing links, QR & fake UPI checks' },
                { name: 'Small Business Finance', desc: 'GST invoices, aging receivables & reconciliation' },
              ].map(tool => {
                const isSelected = selectedTools.includes(tool.name);
                return (
                  <div
                    key={tool.name}
                    onClick={() => toggleTool(tool.name)}
                    className={`p-4 rounded-xl border cursor-pointer transition-colors flex items-start justify-between ${
                      isSelected
                        ? 'bg-[var(--fs-surface-secondary)] border-[var(--fs-accent)]'
                        : 'bg-[var(--fs-bg)] border-[var(--fs-border)]'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[var(--fs-text)]">{tool.name}</h4>
                      <p className="text-[11px] text-[var(--fs-text-body)] mt-1">{tool.desc}</p>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ml-2 ${
                        isSelected ? 'bg-[var(--fs-brand)] text-white' : 'border border-[var(--fs-border)]'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(4)} className="text-xs text-[var(--fs-text-muted)] hover:text-[var(--fs-text)]">Back</button>
              <button onClick={() => setStep(6)} className="fs-btn-primary px-6 py-2.5 text-xs">Complete Setup</button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6 text-center py-6">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-[var(--fs-success)]/15 border border-[var(--fs-success)]/40 flex items-center justify-center text-[var(--fs-success)]">
              <Check className="h-7 w-7 stroke-[3]" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-[var(--fs-text)]">Your financial workspace is ready.</h1>
              <p className="text-sm text-[var(--fs-text-body)] max-w-md mx-auto">
                Start exploring your Dashboard, Financial Health Index, Cash-Flow Radar, and AI assistant anytime.
              </p>
            </div>
            {saveError && (
              <div className="p-3 rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/40 text-xs text-[var(--fs-danger)]">
                {saveError}
              </div>
            )}
            <button
              onClick={handleComplete}
              disabled={isSaving}
              className="fs-btn-primary inline-flex items-center gap-2 px-7 py-3 text-xs disabled:opacity-60"
            >
              {isSaving ? 'Saving Workspace...' : 'Go to Dashboard'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
