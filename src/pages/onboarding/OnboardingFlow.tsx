import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/api';

interface OnboardingFlowProps {
  onNavigate: (path: string) => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onNavigate }) => {
  const { user, refreshUserProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form states
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
    <div className="min-h-screen bg-[#0B1C19] text-[#F5F7F5] flex flex-col items-center justify-center p-6 py-12">
      <div className="w-full max-w-2xl rounded-2xl border border-[#28443C] bg-[#102722] p-8 shadow-2xl space-y-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-between border-b border-[#28443C] pb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-[#F5F7F5]">FinSight Onboarding</span>
          </div>
          <div className="text-xs text-[#718D83]">
            Step {step} of 6
          </div>
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="space-y-6 text-center py-6">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-[#F5F7F5]">Welcome to your financial workspace.</h1>
              <p className="text-sm text-[#A7C1B8] max-w-md mx-auto">
                Let's personalize FinSight around the way you manage money in India.
              </p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#A8E6CE] px-8 py-3.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 2: Personal Details */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#F5F7F5]">Tell us a little about yourself.</h2>
              <p className="text-xs text-[#A7C1B8]">These settings configure default Indian tax rules and currency formatting.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2.5 text-xs text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  disabled
                  className="w-full rounded-xl bg-[#0B1C19]/50 border border-[#28443C] px-3.5 py-2.5 text-xs text-[#718D83]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Preferred Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2.5 text-xs text-[#F5F7F5]"
                >
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Financial Year</label>
                <select
                  value={financialYear}
                  onChange={e => setFinancialYear(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2.5 text-xs text-[#F5F7F5]"
                >
                  <option value="2025-26">FY 2025-26 (AY 2026-27)</option>
                  <option value="2024-25">FY 2024-25 (AY 2025-26)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Occupation / Profile</label>
                <input
                  type="text"
                  value={occupation}
                  onChange={e => setOccupation(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2.5 text-xs text-[#F5F7F5]"
                  placeholder="e.g. Salaried Employee, Freelancer, Small Business Owner"
                />
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(1)} className="text-xs text-[#718D83] hover:text-[#A7C1B8]">Back</button>
              <button
                onClick={() => setStep(3)}
                className="rounded-xl bg-[#A8E6CE] px-6 py-2.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Financial Profile */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#F5F7F5]">Understand your financial starting point.</h2>
              <p className="text-xs text-[#A7C1B8]">Sensitive financial figures are optional and stored strictly under your private account.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Estimated Monthly Income (₹)</label>
                <input
                  type="number"
                  value={monthlyIncome}
                  onChange={e => setMonthlyIncome(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2.5 text-xs text-[#F5F7F5]"
                  placeholder="e.g. 145000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Estimated Monthly Expenses (₹)</label>
                <input
                  type="number"
                  value={monthlyExpenses}
                  onChange={e => setMonthlyExpenses(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2.5 text-xs text-[#F5F7F5]"
                  placeholder="e.g. 65000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-2">Financial Experience</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Beginner', 'Intermediate', 'Advanced'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setExperienceLevel(lvl)}
                      className={`p-3 rounded-xl border text-xs font-semibold text-center transition-colors ${
                        experienceLevel === lvl
                          ? 'bg-[#16352E] border-[#A8E6CE] text-[#A8E6CE]'
                          : 'bg-[#0B1C19] border-[#28443C] text-[#A7C1B8]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(2)} className="text-xs text-[#718D83] hover:text-[#A7C1B8]">Back</button>
              <button
                onClick={() => setStep(4)}
                className="rounded-xl bg-[#A8E6CE] px-6 py-2.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Preferences */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#F5F7F5]">Choose how you want to use FinSight.</h2>
              <p className="text-xs text-[#A7C1B8]">Configure how detailed AI explanations should be across tax, investing, and fraud checks.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Preferred Language</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2.5 text-xs text-[#F5F7F5]"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-2">AI Explanation Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Simple', 'Balanced', 'Detailed'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setExplanationLevel(lvl)}
                      className={`p-3 rounded-xl border text-xs font-semibold text-center transition-colors ${
                        explanationLevel === lvl
                          ? 'bg-[#16352E] border-[#A8E6CE] text-[#A8E6CE]'
                          : 'bg-[#0B1C19] border-[#28443C] text-[#A7C1B8]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(3)} className="text-xs text-[#718D83] hover:text-[#A7C1B8]">Back</button>
              <button
                onClick={() => setStep(5)}
                className="rounded-xl bg-[#A8E6CE] px-6 py-2.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Feature Selection */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-[#F5F7F5]">What would you like to explore?</h2>
              <p className="text-xs text-[#A7C1B8]">Select one or more financial tools for your workspace.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: 'Smart Budgeting', desc: 'UPI alerts, categorization & monthly limits' },
                { name: 'Investing & Portfolio Guide', desc: 'Holdings, index funds & asset allocation' },
                { name: 'Trading & Market Insights', desc: 'NSE historical charts & paper trading' },
                { name: 'Tax Helper', desc: 'Old vs new regime & deduction organizer' },
                { name: 'Scam & Fraud Detector', desc: 'Phishing message & fake UPI check' },
                { name: 'Small Business Finance', desc: 'GST invoices, cash flow & EMI calculator' },
              ].map(tool => {
                const isSelected = selectedTools.includes(tool.name);
                return (
                  <div
                    key={tool.name}
                    onClick={() => toggleTool(tool.name)}
                    className={`p-4 rounded-xl border cursor-pointer transition-colors flex items-start justify-between ${
                      isSelected
                        ? 'bg-[#16352E] border-[#A8E6CE]'
                        : 'bg-[#0B1C19] border-[#28443C] hover:border-[#718D83]'
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[#F5F7F5]">{tool.name}</h4>
                      <p className="text-[11px] text-[#A7C1B8] mt-1">{tool.desc}</p>
                    </div>
                    <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ml-2 ${
                      isSelected ? 'bg-[#A8E6CE] text-[#0B1C19]' : 'border border-[#28443C]'
                    }`}>
                      {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between pt-4">
              <button onClick={() => setStep(4)} className="text-xs text-[#718D83] hover:text-[#A7C1B8]">Back</button>
              <button
                onClick={() => setStep(6)}
                className="rounded-xl bg-[#A8E6CE] px-6 py-2.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
              >
                Complete Setup
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Onboarding Complete */}
        {step === 6 && (
          <div className="space-y-6 text-center py-6">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-[#55C99A]/20 border border-[#55C99A] flex items-center justify-center text-[#55C99A]">
              <Check className="h-8 w-8 stroke-[3]" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-[#F5F7F5]">Your financial workspace is ready.</h1>
              <p className="text-sm text-[#A7C1B8] max-w-md mx-auto">
                Start exploring the tools you selected. You can import transactions or check your investment overview anytime.
              </p>
            </div>
            {saveError && (
              <div className="p-3 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676]">
                {saveError}
              </div>
            )}
            <button
              onClick={handleComplete}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#A8E6CE] px-8 py-3.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0] disabled:opacity-60 transition-colors shadow-lg"
            >
              {isSaving ? 'Saving Workspace...' : 'Go to Dashboard'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
