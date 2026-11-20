import React, { useEffect, useMemo, useState } from 'react';
import { Search, ArrowRight, Sparkles, X, Plus, FileText, ShieldAlert, Calendar, CreditCard, Target, Activity } from 'lucide-react';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { formatINR } from '../../utils/financialMath';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

interface SearchTx {
  id: string;
  description: string;
  merchant: string;
  amount: number;
  category: string;
  transactionDate: string;
}

const WORKSPACE_ROUTES = [
  { label: 'Dashboard Overview', group: 'OVERVIEW', path: '/app/dashboard', keywords: 'home summary snapshot cash flow' },
  { label: 'Financial Health & Net Worth', group: 'OVERVIEW', path: '/app/financial-health', keywords: 'score index net worth emergency fund assets liabilities' },
  { label: 'Money Calendar & Cash Flow Radar', group: 'PLAN', path: '/app/money-calendar', keywords: 'bills forecast radar due dates shortfall' },
  { label: 'Transactions & Ledger', group: 'MY MONEY', path: '/app/budgeting/transactions', keywords: 'upi expenses income statement' },
  { label: 'Statement Import & Money Inbox', group: 'MY MONEY', path: '/app/budgeting/import', keywords: 'csv xlsx pdf sms triage inbox' },
  { label: 'Budgets & Alerts', group: 'MY MONEY', path: '/app/budgeting/budgets', keywords: 'limits categories spending' },
  { label: 'Recurring Payments & Subscriptions', group: 'MY MONEY', path: '/app/recurring-payments', keywords: 'subscriptions auto debit ott' },
  { label: 'Credit Cards & Debt Payoff', group: 'MY MONEY', path: '/app/credit-cards', keywords: 'utilization avalanche snowball emi cards' },
  { label: 'Financial Goals', group: 'PLAN', path: '/app/goals', keywords: 'savings target retirement emergency fund' },
  { label: 'Investments & Portfolio Risk', group: 'INVEST', path: '/app/investments', keywords: 'holdings allocation shock risk journal' },
  { label: 'NSE Markets & Backtesting', group: 'INVEST', path: '/app/markets', keywords: 'nifty stocks etf strategy archive' },
  { label: 'Paper Trading Simulator', group: 'INVEST', path: '/app/markets/paper-trading', keywords: 'virtual capital practice' },
  { label: 'Tax Center & Readiness', group: 'PLAN', path: '/app/tax', keywords: 'old new regime 80c 80d form 16' },
  { label: 'Scam & Fraud Shield', group: 'PROTECT', path: '/app/fraud', keywords: 'phishing upi qr url inspector 1930' },
  { label: 'Business Workspace & GST Invoices', group: 'BUSINESS', path: '/app/business', keywords: 'gstin invoices clients expenses' },
  { label: 'Receivables Aging & Follow-ups', group: 'BUSINESS', path: '/app/business/receivables', keywords: 'overdue collections aging reminders' },
  { label: 'Ledger Reconciliation Assistant', group: 'BUSINESS', path: '/app/business/reconciliation', keywords: 'bank match unmatched exceptions' },
  { label: 'Settings & Theme / Language', group: 'ACCOUNT', path: '/app/settings/financial-preferences', keywords: 'theme dark light hindi english export' },
];

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenAI,
}) => {
  const [query, setQuery] = useState('');
  const [recentTxs, setRecentTxs] = useState<SearchTx[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    apiFetch('/api/v1/transactions')
      .then(r => parseApiResponse<{ data?: SearchTx[] }>(r))
      .then(res => {
        if (res.ok && Array.isArray(res.json?.data)) {
          setRecentTxs(res.json.data.slice(0, 40));
        }
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const filteredRoutes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WORKSPACE_ROUTES.slice(0, 8);
    return WORKSPACE_ROUTES.filter(
      r =>
        r.label.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q) ||
        r.keywords.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query]);

  const matchedTxs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return recentTxs
      .filter(
        t =>
          t.description.toLowerCase().includes(q) ||
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [query, recentTxs]);

  if (!isOpen) return null;

  const go = (path: string) => {
    onNavigate(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-xs pt-14 sm:pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--fs-border)] bg-[var(--fs-surface)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--fs-border)]">
          <Search className="h-4 w-4 text-[var(--fs-text-muted)] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Jump to module, quick action, or search transactions..."
            className="w-full bg-transparent text-sm text-[var(--fs-text)] placeholder-[var(--fs-text-muted)] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--fs-text-muted)] hover:text-[var(--fs-text)]"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--fs-border)]">
          {/* Quick Actions */}
          {!query && (
            <div className="p-3">
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fs-text-muted)]">
                Quick Actions
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <button
                  onClick={() => go('/app/budgeting/transactions')}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--fs-text)] hover:bg-[var(--fs-surface-secondary)] text-left"
                >
                  <Plus className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
                  <span>Add Transaction</span>
                </button>
                <button
                  onClick={() => go('/app/budgeting/import')}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--fs-text)] hover:bg-[var(--fs-surface-secondary)] text-left"
                >
                  <FileText className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
                  <span>Import Statement</span>
                </button>
                <button
                  onClick={() => go('/app/financial-health')}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--fs-text)] hover:bg-[var(--fs-surface-secondary)] text-left"
                >
                  <Activity className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
                  <span>Health Score</span>
                </button>
                <button
                  onClick={() => go('/app/credit-cards')}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--fs-text)] hover:bg-[var(--fs-surface-secondary)] text-left"
                >
                  <CreditCard className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
                  <span>Credit Cards</span>
                </button>
                <button
                  onClick={() => go('/app/goals')}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--fs-text)] hover:bg-[var(--fs-surface-secondary)] text-left"
                >
                  <Target className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
                  <span>Track Goals</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onOpenAI();
                  }}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--fs-brand)] dark:text-[#A8E6CE] bg-[var(--fs-surface-secondary)] text-left"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Ask FinSight AI</span>
                </button>
              </div>
            </div>
          )}

          {/* Matched Transactions */}
          {matchedTxs.length > 0 && (
            <div className="p-3">
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fs-text-muted)]">
                Matching Transactions
              </div>
              <div className="space-y-1">
                {matchedTxs.map(tx => (
                  <button
                    key={tx.id}
                    onClick={() => go('/app/budgeting/transactions')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-[var(--fs-surface-secondary)]"
                  >
                    <div className="text-left">
                      <div className="font-medium text-[var(--fs-text)]">{tx.merchant || tx.description}</div>
                      <div className="text-[11px] text-[var(--fs-text-muted)]">
                        {tx.category} · {tx.transactionDate}
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-[var(--fs-text)] tabular-nums">
                      {formatINR(tx.amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Modules & Pages */}
          <div className="p-3">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fs-text-muted)]">
              Workspace Modules
            </div>
            {filteredRoutes.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[var(--fs-text-muted)]">
                No matching modules. Try searching &ldquo;Tax&rdquo;, &ldquo;Goals&rdquo;, &ldquo;Credit Cards&rdquo;, or &ldquo;Scam&rdquo;.
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredRoutes.map(item => (
                  <button
                    key={item.path}
                    onClick={() => go(item.path)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-[var(--fs-surface-secondary)] group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono uppercase text-[var(--fs-text-muted)] w-16 text-left">
                        {item.group}
                      </span>
                      <span className="font-medium text-[var(--fs-text)]">{item.label}</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--fs-text-muted)] group-hover:text-[var(--fs-accent)]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-2 bg-[var(--fs-surface-secondary)] border-t border-[var(--fs-border)] flex items-center justify-between text-[11px] text-[var(--fs-text-muted)]">
          <div className="flex items-center gap-3">
            <button onClick={() => go('/app/money-calendar')} className="hover:text-[var(--fs-text)] flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Money Calendar
            </button>
            <button onClick={() => go('/app/fraud')} className="hover:text-[var(--fs-text)] flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Scam Shield
            </button>
          </div>
          <span className="font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
};
