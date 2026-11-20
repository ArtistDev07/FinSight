import React, { useEffect, useState, useCallback } from 'react';
import { CreditCard as CardIcon, Plus, Trash2, Calculator, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { formatINR } from '../../utils/financialMath';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslations } from '../../utils/i18n';
import type { CreditCard, CreditCardStatement } from '../../types';

interface CreditCardsPageProps {
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

interface CardSummary {
  totalOutstandingBalance: number;
  totalCreditLimit: number;
  overallUtilizationPct: number;
  totalMinimumDue: number;
  totalStatementDue: number;
}

export const CreditCardsPage: React.FC<CreditCardsPageProps> = ({ onOpenAI }) => {
  const { preferences } = useAuth();
  const t = useTranslations(preferences?.language);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [summary, setSummary] = useState<CardSummary | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [statements, setStatements] = useState<CreditCardStatement[]>([]);
  const [paymentSim, setPaymentSim] = useState<any>(null);
  const [extraMonthly, setExtraMonthly] = useState('3000');

  const [payoffBudget, setPayoffBudget] = useState('20000');
  const [payoffComparison, setPayoffComparison] = useState<any>(null);

  const [nickname, setNickname] = useState('');
  const [issuer, setIssuer] = useState('HDFC Bank');
  const [last4, setLast4] = useState('');
  const [limit, setLimit] = useState('');
  const [balance, setBalance] = useState('');
  const [apr, setApr] = useState('36');
  const [formError, setFormError] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    const res = await apiFetch('/api/v1/credit-cards');
    const parsed = await parseApiResponse<{ data?: { cards: CreditCard[]; summary: CardSummary } }>(res);
    if (parsed.ok && parsed.json?.data) {
      setCards(parsed.json.data.cards);
      setSummary(parsed.json.data.summary);
      if (!selectedCardId && parsed.json.data.cards.length > 0) {
        setSelectedCardId(parsed.json.data.cards[0].id);
      }
    }
  }, [selectedCardId]);

  const loadCardDetail = useCallback(async (cardId: string) => {
    const res = await apiFetch(`/api/v1/credit-cards/${cardId}/statements?extraMonthly=${Number(extraMonthly) || 0}`);
    const parsed = await parseApiResponse<{ data?: { statements: CreditCardStatement[]; paymentSimulation: any } }>(res);
    if (parsed.ok && parsed.json?.data) {
      setStatements(parsed.json.data.statements);
      setPaymentSim(parsed.json.data.paymentSimulation);
    }
  }, [extraMonthly]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  useEffect(() => {
    if (selectedCardId) loadCardDetail(selectedCardId);
  }, [selectedCardId, loadCardDetail]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!/^\d{4}$/.test(last4.trim())) {
      setFormError('Enter strictly the last 4 digits (e.g. 4821). Never enter full card numbers or CVV.');
      return;
    }
    const res = await apiFetch('/api/v1/credit-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: nickname.trim(),
        issuer,
        lastFourDigits: last4.trim(),
        creditLimit: Number(limit),
        currentBalance: Number(balance) || 0,
        annualInterestRate: Number(apr) || 36,
      }),
    });
    const parsed = await parseApiResponse(res);
    if (!parsed.ok) {
      setFormError(parsed.errorMessage || 'Unable to save card.');
      return;
    }
    setNickname('');
    setLast4('');
    setLimit('');
    setBalance('');
    await loadCards();
  };

  const handleDeleteCard = async (id: string) => {
    await apiFetch(`/api/v1/credit-cards/${id}`, { method: 'DELETE' });
    if (selectedCardId === id) setSelectedCardId(null);
    await loadCards();
  };

  const handleLogStatement = async (card: CreditCard) => {
    await apiFetch(`/api/v1/credit-cards/${card.id}/statements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statementPeriod: new Date().toISOString().slice(0, 7),
        totalDue: card.currentBalance,
        minimumDue: card.minimumDue,
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      }),
    });
    await loadCardDetail(card.id);
  };

  const handleVerifyStatement = async (stmtId: string) => {
    await apiFetch(`/api/v1/credit-cards/statements/${stmtId}/verify`, { method: 'PUT' });
    if (selectedCardId) await loadCardDetail(selectedCardId);
  };

  const handlePayoffCompare = async () => {
    const res = await apiFetch('/api/v1/credit-cards/payoff-compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyBudget: Number(payoffBudget) || 15000 }),
    });
    const parsed = await parseApiResponse<{ data?: any }>(res);
    if (parsed.ok && parsed.json?.data) setPayoffComparison(parsed.json.data);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">
            Utilization · Statement Check · Debt Payoff Planner
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] mt-1">
            {t.modules.creditCardsTitle}
          </h1>
        </div>
        <button onClick={onOpenAI} className="fs-btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5 self-start">
          <Sparkles className="h-3.5 w-3.5 text-[var(--fs-accent)]" /> Ask AI About Debt Strategy
        </button>
      </div>

      {/* Security Notice */}
      <div className="fs-card p-3.5 bg-[var(--fs-surface-secondary)] flex items-center gap-2.5 text-xs text-[var(--fs-text-body)]">
        <ShieldCheck className="h-4 w-4 text-[var(--fs-success)] shrink-0" />
        <span>
          Privacy Guarantee: FinSight only accepts card nicknames and the <strong>last 4 digits</strong>. Full card numbers, CVVs, PINs, and OTPs are strictly blocked.
        </span>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="fs-card p-5 space-y-1">
            <div className="text-xs text-[var(--fs-text-muted)]">Total Card Balance</div>
            <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">{formatINR(summary.totalOutstandingBalance)}</div>
          </div>
          <div className="fs-card p-5 space-y-1">
            <div className="text-xs text-[var(--fs-text-muted)]">Combined Credit Limit</div>
            <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">{formatINR(summary.totalCreditLimit)}</div>
          </div>
          <div className="fs-card p-5 space-y-1">
            <div className="text-xs text-[var(--fs-text-muted)]">Credit Utilization</div>
            <div
              className={`text-2xl font-extrabold font-mono tabular-nums ${
                summary.overallUtilizationPct > 30 ? 'text-[var(--fs-warning)]' : 'text-[var(--fs-success)]'
              }`}
            >
              {summary.overallUtilizationPct}%
            </div>
            <div className="text-[11px] text-[var(--fs-text-muted)]">Under 30% protects credit score health</div>
          </div>
          <div className="fs-card p-5 space-y-1">
            <div className="text-xs text-[var(--fs-text-muted)]">Minimum Due Combined</div>
            <div className="text-2xl font-extrabold font-mono text-[var(--fs-text)] tabular-nums">{formatINR(summary.totalMinimumDue)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Add Card Form */}
        <form onSubmit={handleAddCard} className="lg:col-span-5 fs-card p-6 space-y-4">
          <h2 className="text-base font-bold text-[var(--fs-text)] flex items-center gap-2">
            <CardIcon className="h-4 w-4 text-[var(--fs-accent)]" /> Track Credit Card
          </h2>
          {formError && (
            <div className="p-2.5 rounded-lg bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/30 text-xs text-[var(--fs-danger)]">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Card Nickname</label>
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="fs-input" placeholder="Millennia Rewards" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Issuer</label>
              <input type="text" value={issuer} onChange={e => setIssuer(e.target.value)} className="fs-input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Last 4 Digits Only</label>
              <input type="text" maxLength={4} value={last4} onChange={e => setLast4(e.target.value)} className="fs-input font-mono" placeholder="4821" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Annual APR (%)</label>
              <input type="number" min="0" max="60" value={apr} onChange={e => setApr(e.target.value)} className="fs-input font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Credit Limit (₹)</label>
              <input type="number" min="1000" value={limit} onChange={e => setLimit(e.target.value)} className="fs-input font-mono" placeholder="200000" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Current Balance (₹)</label>
              <input type="number" min="0" value={balance} onChange={e => setBalance(e.target.value)} className="fs-input font-mono" placeholder="38000" />
            </div>
          </div>
          <button type="submit" className="fs-btn-primary w-full py-2.5 text-xs inline-flex items-center justify-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Card Safely
          </button>
        </form>

        {/* Card List & Minimum vs Full Simulator */}
        <div className="lg:col-span-7 fs-card p-6 space-y-5">
          <h2 className="text-base font-bold text-[var(--fs-text)]">Tracked Cards ({cards.length})</h2>
          {cards.length === 0 ? (
            <p className="text-xs text-[var(--fs-text-muted)] py-6 text-center">
              Add a credit card using only its nickname and last 4 digits to simulate minimum-due vs full-payment interest.
            </p>
          ) : (
            <div className="space-y-3">
              {cards.map(c => {
                const util = c.creditLimit > 0 ? Math.round((c.currentBalance / c.creditLimit) * 100) : 0;
                const isSelected = selectedCardId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCardId(c.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                      isSelected ? 'border-[var(--fs-accent)] bg-[var(--fs-surface-secondary)]' : 'border-[var(--fs-border)] bg-[var(--fs-bg)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-[var(--fs-text)]">
                          {c.nickname} · <span className="font-mono text-xs text-[var(--fs-text-muted)]">*{c.lastFourDigits}</span>
                        </div>
                        <div className="text-[11px] text-[var(--fs-text-muted)]">
                          {c.issuer} · Due day {c.dueDate} · {c.annualInterestRate || 36}% APR · {util}% utilization
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-mono font-bold text-[var(--fs-text)] tabular-nums">{formatINR(c.currentBalance)}</div>
                          <div className="text-[11px] text-[var(--fs-text-muted)] font-mono">Limit {formatINR(c.creditLimit)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleLogStatement(c);
                          }}
                          className="fs-btn-secondary px-2.5 py-1 text-[11px]"
                        >
                          Log Statement
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteCard(c.id);
                          }}
                          className="text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                          aria-label="Delete card"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {paymentSim && (
            <div className="pt-4 border-t border-[var(--fs-border)] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fs-text)]">
                  Minimum Due vs Extra Payment Cost Simulator
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--fs-text-muted)]">Extra ₹/mo:</span>
                  <input
                    type="number"
                    min="0"
                    value={extraMonthly}
                    onChange={e => setExtraMonthly(e.target.value)}
                    className="fs-input w-24 font-mono py-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-bg)]">
                  <div className="text-[var(--fs-text-muted)]">{paymentSim.fullPay.label}</div>
                  <div className="font-mono font-bold text-base text-[var(--fs-success)] mt-1">{formatINR(0)} interest</div>
                  <div className="text-[11px] text-[var(--fs-text-muted)]">{paymentSim.fullPay.months} month</div>
                </div>
                <div className="p-3 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-bg)]">
                  <div className="text-[var(--fs-text-muted)]">{paymentSim.withExtra.label}</div>
                  <div className="font-mono font-bold text-base text-[var(--fs-text)] mt-1">{formatINR(paymentSim.withExtra.totalInterest)} interest</div>
                  <div className="text-[11px] text-[var(--fs-text-muted)]">{paymentSim.withExtra.months} months</div>
                </div>
                <div className="p-3 rounded-lg border border-[var(--fs-danger)]/40 bg-[var(--fs-danger)]/5">
                  <div className="text-[var(--fs-danger)] font-medium">{paymentSim.minimumOnly.label}</div>
                  <div className="font-mono font-bold text-base text-[var(--fs-danger)] mt-1">{formatINR(paymentSim.minimumOnly.totalInterest)} interest</div>
                  <div className="text-[11px] text-[var(--fs-text-muted)]">{paymentSim.minimumOnly.months} months</div>
                </div>
              </div>
              <p className="text-[11px] text-[var(--fs-text-muted)]">{paymentSim.assumptions}</p>
            </div>
          )}

          {statements.length > 0 && (
            <div className="pt-3 border-t border-[var(--fs-border)] space-y-2">
              <div className="text-xs font-bold text-[var(--fs-text)]">Statement Verification Queue</div>
              {statements.map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs py-1.5">
                  <span>
                    Period <span className="font-mono">{s.statementPeriod}</span> · Due {s.dueDate} ·{' '}
                    <span className="font-mono font-semibold">{formatINR(s.totalDue)}</span>
                  </span>
                  {s.verificationStatus === 'VERIFIED' ? (
                    <span className="text-[var(--fs-success)] inline-flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                    </span>
                  ) : (
                    <button onClick={() => handleVerifyStatement(s.id)} className="text-[var(--fs-accent)] font-semibold hover:underline">
                      Confirm Statement
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Debt Payoff Planner (Avalanche vs Snowball) */}
      <div className="fs-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--fs-text)] flex items-center gap-2">
              <Calculator className="h-4 w-4 text-[var(--fs-accent)]" /> Debt Payoff Strategy Comparison (Avalanche vs Snowball)
            </h2>
            <p className="text-xs text-[var(--fs-text-muted)]">
              Combines tracked credit cards and Business EMI plans against your monthly repayment budget.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1000"
              value={payoffBudget}
              onChange={e => setPayoffBudget(e.target.value)}
              className="fs-input w-32 font-mono"
            />
            <button onClick={handlePayoffCompare} className="fs-btn-primary px-4 py-2 text-xs whitespace-nowrap">
              Compare Strategies
            </button>
          </div>
        </div>

        {payoffComparison && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {(['avalanche', 'snowball'] as const).map(key => {
              const plan = payoffComparison[key];
              return (
                <div key={key} className="p-4 rounded-xl border border-[var(--fs-border)] bg-[var(--fs-bg)] space-y-1.5 text-xs">
                  <div className="font-bold text-sm text-[var(--fs-text)]">
                    {key === 'avalanche' ? 'Avalanche (Highest APR First)' : 'Snowball (Smallest Balance First)'}
                  </div>
                  <div className="font-mono text-[var(--fs-text)]">
                    Payoff Horizon: <strong>{plan.months} months</strong> · Total Interest: <strong>{formatINR(plan.totalInterest)}</strong>
                  </div>
                  <div className="text-[11px] text-[var(--fs-text-muted)]">
                    Order: {plan.payoffOrder.length > 0 ? plan.payoffOrder.join(' → ') : 'No active debts'}
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
