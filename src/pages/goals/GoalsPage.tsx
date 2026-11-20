import React, { useEffect, useState, useCallback } from 'react';
import { Target, Plus, Trash2, ArrowUpRight, Sparkles } from 'lucide-react';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { formatINR } from '../../utils/financialMath';
import { computeGoalProjection } from '../../utils/financialIntelligence';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslations } from '../../utils/i18n';
import type { MoneyGoal } from '../../types';

interface GoalsPageProps {
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

type GoalWithProj = MoneyGoal & { projection?: ReturnType<typeof computeGoalProjection> };

export const GoalsPage: React.FC<GoalsPageProps> = ({ onOpenAI }) => {
  const { preferences } = useAuth();
  const t = useTranslations(preferences?.language);
  const [goals, setGoals] = useState<GoalWithProj[]>([]);
  const [loading, setLoading] = useState(true);
  const [whatIfExtra, setWhatIfExtra] = useState('2500');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<MoneyGoal['category']>('Emergency Fund');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [targetDate, setTargetDate] = useState(() => new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]);
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/goals');
      const parsed = await parseApiResponse<{ data?: GoalWithProj[] }>(res);
      if (parsed.ok && Array.isArray(parsed.json?.data)) {
        setGoals(parsed.json.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !targetAmount) return;
    const res = await apiFetch('/api/v1/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        category,
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount) || 0,
        monthlyContribution: Number(monthlyContribution) || 0,
        targetDate,
        priority,
      }),
    });
    if (res.ok) {
      setTitle('');
      setTargetAmount('');
      setCurrentAmount('');
      setMonthlyContribution('');
      await loadGoals();
    }
  };

  const handleContribute = async (goal: GoalWithProj, delta: number) => {
    await apiFetch(`/api/v1/goals/${goal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentAmount: goal.currentAmount + delta }),
    });
    await loadGoals();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/v1/goals/${id}`, { method: 'DELETE' });
    await loadGoals();
  };

  const extraAmt = Math.max(0, Number(whatIfExtra) || 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">
            Milestone Planning · Contribution Math · Timeline Scenarios
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] mt-1">
            {t.modules.goalsTitle}
          </h1>
        </div>
        <button onClick={onOpenAI} className="fs-btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5 self-start">
          <Sparkles className="h-3.5 w-3.5 text-[var(--fs-accent)]" /> Ask AI About Prioritizing Goals
        </button>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="fs-card p-5 space-y-1">
          <div className="text-xs text-[var(--fs-text-muted)]">Total Saved Across Goals</div>
          <div className="text-2xl font-extrabold font-mono text-[var(--fs-success)] tabular-nums">{formatINR(totalSaved)}</div>
        </div>
        <div className="fs-card p-5 space-y-1">
          <div className="text-xs text-[var(--fs-text-muted)]">Combined Target Corpus</div>
          <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">{formatINR(totalTarget)}</div>
        </div>
        <div className="fs-card p-5 space-y-1">
          <div className="text-xs text-[var(--fs-text-muted)]">What-If Extra Monthly Boost</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-[var(--fs-text-muted)]">+₹</span>
            <input
              type="number"
              min="0"
              value={whatIfExtra}
              onChange={e => setWhatIfExtra(e.target.value)}
              className="fs-input font-mono w-32 py-1"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Create Goal Form */}
        <form onSubmit={handleCreate} className="lg:col-span-4 fs-card p-6 space-y-4">
          <h2 className="text-base font-bold text-[var(--fs-text)] flex items-center gap-2">
            <Target className="h-4 w-4 text-[var(--fs-accent)]" /> Create Financial Goal
          </h2>
          <div>
            <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Goal Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="fs-input" placeholder="e.g. 6-Month Emergency Fund" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value as MoneyGoal['category'])} className="fs-input">
                <option value="Emergency Fund">Emergency Fund</option>
                <option value="Home">Home</option>
                <option value="Education">Education</option>
                <option value="Retirement">Retirement</option>
                <option value="Travel">Travel</option>
                <option value="Vehicle">Vehicle</option>
                <option value="Family">Family</option>
                <option value="Custom Goal">Custom Goal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as 'HIGH' | 'MEDIUM' | 'LOW')} className="fs-input">
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Target Amount (₹)</label>
              <input type="number" min="1000" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className="fs-input font-mono" placeholder="300000" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Current Saved (₹)</label>
              <input type="number" min="0" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} className="fs-input font-mono" placeholder="75000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Monthly Contribution (₹)</label>
              <input type="number" min="0" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} className="fs-input font-mono" placeholder="15000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Target Date</label>
              <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="fs-input" required />
            </div>
          </div>
          <button type="submit" className="fs-btn-primary w-full py-2.5 text-xs inline-flex items-center justify-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Goal
          </button>
        </form>

        {/* Goals List */}
        <div className="lg:col-span-8 space-y-4">
          {loading ? (
            <div className="fs-card p-8 text-xs text-[var(--fs-text-muted)]">Loading financial goals...</div>
          ) : goals.length === 0 ? (
            <EmptyStateCard
              variant="goals"
              title="No financial goals created yet"
              body="Start with an Emergency Fund or a specific milestone like Education, Home Down Payment, or Travel."
            />
          ) : (
            goals.map(g => {
              const baseProj = g.projection || computeGoalProjection(g, 0);
              const boostProj = computeGoalProjection(g, extraAmt);
              return (
                <div key={g.id} className="fs-card p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-bold text-[var(--fs-text)]">{g.title}</div>
                      <div className="text-[11px] text-[var(--fs-text-muted)]">
                        {g.category} · Priority {g.priority} · Target Date {g.targetDate} · {g.status}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-[var(--fs-text)] tabular-nums">
                        {formatINR(g.currentAmount)} / {formatINR(g.targetAmount)}
                      </span>
                      <button onClick={() => handleDelete(g.id)} className="text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]" aria-label="Delete goal">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="h-2 w-full rounded-full bg-[var(--fs-surface-secondary)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--fs-accent)] transition-all"
                      style={{ width: `${baseProj.progressPct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--fs-text-body)]">
                    <span>
                      Progress: <strong className="font-mono">{baseProj.progressPct}%</strong> · Required monthly:{' '}
                      <strong className="font-mono">{formatINR(baseProj.requiredMonthlyContribution)}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleContribute(g, 5000)}
                        className="fs-btn-secondary px-2.5 py-1 text-[11px] inline-flex items-center gap-1"
                      >
                        +₹5,000 <ArrowUpRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {extraAmt > 0 && baseProj.remainingAmount > 0 && (
                    <div className="text-[11px] text-[var(--fs-accent)] font-medium pt-1 border-t border-[var(--fs-border)]">
                      What-If (+{formatINR(extraAmt)}/mo): Finishes in{' '}
                      <span className="font-mono font-bold">{boostProj.estimatedMonthsToComplete ?? '—'} months</span> (est.{' '}
                      {boostProj.estimatedCompletionDate ?? 'N/A'}) vs current{' '}
                      <span className="font-mono">{baseProj.estimatedMonthsToComplete ?? '∞'} months</span>.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
