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
} from 'lucide-react';
import { Transaction, Budget, ImportJobRecord } from '../../types';
import { calculateBudgetMetrics, formatINR } from '../../utils/financialMath';
import { apiFetch, parseApiResponse } from '../../utils/api';

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

  // Add/Edit Transaction modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [newCategory, setNewCategory] = useState('Food');
  const [newAccount, setNewAccount] = useState('HDFC Bank UPI');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Budget Modal
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetName, setBudgetName] = useState('');
  const [budgetCategory, setBudgetCategory] = useState('Food');
  const [budgetAllocated, setBudgetAllocated] = useState('');
  const [budgetThreshold, setBudgetThreshold] = useState('80');

  // Import state
  const [importTab, setImportTab] = useState<'sms' | 'file'>('sms');
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

  const totalAllocatedBudget = budgets.reduce((s, b) => s + b.allocatedAmount, 0);
  const metrics = calculateBudgetMetrics(transactions, totalAllocatedBudget);
  const expenseCount = transactions.filter(t => t.type === 'EXPENSE').length;
  const remainingPct =
    totalAllocatedBudget > 0 ? Math.round((metrics.remainingBudget / totalAllocatedBudget) * 1000) / 10 : 0;

  const uniqueCategories = Array.from(new Set(transactions.map(t => t.category)));

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.merchant.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Dynamic spending breakdown for Insights tab
  const categoryBreakdown = Array.from(
    transactions
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
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#28443C] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7F5] tracking-tight">
            {subview === 'overview' && 'Smart Budgeting'}
            {subview === 'transactions' && 'Transactions'}
            {subview === 'import' && 'Import Financial Data'}
            {subview === 'budgets' && 'Monthly Budgets'}
            {subview === 'insights' && 'Spending Insights'}
          </h1>
          <p className="text-xs text-[#A7C1B8] mt-1">
            Organize UPI alerts, CSV/XLSX/PDF bank statements, and monthly category limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/app/budgeting/import')}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              subview === 'import'
                ? 'bg-[#16352E] text-[#A8E6CE] border-[#A8E6CE]'
                : 'bg-[#102722] text-[#A7C1B8] border-[#28443C] hover:text-[#F5F7F5]'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import</span>
          </button>
          <button
            onClick={() => {
              setEditingTxId(null);
              setNewDesc('');
              setNewAmount('');
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-[#A8E6CE] px-3.5 py-2 text-xs font-semibold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {moduleError && (
        <div className="p-3 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{moduleError}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#28443C] pb-2 overflow-x-auto whitespace-nowrap">
        {[
          { label: 'Overview', path: '/app/budgeting', key: 'overview' },
          { label: 'Transactions', path: '/app/budgeting/transactions', key: 'transactions' },
          { label: 'Import Statement / SMS', path: '/app/budgeting/import', key: 'import' },
          { label: 'Budgets', path: '/app/budgeting/budgets', key: 'budgets' },
          { label: 'Spending Insights', path: '/app/budgeting/insights', key: 'insights' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => onNavigate(tab.path)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              subview === tab.key
                ? 'bg-[#16352E] text-[#A8E6CE] border border-[#28443C]'
                : 'text-[#A7C1B8] hover:text-[#F5F7F5]'
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
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Total Income</span>
              <div className="text-2xl font-bold text-[#55C99A] tabular-nums">{formatINR(metrics.totalIncome)}</div>
              <span className="text-[11px] text-[#718D83]">Computed from recorded inflows</span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Total Spending</span>
              <div className="text-2xl font-bold text-[#F5F7F5] tabular-nums">{formatINR(metrics.totalExpenses)}</div>
              <span className="text-[11px] text-[#718D83]">{expenseCount} expense record{expenseCount === 1 ? '' : 's'}</span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Remaining Allocated Budget</span>
              <div className="text-2xl font-bold text-[#A8E6CE] tabular-nums">{formatINR(metrics.remainingBudget)}</div>
              <span className="text-[11px] text-[#55C99A]">{remainingPct}% of {formatINR(totalAllocatedBudget)} remaining</span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Savings Rate</span>
              <div className={`text-2xl font-bold tabular-nums ${metrics.savingsRate >= 0 ? 'text-[#55C99A]' : 'text-[#EB7676]'}`}>
                {metrics.savingsRate}%
              </div>
              <span className="text-[11px] text-[#718D83]">Net surplus: {formatINR(metrics.savings)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Recent Activity</h3>
              <button onClick={() => onNavigate('/app/budgeting/transactions')} className="text-xs text-[#A8E6CE] hover:underline">
                View All Transactions →
              </button>
            </div>
            {transactions.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#0B1C19] border border-[#28443C] text-center text-xs text-[#718D83]">
                No transactions yet. Add your first transaction or import a bank statement.
              </div>
            ) : (
              <div className="divide-y divide-[#28443C]/50">
                {transactions.slice(0, 5).map(tx => (
                  <div key={tx.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-[#F5F7F5]">{tx.description}</div>
                      <div className="text-[10px] text-[#718D83]">{tx.category} · {tx.transactionDate} · {tx.account}</div>
                    </div>
                    <div className={`font-semibold tabular-nums text-sm ${tx.type === 'INCOME' ? 'text-[#55C99A]' : 'text-[#F5F7F5]'}`}>
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
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between bg-[#102722] p-4 rounded-2xl border border-[#28443C]">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#718D83]" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by description or merchant..."
                className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] pl-9 pr-3 py-2 text-xs text-[#F5F7F5] placeholder-[#718D83] focus:outline-none focus:border-[#A8E6CE]"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5] focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-[#28443C] bg-[#102722] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#16352E]/40 border-b border-[#28443C] text-[#718D83]">
                <tr>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium">Source</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#28443C]/40">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#718D83]">
                      No transactions found. Import a statement or add your first transaction.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-[#16352E]/20 transition-colors">
                      <td className="py-3 px-4 text-[#718D83] whitespace-nowrap">{tx.transactionDate}</td>
                      <td className="py-3 px-4 font-semibold text-[#F5F7F5]">
                        <div>{tx.description}</div>
                        <div className="text-[10px] font-normal text-[#718D83]">{tx.account}</div>
                      </td>
                      <td className="py-3 px-4 text-[#A7C1B8]">{tx.category}</td>
                      <td className="py-3 px-4 text-[10px] font-mono text-[#718D83]">{tx.source}</td>
                      <td className={`py-3 px-4 text-right font-semibold tabular-nums whitespace-nowrap ${
                        tx.type === 'INCOME' ? 'text-[#55C99A]' : 'text-[#F5F7F5]'
                      }`}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatINR(tx.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(tx)}
                            className="text-[#718D83] hover:text-[#A8E6CE] p-1 rounded-md"
                            title="Edit Transaction"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="text-[#718D83] hover:text-[#EB7676] p-1 rounded-md"
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

      {/* SUBVIEW 3: IMPORT DATA */}
      {subview === 'import' && (
        <div className="space-y-6 max-w-4xl">
          {importStatusMsg && (
            <div className="p-4 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/40 text-xs text-[#55C99A] flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{importStatusMsg}</span>
            </div>
          )}

          {importErrorMsg && (
            <div className="p-4 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{importErrorMsg}</span>
            </div>
          )}

          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-[#28443C] pb-4">
              <button
                onClick={() => setImportTab('sms')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${importTab === 'sms' ? 'bg-[#16352E] text-[#A8E6CE]' : 'text-[#A7C1B8]'}`}
              >
                Paste Bank SMS Alert
              </button>
              <button
                onClick={() => setImportTab('file')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${importTab === 'file' ? 'bg-[#16352E] text-[#A8E6CE]' : 'text-[#A7C1B8]'}`}
              >
                Upload CSV / XLSX / PDF / TXT Statement
              </button>
            </div>

            {importTab === 'sms' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">
                    Paste Bank SMS or UPI alert:
                  </label>
                  <textarea
                    rows={4}
                    value={smsText}
                    onChange={e => setSmsText(e.target.value)}
                    placeholder="e.g. Sent Rs.450.00 from HDFC Bank A/C **4102 to ZOMATO on 05-03-26. UPI Ref 606512345678."
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] p-3 text-xs text-[#F5F7F5] placeholder-[#718D83] focus:border-[#A8E6CE] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleParseSms}
                  className="rounded-xl bg-[#16352E] border border-[#28443C] px-4 py-2 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0]"
                >
                  Preview Parsed Data
                </button>

                {parsedSmsPreview && (
                  <div className="p-4 rounded-xl bg-[#0B1C19] border border-[#28443C] space-y-3">
                    {duplicateWarning && (
                      <div className="p-3 rounded-lg bg-[#E5B764]/10 border border-[#E5B764]/40 text-xs text-[#E5B764] flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{duplicateWarning}</span>
                      </div>
                    )}
                    <h4 className="text-xs font-bold text-[#F5F7F5]">Extracted Transaction Preview:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div><span className="text-[#718D83]">Merchant:</span> <span className="text-[#F5F7F5]">{parsedSmsPreview.merchant}</span></div>
                      <div><span className="text-[#718D83]">Amount:</span> <span className="text-[#55C99A] font-bold">{formatINR(parsedSmsPreview.amount)}</span></div>
                      <div><span className="text-[#718D83]">Type:</span> <span className="text-[#F5F7F5]">{parsedSmsPreview.type}</span></div>
                      <div><span className="text-[#718D83]">Category:</span> <span className="text-[#F5F7F5]">{parsedSmsPreview.category}</span></div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleConfirmSmsImport}
                        disabled={isImporting}
                        className="rounded-lg bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19] disabled:opacity-60"
                      >
                        {isImporting ? 'Importing...' : 'Confirm & Import to Account'}
                      </button>
                      <button
                        onClick={() => { setParsedSmsPreview(null); setDuplicateWarning(null); }}
                        className="rounded-lg border border-[#28443C] px-3 py-2 text-xs text-[#718D83]"
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
                <div className="p-8 border-2 border-dashed border-[#28443C] rounded-2xl text-center space-y-3">
                  <FileText className="h-10 w-10 mx-auto text-[#718D83]" />
                  <div className="text-xs font-semibold text-[#F5F7F5]">Upload Bank Statement (CSV, XLSX, PDF, or TXT)</div>
                  <p className="text-[11px] text-[#718D83]">Maximum file size: 10MB. Parsed on server with duplicate candidate detection.</p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.pdf,.txt"
                    className="hidden"
                    id="statement-file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleStatementFileSelected(file);
                      }
                      e.target.value = '';
                    }}
                  />
                  <label
                    htmlFor="statement-file-input"
                    className="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
                  >
                    {isParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    <span>{isParsing ? 'Parsing Statement...' : 'Browse Statement File'}</span>
                  </label>
                </div>

                {stagedBatch && (
                  <div className="rounded-xl bg-[#0B1C19] border border-[#28443C] p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#28443C] pb-3">
                      <div>
                        <h4 className="text-xs font-bold text-[#F5F7F5]">
                          Staged Preview: {stagedBatch.fileName} ({stagedBatch.format})
                        </h4>
                        <p className="text-[11px] text-[#718D83]">
                          {stagedBatch.transactions.length} transactions extracted · {stagedBatch.transactions.filter(t => t.isDuplicate).length} potential duplicate(s) flagged
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[#A7C1B8] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipDuplicates}
                          onChange={e => setSkipDuplicates(e.target.checked)}
                          className="rounded border-[#28443C]"
                        />
                        <span>Skip flagged duplicates</span>
                      </label>
                    </div>

                    <div className="max-h-64 overflow-y-auto overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[#718D83] border-b border-[#28443C]">
                          <tr>
                            <th className="py-2 pr-3">Date</th>
                            <th className="py-2 pr-3">Description</th>
                            <th className="py-2 pr-3">Category</th>
                            <th className="py-2 pr-3">Status</th>
                            <th className="py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#28443C]/40">
                          {stagedBatch.transactions.map((row, idx) => (
                            <tr key={idx}>
                              <td className="py-2 pr-3 text-[#718D83] whitespace-nowrap">{row.transactionDate}</td>
                              <td className="py-2 pr-3 text-[#F5F7F5]">{row.description}</td>
                              <td className="py-2 pr-3 text-[#A7C1B8]">{row.category}</td>
                              <td className="py-2 pr-3">
                                {row.isDuplicate ? (
                                  <span className="px-2 py-0.5 rounded bg-[#E5B764]/20 text-[#E5B764] text-[10px] font-bold">DUPLICATE</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-[#55C99A]/20 text-[#55C99A] text-[10px] font-bold">NEW</span>
                                )}
                              </td>
                              <td className={`py-2 text-right font-semibold tabular-nums ${row.type === 'INCOME' ? 'text-[#55C99A]' : 'text-[#F5F7F5]'}`}>
                                {row.type === 'INCOME' ? '+' : '-'}{formatINR(row.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#28443C]">
                      <button
                        onClick={() => setStagedBatch(null)}
                        className="rounded-lg border border-[#28443C] px-3 py-2 text-xs text-[#718D83]"
                      >
                        Discard
                      </button>
                      <button
                        onClick={handleConfirmBatchImport}
                        disabled={isImporting}
                        className="rounded-lg bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19] disabled:opacity-60"
                      >
                        {isImporting ? 'Importing...' : 'Confirm & Commit Batch Import'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Import History */}
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-3">
            <h3 className="text-sm font-bold text-[#F5F7F5]">Statement Import History</h3>
            {importJobs.length === 0 ? (
              <p className="text-xs text-[#718D83]">No statement import jobs recorded yet.</p>
            ) : (
              <div className="divide-y divide-[#28443C]/40 text-xs">
                {importJobs.map(job => (
                  <div key={job.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#F5F7F5]">{job.fileName} <span className="text-[10px] font-mono text-[#A8E6CE]">[{job.format}]</span></div>
                      <div className="text-[10px] text-[#718D83]">{job.createdAt.split('T')[0]} · {job.totalRowsParsed} parsed</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[#55C99A]">{job.importedCount} imported</div>
                      <div className="text-[10px] text-[#718D83]">{job.skippedDuplicatesCount} duplicates skipped</div>
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
            <p className="text-xs text-[#A7C1B8]">Budgets automatically compute spent totals from your categorized expense transactions.</p>
            <button
              onClick={() => setShowBudgetModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#A8E6CE] px-3.5 py-2 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Budget</span>
            </button>
          </div>

          {budgets.length === 0 ? (
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-8 text-center space-y-3">
              <p className="text-xs text-[#718D83]">No monthly category budgets configured yet.</p>
              <button
                onClick={() => setShowBudgetModal(true)}
                className="rounded-lg bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
              >
                Create Your First Budget
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {budgets.map(b => {
                const pct = b.allocatedAmount > 0 ? Math.round((b.spentAmount / b.allocatedAmount) * 100) : 0;
                return (
                  <div key={b.id} className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-[#F5F7F5]">{b.name}</span>
                        <div className="text-[10px] text-[#718D83]">{b.category}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono ${pct >= b.alertThreshold ? 'text-[#EB7676]' : 'text-[#A8E6CE]'}`}>
                          {pct}% spent
                        </span>
                        <button
                          onClick={() => handleDeleteBudget(b.id)}
                          className="text-[#718D83] hover:text-[#EB7676]"
                          title="Delete Budget"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-[#F5F7F5] tabular-nums">
                      {formatINR(b.spentAmount)} <span className="text-xs font-normal text-[#718D83]">/ {formatINR(b.allocatedAmount)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#0B1C19] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= b.alertThreshold ? 'bg-[#EB7676]' : 'bg-[#55C99A]'}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[#718D83] flex justify-between">
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
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#F5F7F5]">Live Category Spending Breakdown</h3>
              <span className="text-xs text-[#718D83]">Total Outflow: {formatINR(metrics.totalExpenses)}</span>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#0B1C19] border border-[#28443C] text-xs text-[#718D83] text-center">
                Add expense transactions or import a bank statement to generate real spending insights.
              </div>
            ) : (
              <div className="space-y-3">
                {categoryBreakdown.map(item => (
                  <div key={item.category} className="p-4 rounded-xl bg-[#0B1C19] border border-[#28443C] space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-[#F5F7F5]">{item.category}</span>
                      <span className="font-semibold text-[#A8E6CE] tabular-nums">{formatINR(item.amount)} ({item.pct}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#102722] overflow-hidden">
                      <div className="h-full bg-[#A8E6CE] rounded-full" style={{ width: `${Math.min(100, item.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {aiSpendingInsight && (
              <div className="p-4 rounded-xl bg-[#16352E]/60 border border-[#A8E6CE]/40 space-y-1.5">
                <div className="text-xs font-bold text-[#A8E6CE]">Gemini 4 Hydrogen Spending Analysis</div>
                <div className="text-xs text-[#F5F7F5] whitespace-pre-wrap leading-relaxed">{aiSpendingInsight}</div>
              </div>
            )}

            {aiInsightError && (
              <div className="p-3 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676] flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{aiInsightError}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={handleRequestSpendingAiInsight}
                disabled={aiInsightLoading}
                className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0] disabled:opacity-60 flex items-center gap-2"
              >
                {aiInsightLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>{aiInsightLoading ? 'Analyzing...' : 'Generate AI Spending Insights'}</span>
              </button>
              <button
                onClick={onOpenAI}
                className="rounded-xl bg-[#16352E] border border-[#28443C] px-4 py-2 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0]"
              >
                Ask AI in Chat Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F7F5]">
              {editingTxId ? 'Edit Transaction' : 'Add New Transaction'}
            </h3>
            <form onSubmit={handleSaveTransaction} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Description</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="e.g. Swiggy Groceries Order"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    placeholder="1200"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as 'INCOME' | 'EXPENSE')}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  >
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  >
                    <option value="Food">Food</option>
                    <option value="Housing">Housing</option>
                    <option value="Transport">Transport</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Investments">Investments</option>
                    <option value="Salary">Salary</option>
                    <option value="Consulting">Consulting</option>
                    <option value="General Expense">General Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Account</label>
                <input
                  type="text"
                  value={newAccount}
                  onChange={e => setNewAccount(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#28443C]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-[#28443C] px-4 py-2 text-xs text-[#718D83]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F7F5]">Create Category Budget</h3>
            <form onSubmit={handleCreateBudget} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Budget Label</label>
                <input
                  type="text"
                  value={budgetName}
                  onChange={e => setBudgetName(e.target.value)}
                  placeholder="e.g. Monthly Groceries & Dining"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Category</label>
                  <select
                    value={budgetCategory}
                    onChange={e => setBudgetCategory(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  >
                    <option value="Food">Food</option>
                    <option value="Housing">Housing</option>
                    <option value="Transport">Transport</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Investments">Investments</option>
                    <option value="General Expense">General Expense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Monthly Limit (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={budgetAllocated}
                    onChange={e => setBudgetAllocated(e.target.value)}
                    placeholder="15000"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Alert Threshold (%)</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={budgetThreshold}
                  onChange={e => setBudgetThreshold(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#28443C]">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="rounded-xl border border-[#28443C] px-4 py-2 text-xs text-[#718D83]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
                >
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
