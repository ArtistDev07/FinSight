import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Upload,
  Search,
  Trash2,
  FileText,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Loader2,
  Inbox,
  Split,
  ArrowLeftRight,
  CreditCard,
  RotateCcw,
  EyeOff,
} from 'lucide-react';
import { Transaction, Budget, ImportJobRecord } from '../../types';
import { calculateBudgetMetrics, formatINR } from '../../utils/financialMath';
import { isDoubleCountExcluded } from '../../utils/financialIntelligence';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';

interface BudgetingModuleProps {
  subview: 'overview' | 'transactions' | 'import' | 'budgets' | 'insights';
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

interface StagedImportRow {
  description: string;
  merchant: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  account: string;
  transactionDate: string;
  referenceId?: string;
  source: 'CSV' | 'XLSX' | 'PDF' | 'SMS' | 'STATEMENT';
  isDuplicate?: boolean;
}

const CATEGORIES = [
  'Food & Dining',
  'Food',
  'Housing & Utilities',
  'Housing',
  'Transport',
  'Shopping',
  'Subscriptions',
  'Utilities',
  'Investments',
  'Salary',
  'Consulting',
  'Transfer',
  'Credit Card Payment',
  'Refund',
  'General Expense',
];

export const BudgetingModule: React.FC<BudgetingModuleProps> = ({
  subview,
  onNavigate,
  onOpenAI,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJobRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [inboxFeedback, setInboxFeedback] = useState<string | null>(null);

  // Add/Edit Transaction modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [newCategory, setNewCategory] = useState('Food & Dining');
  const [newAccount, setNewAccount] = useState('HDFC Bank UPI');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Split Modal
  const [splitTx, setSplitTx] = useState<Transaction | null>(null);
  const [splitRows, setSplitRows] = useState<Array<{ category: string; amount: string }>>([]);

  // Budget Modal
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetName, setBudgetName] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('Food & Dining');
  const [budgetAllocated, setBudgetAllocated] = useState('');
  const [budgetThreshold, setBudgetThreshold] = useState('80');

  // Import & Money Inbox state
  const [importTab, setImportTab] = useState<'inbox' | 'sms' | 'file'>('inbox');
  const [inboxFilter, setInboxFilter] = useState<'NEEDS_REVIEW' | 'ALL'>('NEEDS_REVIEW');
  const [smsText, setSmsText] = useState('');
  const [parsedSmsPreview, setParsedSmsPreview] = useState<StagedImportRow | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [stagedBatch, setStagedBatch] = useState<{
    fileName: string;
    format: 'CSV' | 'XLSX' | 'PDF' | 'TXT';
    fileSizeBytes: number;
    transactions: StagedImportRow[];
  } | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);
  const [importErrorMsg, setImportErrorMsg] = useState<string | null>(null);

  // AI Spending Insights
  const [aiSpendingInsight, setAiSpendingInsight] = useState<string | null>(null);
  const [aiInsightError, setAiInsightError] = useState<string | null>(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const [txRes, budRes, jobRes] = await Promise.all([
        apiFetch('/api/v1/transactions'),
        apiFetch('/api/v1/budgets'),
        apiFetch('/api/v1/transactions/import-history'),
      ]);
      const [txJson, budJson, jobJson] = await Promise.all([
        txRes.json(),
        budRes.json(),
        jobRes.json(),
      ]);
      if (txJson.success) setTransactions(txJson.data || []);
      if (budJson.success) setBudgets(budJson.data || []);
      if (jobJson.success) setImportJobs(jobJson.data || []);
    } catch (err) {
      setModuleError(err instanceof Error ? err.message : 'Unable to load budgeting records.');
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim() || !newAmount) return;

    const payload = {
      description: newDesc.trim(),
      amount: parseFloat(newAmount),
      type: newType,
      category: newCategory,
      account: newAccount,
      transactionDate: newDate,
    };

    const url = editingTxId ? `/api/v1/transactions/${editingTxId}` : '/api/v1/transactions';
    const method = editingTxId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      await refreshData();
      setEditingTxId(null);
      setShowAddModal(false);
      setNewDesc('');
      setNewAmount('');
    } else {
      setModuleError(json?.error?.message || 'Failed to save transaction.');
    }
  };

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setNewDesc(tx.description);
    setNewAmount(tx.amount.toString());
    setNewType(tx.type);
    setNewCategory(tx.category);
    setNewAccount(tx.account);
    setNewDate(tx.transactionDate);
    setShowAddModal(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    const res = await apiFetch(`/api/v1/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await refreshData();
    }
  };

  const handleInboxAction = async (
    txId: string,
    action: 'CONFIRM' | 'MARK_TRANSFER' | 'MARK_CARD_PAYMENT' | 'MARK_REFUND' | 'IGNORE' | 'SPLIT',
    extra?: { category?: string; splitItems?: Array<{ category: string; amount: number }> }
  ) => {
    setModuleError(null);
    setInboxFeedback(null);
    const res = await apiFetch(`/api/v1/transactions/${txId}/inbox-action`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setModuleError(json?.error?.message || 'Unable to apply Money Inbox triage action.');
      return;
    }
    await refreshData();
    setInboxFeedback(`Updated transaction classification (${action.replace('_', ' ')}).`);
    setTimeout(() => setInboxFeedback(null), 3000);
  };

  const handleSubmitSplit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitTx) return;
    const splitItems = splitRows
      .map(r => ({ category: r.category, amount: Math.round((parseFloat(r.amount) || 0) * 100) / 100 }))
      .filter(r => r.amount > 0);
    await handleInboxAction(splitTx.id, 'SPLIT', { splitItems });
    setSplitTx(null);
  };

  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const allocated = parseFloat(budgetAllocated);
    if (!budgetCategory || !Number.isFinite(allocated) || allocated <= 0) return;
    const res = await apiFetch('/api/v1/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: budgetName.trim() || `${budgetCategory} Budget`,
        category: budgetCategory,
        allocatedAmount: allocated,
        alertThreshold: parseInt(budgetThreshold, 10) || 80,
      }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      await refreshData();
      setShowBudgetModal(false);
      setBudgetName('');
      setBudgetAllocated('');
    }
  };

  const handleDeleteBudget = async (id: string) => {
    const res = await apiFetch(`/api/v1/budgets/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await refreshData();
    }
  };

  const handleParseSms = async () => {
    if (!smsText.trim()) return;
    setDuplicateWarning(null);
    setImportErrorMsg(null);
    setImportStatusMsg(null);

    const res = await apiFetch('/api/v1/transactions/parse-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: smsText }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setImportErrorMsg(json?.error?.message || 'Unable to parse SMS text.');
      return;
    }

    const parsed = json.data.parsed as StagedImportRow;
    setParsedSmsPreview(parsed);
    if (parsed.isDuplicate) {
      setDuplicateWarning(
        `Potential duplicate detected: An identical transaction of ${formatINR(parsed.amount)} with ${parsed.merchant} already exists.`
      );
    }
  };

  const handleConfirmSmsImport = async () => {
    if (!parsedSmsPreview) return;
    setIsImporting(true);
    setImportErrorMsg(null);
    try {
      const res = await apiFetch('/api/v1/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: 'sms-alert',
          format: 'SMS',
          fileSizeBytes: smsText.length,
          skipDuplicates: false,
          transactions: [parsedSmsPreview],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Import failed.');
      }
      await refreshData();
      setImportStatusMsg(json.message || 'SMS transaction imported successfully.');
      setParsedSmsPreview(null);
      setSmsText('');
      setDuplicateWarning(null);
    } catch (err) {
      setImportErrorMsg(err instanceof Error ? err.message : 'Unable to import SMS transaction.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleStatementFileSelected = async (file: File) => {
    setImportErrorMsg(null);
    setImportStatusMsg(null);
    setStagedBatch(null);
    setIsParsing(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read selected file.'));
        reader.readAsDataURL(file);
      });

      const res = await apiFetch('/api/v1/transactions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileBase64: base64,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Unable to parse statement file.');
      }
      setStagedBatch({
        fileName: json.data.fileName,
        format: json.data.format,
        fileSizeBytes: json.data.fileSizeBytes,
        transactions: json.data.transactions,
      });
    } catch (err) {
      setImportErrorMsg(err instanceof Error ? err.message : 'File parsing failed.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmBatchImport = async () => {
    if (!stagedBatch) return;
    setIsImporting(true);
    setImportErrorMsg(null);
    try {
      const res = await apiFetch('/api/v1/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: stagedBatch.fileName,
          format: stagedBatch.format,
          fileSizeBytes: stagedBatch.fileSizeBytes,
          skipDuplicates,
          transactions: stagedBatch.transactions,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Batch import failed.');
      }
      await refreshData();
      setImportStatusMsg(json.message);
      setStagedBatch(null);
    } catch (err) {
      setImportErrorMsg(err instanceof Error ? err.message : 'Batch import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleRequestSpendingAiInsight = async () => {
    setAiInsightLoading(true);
    setAiInsightError(null);
    try {
      const res = await apiFetch('/api/v1/ai/module-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'Smart Budgeting & Spending',
          question: 'Analyze my category spending distribution and highlight 3 concrete budget optimizations.',
        }),
      });
      const parsed = await parseApiResponse<{ success: boolean; data?: { insight?: string } }>(res);
      if (!parsed.ok || !parsed.json?.data?.insight) {
        throw new Error(parsed.errorMessage || 'Gemini spending insight unavailable.');
      }
      setAiSpendingInsight(parsed.json.data.insight);
    } catch (err) {
      setAiInsightError(err instanceof Error ? err.message : 'Failed to generate AI spending insight.');
    } finally {
      setAiInsightLoading(false);
    }
  };

  const activeTransactions = transactions.filter(t => !isDoubleCountExcluded(t));
  const totalAllocatedBudget = budgets.reduce((s, b) => s + b.allocatedAmount, 0);
  const metrics = calculateBudgetMetrics(activeTransactions, totalAllocatedBudget);
  const expenseCount = activeTransactions.filter(t => t.type === 'EXPENSE').length;
  const remainingPct =
    totalAllocatedBudget > 0 ? Math.round((metrics.remainingBudget / totalAllocatedBudget) * 1000) / 10 : 0;

  const needsReviewItems = transactions.filter(t => t.inboxStatus === 'NEEDS_REVIEW' || t.inboxStatus === 'DUPLICATE');
  const inboxDisplayList = inboxFilter === 'NEEDS_REVIEW' ? needsReviewItems : transactions;

  const uniqueCategories = Array.from(new Set(transactions.map(t => t.category)));

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.merchant.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryBreakdown = Array.from(
    activeTransactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((map, tx) => {
        map.set(tx.category, (map.get(tx.category) || 0) + tx.amount);
        return map;
      }, new Map<string, number>())
      .entries()
  )
    .map(([category, amount]) => ({
      category,
      amount,
      pct: metrics.totalExpenses > 0 ? Math.round((amount / metrics.totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--fs-border)] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] tracking-tight">
            {subview === 'overview' && 'Smart Budgeting'}
            {subview === 'transactions' && 'Transactions Ledger'}
            {subview === 'import' && 'Money Inbox & Statement Import'}
            {subview === 'budgets' && 'Monthly Budgets'}
            {subview === 'insights' && 'Spending Insights'}
          </h1>
          <p className="text-xs text-[var(--fs-text-body)] mt-1">
            Triage uncategorized entries, exclude internal transfers from double-counting, and manage monthly category caps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/app/budgeting/import')}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              subview === 'import'
                ? 'bg-[var(--fs-surface-2)] text-[var(--fs-accent)] border-[var(--fs-accent)]'
                : 'bg-[var(--fs-surface)] text-[var(--fs-text-body)] border-[var(--fs-border)] hover:text-[var(--fs-text)]'
            }`}
          >
            <Inbox className="h-3.5 w-3.5" />
            <span>Money Inbox {needsReviewItems.length > 0 ? `(${needsReviewItems.length})` : ''}</span>
          </button>
          <button
            onClick={() => {
              setEditingTxId(null);
              setNewDesc('');
              setNewAmount('');
              setShowAddModal(true);
            }}
            className="fs-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {moduleError && (
        <div className="p-3 rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/40 text-xs text-[var(--fs-danger)] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{moduleError}</span>
        </div>
      )}

      {inboxFeedback && (
        <div className="p-3 rounded-xl bg-[var(--fs-success)]/10 border border-[var(--fs-success)]/40 text-xs text-[var(--fs-success)] flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{inboxFeedback}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--fs-border)] pb-2 overflow-x-auto whitespace-nowrap">
        {[
          { label: 'Overview', path: '/app/budgeting', key: 'overview' },
          { label: 'Transactions', path: '/app/budgeting/transactions', key: 'transactions' },
          { label: `Money Inbox & Import (${needsReviewItems.length})`, path: '/app/budgeting/import', key: 'import' },
          { label: 'Budgets', path: '/app/budgeting/budgets', key: 'budgets' },
          { label: 'Spending Insights', path: '/app/budgeting/insights', key: 'insights' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => onNavigate(tab.path)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              subview === tab.key
                ? 'bg-[var(--fs-brand)] text-white dark:text-[#0A1815]'
                : 'text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-2)] hover:text-[var(--fs-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBVIEW 1: OVERVIEW */}
      {subview === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Net Income</span>
              <div className="font-mono-num text-2xl font-bold text-[var(--fs-success)]">{formatINR(metrics.totalIncome)}</div>
              <span className="text-[11px] text-[var(--fs-text-muted)]">Excludes internal transfers</span>
            </div>
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Net Spending</span>
              <div className="font-mono-num text-2xl font-bold text-[var(--fs-text)]">{formatINR(metrics.totalExpenses)}</div>
              <span className="text-[11px] text-[var(--fs-text-muted)]">{expenseCount} active expense record{expenseCount === 1 ? '' : 's'}</span>
            </div>
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Remaining Allocated Budget</span>
              <div className="font-mono-num text-2xl font-bold text-[var(--fs-accent)]">{formatINR(metrics.remainingBudget)}</div>
              <span className="text-[11px] text-[var(--fs-success)]">{remainingPct}% of {formatINR(totalAllocatedBudget)} remaining</span>
            </div>
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Savings Rate</span>
              <div className={`font-mono-num text-2xl font-bold ${metrics.savingsRate >= 0 ? 'text-[var(--fs-success)]' : 'text-[var(--fs-danger)]'}`}>
                {metrics.savingsRate}%
              </div>
              <span className="text-[11px] text-[var(--fs-text-muted)]">Net surplus: {formatINR(metrics.savings)}</span>
            </div>
          </div>

          <div className="fs-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-[var(--fs-text)]">Recent Activity</h3>
              <button onClick={() => onNavigate('/app/budgeting/transactions')} className="text-xs font-semibold text-[var(--fs-accent)] hover:underline">
                View All Transactions →
              </button>
            </div>
            {transactions.length === 0 ? (
              <EmptyStateCard
                variant="transactions"
                title="No transactions recorded yet"
                description="Add a transaction manually, paste an Indian bank SMS alert, or upload a CSV/XLSX/PDF statement."
                actionLabel="Open Money Inbox & Import"
                onAction={() => onNavigate('/app/budgeting/import')}
              />
            ) : (
              <div className="divide-y divide-[var(--fs-border)]">
                {transactions.slice(0, 6).map(tx => (
                  <div key={tx.id} className="py-3 flex items-center justify-between text-xs gap-3">
                    <div>
                      <div className="font-semibold text-[var(--fs-text)] flex items-center gap-2">
                        <span>{tx.description}</span>
                        {isDoubleCountExcluded(tx) && (
                          <span className="text-[10px] font-mono-num text-[var(--fs-info)]">
                            [Excluded: {tx.isCreditCardSettlement ? 'Card Settlement' : tx.isInternalTransfer ? 'Transfer' : tx.inboxStatus}]
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--fs-text-muted)]">{tx.category} · {tx.transactionDate} · {tx.account}</div>
                    </div>
                    <div className={`font-mono-num font-semibold text-sm ${tx.type === 'INCOME' ? 'text-[var(--fs-success)]' : 'text-[var(--fs-text)]'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'}{formatINR(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW 2: TRANSACTIONS TABLE */}
      {subview === 'transactions' && (
        <div className="space-y-4">
          <div className="fs-card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--fs-text-muted)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by description or merchant..."
                className="fs-input w-full pl-9 pr-3 py-2 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="fs-input px-3 py-2 text-xs"
              >
                <option value="ALL">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="fs-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--fs-surface-2)] border-b border-[var(--fs-border)] text-[var(--fs-text-muted)]">
                <tr>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium">Category & Status</th>
                  <th className="py-3 px-4 font-medium">Source</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fs-border)]">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--fs-text-muted)]">
                      No transactions found. Import a statement or add your first transaction.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-[var(--fs-surface-2)]/50 transition-colors">
                      <td className="py-3 px-4 text-[var(--fs-text-muted)] whitespace-nowrap font-mono-num">{tx.transactionDate}</td>
                      <td className="py-3 px-4 font-semibold text-[var(--fs-text)]">
                        <div>{tx.description}</div>
                        <div className="text-[11px] font-normal text-[var(--fs-text-muted)]">{tx.account}</div>
                      </td>
                      <td className="py-3 px-4 text-[var(--fs-text-body)]">
                        <div>{tx.category}</div>
                        {tx.inboxStatus === 'NEEDS_REVIEW' && (
                          <span className="text-[10px] font-semibold text-[var(--fs-warning)]">Needs Review</span>
                        )}
                        {isDoubleCountExcluded(tx) && (
                          <span className="text-[10px] font-semibold text-[var(--fs-info)]">Excluded from double-counting</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[10px] font-mono-num text-[var(--fs-text-muted)]">{tx.source}</td>
                      <td className={`py-3 px-4 text-right font-mono-num font-semibold whitespace-nowrap ${
                        tx.type === 'INCOME' ? 'text-[var(--fs-success)]' : 'text-[var(--fs-text)]'
                      }`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatINR(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSplitTx(tx);
                              setSplitRows([
                                { category: tx.category, amount: String(Math.round((tx.amount / 2) * 100) / 100) },
                                { category: 'Shopping', amount: String(Math.round((tx.amount - Math.round((tx.amount / 2) * 100) / 100) * 100) / 100) },
                              ]);
                            }}
                            className="text-[var(--fs-text-muted)] hover:text-[var(--fs-accent)] p-1 rounded"
                            title="Split Transaction"
                          >
                            <Split className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(tx)}
                            className="text-[var(--fs-text-muted)] hover:text-[var(--fs-accent)] px-1.5 py-1 rounded text-[11px] font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)] p-1 rounded"
                            title="Delete Transaction"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW 3: MONEY INBOX & IMPORT DATA */}
      {subview === 'import' && (
        <div className="space-y-6 max-w-5xl">
          {importStatusMsg && (
            <div className="p-4 rounded-xl bg-[var(--fs-success)]/10 border border-[var(--fs-success)]/40 text-xs text-[var(--fs-success)] flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{importStatusMsg}</span>
            </div>
          )}

          {importErrorMsg && (
            <div className="p-4 rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/40 text-xs text-[var(--fs-danger)] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{importErrorMsg}</span>
            </div>
          )}

          <div className="fs-card p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--fs-border)] pb-4">
              <button
                onClick={() => setImportTab('inbox')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                  importTab === 'inbox'
                    ? 'bg-[var(--fs-brand)] text-white dark:text-[#0A1815]'
                    : 'text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-2)]'
                }`}
              >
                Money Inbox Review ({needsReviewItems.length})
              </button>
              <button
                onClick={() => setImportTab('sms')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                  importTab === 'sms'
                    ? 'bg-[var(--fs-brand)] text-white dark:text-[#0A1815]'
                    : 'text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-2)]'
                }`}
              >
                Paste Bank SMS Alert
              </button>
              <button
                onClick={() => setImportTab('file')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                  importTab === 'file'
                    ? 'bg-[var(--fs-brand)] text-white dark:text-[#0A1815]'
                    : 'text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-2)]'
                }`}
              >
                Upload CSV / XLSX / PDF / TXT Statement
              </button>
            </div>

            {importTab === 'inbox' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[var(--fs-text)]">Transaction Triage & Anti-Double-Counting</h3>
                    <p className="text-xs text-[var(--fs-text-muted)]">
                      Confirm auto-detected categories, split mixed orders, or mark self-transfers & credit-card bill settlements.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-[var(--fs-surface-2)] p-1 border border-[var(--fs-border)]">
                    <button
                      type="button"
                      onClick={() => setInboxFilter('NEEDS_REVIEW')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                        inboxFilter === 'NEEDS_REVIEW'
                          ? 'bg-[var(--fs-brand)] text-white dark:text-[#0A1815]'
                          : 'text-[var(--fs-text-body)]'
                      }`}
                    >
                      Needs Review ({needsReviewItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setInboxFilter('ALL')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                        inboxFilter === 'ALL'
                          ? 'bg-[var(--fs-brand)] text-white dark:text-[#0A1815]'
                          : 'text-[var(--fs-text-body)]'
                      }`}
                    >
                      All ({transactions.length})
                    </button>
                  </div>
                </div>

                {inboxDisplayList.length === 0 ? (
                  <EmptyStateCard
                    variant="transactions"
                    title={inboxFilter === 'NEEDS_REVIEW' ? 'Money Inbox is clean' : 'No transactions in Money Inbox'}
                    description={
                      inboxFilter === 'NEEDS_REVIEW'
                        ? 'Every imported transaction has been verified or categorized. Import a new statement or SMS anytime.'
                        : 'Paste a bank SMS alert or upload a CSV/XLSX/PDF statement to triage entries here.'
                    }
                    actionLabel="Import SMS or Statement"
                    onAction={() => setImportTab('sms')}
                  />
                ) : (
                  <div className="space-y-3">
                    {inboxDisplayList.slice(0, 25).map(tx => (
                      <div key={tx.id} className="p-4 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-bold text-[var(--fs-text)] flex flex-wrap items-center gap-2">
                              <span>{tx.description}</span>
                              <span className="font-mono-num text-[10px] text-[var(--fs-text-muted)]">
                                {tx.inboxStatus || 'CATEGORIZED'} · {tx.confidence ?? 85}% confidence
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--fs-text-body)] mt-0.5">
                              {tx.transactionDate} · {tx.account} · Suggested: <strong>{tx.category}</strong>
                            </div>
                            {tx.suggestionReason && (
                              <div className="text-[11px] text-[var(--fs-text-muted)] mt-0.5">{tx.suggestionReason}</div>
                            )}
                          </div>
                          <div className={`font-mono-num text-base font-bold shrink-0 ${
                            tx.type === 'INCOME' ? 'text-[var(--fs-success)]' : 'text-[var(--fs-text)]'
                          }`}>
                            {tx.type === 'INCOME' ? '+' : '-'}{formatINR(tx.amount)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--fs-border)]">
                          <button
                            type="button"
                            onClick={() => handleInboxAction(tx.id, 'CONFIRM', { category: tx.category })}
                            className="fs-btn-primary px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1"
                          >
                            <CheckCircle className="h-3 w-3" />
                            <span>Confirm ({tx.category})</span>
                          </button>
                          <select
                            aria-label={`Change category for ${tx.description}`}
                            value={tx.category}
                            onChange={e => handleInboxAction(tx.id, 'CONFIRM', { category: e.target.value })}
                            className="fs-input px-2 py-1 text-[11px]"
                          >
                            {CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setSplitTx(tx);
                              setSplitRows([
                                { category: tx.category, amount: String(Math.round((tx.amount / 2) * 100) / 100) },
                                { category: 'Shopping', amount: String(Math.round((tx.amount - Math.round((tx.amount / 2) * 100) / 100) * 100) / 100) },
                              ]);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-surface)] text-[11px] text-[var(--fs-text)] hover:border-[var(--fs-accent)] inline-flex items-center gap-1"
                          >
                            <Split className="h-3 w-3" />
                            <span>Split</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInboxAction(tx.id, 'MARK_TRANSFER')}
                            className="px-2.5 py-1 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-surface)] text-[11px] text-[var(--fs-text-body)] hover:text-[var(--fs-text)] inline-flex items-center gap-1"
                          >
                            <ArrowLeftRight className="h-3 w-3" />
                            <span>Transfer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInboxAction(tx.id, 'MARK_CARD_PAYMENT')}
                            className="px-2.5 py-1 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-surface)] text-[11px] text-[var(--fs-text-body)] hover:text-[var(--fs-text)] inline-flex items-center gap-1"
                          >
                            <CreditCard className="h-3 w-3" />
                            <span>Card Payment</span>
                          </button>
                          {tx.type === 'INCOME' && (
                            <button
                              type="button"
                              onClick={() => handleInboxAction(tx.id, 'MARK_REFUND')}
                              className="px-2.5 py-1 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-surface)] text-[11px] text-[var(--fs-text-body)] hover:text-[var(--fs-text)] inline-flex items-center gap-1"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Refund</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleInboxAction(tx.id, 'IGNORE')}
                            className="px-2.5 py-1 rounded-lg border border-[var(--fs-border)] bg-[var(--fs-surface)] text-[11px] text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)] inline-flex items-center gap-1"
                          >
                            <EyeOff className="h-3 w-3" />
                            <span>Ignore</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {importTab === 'sms' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                    Paste Bank SMS or UPI alert:
                  </label>
                  <textarea
                    rows={4}
                    value={smsText}
                    onChange={e => setSmsText(e.target.value)}
                    placeholder="e.g. Sent Rs.450.00 from HDFC Bank A/C **4102 to ZOMATO on 05-03-26. UPI Ref 606512345678."
                    className="fs-input w-full p-3 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleParseSms}
                  className="fs-btn-primary px-4 py-2 text-xs font-semibold"
                >
                  Preview Parsed Data
                </button>

                {parsedSmsPreview && (
                  <div className="p-4 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] space-y-3">
                    {duplicateWarning && (
                      <div className="p-3 rounded-lg bg-[var(--fs-warning)]/10 border border-[var(--fs-warning)]/40 text-xs text-[var(--fs-warning)] flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{duplicateWarning}</span>
                      </div>
                    )}
                    <h4 className="text-xs font-bold text-[var(--fs-text)]">Extracted Transaction Preview:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div><span className="text-[var(--fs-text-muted)]">Merchant:</span> <span className="text-[var(--fs-text)] font-medium">{parsedSmsPreview.merchant}</span></div>
                      <div><span className="text-[var(--fs-text-muted)]">Amount:</span> <span className="text-[var(--fs-success)] font-mono-num font-bold">{formatINR(parsedSmsPreview.amount)}</span></div>
                      <div><span className="text-[var(--fs-text-muted)]">Type:</span> <span className="text-[var(--fs-text)]">{parsedSmsPreview.type}</span></div>
                      <div><span className="text-[var(--fs-text-muted)]">Category:</span> <span className="text-[var(--fs-text)]">{parsedSmsPreview.category}</span></div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleConfirmSmsImport}
                        disabled={isImporting}
                        className="fs-btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-60"
                      >
                        {isImporting ? 'Importing...' : 'Confirm & Import to Account'}
                      </button>
                      <button
                        onClick={() => { setParsedSmsPreview(null); setDuplicateWarning(null); }}
                        className="rounded-lg border border-[var(--fs-border)] px-3 py-2 text-xs text-[var(--fs-text-muted)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {importTab === 'file' && (
              <div className="space-y-4">
                <div className="p-8 border-2 border-dashed border-[var(--fs-border)] rounded-2xl text-center space-y-3 bg-[var(--fs-surface-2)]/40">
                  <FileText className="h-10 w-10 mx-auto text-[var(--fs-text-muted)]" />
                  <div className="text-xs font-semibold text-[var(--fs-text)]">Upload Bank Statement (CSV, XLSX, PDF, or TXT)</div>
                  <p className="text-[11px] text-[var(--fs-text-muted)]">Maximum file size: 10MB. Parsed on server with duplicate candidate detection.</p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.pdf,.txt"
                    className="hidden"
                    id="statement-file-input"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleStatementFileSelected(file);
                      }
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="statement-file-input"
                    className="fs-btn-primary inline-flex items-center gap-2 cursor-pointer px-4 py-2 text-xs font-semibold"
                  >
                    {isParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    <span>{isParsing ? 'Parsing Statement...' : 'Browse Statement File'}</span>
                  </label>
                </div>

                {stagedBatch && (
                  <div className="rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--fs-border)] pb-3">
                      <div>
                        <h4 className="text-xs font-bold text-[var(--fs-text)]">
                          Staged Preview: {stagedBatch.fileName} ({stagedBatch.format})
                        </h4>
                        <p className="text-[11px] text-[var(--fs-text-muted)]">
                          {stagedBatch.transactions.length} transactions extracted · {stagedBatch.transactions.filter(t => t.isDuplicate).length} potential duplicate(s) flagged
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[var(--fs-text-body)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipDuplicates}
                          onChange={e => setSkipDuplicates(e.target.checked)}
                          className="rounded border-[var(--fs-border)]"
                        />
                        <span>Skip flagged duplicates</span>
                      </label>
                    </div>

                    <div className="max-h-64 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[var(--fs-text-muted)] border-b border-[var(--fs-border)]">
                          <tr>
                            <th className="py-2 pr-3">Date</th>
                            <th className="py-2 pr-3">Description</th>
                            <th className="py-2 pr-3">Category</th>
                            <th className="py-2 pr-3">Status</th>
                            <th className="py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--fs-border)]">
                          {stagedBatch.transactions.map((row, idx) => (
                            <tr key={idx}>
                              <td className="py-2 pr-3 text-[var(--fs-text-muted)] whitespace-nowrap font-mono-num">{row.transactionDate}</td>
                              <td className="py-2 pr-3 text-[var(--fs-text)]">{row.description}</td>
                              <td className="py-2 pr-3 text-[var(--fs-text-body)]">{row.category}</td>
                              <td className="py-2 pr-3">
                                <span className={`text-[10px] font-bold ${row.isDuplicate ? 'text-[var(--fs-warning)]' : 'text-[var(--fs-success)]'}`}>
                                  {row.isDuplicate ? 'DUPLICATE' : 'NEW'}
                                </span>
                              </td>
                              <td className={`py-2 text-right font-mono-num font-semibold ${row.type === 'INCOME' ? 'text-[var(--fs-success)]' : 'text-[var(--fs-text)]'}`}>
                                {row.type === 'INCOME' ? '+' : '-'}{formatINR(row.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--fs-border)]">
                      <button
                        onClick={() => setStagedBatch(null)}
                        className="rounded-lg border border-[var(--fs-border)] px-3 py-2 text-xs text-[var(--fs-text-muted)]"
                      >
                        Discard
                      </button>
                      <button
                        onClick={handleConfirmBatchImport}
                        disabled={isImporting}
                        className="fs-btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-60"
                      >
                        {isImporting ? 'Importing...' : 'Confirm & Commit Batch Import'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="fs-card p-6 space-y-3">
            <h3 className="font-display text-sm font-bold text-[var(--fs-text)]">Statement Import History</h3>
            {importJobs.length === 0 ? (
              <p className="text-xs text-[var(--fs-text-muted)]">No statement import jobs recorded yet.</p>
            ) : (
              <div className="divide-y divide-[var(--fs-border)] text-xs">
                {importJobs.map(job => (
                  <div key={job.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[var(--fs-text)]">{job.fileName} <span className="text-[10px] font-mono-num text-[var(--fs-accent)]">[{job.format}]</span></div>
                      <div className="text-[11px] text-[var(--fs-text-muted)]">{job.createdAt.split('T')[0]} · {job.totalRowsParsed} parsed</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[var(--fs-success)]">{job.importedCount} imported</div>
                      <div className="text-[11px] text-[var(--fs-text-muted)]">{job.skippedDuplicatesCount} duplicates skipped</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW 4: BUDGETS */}
      {subview === 'budgets' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--fs-text-body)]">Budgets automatically compute spent totals from your non-transfer expense transactions.</p>
            <button
              onClick={() => setShowBudgetModal(true)}
              className="fs-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Budget</span>
            </button>
          </div>

          {budgets.length === 0 ? (
            <EmptyStateCard
              variant="budgets"
              title="No monthly category budgets configured"
              description="Create monthly category envelopes (Food, Housing, Transport) to monitor threshold alerts automatically."
              actionLabel="Create Your First Budget"
              onAction={() => setShowBudgetModal(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {budgets.map(b => {
                const pct = b.allocatedAmount > 0 ? Math.round((b.spentAmount / b.allocatedAmount) * 100) : 0;
                return (
                  <div key={b.id} className="fs-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-[var(--fs-text)]">{b.name}</span>
                        <div className="text-[11px] text-[var(--fs-text-muted)]">{b.category}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-mono-num font-semibold ${pct >= b.alertThreshold ? 'text-[var(--fs-danger)]' : 'text-[var(--fs-accent)]'}`}>
                          {pct}% spent
                        </span>
                        <button
                          onClick={() => handleDeleteBudget(b.id)}
                          className="text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                          title="Delete Budget"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="font-mono-num text-xl font-bold text-[var(--fs-text)]">
                      {formatINR(b.spentAmount)} <span className="text-xs font-normal text-[var(--fs-text-muted)]">/ {formatINR(b.allocatedAmount)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--fs-surface-2)] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= b.alertThreshold ? 'bg-[var(--fs-danger)]' : 'bg-[var(--fs-success)]'}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[var(--fs-text-muted)] flex justify-between">
                      <span>Remaining: {formatINR(Math.max(0, b.allocatedAmount - b.spentAmount))}</span>
                      <span>Alert at {b.alertThreshold}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW 5: SPENDING INSIGHTS */}
      {subview === 'insights' && (
        <div className="space-y-6 max-w-4xl">
          <div className="fs-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[var(--fs-text)]">Live Category Spending Breakdown</h3>
              <span className="font-mono-num text-xs text-[var(--fs-text-muted)]">Total Outflow: {formatINR(metrics.totalExpenses)}</span>
            </div>

            {categoryBreakdown.length === 0 ? (
              <EmptyStateCard
                variant="budgets"
                title="Add expenses to generate spending insights"
                description="Once categorized expenses are recorded, FinSight maps your highest spend areas and prepares Gemini recommendations."
                actionLabel="Add Transaction"
                onAction={() => setShowAddModal(true)}
              />
            ) : (
              <div className="space-y-3">
                {categoryBreakdown.map(item => (
                  <div key={item.category} className="p-4 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-[var(--fs-text)]">{item.category}</span>
                      <span className="font-mono-num font-semibold text-[var(--fs-accent)]">{formatINR(item.amount)} ({item.pct}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--fs-bg)] overflow-hidden">
                      <div className="h-full bg-[var(--fs-accent)] rounded-full" style={{ width: `${Math.min(100, item.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {aiSpendingInsight && (
              <div className="p-4 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-accent)]/40 space-y-1.5">
                <div className="text-xs font-bold text-[var(--fs-accent)]">Gemini 4 Hydrogen Spending Analysis</div>
                <div className="text-xs text-[var(--fs-text)] whitespace-pre-wrap leading-relaxed">{aiSpendingInsight}</div>
              </div>
            )}

            {aiInsightError && (
              <div className="p-3 rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/40 text-xs text-[var(--fs-danger)] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{aiInsightError}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={handleRequestSpendingAiInsight}
                disabled={aiInsightLoading}
                className="fs-btn-primary px-4 py-2 text-xs font-semibold disabled:opacity-60 flex items-center gap-2"
              >
                {aiInsightLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>{aiInsightLoading ? 'Analyzing...' : 'Generate AI Spending Insights'}</span>
              </button>
              <button
                onClick={onOpenAI}
                className="rounded-lg border border-[var(--fs-border)] px-4 py-2 text-xs font-semibold text-[var(--fs-text)] hover:bg-[var(--fs-surface-2)]"
              >
                Ask AI in Chat Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Transaction Modal */}
      {splitTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md fs-card p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="font-display text-base font-bold text-[var(--fs-text)]">Split Transaction</h3>
              <p className="text-xs text-[var(--fs-text-muted)] mt-0.5">
                {splitTx.description} · Original Total: <strong className="font-mono-num">{formatINR(splitTx.amount)}</strong>
              </p>
            </div>
            <form onSubmit={handleSubmitSplit} className="space-y-3">
              {splitRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-2">
                  <select
                    value={row.category}
                    onChange={e =>
                      setSplitRows(prev => prev.map((r, i) => (i === idx ? { ...r, category: e.target.value } : r)))
                    }
                    className="fs-input px-2.5 py-2 text-xs"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={row.amount}
                    onChange={e =>
                      setSplitRows(prev => prev.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)))
                    }
                    className="fs-input px-2.5 py-2 text-xs font-mono-num"
                    required
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSplitRows(prev => [...prev, { category: 'Other', amount: '0' }])}
                className="text-xs font-semibold text-[var(--fs-accent)] hover:underline"
              >
                + Add another split line
              </button>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--fs-border)]">
                <button
                  type="button"
                  onClick={() => setSplitTx(null)}
                  className="rounded-lg border border-[var(--fs-border)] px-4 py-2 text-xs text-[var(--fs-text-muted)]"
                >
                  Cancel
                </button>
                <button type="submit" className="fs-btn-primary px-4 py-2 text-xs font-semibold">
                  Save Split
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md fs-card p-6 space-y-4 shadow-2xl">
            <h3 className="font-display text-base font-bold text-[var(--fs-text)]">
              {editingTxId ? 'Edit Transaction' : 'Add New Transaction'}
            </h3>
            <form onSubmit={handleSaveTransaction} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Description</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="e.g. Swiggy Groceries Order"
                  className="fs-input w-full px-3 py-2 text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    placeholder="1200"
                    className="fs-input w-full px-3 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as 'INCOME' | 'EXPENSE')}
                    className="fs-input w-full px-3 py-2 text-xs"
                  >
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="fs-input w-full px-3 py-2 text-xs"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="fs-input w-full px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Account</label>
                <input
                  type="text"
                  value={newAccount}
                  onChange={e => setNewAccount(e.target.value)}
                  className="fs-input w-full px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--fs-border)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-[var(--fs-border)] px-4 py-2 text-xs text-[var(--fs-text-muted)]"
                >
                  Cancel
                </button>
                <button type="submit" className="fs-btn-primary px-4 py-2 text-xs font-semibold">
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md fs-card p-6 space-y-4 shadow-2xl">
            <h3 className="font-display text-base font-bold text-[var(--fs-text)]">Create Category Budget</h3>
            <form onSubmit={handleCreateBudget} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Budget Label</label>
                <input
                  type="text"
                  value={budgetName}
                  onChange={e => setBudgetName(e.target.value)}
                  placeholder="e.g. Monthly Groceries & Dining"
                  className="fs-input w-full px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Category</label>
                  <select
                    value={budgetCategory}
                    onChange={e => setBudgetCategory(e.target.value)}
                    className="fs-input w-full px-3 py-2 text-xs"
                  >
                    <option value="Food & Dining">Food & Dining</option>
                    <option value="Food">Food</option>
                    <option value="Housing & Utilities">Housing & Utilities</option>
                    <option value="Transport">Transport</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Subscriptions">Subscriptions</option>
                    <option value="Investments">Investments</option>
                    <option value="General Expense">General Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Monthly Limit (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={budgetAllocated}
                    onChange={e => setBudgetAllocated(e.target.value)}
                    placeholder="15000"
                    className="fs-input w-full px-3 py-2 text-xs"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Alert Threshold (%)</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={budgetThreshold}
                  onChange={e => setBudgetThreshold(e.target.value)}
                  className="fs-input w-full px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--fs-border)]">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="rounded-lg border border-[var(--fs-border)] px-4 py-2 text-xs text-[var(--fs-text-muted)]"
                >
                  Cancel
                </button>
                <button type="submit" className="fs-btn-primary px-4 py-2 text-xs font-semibold">
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
