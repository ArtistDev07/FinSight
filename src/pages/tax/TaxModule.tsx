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
} from 'lucide-react';
import { TaxCalculationRecord, TaxDeduction, TaxDocument } from '../../types';
import { calculateIndianTax, formatINR } from '../../utils/financialMath';
import { apiFetch } from '../../utils/api';

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
      const [profRes, dedRes, calcRes, docRes] = await Promise.all([
        apiFetch('/api/v1/tax/profile'),
        apiFetch('/api/v1/tax/deductions'),
        apiFetch('/api/v1/tax/calculations'),
        apiFetch('/api/v1/tax/documents'),
      ]);
      const [profJson, dedJson, calcJson, docJson] = await Promise.all([
        profRes.json(),
        dedRes.json(),
        calcRes.json(),
        docRes.json(),
      ]);
      if (profJson.success && profJson.data) {
        if (profJson.data.financialYear === '2024-25' || profJson.data.financialYear === '2025-26') {
          setFinancialYear(profJson.data.financialYear);
        }
        if (profJson.data.annualSalary > 0 || profJson.data.otherIncome > 0) {
          setAnnualSalary(String(profJson.data.annualSalary));
          setOtherIncome(String(profJson.data.otherIncome));
        }
      }
      if (dedJson.success) setDeductions(dedJson.data || []);
      if (calcJson.success) setCalculations(calcJson.data || []);
      if (docJson.success) setDocuments(docJson.data || []);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Unable to load tax workspace.');
    }
  }, []);

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
      setDocUploadStatus(`Document "${json.data.name}" (${json.data.fileSize}) stored securely in your private tax vault.`);
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

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#28443C] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7F5] tracking-tight">
            Tax Helper (India FY {financialYear})
          </h1>
          <p className="text-xs text-[#A7C1B8] mt-1">
            Compare Old vs New Tax Regimes ({newRegimeTax.rulesetVersion}), organize Chapter VI-A deductions, and store Form 16 proofs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={financialYear}
            onChange={e => setFinancialYear(e.target.value as '2025-26' | '2024-25')}
            className="rounded-lg bg-[#102722] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
          >
            <option value="2025-26">FY 2025-26 (AY 2026-27)</option>
            <option value="2024-25">FY 2024-25 (AY 2025-26)</option>
          </select>
          <button
            onClick={() => setShowDeductionModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#A8E6CE] px-3.5 py-2 text-xs font-semibold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Deduction</span>
          </button>
        </div>
      </div>

      {statusError && (
        <div className="p-3.5 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      {saveMessage && (
        <div className="p-3.5 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/40 text-xs text-[#55C99A] flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#28443C] pb-2 overflow-x-auto whitespace-nowrap">
        {[
          { label: 'Overview', path: '/app/tax', key: 'overview' },
          { label: 'Old vs New Regime', path: '/app/tax/compare', key: 'compare' },
          { label: 'Tax Calculator', path: '/app/tax/calculator', key: 'calculator' },
          { label: `Deductions & Proofs (${fyDeductions.length})`, path: '/app/tax/deductions', key: 'deductions' },
          { label: `Tax Documents (${documents.length})`, path: '/app/tax/documents', key: 'documents' },
          { label: 'Tax Summary', path: '/app/tax/summary', key: 'summary' },
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

      {/* SUBVIEW 1: OVERVIEW, COMPARE & CALCULATOR */}
      {(subview === 'overview' || subview === 'compare' || subview === 'calculator') && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Annual Income & Eligible Deductions ({financialYear})</h3>
              <button
                onClick={handleSaveProfileAndCalc}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#16352E] border border-[#28443C] px-3 py-1.5 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0]"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Calculation Snapshot</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Gross Annual Salary (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={annualSalary}
                  onChange={e => setAnnualSalary(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Other Income (Interest / Freelance) (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={otherIncome}
                  onChange={e => setOtherIncome(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Eligible Chapter VI-A Deductions (₹)</label>
                <input
                  type="number"
                  disabled
                  value={totalDeductionsClaimed}
                  className="w-full rounded-xl bg-[#0B1C19]/60 border border-[#28443C] px-3 py-2 text-xs text-[#718D83]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
            {/* New Regime Card */}
            <div className={`rounded-2xl border p-6 space-y-4 ${
              isNewBetter ? 'border-[#55C99A] bg-[#102722]' : 'border-[#28443C] bg-[#102722]/60'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-[#F5F7F5]">New Tax Regime (Section 115BAC)</h4>
                  <span className="text-xs text-[#718D83]">Default Regime · Salaried Std Deduction ₹75,000</span>
                </div>
                {isNewBetter && (
                  <span className="rounded-full bg-[#55C99A]/20 border border-[#55C99A] px-2.5 py-0.5 text-[10px] font-bold text-[#55C99A]">
                    Recommended Lower Tax
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs pt-2">
                <div className="flex justify-between text-[#A7C1B8]">
                  <span>Gross Total Income:</span>
                  <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(grossIncome)}</span>
                </div>
                <div className="flex justify-between text-[#A7C1B8]">
                  <span>Standard Deduction:</span>
                  <span className="font-semibold text-[#55C99A] tabular-nums">-{formatINR(newRegimeTax.standardDeduction)}</span>
                </div>
                <div className="flex justify-between text-[#A7C1B8]">
                  <span>Net Taxable Income:</span>
                  <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(newRegimeTax.taxableIncome)}</span>
                </div>
                {newRegimeTax.rebate87A > 0 && (
                  <div className="flex justify-between text-[#55C99A]">
                    <span>Section 87A Rebate:</span>
                    <span className="font-semibold tabular-nums">-{formatINR(newRegimeTax.rebate87A)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#A7C1B8] pt-2 border-t border-[#28443C]">
                  <span>Income Tax Before Cess:</span>
                  <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(newRegimeTax.taxBeforeCess)}</span>
                </div>
                {newRegimeTax.surcharge > 0 && (
                  <div className="flex justify-between text-[#E5B764]">
                    <span>Income Surcharge:</span>
                    <span className="font-semibold tabular-nums">{formatINR(newRegimeTax.surcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#A7C1B8]">
                  <span>Health & Education Cess (4%):</span>
                  <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(newRegimeTax.cess)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#F5F7F5] pt-2 border-t border-[#28443C]">
                  <span>Total Estimated Tax:</span>
                  <span className="text-[#A8E6CE] tabular-nums">{formatINR(newRegimeTax.totalTax)}</span>
                </div>
              </div>
            </div>

            {/* Old Regime Card */}
            <div className={`rounded-2xl border p-6 space-y-4 ${
              !isNewBetter ? 'border-[#55C99A] bg-[#102722]' : 'border-[#28443C] bg-[#102722]/60'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-[#F5F7F5]">Old Tax Regime</h4>
                  <span className="text-xs text-[#718D83]">Std Deduction ₹50,000 + 80C/80D Exemptions</span>
                </div>
                {!isNewBetter && (
                  <span className="rounded-full bg-[#55C99A]/20 border border-[#55C99A] px-2.5 py-0.5 text-[10px] font-bold text-[#55C99A]">
                    Recommended Lower Tax
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs pt-2">
                <div className="flex justify-between text-[#A7C1B8]">
                  <span>Gross Total Income:</span>
                  <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(grossIncome)}</span>
                </div>
                <div className="flex justify-between text-[#A7C1B8]">
                  <span>Std Deduction + 80C/80D:</span>
                  <span className="font-semibold text-[#55C99A] tabular-nums">-{formatINR(oldRegimeTax.deductions)}</span>
                </div>
                <div className="flex justify-between text-[#A7C1B8]">
                  <span>Net Taxable Income:</span>
                  <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(oldRegimeTax.taxableIncome)}</span>
                </div>
                {oldRegimeTax.rebate87A > 0 && (
                  <div className="flex justify-between text-[#55C99A]">
                    <span>Section 87A Rebate:</span>
                    <span className="font-semibold tabular-nums">-{formatINR(oldRegimeTax.rebate87A)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#A7C1B8] pt-2 border-t border-[#28443C]">
                  <span>Income Tax Before Cess:</span>
                  <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(oldRegimeTax.taxBeforeCess)}</span>
                </div>
                {oldRegimeTax.surcharge > 0 && (
                  <div className="flex justify-between text-[#E5B764]">
                    <span>Income Surcharge:</span>
                    <span className="font-semibold tabular-nums">{formatINR(oldRegimeTax.surcharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#A7C1B8]">
                  <span>Health & Education Cess (4%):</span>
                  <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(oldRegimeTax.cess)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#F5F7F5] pt-2 border-t border-[#28443C]">
                  <span>Total Estimated Tax:</span>
                  <span className="text-[#A8E6CE] tabular-nums">{formatINR(oldRegimeTax.totalTax)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-4xl p-4 rounded-xl border border-[#28443C] bg-[#16352E] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 text-[#F5F7F5]">
              <CheckCircle className="h-4 w-4 text-[#55C99A] shrink-0" />
              <span>
                {isNewBetter
                  ? `New Tax Regime saves you approx ${formatINR(Math.abs(diff))} in taxes.`
                  : `Old Tax Regime saves you approx ${formatINR(Math.abs(diff))} due to your logged deductions.`}
              </span>
            </div>
            <button
              onClick={onOpenAI}
              className="font-semibold text-[#A8E6CE] hover:underline shrink-0 ml-4"
            >
              Ask AI to Explain Slabs →
            </button>
          </div>

          {calculations.length > 0 && (
            <div className="max-w-4xl rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-3">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Saved Tax Calculation History</h3>
              <div className="divide-y divide-[#28443C]/40 text-xs">
                {calculations.slice(0, 6).map(c => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#F5F7F5]">
                        FY {c.financialYear} ({c.rulesetVersion}) · Gross {formatINR(c.grossIncome)}
                      </div>
                      <div className="text-[10px] text-[#718D83]">
                        Old: {formatINR(c.oldRegimeTotalTax)} vs New: {formatINR(c.newRegimeTotalTax)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#55C99A]">{c.recommendedRegime} Regime</span>
                      <div className="text-[10px] text-[#A7C1B8]">Saves {formatINR(c.estimatedSavings)}</div>
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
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Organized Tax Deductions ({financialYear})</h3>
              <button
                onClick={() => setShowDeductionModal(true)}
                className="rounded-lg bg-[#A8E6CE] px-3 py-1.5 text-xs font-bold text-[#0B1C19]"
              >
                + Add Deduction
              </button>
            </div>

            {fyDeductions.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#0B1C19] border border-[#28443C] text-center text-xs text-[#718D83]">
                No deductions logged for FY {financialYear}. Add Section 80C, 80D, or NPS investments to compare regimes accurately.
              </div>
            ) : (
              <div className="divide-y divide-[#28443C]/50">
                {fyDeductions.map(d => (
                  <div key={d.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#F5F7F5]">{d.category}</div>
                      <div className="text-[#A7C1B8]">{d.description} (Cap: {formatINR(d.applicableLimit)})</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-[#55C99A] tabular-nums">{formatINR(d.claimedAmount)}</div>
                        <div className="text-[10px] text-[#718D83]">{d.verificationStatus}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteDeduction(d.id)}
                        className="p-1 text-[#718D83] hover:text-[#EB7676]"
                        title="Delete Deduction"
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
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Private Tax Document Vault</h3>
              <select
                value={docCategory}
                onChange={e => setDocCategory(e.target.value as TaxDocument['category'])}
                className="rounded-lg bg-[#0B1C19] border border-[#28443C] px-3 py-1.5 text-xs text-[#F5F7F5]"
              >
                <option value="Form 16">Form 16</option>
                <option value="Salary Slips">Salary Slips</option>
                <option value="Investment Proofs">Investment Proofs (80C/80D)</option>
                <option value="Interest Certificates">Interest Certificates</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="p-8 border-2 border-dashed border-[#28443C] rounded-xl text-center space-y-3">
              <FileText className="h-8 w-8 mx-auto text-[#718D83]" />
              <div className="text-xs font-semibold text-[#F5F7F5]">Upload Form 16, Rent Receipts & Investment Proofs</div>
              <p className="text-[11px] text-[#718D83]">Accepted: PDF, PNG, JPG (Max 10MB). Owner-isolated vault storage.</p>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                id="tax-doc-upload"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleUploadTaxDocument(file);
                  }
                  e.target.value = '';
                }}
              />
              <label
                htmlFor="tax-doc-upload"
                className="inline-flex items-center gap-2 cursor-pointer rounded-lg bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
              >
                {isUploadingDoc && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isUploadingDoc ? 'Uploading to Vault...' : 'Upload Tax Document'}</span>
              </label>

              {docUploadStatus && (
                <div className="mt-4 p-3 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/40 text-xs text-[#55C99A] flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{docUploadStatus}</span>
                </div>
              )}
            </div>

            {/* Stored Documents List */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-[#F5F7F5]">Stored Tax Documents ({documents.length})</h4>
              {documents.length === 0 ? (
                <p className="text-xs text-[#718D83]">No documents uploaded to your tax vault yet.</p>
              ) : (
                <div className="divide-y divide-[#28443C]/40">
                  {documents.map(doc => (
                    <div key={doc.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-[#F5F7F5]">{doc.name}</div>
                        <div className="text-[10px] text-[#718D83]">
                          {doc.category} · FY {doc.financialYear} · {doc.fileSize} · {doc.uploadedAt.split('T')[0]}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownloadTaxDocument(doc)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#16352E] border border-[#28443C] px-2.5 py-1 text-[11px] text-[#A8E6CE] hover:border-[#72C8B0]"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download</span>
                        </button>
                        <button
                          onClick={() => handleDeleteTaxDocument(doc.id)}
                          className="p-1 text-[#718D83] hover:text-[#EB7676]"
                          title="Delete Document"
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
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#F5F7F5]">Tax Position Summary (FY {financialYear})</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#28443C]">
                <span className="text-[#A7C1B8]">Applicable Ruleset:</span>
                <span className="font-mono text-[#F5F7F5]">{newRegimeTax.rulesetVersion}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#28443C]">
                <span className="text-[#A7C1B8]">Total Gross Income:</span>
                <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(grossIncome)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#28443C]">
                <span className="text-[#A7C1B8]">Recommended Regime:</span>
                <span className="font-bold text-[#55C99A]">{isNewBetter ? 'New Regime (Sec 115BAC)' : 'Old Regime'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#28443C]">
                <span className="text-[#A7C1B8]">Estimated Tax Liability:</span>
                <span className="font-bold text-[#A8E6CE] tabular-nums">
                  {formatINR(isNewBetter ? newRegimeTax.totalTax : oldRegimeTax.totalTax)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#28443C]">
                <span className="text-[#A7C1B8]">Effective Tax Rate:</span>
                <span className="font-semibold text-[#F5F7F5]">{isNewBetter ? newRegimeTax.effectiveRate : oldRegimeTax.effectiveRate}%</span>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="rounded-xl border border-[#28443C] bg-[#16352E] px-4 py-2 text-xs font-semibold text-[#A8E6CE]"
            >
              Export Summary / Print
            </button>
          </div>
        </div>
      )}

      {/* Add Deduction Modal */}
      {showDeductionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F7F5]">Add Tax Deduction (FY {financialYear})</h3>
            <form onSubmit={handleAddDeduction} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Deduction Section</label>
                <select
                  value={newCat}
                  onChange={e => setNewCat(e.target.value as TaxDeduction['category'])}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                >
                  <option value="Section 80C">Section 80C (PPF, ELSS, EPF - Up to ₹1.5L)</option>
                  <option value="Section 80D">Section 80D (Health Insurance)</option>
                  <option value="Section 80CCD (NPS)">Section 80CCD(1B) (NPS Extra ₹50,000)</option>
                  <option value="Section 24(b) Home Loan">Section 24(b) (Home Loan Interest up to ₹2L)</option>
                  <option value="Section 80E">Section 80E (Education Loan Interest)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Description</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="e.g. PPF Account Deposit"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Claimed Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={newClaim}
                  onChange={e => setNewClaim(e.target.value)}
                  placeholder="50000"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#28443C]">
                <button
                  type="button"
                  onClick={() => setShowDeductionModal(false)}
                  className="rounded-xl border border-[#28443C] px-4 py-2 text-xs text-[#718D83]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
                >
                  Save Deduction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#28443C] bg-[#16352E]/30 p-4 text-xs text-[#718D83] flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-[#A8E6CE] shrink-0" />
        <p>
          Tax calculations are indicative and must be verified against applicable official Indian Income Tax rules and professional chartered accountant advice.
        </p>
      </div>
    </div>
  );
};
