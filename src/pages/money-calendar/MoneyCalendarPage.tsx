import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Plus, CheckCircle2, Trash2, AlertTriangle, Sparkles } from 'lucide-react';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { formatINR } from '../../utils/financialMath';
import { BalanceProjectionLineChart } from '../../components/charts/FinSightCharts';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslations } from '../../utils/i18n';
import type { MoneyCalendarEvent } from '../../types';

interface MoneyCalendarPageProps {
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

interface RadarData {
  horizonDays: 7 | 30 | 90;
  openingBalance: number;
  expectedInflows: number;
  expectedOutflows: number;
  projectedClosingBalance: number;
  shortfallDates: Array<{ date: string; projectedBalance: number; eventTitle: string }>;
  timeline: Array<{ label: string; balance: number }>;
  eventsInWindow: MoneyCalendarEvent[];
  formula: string;
}

export const MoneyCalendarPage: React.FC<MoneyCalendarPageProps> = ({ onOpenAI }) => {
  const { preferences } = useAuth();
  const t = useTranslations(preferences?.language);
  const [horizon, setHorizon] = useState<7 | 30 | 90>(30);
  const [whatIfExpense, setWhatIfExpense] = useState('');
  const [radar, setRadar] = useState<RadarData | null>(null);
  const [allEvents, setAllEvents] = useState<MoneyCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<MoneyCalendarEvent['eventType']>('BILL');
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'INFLOW' | 'OUTFLOW'>('OUTFLOW');
  const [recurrence, setRecurrence] = useState<'ONCE' | 'MONTHLY'>('MONTHLY');

  const loadRadar = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        horizon: String(horizon),
        whatIfExpense: String(Math.max(0, Number(whatIfExpense) || 0)),
      });
      const [radRes, evRes] = await Promise.all([
        apiFetch(`/api/v1/calendar/radar?${q.toString()}`),
        apiFetch('/api/v1/calendar/events'),
      ]);
      const radParsed = await parseApiResponse<{ data?: RadarData }>(radRes);
      const evParsed = await parseApiResponse<{ data?: MoneyCalendarEvent[] }>(evRes);
      if (radParsed.ok && radParsed.json?.data) setRadar(radParsed.json.data);
      if (evParsed.ok && Array.isArray(evParsed.json?.data)) setAllEvents(evParsed.json.data);
    } finally {
      setLoading(false);
    }
  }, [horizon, whatIfExpense]);

  useEffect(() => {
    loadRadar();
  }, [loadRadar]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    const res = await apiFetch('/api/v1/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        eventType,
        dueDate,
        amount: Number(amount),
        direction,
        recurrence,
      }),
    });
    if (res.ok) {
      setTitle('');
      setAmount('');
      await loadRadar();
    }
  };

  const handleMarkPaid = async (id: string) => {
    if (id.startsWith('derived-')) return;
    await apiFetch(`/api/v1/calendar/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' }),
    });
    await loadRadar();
  };

  const handleDeleteEvent = async (id: string) => {
    if (id.startsWith('derived-')) return;
    await apiFetch(`/api/v1/calendar/events/${id}`, { method: 'DELETE' });
    await loadRadar();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">
            Forward Liquidity · Commitments · What-If Stress Test
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] mt-1">
            {t.modules.moneyCalendarTitle}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([7, 30, 90] as const).map(h => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                horizon === h
                  ? 'bg-[var(--fs-brand)] text-white'
                  : 'fs-btn-secondary'
              }`}
            >
              {h} Days
            </button>
          ))}
          <button onClick={onOpenAI} className="fs-btn-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[var(--fs-accent)]" /> Ask AI
          </button>
        </div>
      </div>

      {/* Radar Summary Cards */}
      {radar && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="fs-card p-5 space-y-1">
            <div className="text-xs text-[var(--fs-text-muted)]">Opening Liquid Estimate</div>
            <div className="text-xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">{formatINR(radar.openingBalance)}</div>
          </div>
          <div className="fs-card p-5 space-y-1">
            <div className="text-xs text-[var(--fs-text-muted)]">Expected Inflows ({horizon}d)</div>
            <div className="text-xl font-extrabold font-mono text-[var(--fs-success)] tabular-nums">+{formatINR(radar.expectedInflows)}</div>
          </div>
          <div className="fs-card p-5 space-y-1">
            <div className="text-xs text-[var(--fs-text-muted)]">Scheduled Outflows ({horizon}d)</div>
            <div className="text-xl font-extrabold font-mono text-[var(--fs-danger)] tabular-nums">−{formatINR(radar.expectedOutflows)}</div>
          </div>
          <div className="fs-card p-5 space-y-1">
            <div className="text-xs text-[var(--fs-text-muted)]">Projected Closing Balance</div>
            <div
              className={`text-xl font-extrabold font-mono tabular-nums ${
                radar.projectedClosingBalance < 0 ? 'text-[var(--fs-danger)]' : 'text-[var(--fs-text)]'
              }`}
            >
              {formatINR(radar.projectedClosingBalance)}
            </div>
          </div>
        </div>
      )}

      {/* Projection Chart + What-If Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 fs-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[var(--fs-text)]">Cash Balance Trajectory ({horizon}-Day Radar)</h2>
              <p className="text-[11px] text-[var(--fs-text-muted)]">{radar?.formula}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--fs-text-body)] whitespace-nowrap">What-if extra spend (₹):</label>
              <input
                type="number"
                min="0"
                value={whatIfExpense}
                onChange={e => setWhatIfExpense(e.target.value)}
                placeholder="0"
                className="fs-input w-28 font-mono"
              />
            </div>
          </div>

          {radar && radar.timeline.length > 0 ? (
            <BalanceProjectionLineChart points={radar.timeline} />
          ) : (
            <div className="py-10 text-center text-xs text-[var(--fs-text-muted)]">
              Add upcoming income, rent, EMI, or bill events to plot your cash-flow trajectory.
            </div>
          )}

          {radar && radar.shortfallDates.length > 0 && (
            <div className="p-3 rounded-lg bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/30 text-xs text-[var(--fs-danger)] space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Potential Shortfall Warning
              </div>
              {radar.shortfallDates.slice(0, 3).map((sf, i) => (
                <div key={i}>
                  • {sf.date}: &ldquo;{sf.eventTitle}&rdquo; drops projected balance to <span className="font-mono font-bold">{formatINR(sf.projectedBalance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Event Form */}
        <form onSubmit={handleAddEvent} className="lg:col-span-4 fs-card p-6 space-y-4">
          <h2 className="text-base font-bold text-[var(--fs-text)] flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--fs-accent)]" /> Schedule Money Event
          </h2>
          <div>
            <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="fs-input" placeholder="e.g. Apartment Rent or Salary Credit" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Direction</label>
              <select value={direction} onChange={e => setDirection(e.target.value as 'INFLOW' | 'OUTFLOW')} className="fs-input">
                <option value="OUTFLOW">Outflow (−)</option>
                <option value="INFLOW">Inflow (+)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Type</label>
              <select value={eventType} onChange={e => setEventType(e.target.value as MoneyCalendarEvent['eventType'])} className="fs-input">
                <option value="BILL">Bill / Utility</option>
                <option value="RENT">Rent</option>
                <option value="EMI">EMI</option>
                <option value="INSURANCE">Insurance</option>
                <option value="TAX">Tax / Advance Tax</option>
                <option value="SALARY">Salary</option>
                <option value="INCOME">Other Income</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="fs-input" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Amount (₹)</label>
              <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} className="fs-input" placeholder="18500" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Recurrence</label>
            <select value={recurrence} onChange={e => setRecurrence(e.target.value as 'ONCE' | 'MONTHLY')} className="fs-input">
              <option value="MONTHLY">Monthly</option>
              <option value="ONCE">One-Time</option>
            </select>
          </div>
          <button type="submit" className="fs-btn-primary w-full py-2.5 text-xs inline-flex items-center justify-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add to Calendar
          </button>
        </form>
      </div>

      {/* Upcoming Events List */}
      <div className="fs-card p-6 space-y-4">
        <h2 className="text-base font-bold text-[var(--fs-text)]">Scheduled Commitments &amp; Derived Card / Subscription Dues</h2>
        {loading ? (
          <div className="text-xs text-[var(--fs-text-muted)]">Loading events...</div>
        ) : allEvents.length === 0 ? (
          <EmptyStateCard
            variant="recurring"
            title="Your Money Calendar is clear"
            body="Add salary dates, rent, insurance premiums, EMIs, or credit card cycles to predict upcoming liquidity pressure."
          />
        ) : (
          <div className="divide-y divide-[var(--fs-border)]">
            {allEvents.map(ev => {
              const isDerived = ev.id.startsWith('derived-');
              return (
                <div key={ev.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-[var(--fs-text)]">{ev.title}</div>
                    <div className="text-[11px] text-[var(--fs-text-muted)]">
                      {ev.dueDate} · {ev.eventType} · {ev.status} {isDerived ? '· Auto-linked' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        ev.direction === 'INFLOW' ? 'text-[var(--fs-success)]' : 'text-[var(--fs-text)]'
                      }`}
                    >
                      {ev.direction === 'INFLOW' ? '+' : '−'}{formatINR(ev.amount)}
                    </span>
                    {!isDerived && ev.status !== 'PAID' && (
                      <button
                        onClick={() => handleMarkPaid(ev.id)}
                        className="text-[var(--fs-success)] hover:underline inline-flex items-center gap-1"
                        title="Mark settled"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Paid
                      </button>
                    )}
                    {!isDerived && (
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                        aria-label="Delete event"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
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
