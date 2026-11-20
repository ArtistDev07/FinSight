import React, { useEffect, useState, useCallback } from 'react';
import { CheckSquare, Play, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { formatINR } from '../../utils/financialMath';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslations } from '../../utils/i18n';
import type { BusinessReconciliationRun } from '../../types';

interface ReconciliationPageProps {
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

export const ReconciliationPage: React.FC<ReconciliationPageProps> = ({ onOpenAI }) => {
  const { preferences } = useAuth();
  const t = useTranslations(preferences?.language);
  const [runs, setRuns] = useState<BusinessReconciliationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/business/reconciliation');
      const parsed = await parseApiResponse<{ data?: BusinessReconciliationRun[] }>(res);
      if (parsed.ok && Array.isArray(parsed.json?.data)) setRuns(parsed.json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await apiFetch('/api/v1/business/reconciliation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType: 'FULL_LEDGER' }),
      });
      if (res.ok) await loadRuns();
    } finally {
      setRunning(false);
    }
  };

  const handleConfirm = async (id: string) => {
    await apiFetch(`/api/v1/business/reconciliation/${id}/confirm`, { method: 'POST' });
    await loadRuns();
  };

  const latest = runs[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">
            Bank Credits vs Invoices · Exception Detection
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] mt-1">
            {t.modules.reconciliationTitle}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleRun} disabled={running} className="fs-btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5" /> {running ? 'Matching Ledger...' : 'Run Deterministic Match'}
          </button>
          <button onClick={onOpenAI} className="fs-btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--fs-accent)]" /> Ask AI
          </button>
        </div>
      </div>

      {loading ? (
        <div className="fs-card p-8 text-xs text-[var(--fs-text-muted)]">Loading reconciliation runs...</div>
      ) : !latest ? (
        <EmptyStateCard
          variant="invoices"
          title="No ledger reconciliation run yet"
          body="Compare your recorded income credits against business GST invoices to surface unmatched deposits, outstanding balances, and potential duplicates."
          actionLabel="Run First Reconciliation"
          onAction={handleRun}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)]">Matched Pairs</div>
              <div className="text-2xl font-extrabold font-mono text-[var(--fs-success)] tabular-nums">{latest.matchedRecords.length}</div>
            </div>
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)]">Unmatched Records</div>
              <div className="text-2xl font-extrabold font-mono text-[var(--fs-warning)] tabular-nums">{latest.unmatchedRecords.length}</div>
            </div>
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)]">Exceptions Surfaced</div>
              <div className="text-2xl font-extrabold font-mono text-[var(--fs-danger)] tabular-nums">{latest.exceptions.length}</div>
            </div>
          </div>

          <div className="fs-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--fs-border)] pb-3">
              <div>
                <h2 className="text-base font-bold text-[var(--fs-text)] flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-[var(--fs-accent)]" /> Latest Run ({latest.period})
                </h2>
                <p className="text-[11px] text-[var(--fs-text-muted)]">
                  Status: {latest.status} · Executed {new Date(latest.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              {latest.status !== 'CONFIRMED' ? (
                <button onClick={() => handleConfirm(latest.id)} className="fs-btn-primary px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5 self-start">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirm User Review
                </button>
              ) : (
                <span className="text-xs font-semibold text-[var(--fs-success)] inline-flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Confirmed by User
                </span>
              )}
            </div>

            {latest.matchedRecords.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fs-text)]">Matched Bank Credits &amp; Invoices</h3>
                <div className="divide-y divide-[var(--fs-border)]">
                  {latest.matchedRecords.map((m, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between text-xs">
                      <span>{m.label} ({m.confidence}% exact amount match)</span>
                      <span className="font-mono font-bold text-[var(--fs-success)]">{formatINR(m.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {latest.exceptions.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fs-text)]">Exceptions Requiring Verification</h3>
                <div className="space-y-2">
                  {latest.exceptions.map(exc => (
                    <div key={exc.id} className="p-3 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-bg)] flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-4 w-4 text-[var(--fs-warning)] shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-[var(--fs-text)]">{exc.type} · {exc.severity}</div>
                        <div className="text-[var(--fs-text-body)]">{exc.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
