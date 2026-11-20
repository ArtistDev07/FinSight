import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Trash2,
} from 'lucide-react';
import { FraudAnalysis } from '../../types';
import { apiFetch, parseApiResponse } from '../../utils/api';

interface FraudModuleProps {
  subview: 'overview' | 'analyze' | 'reports';
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

export const FraudModule: React.FC<FraudModuleProps> = ({
  subview,
  onNavigate,
}) => {
  const [analyses, setAnalyses] = useState<FraudAnalysis[]>([]);
  const [inputText, setInputText] = useState('');
  const [sourceType, setSourceType] = useState<'SMS' | 'WhatsApp' | 'Email' | 'UPI App' | 'Website' | 'Other'>('SMS');
  const [removedConfidential, setRemovedConfidential] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<FraudAnalysis | null>(null);

  useEffect(() => {
    apiFetch('/api/v1/fraud/analyses')
      .then(res => res.json())
      .then(json => { if (json.success) setAnalyses(json.data || []); });
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || inputText.length < 5 || !removedConfidential) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setCurrentResult(null);

    try {
      const res = await apiFetch('/api/v1/fraud/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, sourceType }),
      });
      const parsed = await parseApiResponse<{ success: boolean; data?: FraudAnalysis }>(res);
      if (!parsed.ok || !parsed.json?.data) {
        throw new Error(parsed.errorMessage || `Gemini analysis failed (HTTP ${res.status}).`);
      }
      const analysis = parsed.json.data;
      setCurrentResult(analysis);
      setAnalyses(prev => [analysis, ...prev]);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Unable to complete Gemini fraud analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    const res = await apiFetch(`/api/v1/fraud/analyses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAnalyses(prev => prev.filter(a => a.id !== id));
    }
  };

  const sampleScams = [
    {
      label: 'Fake SBI KYC Update SMS',
      text: 'Dear customer, your SBI NetBanking account will be suspended today due to pending KYC update. Click http://sbi-kyc-verify-portal.top to avoid blocking.',
      source: 'SMS' as const,
    },
    {
      label: 'Fake UPI Collect Request',
      text: 'You have won ₹25,000 lottery cash prize from PhonePe Rewards. Enter your 6-digit UPI PIN to claim reward into your bank balance immediately.',
      source: 'UPI App' as const,
    },
    {
      label: 'Electricity Power Disconnection',
      text: 'Dear consumer, electricity power will be disconnected tonight at 9:30 PM because previous bill was not updated. Immediately call officer Sharma at 9876543210.',
      source: 'SMS' as const,
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#28443C] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7F5] tracking-tight">
            Scam & Fraud Detector
          </h1>
          <p className="text-xs text-[#A7C1B8] mt-1">
            Examine suspicious SMS alerts, fake UPI collect requests, and phishing links powered by Gemini 4 Hydrogen.
          </p>
        </div>
        <button
          onClick={() => {
            setCurrentResult(null);
            setAnalysisError(null);
            onNavigate('/app/fraud/analyze');
          }}
          className="flex items-center gap-1.5 rounded-lg bg-[#A8E6CE] px-3.5 py-2 text-xs font-semibold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Analyze a Message</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#28443C] pb-2">
        <button
          onClick={() => onNavigate('/app/fraud')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
            subview === 'overview' ? 'bg-[#16352E] text-[#A8E6CE] border border-[#28443C]' : 'text-[#A7C1B8]'
          }`}
        >
          Overview & Quick Check
        </button>
        <button
          onClick={() => onNavigate('/app/fraud/analyze')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
            subview === 'analyze' ? 'bg-[#16352E] text-[#A8E6CE] border border-[#28443C]' : 'text-[#A7C1B8]'
          }`}
        >
          Deep Message Scanner
        </button>
        <button
          onClick={() => onNavigate('/app/fraud/reports')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
            subview === 'reports' ? 'bg-[#16352E] text-[#A8E6CE] border border-[#28443C]' : 'text-[#A7C1B8]'
          }`}
        >
          Security History ({analyses.length})
        </button>
      </div>

      {/* SUBVIEW 1: OVERVIEW & ANALYZER */}
      {(subview === 'overview' || subview === 'analyze') && (
        <div className="space-y-6 max-w-4xl">
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-[#F5F7F5]">Check Before You Click</h3>
              <p className="text-xs text-[#A7C1B8] mt-1">
                Paste the SMS, WhatsApp text, email, or UPI collect payment request you want to examine.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-[#718D83]">Try a common Indian scam pattern:</span>
              <div className="flex flex-wrap gap-2">
                {sampleScams.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputText(s.text);
                      setSourceType(s.source);
                      setRemovedConfidential(true);
                      setAnalysisError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0B1C19] border border-[#28443C] text-[11px] text-[#A8E6CE] hover:border-[#72C8B0] transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAnalyze} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">
                  Message Content:
                </label>
                <textarea
                  rows={4}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Paste the SMS, UPI request, email, or payment message you want to examine..."
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] p-3 text-xs text-[#F5F7F5] placeholder-[#718D83] focus:border-[#A8E6CE] focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Where did you receive this message?</label>
                  <select
                    value={sourceType}
                    onChange={e => setSourceType(e.target.value as FraudAnalysis['sourceType'])}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  >
                    <option value="SMS">SMS Alert</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="UPI App">UPI App (GPay/PhonePe/Paytm)</option>
                    <option value="Website">Website Link</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-start gap-2 cursor-pointer text-xs text-[#A7C1B8]">
                    <input
                      type="checkbox"
                      checked={removedConfidential}
                      onChange={e => setRemovedConfidential(e.target.checked)}
                      className="mt-0.5 rounded border-[#28443C] bg-[#0B1C19] text-[#A8E6CE]"
                      required
                    />
                    <span>I have removed any passwords, OTPs, PINs, or confidential credentials.</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAnalyzing || !inputText.trim() || !removedConfidential}
                className="rounded-xl bg-[#A8E6CE] px-6 py-2.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0] disabled:opacity-50 flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Examining message patterns with Gemini AI...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" />
                    <span>Analyze Message</span>
                  </>
                )}
              </button>
            </form>

            {analysisError && (
              <div className="p-4 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676] flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Gemini AI Analysis Unavailable</div>
                  <div className="mt-0.5">{analysisError}</div>
                </div>
              </div>
            )}

            {currentResult && (
              <div className="p-6 rounded-2xl bg-[#0B1C19] border border-[#28443C] space-y-4">
                <div className="flex items-center justify-between border-b border-[#28443C] pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className={`h-5 w-5 ${
                      currentResult.riskLevel === 'CRITICAL' || currentResult.riskLevel === 'HIGH'
                        ? 'text-[#EB7676]'
                        : currentResult.riskLevel === 'MEDIUM'
                        ? 'text-[#E5B764]'
                        : 'text-[#55C99A]'
                    }`} />
                    <div>
                      <h4 className="text-sm font-bold text-[#F5F7F5]">Security Risk Assessment</h4>
                      <span className="text-[10px] font-mono text-[#718D83]">Model: {currentResult.modelUsed}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#718D83]">Risk Score:</span>
                    <span className={`text-sm font-extrabold tabular-nums ${
                      currentResult.riskScore > 75 ? 'text-[#EB7676]' : currentResult.riskScore > 40 ? 'text-[#E5B764]' : 'text-[#55C99A]'
                    }`}>
                      {currentResult.riskScore}/100 ({currentResult.riskLevel})
                    </span>
                  </div>
                </div>

                <div className="text-xs text-[#F5F7F5] font-medium leading-relaxed">
                  {currentResult.summary}
                </div>

                {currentResult.suspiciousKeywords && currentResult.suspiciousKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {currentResult.suspiciousKeywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[#EB7676]/15 border border-[#EB7676]/30 text-[10px] font-mono text-[#EB7676]">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-1.5">
                  <span className="text-[11px] text-[#718D83] uppercase tracking-wider font-semibold">Key Findings:</span>
                  <ul className="list-disc list-inside text-xs text-[#A7C1B8] space-y-1">
                    {currentResult.findings.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-[#16352E]/60 border border-[#28443C] space-y-2">
                  <span className="text-xs font-bold text-[#A8E6CE]">Recommended Safety Actions:</span>
                  <ul className="text-xs text-[#A7C1B8] space-y-1">
                    {currentResult.recommendedActions.map((act, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-[#55C99A] shrink-0" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW 2: SECURITY REPORTS */}
      {subview === 'reports' && (
        <div className="space-y-4 max-w-4xl">
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] overflow-hidden">
            <div className="p-4 border-b border-[#28443C] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Security Inspection Reports</h3>
              <span className="text-xs text-[#718D83]">{analyses.length} verified records</span>
            </div>
            {analyses.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#718D83]">
                No fraud scans recorded yet. Analyze a suspicious SMS, email, or UPI message to save a security report.
              </div>
            ) : (
              <div className="divide-y divide-[#28443C]/40">
                {analyses.map(a => (
                  <div key={a.id} className="p-4 space-y-2 hover:bg-[#16352E]/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          a.riskLevel === 'CRITICAL' || a.riskLevel === 'HIGH'
                            ? 'bg-[#EB7676]/20 text-[#EB7676]'
                            : a.riskLevel === 'MEDIUM'
                            ? 'bg-[#E5B764]/20 text-[#E5B764]'
                            : 'bg-[#55C99A]/20 text-[#55C99A]'
                        }`}>
                          {a.riskLevel} RISK ({a.riskScore}/100)
                        </span>
                        <span className="text-xs text-[#718D83]">{a.sourceType} · {a.createdAt.split('T')[0]}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteReport(a.id)}
                        className="p-1 text-[#718D83] hover:text-[#EB7676]"
                        title="Delete Report"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-[#F5F7F5]">{a.summary}</p>
                    <p className="text-[11px] text-[#718D83] truncate italic">"{a.inputText}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#28443C] bg-[#16352E]/30 p-4 text-xs text-[#718D83] flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-[#A8E6CE] shrink-0" />
        <p>
          AI detection is probabilistic. A low-risk assessment does not guarantee that a message is genuine. Never disclose your banking passwords, OTPs, or UPI PINs to anyone.
        </p>
      </div>
    </div>
  );
};
