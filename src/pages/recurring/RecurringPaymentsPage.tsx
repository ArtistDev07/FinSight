import React, { useEffect, useState, useCallback } from 'react';
import { Repeat, Search, CheckCircle2, XCircle, Trash2, Sparkles } from 'lucide-react';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { formatINR } from '../../utils/financialMath';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslations } from '../../utils/i18n';
import type { RecurringPayment } from '../../types';

interface RecurringPaymentsPageProps {
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

export const RecurringPaymentsPage: React.FC<RecurringPaymentsPageProps> = ({ onOpenAI }) => {
  const { preferences } = useAuth();
  const t = useTranslations(preferences?.language);
  const [items, setItems] = useState<RecurringPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRecurring = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/recurring-payments');
      const parsed = await parseApiResponse<{ data?: RecurringPayment[] }>(res);
      if (parsed.ok && Array.isArray(parsed.json?.data)) {
        setItems(parsed.json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecurring();
  }, [loadRecurring]);

  const handleDetect = async () => {
    setDetecting(true);
    setNotice(null);
    try {
      const res = await apiFetch('/api/v1/recurring-payments/detect', { method: 'POST' });
      const parsed = await parseApiResponse<{ data?: RecurringPayment[]; newlyDetectedCount?: number }>(res);
      if (parsed.ok) {
        if (Array.isArray(parsed.json?.data)) setItems(parsed.json.data);
        setNotice(
          parsed.json?.newlyDetectedCount
            ? `Detected ${parsed.json.newlyDetectedCount} recurring candidate(s) from your transaction history.`
            : 'Scan complete. No new recurring patterns detected beyond tracked items.'
        );
      }
    } finally {
      setDetecting(false);
    }
  };

  const handleStatus = async (id: string, status: RecurringPayment['status']) => {
    await apiFetch(`/api/v1/recurring-payments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await loadRecurring();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/v1/recurring-payments/${id}`, { method: 'DELETE' });
    await loadRecurring();
  };

  const activeItems = items.filter(i => i.status === 'CONFIRMED' || i.status === 'DETECTED');
  const monthlyEstimate = activeItems.reduce((sum, r) => {
    const mult = r.frequency === 'WEEKLY' ? 4.3 : r.frequency === 'QUARTERLY' ? 1 / 3 : r.frequency === 'YEARLY' ? 1 / 12 : 1;
    return sum + r.estimatedAmount * mult;
  }, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">
            Subscription Intelligence · Commitment Tracking
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] mt-1">
            {t.modules.recurringTitle}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleDetect} disabled={detecting} className="fs-btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" /> {detecting ? 'Scanning History...' : 'Scan Transactions'}
          </button>
          <button onClick={onOpenAI} className="fs-btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--fs-accent)]" /> Ask AI
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-surface-secondary)] text-xs text-[var(--fs-text)]">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="fs-card p-5 space-y-1">
          <div className="text-xs text-[var(--fs-text-muted)]">Estimated Monthly Recurring Cost</div>
          <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">{formatINR(Math.round(monthlyEstimate))}</div>
        </div>
        <div className="fs-card p-5 space-y-1">
          <div className="text-xs text-[var(--fs-text-muted)]">Annualized Commitment</div>
          <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">{formatINR(Math.round(monthlyEstimate * 12))}</div>
        </div>
        <div className="fs-card p-5 space-y-1">
          <div className="text-xs text-[var(--fs-text-muted)]">Tracked Subscriptions / Bills</div>
          <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">{activeItems.length}</div>
        </div>
      </div>

      <div className="fs-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--fs-text)] flex items-center gap-2">
            <Repeat className="h-4 w-4 text-[var(--fs-accent)]" /> Recurring Commitments
          </h2>
          <span className="text-[11px] text-[var(--fs-text-muted)]">Confirm or mark cancelled manually — FinSight never cancels mandates automatically</span>
        </div>

        {loading ? (
          <div className="text-xs text-[var(--fs-text-muted)]">Loading recurring commitments...</div>
        ) : items.length === 0 ? (
          <EmptyStateCard
            variant="recurring"
            title="No recurring payments detected yet"
            body="Log two or more transactions for the same subscription or utility merchant and click 'Scan Transactions' above."
            actionLabel="Scan Transaction History"
            onAction={handleDetect}
          />
        ) : (
          <div className="divide-y divide-[var(--fs-border)]">
            {items.map(rec => {
              const priceCreep = rec.previousAmount && rec.estimatedAmount > rec.previousAmount;
              return (
                <div key={rec.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm text-[var(--fs-text)]">{rec.merchant}</div>
                    <div className="text-[11px] text-[var(--fs-text-muted)]">
                      {rec.category} · {rec.frequency} · Next estimated: {rec.nextEstimatedDate} · Status: {rec.status} ({rec.confidence}% match)
                    </div>
                    {priceCreep && (
                      <div className="text-[11px] text-[var(--fs-warning)] font-medium">
                        Amount increased from {formatINR(rec.previousAmount!)} to {formatINR(rec.estimatedAmount)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono font-bold text-sm text-[var(--fs-text)] tabular-nums">{formatINR(rec.estimatedAmount)}</span>
                    {rec.status !== 'CONFIRMED' && (
                      <button
                        onClick={() => handleStatus(rec.id, 'CONFIRMED')}
                        className="text-[var(--fs-success)] font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                      </button>
                    )}
                    {rec.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleStatus(rec.id, 'CANCELLED')}
                        className="text-[var(--fs-warning)] hover:underline inline-flex items-center gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Mark Cancelled
                      </button>
                    )}
                    <button onClick={() => handleDelete(rec.id)} className="text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]" aria-label="Delete recurring item">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
