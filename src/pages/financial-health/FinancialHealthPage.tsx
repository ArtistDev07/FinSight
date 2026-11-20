import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Download, FileJson, Plus, Trash2, Save, AlertTriangle, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { formatINR } from '../../utils/financialMath';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslations } from '../../utils/i18n';
import type { FinancialHealthDimension, FinancialHealthSnapshot, ManualAssetLiability } from '../../types';

interface FinancialHealthPageProps {
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

interface HealthSummaryResponse {
  totalAssets: number;
  totalLiabilities: number;
  estimatedNetWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  savingsRate: number;
  emergencyFundCoverageMonths: number;
  compositeIndex: number;
  formulaDisclosure: string;
  missingDataNotes: string[];
  dimensions: FinancialHealthDimension[];
  observations: Array<{ id: string; title: string; calculation: string; severity: 'info' | 'warning' | 'positive' }>;
  manualItems: ManualAssetLiability[];
}

export const FinancialHealthPage: React.FC<FinancialHealthPageProps> = ({ onOpenAI }) => {
  const { preferences } = useAuth();
  const t = useTranslations(preferences?.language);
  const [summary, setSummary] = useState<HealthSummaryResponse | null>(null);
  const [history, setHistory] = useState<FinancialHealthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSnap, setSavingSnap] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [itemName, setItemName] = useState('');
  const [itemKind, setItemKind] = useState<'ASSET' | 'LIABILITY'>('ASSET');
  const [itemCategory, setItemCategory] = useState('Savings Account / FD');
  const [itemAmount, setItemAmount] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, histRes] = await Promise.all([
        apiFetch('/api/v1/financial-health/summary'),
        apiFetch('/api/v1/financial-health/history'),
      ]);
      const sumParsed = await parseApiResponse<{ data?: HealthSummaryResponse }>(sumRes);
      const histParsed = await parseApiResponse<{ data?: FinancialHealthSnapshot[] }>(histRes);
      if (sumParsed.ok && sumParsed.json?.data) setSummary(sumParsed.json.data);
      if (histParsed.ok && Array.isArray(histParsed.json?.data)) setHistory(histParsed.json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemAmount) return;
    const res = await apiFetch('/api/v1/financial-health/assets-liabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: itemName.trim(),
        kind: itemKind,
        category: itemCategory,
        amount: Number(itemAmount),
        included: true,
      }),
    });
    if (res.ok) {
      setItemName('');
      setItemAmount('');
      await loadData();
    }
  };

  const handleDeleteItem = async (id: string) => {
    await apiFetch(`/api/v1/financial-health/assets-liabilities/${id}`, { method: 'DELETE' });
    await loadData();
  };

  const handleSaveSnapshot = async () => {
    setSavingSnap(true);
    setStatusMsg(null);
    try {
      const res = await apiFetch('/api/v1/financial-health/snapshot', { method: 'POST' });
      if (res.ok) {
        setStatusMsg('Financial health snapshot recorded.');
        await loadData();
      }
    } finally {
      setSavingSnap(false);
    }
  };

  const handleDownloadJson = async () => {
    const res = await apiFetch('/api/v1/financial-health/report');
    if (!res.ok) return;
    const blob = new Blob([await res.text()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FinSight-Health-Report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    const res = await apiFetch('/api/v1/financial-health/report/pdf');
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FinSight-Health-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">
            Net Worth · Readiness · Transparent Score
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] mt-1">
            {t.modules.financialHealthTitle}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleSaveSnapshot} disabled={savingSnap} className="fs-btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save Snapshot
          </button>
          <button onClick={handleDownloadJson} className="fs-btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5">
            <FileJson className="h-3.5 w-3.5" /> JSON
          </button>
          <button onClick={handleDownloadPdf} className="fs-btn-primary px-3.5 py-2 text-xs inline-flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> Download PDF
          </button>
          <button onClick={onOpenAI} className="fs-btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--fs-accent)]" /> Ask AI
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-lg border border-[var(--fs-success)]/40 bg-[var(--fs-success)]/10 text-xs text-[var(--fs-success)]">
          {statusMsg}
        </div>
      )}

      {loading || !summary ? (
        <div className="fs-card p-8 text-xs text-[var(--fs-text-muted)]">Computing Financial Health Index from your verified records...</div>
      ) : (
        <>
          {/* Hero KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)] flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-[var(--fs-accent)]" /> Health Index
              </div>
              <div className="text-3xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">
                {summary.compositeIndex} <span className="text-sm font-normal text-[var(--fs-text-muted)]">/ 100</span>
              </div>
              <div className="text-[11px] text-[var(--fs-text-body)]">Weighted 5-dimension index</div>
            </div>
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)]">Estimated Net Worth</div>
              <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">
                {formatINR(summary.estimatedNetWorth)}
              </div>
              <div className="text-[11px] text-[var(--fs-text-body)]">
                Assets {formatINR(summary.totalAssets)} − Liabilities {formatINR(summary.totalLiabilities)}
              </div>
            </div>
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)]">Net Monthly Savings</div>
              <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">
                {formatINR(summary.monthlySavings)}
              </div>
              <div className="text-[11px] text-[var(--fs-text-body)]">Savings Rate: {summary.savingsRate}%</div>
            </div>
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)]">Emergency Coverage</div>
              <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">
                {summary.emergencyFundCoverageMonths} mos
              </div>
              <div className="text-[11px] text-[var(--fs-text-body)]">Target benchmark: 6 months</div>
            </div>
          </div>

          {/* Transparent Formula Disclosure */}
          <div className="fs-card p-4 bg-[var(--fs-surface-secondary)] text-xs text-[var(--fs-text-body)] flex items-start gap-2.5">
            <Info className="h-4 w-4 text-[var(--fs-accent)] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[var(--fs-text)]">Formula Transparency: </span>
              {summary.formulaDisclosure}
            </div>
          </div>

          {/* 5 Dimensions Breakdown + Observations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 fs-card p-6 space-y-4">
              <h2 className="text-base font-bold text-[var(--fs-text)]">Dimension Breakdown</h2>
              <div className="space-y-4">
                {summary.dimensions.map(dim => (
                  <div key={dim.key} className="space-y-1.5 pb-3 border-b border-[var(--fs-border)] last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--fs-text)]">
                        {dim.label} · <span className="font-normal text-[var(--fs-text-muted)]">{Math.round(dim.weight * 100)}% weight</span>
                      </span>
                      <span className="font-mono font-bold text-[var(--fs-text)] tabular-nums">
                        {dim.score}/100 · {dim.status}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--fs-surface-secondary)] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${dim.score}%`,
                          backgroundColor:
                            dim.status === 'STRONG' ? 'var(--fs-success)' : dim.status === 'MODERATE' ? 'var(--fs-warning)' : 'var(--fs-danger)',
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-[var(--fs-text-body)]">{dim.evidenceText}</p>
                    <p className="text-[10px] font-mono text-[var(--fs-text-muted)]">Formula: {dim.formulaSummary}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="fs-card p-6 space-y-3">
                <h2 className="text-base font-bold text-[var(--fs-text)]">Evidence-Based Observations</h2>
                {summary.observations.length === 0 ? (
                  <p className="text-xs text-[var(--fs-text-muted)]">Add transactions, goals, or holdings to generate evidence observations.</p>
                ) : (
                  <div className="space-y-3">
                    {summary.observations.map(obs => (
                      <div key={obs.id} className="p-3 rounded-lg bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] space-y-1">
                        <div className="flex items-start gap-2 text-xs font-semibold text-[var(--fs-text)]">
                          {obs.severity === 'warning' ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-[var(--fs-warning)] shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--fs-success)] shrink-0 mt-0.5" />
                          )}
                          <span>{obs.title}</span>
                        </div>
                        <p className="text-[11px] text-[var(--fs-text-body)] pl-5">{obs.calculation}</p>
                      </div>
                    ))}
                  </div>
                )}

                {summary.missingDataNotes.length > 0 && (
                  <div className="pt-2 border-t border-[var(--fs-border)] space-y-1">
                    <div className="text-[11px] font-semibold text-[var(--fs-warning)]">Missing Data Notes</div>
                    {summary.missingDataNotes.map(n => (
                      <p key={n} className="text-[11px] text-[var(--fs-text-muted)]">• {n}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Manual Assets & Liabilities Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleAddItem} className="lg:col-span-5 fs-card p-6 space-y-4">
              <h2 className="text-base font-bold text-[var(--fs-text)]">Add Manual Asset or Liability</h2>
              <p className="text-xs text-[var(--fs-text-muted)]">
                Include bank FDs, PPF, property equity, or loans (education/vehicle/home) for a complete net worth picture.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Type</label>
                  <select value={itemKind} onChange={e => setItemKind(e.target.value as 'ASSET' | 'LIABILITY')} className="fs-input">
                    <option value="ASSET">Asset (+)</option>
                    <option value="LIABILITY">Liability (−)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Amount (₹)</label>
                  <input type="number" min="0" value={itemAmount} onChange={e => setItemAmount(e.target.value)} className="fs-input" placeholder="250000" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Item Name</label>
                <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className="fs-input" placeholder="e.g. SBI PPF Account or Car Loan" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Category</label>
                <input type="text" value={itemCategory} onChange={e => setItemCategory(e.target.value)} className="fs-input" />
              </div>
              <button type="submit" className="fs-btn-primary w-full py-2.5 text-xs inline-flex items-center justify-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add to Net Worth
              </button>
            </form>

            <div className="lg:col-span-7 fs-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[var(--fs-text)]">Tracked Manual Items ({summary.manualItems.length})</h2>
                <span className="text-xs text-[var(--fs-text-muted)]">{history.length} saved snapshots</span>
              </div>
              {summary.manualItems.length === 0 ? (
                <p className="text-xs text-[var(--fs-text-muted)] py-6 text-center">
                  No manual assets or liabilities added yet. Portfolio holdings and credit card balances are automatically included above.
                </p>
              ) : (
                <div className="divide-y divide-[var(--fs-border)]">
                  {summary.manualItems.map(item => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-[var(--fs-text)]">{item.name}</div>
                        <div className="text-[11px] text-[var(--fs-text-muted)]">
                          {item.kind === 'ASSET' ? 'Asset' : 'Liability'} · {item.category}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            item.kind === 'ASSET' ? 'text-[var(--fs-success)]' : 'text-[var(--fs-danger)]'
                          }`}
                        >
                          {item.kind === 'ASSET' ? '+' : '−'}{formatINR(item.amount)}
                        </span>
                        <button onClick={() => handleDeleteItem(item.id)} className="text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]" aria-label="Delete item">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
