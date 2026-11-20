import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ShieldCheck,
  CheckCircle,
  FileText,
  Trash2,
  Download,
  AlertCircle,
  Save,
  Loader2,
  ClipboardCheck,
  CalendarClock,
} from 'lucide-react';
import {
  TaxCalculationRecord,
  TaxDeduction,
  TaxDocument,
  TaxReadinessItem,
} from '../../types';
import { calculateIndianTax, formatINR } from '../../utils/financialMath';
import { apiFetch } from '../../utils/api';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';

interface TaxModuleProps {
  subview: 'overview' | 'compare' | 'calculator' | 'deductions' | 'documents' | 'summary';
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

export const TaxModule: React.FC<TaxModuleProps> = ({
  subview,
  onNavigate,
  onOpenAI,
}) => {
  const [financialYear, setFinancialYear] = useState<'2025-26' | '2024-25'>('2025-26');
  const [deductions, setDeductions] = useState<TaxDeduction[]>([]);
  const [calculations, setCalculations] = useState<TaxCalculationRecord[]>([]);
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [readinessItems, setReadinessItems] = useState<TaxReadinessItem[]>([]);
  const [annualSalary, setAnnualSalary] = useState('1200000');
  const [otherIncome, setOtherIncome] = useState('0');
  const [showDeductionModal, setShowDeductionModal] = useState(false);

  const [docCategory, setDocCategory] = useState<TaxDocument['category']>('Form 16');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadStatus, setDocUploadStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // New Deduction State
  const [newCat, setNewCat] = useState<TaxDeduction['category']>('Section 80C');
  const [newDesc, setNewDesc] = useState('');
  const [newClaim, setNewClaim] = useState('');

  const loadTaxWorkspace = useCallback(async () => {
    try {
      const [profRes, dedRes, calcRes, docRes, readyRes] = await Promise.all([
        apiFetch('/api/v1/tax/profile'),
        apiFetch('/api/v1/tax/deductions'),
        apiFetch('/api/v1/tax/calculations'),
        apiFetch('/api/v1/tax/documents'),
        apiFetch(`/api/v1/tax/readiness?fy=${financialYear}`),
      ]);
      const [profJson, dedJson, calcJson, docJson, readyJson] = await Promise.all([
        profRes.json(),
        dedRes.json(),
        calcRes.json(),
        docRes.json(),
        readyRes.json(),
      ]);
      if (profJson.success && profJson.data) {
        if (profJson.data.annualSalary > 0 || profJson.data.otherIncome > 0) {
          setAnnualSalary(String(profJson.data.annualSalary));
          setOtherIncome(String(profJson.data.otherIncome));
        }
      }
      if (dedJson.success) setDeductions(dedJson.data || []);
      if (calcJson.success) setCalculations(calcJson.data || []);
      if (docJson.success) setDocuments(docJson.data || []);
      if (readyJson.success && Array.isArray(readyJson.data)) setReadinessItems(readyJson.data);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to load tax workspace.');
    }
  }, [financialYear]);

  useEffect(() => {
    loadTaxWorkspace();
  }, [loadTaxWorkspace]);

  const fyDeductions = deductions.filter(d => !d.financialYear || d.financialYear === financialYear);
  const totalDeductionsClaimed = fyDeductions.reduce(
    (sum, d) => sum + Math.min(d.claimedAmount, d.applicableLimit),
    0
  );
  const grossIncome = (parseFloat(annualSalary) || 0) + (parseFloat(otherIncome) || 0);

  const oldRegimeTax = calculateIndianTax(grossIncome, totalDeductionsClaimed, 'OLD', financialYear);
  const newRegimeTax = calculateIndianTax(grossIncome, totalDeductionsClaimed, 'NEW', financialYear);
  const diff = oldRegimeTax.totalTax - newRegimeTax.totalTax;
  const isNewBetter = newRegimeTax.totalTax <= oldRegimeTax.totalTax;

  const verifiedReadinessCount = readinessItems.filter(
    i => i.status === 'VERIFIED_BY_USER' || i.status === 'UPLOADED'
  ).length;

  const handleUpdateReadinessStatus = async (
    id: string,
    status: TaxReadinessItem['status']
  ) => {
    const res = await apiFetch(`/api/v1/tax/readiness/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      setReadinessItems(prev => prev.map(item => (item.id === id ? json.data : item)));
    }
  };

  const handleSaveProfileAndCalc = async () => {
    setStatusError(null);
    setSaveMessage(null);
    try {
      await apiFetch('/api/v1/tax/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financialYear,
          annualSalary: parseFloat(annualSalary) || 0,
          otherIncome: parseFloat(otherIncome) || 0,
          preferredRegime: isNewBetter ? 'NEW' : 'OLD',
        }),
      });

      const res = await apiFetch('/api/v1/tax/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financialYear,
          grossIncome,
          deductions: totalDeductionsClaimed,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Unable to save tax calculation.');
      }
      setCalculations(prev => [json.data.record, ...prev]);
      setSaveMessage('Tax profile & regime calculation saved to your audit history.');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to save tax calculation.');
    }
  };

  const handleAddDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClaim) return;
    const res = await apiFetch('/api/v1/tax/deductions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: newCat,
        description: newDesc || newCat,
        claimedAmount: parseFloat(newClaim),
        financialYear,
        applicableLimit:
          newCat === 'Section 80C'
            ? 150000
            : newCat === 'Section 24(b) Home Loan'
            ? 200000
            : 50000,
      }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setDeductions(prev => [...prev, json.data]);
      setShowDeductionModal(false);
      setNewDesc('');
      setNewClaim('');
    }
  };

  const handleDeleteDeduction = async (id: string) => {
    const res = await apiFetch(`/api/v1/tax/deductions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDeductions(prev => prev.filter(d => d.id !== id));
    }
  };

  const handleUploadTaxDocument = async (file: File) => {
    setStatusError(null);
    setDocUploadStatus(null);
    setIsUploadingDoc(true);
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

      const res = await apiFetch('/api/v1/tax/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          fileBase64: base64,
          category: docCategory,
          financialYear,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Document upload failed.');
      }
      setDocuments(prev => [json.data, ...prev]);
      setDocUploadStatus(
        `Document "${json.data.name}" (${json.data.fileSize}) stored securely in your private tax vault.`
      );
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to upload document.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDownloadTaxDocument = async (doc: TaxDocument) => {
    try {
      const res = await apiFetch(`/api/v1/tax/documents/${doc.id}/download`);
      if (!res.ok) {
        throw new Error('Unable to download document.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Download failed.');
    }
  };

  const handleDeleteTaxDocument = async (id: string) => {
    const res = await apiFetch(`/api/v1/tax/documents/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDocuments(prev => prev.filter(d => d.id !== id));
    }
  };

  const cbdtDeadlines =
    financialYear === '2025-26'
      ? [
          { date: '15 Jun / 15 Sep / 15 Dec 2025', title: 'Advance Tax Instalments (15% / 45% / 75%)' },
          { date: '15 Mar 2026', title: '100% Advance Tax & Final 80C / 80D Window' },
          { date: '31 Jul 2026', title: 'ITR Filing Due Date (Non-Audit Individuals, AY 2026-27)' },
        ]
      : [
          { date: '15 Mar 2025', title: '100% Advance Tax Instalment (FY 2024-25)' },
          { date: '31 Jul 2025', title: 'ITR Filing Due Date (AY 2025-26)' },
          { date: '31 Dec 2025', title: 'Belated / Revised Return Deadline (AY 2025-26)' },
        ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--fs-border)] pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">
            Section 115BAC · Chapter VI-A · Filing Readiness
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] tracking-tight mt-1">
            Tax Helper (India FY {financialYear})
          </h1>
          <p className="text-xs text-[var(--fs-text-body)] mt-1">
            Compare Old vs New Tax Regimes ({newRegimeTax.rulesetVersion}), track CBDT filing readiness, and store Form 16 proofs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Select Financial Year"
            value={financialYear}
            onChange={e => setFinancialYear(e.target.value as '2025-26' | '2024-25')}
            className="fs-input w-auto py-2"
          >
            <option value="2025-26">FY 2025-26 (AY 2026-27)</option>
            <option value="2024-25">FY 2024-25 (AY 2025-26)</option>
          </select>
          <button
            onClick={() => setShowDeductionModal(true)}
            className="fs-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-xs whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Deduction</span>
          </button>
        </div>
      </div>

      {statusError && (
        <div className="p-3.5 rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/30 text-xs text-[var(--fs-danger)] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      {saveMessage && (
        <div className="p-3.5 rounded-xl bg-[var(--fs-success)]/10 border border-[var(--fs-success)]/30 text-xs text-[var(--fs-success)] flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--fs-border)] pb-2 overflow-x-auto whitespace-nowrap">
        {[
          { label: 'Overview', path: '/app/tax', key: 'overview' },
          { label: 'Old vs New Regime', path: '/app/tax/compare', key: 'compare' },
          { label: 'Tax Calculator', path: '/app/tax/calculator', key: 'calculator' },
          { label: `Deductions & Proofs (${fyDeductions.length})`, path: '/app/tax/deductions', key: 'deductions' },
          { label: `Tax Documents (${documents.length})`, path: '/app/tax/documents', key: 'documents' },
          { label: 'Tax Summary & Readiness', path: '/app/tax/summary', key: 'summary' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => onNavigate(tab.path)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              subview === tab.key
                ? 'bg-[var(--fs-surface-secondary)] text-[var(--fs-text)] border border-[var(--fs-border)]'
                : 'text-[var(--fs-text-body)] hover:text-[var(--fs-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBVIEW 1: OVERVIEW, COMPARE & CALCULATOR */}
      {(subview === 'overview' || subview === 'compare' || subview === 'calculator') && (
        <div className="space-y-6">
          <div className="fs-card p-6 space-y-4 max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[var(--fs-text)]">
                Annual Income &amp; Eligible Deductions ({financialYear})
              </h3>
              <button
                onClick={handleSaveProfileAndCalc}
                className="fs-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs self-start"
              >
                <Save className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
                <span>Save Calculation Snapshot</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Gross Annual Salary (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={annualSalary}
                  onChange={e => setAnnualSalary(e.target.value)}
                  className="fs-input font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Other Income (Interest / Freelance) (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={otherIncome}
                  onChange={e => setOtherIncome(e.target.value)}
                  className="fs-input font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Eligible Chapter VI-A Deductions (₹)
                </label>
                <input
                  type="number"
                  disabled
                  value={totalDeductionsClaimed}
                  className="fs-input font-mono-num opacity-70"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
            {/* New Regime Card */}
            <div
              className={`fs-card p-6 space-y-4 ${
                isNewBetter ? 'border-[var(--fs-success)] ring-1 ring-[var(--fs-success)]/30' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-base font-bold text-[var(--fs-text)]">
                    New Tax Regime (Section 115BAC)
                  </h4>
                  <span className="text-xs text-[var(--fs-text-muted)]">
                    Default Regime · Salaried Std Deduction ₹75,000
                  </span>
                </div>
                {isNewBetter && (
                  <span className="rounded-md bg-[var(--fs-success)]/15 border border-[var(--fs-success)]/40 px-2 py-0.5 text-[10px] font-bold text-[var(--fs-success)] shrink-0">
                    Recommended Lower Tax
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs pt-2">
                <div className="flex justify-between text-[var(--fs-text-body)]">
                  <span>Gross Total Income:</span>
                  <span className="font-semibold font-mono-num text-[var(--fs-text)] tabular-nums">
                    {formatINR(grossIncome)}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--fs-text-body)]">
                  <span>Standard Deduction:</span>
                  <span className="font-semibold font-mono-num text-[var(--fs-success)] tabular-nums">
                    -{formatINR(newRegimeTax.standardDeduction)}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--fs-text-body)]">
                  <span>Net Taxable Income:</span>
                  <span className="font-semibold font-mono-num text-[var(--fs-text)] tabular-nums">
                    {formatINR(newRegimeTax.taxableIncome)}
                  </span>
                </div>
                {newRegimeTax.rebate87A > 0 && (
                  <div className="flex justify-between text-[var(--fs-success)]">
                    <span>Section 87A Rebate:</span>
                    <span className="font-semibold font-mono-num tabular-nums">
                      -{formatINR(newRegimeTax.rebate87A)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--fs-text-body)] pt-2 border-t border-[var(--fs-border)]">
                  <span>Income Tax Before Cess:</span>
                  <span className="font-semibold font-mono-num text-[var(--fs-text)] tabular-nums">
                    {formatINR(newRegimeTax.taxBeforeCess)}
                  </span>
                </div>
                {newRegimeTax.surcharge > 0 && (
                  <div className="flex justify-between text-[var(--fs-warning)]">
                    <span>Income Surcharge:</span>
                    <span className="font-semibold font-mono-num tabular-nums">
                      {formatINR(newRegimeTax.surcharge)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--fs-text-body)]">
                  <span>Health &amp; Education Cess (4%):</span>
                  <span className="font-semibold font-mono-num text-[var(--fs-text)] tabular-nums">
                    {formatINR(newRegimeTax.cess)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[var(--fs-text)] pt-2 border-t border-[var(--fs-border)]">
                  <span>Total Estimated Tax:</span>
                  <span className="font-mono-num text-[var(--fs-accent)] tabular-nums">
                    {formatINR(newRegimeTax.totalTax)}
                  </span>
                </div>
              </div>
            </div>

            {/* Old Regime Card */}
            <div
              className={`fs-card p-6 space-y-4 ${
                !isNewBetter ? 'border-[var(--fs-success)] ring-1 ring-[var(--fs-success)]/30' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-base font-bold text-[var(--fs-text)]">Old Tax Regime</h4>
                  <span className="text-xs text-[var(--fs-text-muted)]">
                    Std Deduction ₹50,000 + 80C/80D Exemptions
                  </span>
                </div>
                {!isNewBetter && (
                  <span className="rounded-md bg-[var(--fs-success)]/15 border border-[var(--fs-success)]/40 px-2 py-0.5 text-[10px] font-bold text-[var(--fs-success)] shrink-0">
                    Recommended Lower Tax
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs pt-2">
                <div className="flex justify-between text-[var(--fs-text-body)]">
                  <span>Gross Total Income:</span>
                  <span className="font-semibold font-mono-num text-[var(--fs-text)] tabular-nums">
                    {formatINR(grossIncome)}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--fs-text-body)]">
                  <span>Std Deduction + 80C/80D:</span>
                  <span className="font-semibold font-mono-num text-[var(--fs-success)] tabular-nums">
                    -{formatINR(oldRegimeTax.deductions)}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--fs-text-body)]">
                  <span>Net Taxable Income:</span>
                  <span className="font-semibold font-mono-num text-[var(--fs-text)] tabular-nums">
                    {formatINR(oldRegimeTax.taxableIncome)}
                  </span>
                </div>
                {oldRegimeTax.rebate87A > 0 && (
                  <div className="flex justify-between text-[var(--fs-success)]">
                    <span>Section 87A Rebate:</span>
                    <span className="font-semibold font-mono-num tabular-nums">
                      -{formatINR(oldRegimeTax.rebate87A)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--fs-text-body)] pt-2 border-t border-[var(--fs-border)]">
                  <span>Income Tax Before Cess:</span>
                  <span className="font-semibold font-mono-num text-[var(--fs-text)] tabular-nums">
                    {formatINR(oldRegimeTax.taxBeforeCess)}
                  </span>
                </div>
                {oldRegimeTax.surcharge > 0 && (
                  <div className="flex justify-between text-[var(--fs-warning)]">
                    <span>Income Surcharge:</span>
                    <span className="font-semibold font-mono-num tabular-nums">
                      {formatINR(oldRegimeTax.surcharge)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--fs-text-body)]">
                  <span>Health &amp; Education Cess (4%):</span>
                  <span className="font-semibold font-mono-num text-[var(--fs-text)] tabular-nums">
                    {formatINR(oldRegimeTax.cess)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[var(--fs-text)] pt-2 border-t border-[var(--fs-border)]">
                  <span>Total Estimated Tax:</span>
                  <span className="font-mono-num text-[var(--fs-accent)] tabular-nums">
                    {formatINR(oldRegimeTax.totalTax)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-5xl fs-card-secondary p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2.5 text-[var(--fs-text)]">
              <CheckCircle className="h-4 w-4 text-[var(--fs-success)] shrink-0" />
              <span>
                {isNewBetter
                  ? `New Tax Regime saves you approx ${formatINR(Math.abs(diff))} in taxes.`
                  : `Old Tax Regime saves you approx ${formatINR(Math.abs(diff))} due to your logged deductions.`}
              </span>
            </div>
            <button
              onClick={onOpenAI}
              className="font-semibold text-[var(--fs-accent)] hover:underline shrink-0"
            >
              Ask AI to Explain Slabs →
            </button>
          </div>

          {/* Tax Readiness Checklist & CBDT Deadlines */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-5xl">
            <div className="lg:col-span-7 fs-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-[var(--fs-accent)]" />
                  <h3 className="text-sm font-bold text-[var(--fs-text)]">
                    Tax Filing Readiness Checklist (FY {financialYear})
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[var(--fs-success)] font-semibold">
                  {verifiedReadinessCount} / {readinessItems.length || 6} Ready
                </span>
              </div>
              <div className="divide-y divide-[var(--fs-border)]">
                {readinessItems.map(item => (
                  <div
                    key={item.id}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-[var(--fs-text)]">{item.title}</div>
                      <span className="text-[10px] font-mono text-[var(--fs-text-muted)]">
                        {item.category}
                      </span>
                    </div>
                    <select
                      aria-label={`Status for ${item.title}`}
                      value={item.status}
                      onChange={e =>
                        handleUpdateReadinessStatus(
                          item.id,
                          e.target.value as TaxReadinessItem['status']
                        )
                      }
                      className="fs-input w-auto py-1 text-[11px]"
                    >
                      <option value="NOT_UPLOADED">Not Uploaded</option>
                      <option value="UPLOADED">Uploaded</option>
                      <option value="NEEDS_REVIEW">Needs Review</option>
                      <option value="VERIFIED_BY_USER">Verified</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 fs-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-[var(--fs-warning)]" />
                <h3 className="text-sm font-bold text-[var(--fs-text)]">CBDT Tax Calendar Reminders</h3>
              </div>
              <div className="space-y-3">
                {cbdtDeadlines.map(dl => (
                  <div
                    key={dl.title}
                    className="p-3 rounded-xl bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] space-y-0.5"
                  >
                    <div className="text-[11px] font-mono font-bold text-[var(--fs-accent)]">
                      {dl.date}
                    </div>
                    <div className="text-xs font-medium text-[var(--fs-text)]">{dl.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {calculations.length > 0 && (
            <div className="max-w-5xl fs-card p-6 space-y-3">
              <h3 className="text-sm font-bold text-[var(--fs-text)]">Saved Tax Calculation History</h3>
              <div className="divide-y divide-[var(--fs-border)] text-xs">
                {calculations.slice(0, 6).map(c => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[var(--fs-text)]">
                        FY {c.financialYear} ({c.rulesetVersion}) · Gross {formatINR(c.grossIncome)}
                      </div>
                      <div className="text-[10px] text-[var(--fs-text-muted)]">
                        Old: {formatINR(c.oldRegimeTotalTax)} vs New: {formatINR(c.newRegimeTotalTax)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[var(--fs-success)]">{c.recommendedRegime} Regime</span>
                      <div className="text-[10px] text-[var(--fs-text-body)]">
                        Saves {formatINR(c.estimatedSavings)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW 2: DEDUCTIONS & PROOFS */}
      {subview === 'deductions' && (
        <div className="space-y-6 max-w-4xl">
          <div className="fs-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--fs-text)]">
                Organized Tax Deductions ({financialYear})
              </h3>
              <button
                onClick={() => setShowDeductionModal(true)}
                className="fs-btn-primary px-3 py-1.5 text-xs"
              >
                + Add Deduction
              </button>
            </div>

            {fyDeductions.length === 0 ? (
              <EmptyStateCard
                variant="tax"
                title={`No deductions logged for FY ${financialYear}`}
                description="Add Section 80C (PPF, ELSS), Section 80D health insurance, or NPS investments to accurately compare Old vs New regimes."
                actionLabel="Add Deduction"
                onAction={() => setShowDeductionModal(true)}
              />
            ) : (
              <div className="divide-y divide-[var(--fs-border)]">
                {fyDeductions.map(d => (
                  <div key={d.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[var(--fs-text)]">{d.category}</div>
                      <div className="text-[var(--fs-text-body)]">
                        {d.description} (Cap: {formatINR(d.applicableLimit)})
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold font-mono-num text-[var(--fs-success)] tabular-nums">
                          {formatINR(d.claimedAmount)}
                        </div>
                        <div className="text-[10px] text-[var(--fs-text-muted)]">{d.verificationStatus}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteDeduction(d.id)}
                        aria-label={`Delete ${d.category}`}
                        className="p-1 text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW 3: DOCUMENTS */}
      {subview === 'documents' && (
        <div className="space-y-6 max-w-4xl">
          <div className="fs-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--fs-text)]">Private Tax Document Vault</h3>
              <select
                aria-label="Document Category"
                value={docCategory}
                onChange={e => setDocCategory(e.target.value as TaxDocument['category'])}
                className="fs-input w-auto py-1.5"
              >
                <option value="Form 16">Form 16</option>
                <option value="Salary Slips">Salary Slips</option>
                <option value="Investment Proofs">Investment Proofs (80C/80D)</option>
                <option value="Interest Certificates">Interest Certificates</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="p-8 border-2 border-dashed border-[var(--fs-border)] bg-[var(--fs-surface-secondary)] rounded-xl text-center space-y-3">
              <FileText className="h-8 w-8 mx-auto text-[var(--fs-accent)]" />
              <div className="text-xs font-semibold text-[var(--fs-text)]">
                Upload Form 16, Rent Receipts &amp; Investment Proofs
              </div>
              <p className="text-[11px] text-[var(--fs-text-muted)]">
                Accepted: PDF, PNG, JPG (Max 10MB). Owner-isolated vault storage.
              </p>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                id="tax-doc-upload"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleUploadTaxDocument(file);
                  }
                  e.target.value = '';
                }}
              />
              <label
                htmlFor="tax-doc-upload"
                className="fs-btn-primary inline-flex items-center gap-2 cursor-pointer px-4 py-2 text-xs"
              >
                {isUploadingDoc && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isUploadingDoc ? 'Uploading to Vault...' : 'Upload Tax Document'}</span>
              </label>

              {docUploadStatus && (
                <div className="mt-4 p-3 rounded-xl bg-[var(--fs-success)]/10 border border-[var(--fs-success)]/30 text-xs text-[var(--fs-success)] flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{docUploadStatus}</span>
                </div>
              )}
            </div>

            {/* Stored Documents List */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-[var(--fs-text)]">
                Stored Tax Documents ({documents.length})
              </h4>
              {documents.length === 0 ? (
                <p className="text-xs text-[var(--fs-text-muted)]">
                  No documents uploaded to your tax vault yet.
                </p>
              ) : (
                <div className="divide-y divide-[var(--fs-border)]">
                  {documents.map(doc => (
                    <div key={doc.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-[var(--fs-text)]">{doc.name}</div>
                        <div className="text-[10px] text-[var(--fs-text-muted)]">
                          {doc.category} · FY {doc.financialYear} · {doc.fileSize} ·{' '}
                          {doc.uploadedAt.split('T')[0]}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownloadTaxDocument(doc)}
                          className="fs-btn-secondary inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download</span>
                        </button>
                        <button
                          onClick={() => handleDeleteTaxDocument(doc.id)}
                          aria-label={`Delete ${doc.name}`}
                          className="p-1 text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 4: SUMMARY */}
      {subview === 'summary' && (
        <div className="space-y-6 max-w-3xl">
          <div className="fs-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--fs-text)]">
              Tax Position Summary (FY {financialYear})
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[var(--fs-border)]">
                <span className="text-[var(--fs-text-body)]">Applicable Ruleset:</span>
                <span className="font-mono text-[var(--fs-text)]">{newRegimeTax.rulesetVersion}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--fs-border)]">
                <span className="text-[var(--fs-text-body)]">Total Gross Income:</span>
                <span className="font-semibold font-mono-num text-[var(--fs-text)] tabular-nums">
                  {formatINR(grossIncome)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--fs-border)]">
                <span className="text-[var(--fs-text-body)]">Recommended Regime:</span>
                <span className="font-bold text-[var(--fs-success)]">
                  {isNewBetter ? 'New Regime (Sec 115BAC)' : 'Old Regime'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--fs-border)]">
                <span className="text-[var(--fs-text-body)]">Estimated Tax Liability:</span>
                <span className="font-bold font-mono-num text-[var(--fs-accent)] tabular-nums">
                  {formatINR(isNewBetter ? newRegimeTax.totalTax : oldRegimeTax.totalTax)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--fs-border)]">
                <span className="text-[var(--fs-text-body)]">Effective Tax Rate:</span>
                <span className="font-semibold font-mono-num text-[var(--fs-text)]">
                  {isNewBetter ? newRegimeTax.effectiveRate : oldRegimeTax.effectiveRate}%
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[var(--fs-border)]">
                <span className="text-[var(--fs-text-body)]">Readiness Checklist Progress:</span>
                <span className="font-semibold font-mono-num text-[var(--fs-text)]">
                  {verifiedReadinessCount} / {readinessItems.length || 6} items completed
                </span>
              </div>
            </div>
            <button onClick={() => window.print()} className="fs-btn-secondary px-4 py-2 text-xs">
              Export Summary / Print
            </button>
          </div>
        </div>
      )}

      {/* Add Deduction Modal */}
      {showDeductionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md fs-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--fs-text)]">
              Add Tax Deduction (FY {financialYear})
            </h3>
            <form onSubmit={handleAddDeduction} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Deduction Section
                </label>
                <select
                  value={newCat}
                  onChange={e => setNewCat(e.target.value as TaxDeduction['category'])}
                  className="fs-input"
                >
                  <option value="Section 80C">Section 80C (PPF, ELSS, EPF - Up to ₹1.5L)</option>
                  <option value="Section 80D">Section 80D (Health Insurance)</option>
                  <option value="Section 80CCD (NPS)">Section 80CCD(1B) (NPS Extra ₹50,000)</option>
                  <option value="Section 24(b) Home Loan">Section 24(b) (Home Loan Interest up to ₹2L)</option>
                  <option value="Section 80E">Section 80E (Education Loan Interest)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="e.g. PPF Account Deposit"
                  className="fs-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Claimed Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={newClaim}
                  onChange={e => setNewClaim(e.target.value)}
                  placeholder="50000"
                  className="fs-input font-mono-num"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--fs-border)]">
                <button
                  type="button"
                  onClick={() => setShowDeductionModal(false)}
                  className="fs-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="fs-btn-primary px-4 py-2 text-xs">
                  Save Deduction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="fs-card-secondary p-4 text-xs text-[var(--fs-text-muted)] flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-[var(--fs-accent)] shrink-0" />
        <p>
          Tax calculations are indicative and must be verified against applicable official Indian Income Tax rules and professional chartered accountant advice.
        </p>
      </div>
    </div>
  );
};
