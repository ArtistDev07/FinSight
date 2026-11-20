import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Trash2,
  Link2,
  PhoneCall,
  QrCode,
} from 'lucide-react';
import { FraudAnalysis } from '../../types';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { inspectFraudSignals } from '../../utils/financialIntelligence';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';

interface FraudModuleProps {
  subview: 'overview' | 'analyze' | 'reports';
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

interface UrlInspectionItem {
  url: string;
  hostname: string;
  lookalikeWarning?: string;
}

type FraudAnalysisWithUrls = FraudAnalysis & {
  urlInspection?: UrlInspectionItem[];
};

export const FraudModule: React.FC<FraudModuleProps> = ({
  subview,
  onNavigate,
}) => {
  const [analyses, setAnalyses] = useState<FraudAnalysis[]>([]);
  const [inputText, setInputText] = useState('');
  const [sourceType, setSourceType] = useState<
    'SMS' | 'WhatsApp' | 'Email' | 'UPI App' | 'Website' | 'Other'
  >('SMS');
  const [removedConfidential, setRemovedConfidential] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<FraudAnalysisWithUrls | null>(null);
  const [upiString, setUpiString] = useState('');

  useEffect(() => {
    apiFetch('/api/v1/fraud/analyses')
      .then(res => res.json())
      .then(json => {
        if (json.success) setAnalyses(json.data || []);
      })
      .catch(() => undefined);
  }, []);

  const liveSignals = inputText.trim().length >= 5 ? inspectFraudSignals(inputText.trim()) : null;

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
      const parsed = await parseApiResponse<{
        success: boolean;
        data?: FraudAnalysisWithUrls;
      }>(res);
      if (!parsed.ok || !parsed.json?.data) {
        throw new Error(parsed.errorMessage || `Gemini analysis failed (HTTP ${res.status}).`);
      }
      const analysis = parsed.json.data;
      setCurrentResult(analysis);
      setAnalyses(prev => [analysis, ...prev]);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Unable to complete Gemini fraud analysis.'
      );
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

  const parsedUpi = (() => {
    const raw = upiString.trim();
    if (!raw) return null;
    try {
      const normalized = raw.startsWith('upi://') ? raw : `upi://pay?${raw}`;
      const u = new URL(normalized);
      const pa = u.searchParams.get('pa') || 'Unknown VPA';
      const pn = u.searchParams.get('pn') || 'Unspecified Payee';
      const am = u.searchParams.get('am') || 'Variable';
      const tn = u.searchParams.get('tn') || '';
      const flags: string[] = [];
      if (/collect|refund|claim|prize|lottery/i.test(`${pa} ${pn} ${tn}`)) {
        flags.push('Contains reward/refund/collect phrasing — remember you NEVER enter PIN to receive money.');
      }
      if (/^unknown/i.test(pa) || !pa.includes('@')) {
        flags.push('Missing valid NPCI UPI handle (@bank / @ok... / @ybl / @ibl).');
      }
      return { pa, pn, am, tn, flags };
    } catch {
      return {
        pa: raw,
        pn: 'Unparsed URI',
        am: '—',
        tn: '',
        flags: ['Not a standard upi://pay?... payment intent URI.'],
      };
    }
  })();

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
      label: 'Electricity Disconnection',
      text: 'Dear consumer, electricity power will be disconnected tonight at 9:30 PM because previous bill was not updated. Immediately call officer Sharma at 9876543210.',
      source: 'SMS' as const,
    },
    {
      label: 'Digital Arrest Threat',
      text: 'URGENT: Narcotics parcel linked to your Aadhaar seized at Mumbai Customs. Stay on Skype video call for digital arrest verification or transfer bail deposit immediately.',
      source: 'WhatsApp' as const,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--fs-border)] pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">
            Domain Lookalike Shield · UPI Safety · Cybercrime 1930 Guide
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] tracking-tight mt-1">
            Scam &amp; Fraud Detector
          </h1>
          <p className="text-xs text-[var(--fs-text-body)] mt-1">
            Examine suspicious SMS alerts, lookalike banking domains, and UPI collect requests powered by deterministic URL rules + Gemini AI.
          </p>
        </div>
        <button
          onClick={() => {
            setCurrentResult(null);
            setAnalysisError(null);
            onNavigate('/app/fraud/analyze');
          }}
          className="fs-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-xs self-start"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Analyze a Message</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--fs-border)] pb-2 overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => onNavigate('/app/fraud')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
            subview === 'overview'
              ? 'bg-[var(--fs-surface-secondary)] text-[var(--fs-text)] border border-[var(--fs-border)]'
              : 'text-[var(--fs-text-body)] hover:text-[var(--fs-text)]'
          }`}
        >
          Overview &amp; Quick Check
        </button>
        <button
          onClick={() => onNavigate('/app/fraud/analyze')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
            subview === 'analyze'
              ? 'bg-[var(--fs-surface-secondary)] text-[var(--fs-text)] border border-[var(--fs-border)]'
              : 'text-[var(--fs-text-body)] hover:text-[var(--fs-text)]'
          }`}
        >
          Deep Message Scanner
        </button>
        <button
          onClick={() => onNavigate('/app/fraud/reports')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
            subview === 'reports'
              ? 'bg-[var(--fs-surface-secondary)] text-[var(--fs-text)] border border-[var(--fs-border)]'
              : 'text-[var(--fs-text-body)] hover:text-[var(--fs-text)]'
          }`}
        >
          Security History ({analyses.length})
        </button>
      </div>

      {/* SUBVIEW 1: OVERVIEW & ANALYZER */}
      {(subview === 'overview' || subview === 'analyze') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="fs-card p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-[var(--fs-text)]">Check Before You Click</h3>
                <p className="text-xs text-[var(--fs-text-body)] mt-1">
                  Paste the SMS, WhatsApp text, email, or UPI collect payment request you want to examine.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] text-[var(--fs-text-muted)]">
                  Try a documented Indian scam pattern:
                </span>
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
                      className="fs-btn-secondary px-2.5 py-1 text-[11px]"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                    Message Content:
                  </label>
                  <textarea
                    rows={4}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder="Paste the SMS, UPI request, email, or payment message you want to examine..."
                    className="fs-input"
                    required
                  />
                </div>

                {/* Live Deterministic URL / Signal Preview */}
                {liveSignals && (liveSignals.urls.length > 0 || liveSignals.deterministicEvidence.length > 0) && (
                  <div className="p-3.5 rounded-xl bg-[var(--fs-warning)]/10 border border-[var(--fs-warning)]/30 space-y-1.5 text-xs">
                    <div className="font-bold text-[var(--fs-warning)] flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5" />
                      <span>Instant Deterministic Pre-Scan Signals</span>
                    </div>
                    {liveSignals.urls.map(u => (
                      <div key={u.url} className="text-[11px] text-[var(--fs-text)]">
                        <span className="font-mono">{u.hostname}</span>
                        {u.lookalikeWarning && (
                          <span className="text-[var(--fs-danger)] font-semibold ml-1.5">
                            — {u.lookalikeWarning}
                          </span>
                        )}
                      </div>
                    ))}
                    {liveSignals.deterministicEvidence.slice(0, 2).map((ev, idx) => (
                      <div key={idx} className="text-[11px] text-[var(--fs-text-body)]">
                        • {ev}
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                      Where did you receive this message?
                    </label>
                    <select
                      value={sourceType}
                      onChange={e => setSourceType(e.target.value as FraudAnalysis['sourceType'])}
                      className="fs-input"
                    >
                      <option value="SMS">SMS Alert</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Email">Email</option>
                      <option value="UPI App">UPI App (GPay/PhonePe/Paytm)</option>
                      <option value="Website">Website Link</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-4">
                    <label className="flex items-start gap-2 cursor-pointer text-xs text-[var(--fs-text-body)]">
                      <input
                        type="checkbox"
                        checked={removedConfidential}
                        onChange={e => setRemovedConfidential(e.target.checked)}
                        className="mt-0.5 rounded border-[var(--fs-border)] accent-[var(--fs-accent)]"
                        required
                      />
                      <span>I have removed any passwords, OTPs, PINs, or confidential credentials.</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isAnalyzing || !inputText.trim() || !removedConfidential}
                  className="fs-btn-primary px-6 py-2.5 text-xs disabled:opacity-50 inline-flex items-center gap-2"
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
                <div className="p-4 rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/30 text-xs text-[var(--fs-danger)] flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Gemini AI Analysis Unavailable</div>
                    <div className="mt-0.5">{analysisError}</div>
                  </div>
                </div>
              )}

              {currentResult && (
                <div className="p-6 rounded-2xl bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--fs-border)] pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldAlert
                        className={`h-5 w-5 ${
                          currentResult.riskLevel === 'CRITICAL' ||
                          currentResult.riskLevel === 'HIGH'
                            ? 'text-[var(--fs-danger)]'
                            : currentResult.riskLevel === 'MEDIUM'
                            ? 'text-[var(--fs-warning)]'
                            : 'text-[var(--fs-success)]'
                        }`}
                      />
                      <div>
                        <h4 className="text-sm font-bold text-[var(--fs-text)]">
                          Security Risk Assessment
                        </h4>
                        <span className="text-[10px] font-mono text-[var(--fs-text-muted)]">
                          Model: {currentResult.modelUsed}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--fs-text-muted)]">Risk Score:</span>
                      <span
                        className={`text-sm font-extrabold font-mono-num tabular-nums ${
                          currentResult.riskScore > 75
                            ? 'text-[var(--fs-danger)]'
                            : currentResult.riskScore > 40
                            ? 'text-[var(--fs-warning)]'
                            : 'text-[var(--fs-success)]'
                        }`}
                      >
                        {currentResult.riskScore}/100 ({currentResult.riskLevel})
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-[var(--fs-text)] font-medium leading-relaxed">
                    {currentResult.summary}
                  </div>

                  {currentResult.urlInspection && currentResult.urlInspection.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-[var(--fs-surface)] border border-[var(--fs-border)] space-y-1.5">
                      <span className="text-[11px] font-bold text-[var(--fs-text)] uppercase tracking-wider">
                        Domain &amp; Link Inspection
                      </span>
                      {currentResult.urlInspection.map((u, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-mono text-[var(--fs-accent)]">{u.hostname}</span>
                          {u.lookalikeWarning ? (
                            <p className="text-[11px] text-[var(--fs-danger)] font-semibold">
                              ⚠ {u.lookalikeWarning}
                            </p>
                          ) : (
                            <p className="text-[11px] text-[var(--fs-text-muted)]">
                              Verify official institution domain before signing in.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {currentResult.suspiciousKeywords &&
                    currentResult.suspiciousKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {currentResult.suspiciousKeywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded bg-[var(--fs-danger)]/15 border border-[var(--fs-danger)]/30 text-[10px] font-mono text-[var(--fs-danger)]"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                  <div className="space-y-1.5">
                    <span className="text-[11px] text-[var(--fs-text-muted)] uppercase tracking-wider font-semibold">
                      Key Findings:
                    </span>
                    <ul className="list-disc list-inside text-xs text-[var(--fs-text-body)] space-y-1">
                      {currentResult.findings.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-[var(--fs-surface)] border border-[var(--fs-border)] space-y-2">
                    <span className="text-xs font-bold text-[var(--fs-accent)]">
                      Recommended Safety Actions:
                    </span>
                    <ul className="text-xs text-[var(--fs-text-body)] space-y-1">
                      {currentResult.recommendedActions.map((act, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-3.5 w-3.5 text-[var(--fs-success)] shrink-0 mt-0.5" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: QR / UPI URI Inspector + Emergency 1930 Shield */}
          <div className="lg:col-span-4 space-y-6">
            <div className="fs-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[var(--fs-accent)]" />
                <h3 className="text-sm font-bold text-[var(--fs-text)]">
                  UPI / QR Intent Quick Check
                </h3>
              </div>
              <p className="text-xs text-[var(--fs-text-muted)]">
                Paste a decoded QR string (<span className="font-mono">upi://pay?pa=...</span>) to inspect the payee VPA before opening your UPI app.
              </p>
              <input
                type="text"
                value={upiString}
                onChange={e => setUpiString(e.target.value)}
                placeholder="upi://pay?pa=merchant@ybl&pn=Store&am=500"
                className="fs-input font-mono text-xs"
              />
              {parsedUpi && (
                <div className="p-3 rounded-xl bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] space-y-1.5 text-xs">
                  <div>
                    <span className="text-[var(--fs-text-muted)]">Payee VPA: </span>
                    <span className="font-mono font-bold text-[var(--fs-text)]">{parsedUpi.pa}</span>
                  </div>
                  <div>
                    <span className="text-[var(--fs-text-muted)]">Name: </span>
                    <span className="text-[var(--fs-text)]">{parsedUpi.pn}</span>
                  </div>
                  <div>
                    <span className="text-[var(--fs-text-muted)]">Amount: </span>
                    <span className="font-mono-num text-[var(--fs-text)]">{parsedUpi.am}</span>
                  </div>
                  {parsedUpi.flags.map((f, idx) => (
                    <p key={idx} className="text-[11px] text-[var(--fs-danger)] font-semibold pt-1">
                      ⚠ {f}
                    </p>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setInputText(`Inspect UPI URI: ${upiString}`);
                      setSourceType('UPI App');
                      setRemovedConfidential(true);
                    }}
                    className="text-[11px] font-semibold text-[var(--fs-accent)] hover:underline pt-1"
                  >
                    Send to Deep Message Scanner →
                  </button>
                </div>
              )}
            </div>

            <div className="fs-card p-5 border-[var(--fs-danger)]/35 space-y-3">
              <div className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-[var(--fs-danger)]" />
                <h3 className="text-sm font-bold text-[var(--fs-text)]">
                  Emergency Scam Response (India)
                </h3>
              </div>
              <div className="p-3 rounded-xl bg-[var(--fs-danger)]/10 text-xs space-y-1">
                <div className="font-bold text-[var(--fs-danger)]">
                  National Cybercrime Helpline: 1930
                </div>
                <div className="text-[var(--fs-text-body)]">
                  Official Portal: <span className="font-mono font-semibold">cybercrime.gov.in</span>
                </div>
              </div>
              <ul className="text-xs text-[var(--fs-text-body)] space-y-1.5 list-disc list-inside">
                <li>Report unauthorized UPI/card debits immediately within the first 2 hours to freeze fund trails.</li>
                <li>Call your bank&apos;s official toll-free number to block cards and disable NetBanking.</li>
                <li>Never install remote screen-sharing apps (AnyDesk, TeamViewer) requested by callers.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 2: SECURITY REPORTS */}
      {subview === 'reports' && (
        <div className="space-y-4 max-w-4xl">
          <div className="fs-card overflow-hidden">
            <div className="p-4 border-b border-[var(--fs-border)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--fs-text)]">Security Inspection Reports</h3>
              <span className="text-xs text-[var(--fs-text-muted)]">
                {analyses.length} verified records
              </span>
            </div>
            {analyses.length === 0 ? (
              <div className="p-4">
                <EmptyStateCard
                  variant="fraud"
                  title="No fraud scans recorded yet"
                  description="Analyze a suspicious SMS, WhatsApp forward, or UPI payment request to save a timestamped security report."
                  actionLabel="Scan a Message"
                  onAction={() => onNavigate('/app/fraud/analyze')}
                />
              </div>
            ) : (
              <div className="divide-y divide-[var(--fs-border)]">
                {analyses.map(a => (
                  <div
                    key={a.id}
                    className="p-4 space-y-2 hover:bg-[var(--fs-surface-secondary)]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.riskLevel === 'CRITICAL' || a.riskLevel === 'HIGH'
                              ? 'bg-[var(--fs-danger)]/15 text-[var(--fs-danger)]'
                              : a.riskLevel === 'MEDIUM'
                              ? 'bg-[var(--fs-warning)]/15 text-[var(--fs-warning)]'
                              : 'bg-[var(--fs-success)]/15 text-[var(--fs-success)]'
                          }`}
                        >
                          {a.riskLevel} RISK ({a.riskScore}/100)
                        </span>
                        <span className="text-xs text-[var(--fs-text-muted)]">
                          {a.sourceType} · {a.createdAt.split('T')[0]}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteReport(a.id)}
                        aria-label={`Delete report ${a.id}`}
                        className="p-1 text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-[var(--fs-text)]">{a.summary}</p>
                    <p className="text-[11px] text-[var(--fs-text-muted)] truncate italic">
                      &ldquo;{a.inputText}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fs-card-secondary p-4 text-xs text-[var(--fs-text-muted)] flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-[var(--fs-accent)] shrink-0" />
        <p>
          AI detection is probabilistic. A low-risk assessment does not guarantee that a message is genuine. Never disclose your banking passwords, OTPs, or UPI PINs to anyone.
        </p>
      </div>
    </div>
  );
};
