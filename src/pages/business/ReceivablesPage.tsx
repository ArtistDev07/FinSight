import React, { useEffect, useState, useCallback } from 'react';
import { Clock, Copy, Check, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { formatINR } from '../../utils/financialMath';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslations } from '../../utils/i18n';
import type { Invoice, PaymentFollowUp } from '../../types';

interface ReceivablesPageProps {
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

interface ReceivablesResponse {
  totalOutstanding: number;
  overdueAmount: number;
  dueThisWeek: number;
  expectedCollections: number;
  avgCollectionPeriodDays: number | null;
  agingBuckets: {
    notDue: number;
    days1To30: number;
    days31To60: number;
    days61To90: number;
    over90: number;
  };
  invoices: Invoice[];
  followUps: PaymentFollowUp[];
}

export const ReceivablesPage: React.FC<ReceivablesPageProps> = ({ onNavigate, onOpenAI }) => {
  const { preferences } = useAuth();
  const t = useTranslations(preferences?.language);
  const [data, setData] = useState<ReceivablesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/business/receivables');
      const parsed = await parseApiResponse<{ data?: ReceivablesResponse }>(res);
      if (parsed.ok && parsed.json?.data) setData(parsed.json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDraftFollowUp = async (invoiceId: string, reminderType: PaymentFollowUp['reminderType']) => {
    await apiFetch('/api/v1/business/receivables/follow-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, reminderType }),
    });
    await loadData();
  };

  const handleMarkSent = async (id: string) => {
    await apiFetch(`/api/v1/business/receivables/follow-up/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'MARKED_SENT_EXTERNALLY' }),
    });
    await loadData();
  };

  const handleCopy = async (id: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // clipboard fallback
    }
  };

  const unpaidInvoices = (data?.invoices || []).filter(i => i.balanceDue > 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">
            Collections · Aging Buckets · Copy-Only Reminders
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] mt-1">
            {t.modules.receivablesTitle}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate('/app/business/invoices/new')} className="fs-btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5">
            New GST Invoice <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button onClick={onOpenAI} className="fs-btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--fs-accent)]" /> Ask AI
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="fs-card p-8 text-xs text-[var(--fs-text-muted)]">Computing accounts receivable aging...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)]">Total Outstanding</div>
              <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">{formatINR(data.totalOutstanding)}</div>
            </div>
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)]">Overdue Balance</div>
              <div className="text-2xl font-extrabold font-mono text-[var(--fs-danger)] tabular-nums">{formatINR(data.overdueAmount)}</div>
            </div>
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)]">Due Within 7 Days</div>
              <div className="text-2xl font-extrabold font-mono text-[var(--fs-warning)] tabular-nums">{formatINR(data.dueThisWeek)}</div>
            </div>
            <div className="fs-card p-5 space-y-1">
              <div className="text-xs text-[var(--fs-text-muted)]">Expected Collections (excl. 90d+)</div>
              <div className="text-2xl font-extrabold font-mono text-[var(--fs-success)] tabular-nums">{formatINR(data.expectedCollections)}</div>
            </div>
          </div>

          {/* Aging Buckets */}
          <div className="fs-card p-6 space-y-3">
            <h2 className="text-base font-bold text-[var(--fs-text)] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--fs-accent)]" /> Aging Breakdown
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              {[
                { label: 'Not Due', val: data.agingBuckets.notDue },
                { label: '1–30 Days Overdue', val: data.agingBuckets.days1To30 },
                { label: '31–60 Days Overdue', val: data.agingBuckets.days31To60 },
                { label: '61–90 Days Overdue', val: data.agingBuckets.days61To90 },
                { label: '90+ Days Overdue', val: data.agingBuckets.over90 },
              ].map(b => (
                <div key={b.label} className="p-3 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-bg)]">
                  <div className="text-[11px] text-[var(--fs-text-muted)]">{b.label}</div>
                  <div className="font-mono font-bold text-sm text-[var(--fs-text)] mt-1 tabular-nums">{formatINR(b.val)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Unpaid Invoices & Draft Builder */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 fs-card p-6 space-y-4">
              <h2 className="text-base font-bold text-[var(--fs-text)]">Open Receivables ({unpaidInvoices.length})</h2>
              {unpaidInvoices.length === 0 ? (
                <EmptyStateCard
                  variant="invoices"
                  title="All invoices are settled"
                  body="When you create GST invoices with unpaid balances, FinSight tracks aging and helps prepare follow-up drafts here."
                  actionLabel="Create Invoice"
                  onAction={() => onNavigate('/app/business/invoices/new')}
                />
              ) : (
                <div className="divide-y divide-[var(--fs-border)]">
                  {unpaidInvoices.map(inv => (
                    <div key={inv.id} className="py-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[var(--fs-text)]">{inv.invoiceNumber} · {inv.clientName}</div>
                          <div className="text-[11px] text-[var(--fs-text-muted)]">Due {inv.dueDate} · Status {inv.status}</div>
                        </div>
                        <span className="font-mono font-bold text-[var(--fs-text)] tabular-nums">{formatINR(inv.balanceDue)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleDraftFollowUp(inv.id, 'FRIENDLY')} className="fs-btn-secondary px-2.5 py-1 text-[11px]">
                          Draft Friendly Reminder
                        </button>
                        <button onClick={() => handleDraftFollowUp(inv.id, 'OVERDUE')} className="fs-btn-secondary px-2.5 py-1 text-[11px]">
                          Draft Overdue Notice
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Follow-up Drafts (Copy Only) */}
            <div className="lg:col-span-6 fs-card p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-[var(--fs-text)]">Payment Follow-Up Drafts ({data.followUps.length})</h2>
                <p className="text-[11px] text-[var(--fs-text-muted)]">
                  FinSight drafts reminder text locally for you to review and copy. Messages are never emailed or WhatsApped automatically.
                </p>
              </div>
              {data.followUps.length === 0 ? (
                <p className="text-xs text-[var(--fs-text-muted)] py-8 text-center">
                  Select an unpaid invoice on the left to generate a polite follow-up message draft.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.followUps.map(fu => (
                    <div key={fu.id} className="p-4 rounded-xl border border-[var(--fs-border)] bg-[var(--fs-bg)] space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--fs-text)]">
                          {fu.invoiceNumber} · {fu.clientName} ({fu.reminderType})
                        </span>
                        <span className="text-[11px] font-mono text-[var(--fs-text-muted)]">
                          {fu.status === 'MARKED_SENT_EXTERNALLY' ? 'Sent manually' : 'Draft only'}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-xs text-[var(--fs-text-body)] bg-[var(--fs-surface)] p-3 rounded-lg border border-[var(--fs-border)]">
                        {fu.generatedMessage}
                      </pre>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleCopy(fu.id, fu.generatedMessage)}
                          className="text-[var(--fs-accent)] font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          {copiedId === fu.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedId === fu.id ? 'Copied' : 'Copy Message'}
                        </button>
                        {fu.status !== 'MARKED_SENT_EXTERNALLY' && (
                          <button
                            onClick={() => handleMarkSent(fu.id)}
                            className="text-[var(--fs-success)] hover:underline inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Mark Sent Externally
                          </button>
                        )}
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
