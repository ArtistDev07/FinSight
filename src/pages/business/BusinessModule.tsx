import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  CheckCircle,
  FileText,
  Printer,
  Download,
  X,
  Trash2,
  AlertCircle,
  Upload,
  CreditCard,
  Settings,
  Clock,
  CheckSquare,
  ArrowRight,
} from 'lucide-react';
import {
  Invoice,
  InvoiceItem,
  BusinessExpense,
  EMIPlan,
  Client,
  BusinessProfile,
  CashFlowForecast,
} from '../../types';
import {
  formatINR,
  calculateEMI,
  calculateInvoiceTotals,
  validateGSTIN,
} from '../../utils/financialMath';
import { apiFetch } from '../../utils/api';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';

interface BusinessModuleProps {
  subview: 'overview' | 'invoices' | 'new-invoice' | 'clients' | 'expenses' | 'cash-flow' | 'emi-planner';
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

const PLACE_OF_SUPPLY_OPTIONS = [
  { label: '29 - Karnataka (Intrastate)', value: '29 - Karnataka (Intrastate)' },
  { label: '27 - Maharashtra (Interstate)', value: '27 - Maharashtra (Interstate)' },
  { label: '07 - Delhi (Interstate)', value: '07 - Delhi (Interstate)' },
  { label: '33 - Tamil Nadu (Interstate)', value: '33 - Tamil Nadu (Interstate)' },
  { label: '36 - Telangana (Interstate)', value: '36 - Telangana (Interstate)' },
];

const GST_SLABS = [0, 5, 12, 18, 28];

export const BusinessModule: React.FC<BusinessModuleProps> = ({
  subview,
  onNavigate,
  onOpenAI,
}) => {
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowForecast | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [emiPlans, setEmiPlans] = useState<EMIPlan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Invoice PDF View & Payment states
  const [selectedInvoiceForPdf, setSelectedInvoiceForPdf] = useState<Invoice | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [isDownloadingPdfId, setIsDownloadingPdfId] = useState<string | null>(null);

  // Business Profile Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileGstin, setProfileGstin] = useState('');
  const [profileStateCode, setProfileStateCode] = useState('29');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileOpeningCash, setProfileOpeningCash] = useState('0');

  // Client Modal
  const [showClientModal, setShowClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientGstin, setNewClientGstin] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');

  // Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expName, setExpName] = useState('');
  const [expCategory, setExpCategory] = useState<BusinessExpense['category']>('Software');
  const [expAmount, setExpAmount] = useState('');
  const [expVendor, setExpVendor] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expMethod, setExpMethod] = useState('Corporate Account');
  const [expNotes, setExpNotes] = useState('');
  const [expReceipt, setExpReceipt] = useState<{ fileName: string; mimeType: string; fileBase64: string } | null>(null);

  // New Invoice Form state
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientGstin, setClientGstin] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('29 - Karnataka (Intrastate)');
  const [invoiceDueDate, setInvoiceDueDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [lineItems, setLineItems] = useState<Array<{ id: string; description: string; quantity: string; unitPrice: string; taxRate: number }>>([
    { id: 'li-1', description: 'Financial Advisory & Architecture Retainer', quantity: '1', unitPrice: '50000', taxRate: 18 },
  ]);
  const [invoiceSuccess, setInvoiceSuccess] = useState(false);

  // EMI Planner state
  const [loanAmount, setLoanAmount] = useState('1000000');
  const [interestRate, setInterestRate] = useState('8.5');
  const [tenureMonths, setTenureMonths] = useState('60');
  const [emiPlanName, setEmiPlanName] = useState('Commercial Working Capital Loan');

  const notifySuccess = (msg: string) => {
    setActionError(null);
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const refreshCashFlow = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/business/cash-flow');
      const json = await res.json();
      if (res.ok && json.success) setCashFlow(json.data);
    } catch {
      // ignore transient refresh failure
    }
  }, []);

  const loadAllBusinessData = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const [bizRes, invRes, expRes, emiRes, cliRes, cfRes] = await Promise.all([
        apiFetch('/api/v1/business'),
        apiFetch('/api/v1/business/invoices'),
        apiFetch('/api/v1/business/expenses'),
        apiFetch('/api/v1/business/emi'),
        apiFetch('/api/v1/business/clients'),
        apiFetch('/api/v1/business/cash-flow'),
      ]);

      const [bizJson, invJson, expJson, emiJson, cliJson, cfJson] = await Promise.all([
        bizRes.json(),
        invRes.json(),
        expRes.json(),
        emiRes.json(),
        cliRes.json(),
        cfRes.json(),
      ]);

      if (bizRes.ok && bizJson.success && bizJson.data?.profile) {
        const bp = bizJson.data.profile as BusinessProfile;
        setBusinessProfile(bp);
        setProfileName(bp.businessName);
        setProfileGstin(bp.gstin || '');
        setProfileStateCode(bp.stateCode || '29');
        setProfileAddress(bp.address || '');
        setProfileOpeningCash(String(bp.openingCashBalance ?? 0));
      }
      if (invRes.ok && invJson.success) setInvoices(invJson.data || []);
      if (expRes.ok && expJson.success) setExpenses(expJson.data || []);
      if (emiRes.ok && emiJson.success) setEmiPlans(emiJson.data || []);
      if (cliRes.ok && cliJson.success) setClients(cliJson.data || []);
      if (cfRes.ok && cfJson.success) setCashFlow(cfJson.data || null);
    } catch {
      setActionError('Unable to load business finance records. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllBusinessData();
  }, [loadAllBusinessData]);

  const handleSelectClientForInvoice = (cid: string) => {
    setSelectedClientId(cid);
    const found = clients.find(c => c.id === cid);
    if (found) {
      setClientName(found.companyName);
      setClientGstin(found.gstin || '');
    }
  };

  const handleSaveBusinessProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (profileGstin.trim() && !validateGSTIN(profileGstin)) {
      setActionError('Invalid GSTIN format. Expected 15 characters (e.g. 29AAACF9876K1ZP).');
      return;
    }
    const res = await apiFetch('/api/v1/business/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: profileName,
        gstin: profileGstin.trim().toUpperCase(),
        stateCode: profileStateCode,
        address: profileAddress,
        openingCashBalance: parseFloat(profileOpeningCash) || 0,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setActionError(json?.error?.message || 'Unable to update business profile.');
      return;
    }
    setBusinessProfile(json.data);
    setShowProfileModal(false);
    await refreshCashFlow();
    notifySuccess('Business profile and opening balance updated.');
  };

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!clientName.trim()) {
      setActionError('Client name is required.');
      return;
    }
    if (clientGstin.trim() && !validateGSTIN(clientGstin)) {
      setActionError('Invalid Client GSTIN format (expected 15 alphanumeric characters).');
      return;
    }

    const preparedItems: InvoiceItem[] = lineItems.map((li, idx) => {
      const qty = Math.max(0.01, parseFloat(li.quantity) || 1);
      const price = Math.max(0, parseFloat(li.unitPrice) || 0);
      return {
        id: li.id || `li-${idx + 1}`,
        description: li.description.trim() || 'Service',
        quantity: qty,
        unitPrice: price,
        taxRate: li.taxRate,
        lineTotal: Math.round(qty * price * 100) / 100,
      };
    });

    const res = await apiFetch('/api/v1/business/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: selectedClientId || undefined,
        clientName: clientName.trim(),
        clientGstin: clientGstin.trim() ? clientGstin.trim().toUpperCase() : undefined,
        placeOfSupply,
        dueDate: invoiceDueDate,
        notes: invoiceNotes.trim() || undefined,
        lineItems: preparedItems,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setActionError(json?.error?.message || 'Failed to generate GST invoice.');
      return;
    }
    setInvoices(prev => [json.data, ...prev]);
    setInvoiceSuccess(true);
    await refreshCashFlow();
    setTimeout(() => {
      setInvoiceSuccess(false);
      onNavigate('/app/business/invoices');
    }, 1000);
  };

  const handleRecordPayment = async (invId: string, amount: number) => {
    setActionError(null);
    const res = await apiFetch(`/api/v1/business/invoices/${invId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setActionError(json?.error?.message || 'Unable to record invoice payment.');
      return;
    }
    setInvoices(prev => prev.map(inv => (inv.id === invId ? json.data : inv)));
    setPaymentModalInvoice(null);
    await refreshCashFlow();
    notifySuccess('Invoice payment recorded.');
  };

  const handleDeleteInvoice = async (invId: string) => {
    setActionError(null);
    const res = await apiFetch(`/api/v1/business/invoices/${invId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setActionError(json?.error?.message || 'Unable to delete invoice.');
      return;
    }
    setInvoices(prev => prev.filter(inv => inv.id !== invId));
    await refreshCashFlow();
    notifySuccess('Invoice deleted.');
  };

  const handleDownloadInvoicePdf = async (inv: Invoice) => {
    setActionError(null);
    setIsDownloadingPdfId(inv.id);
    try {
      const res = await apiFetch(`/api/v1/business/invoices/${inv.id}/pdf`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `PDF download failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to download invoice PDF.');
    } finally {
      setIsDownloadingPdfId(null);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    if (!newCompanyName.trim()) {
      setActionError('Company name is required.');
      return;
    }
    if (newClientGstin.trim() && !validateGSTIN(newClientGstin)) {
      setActionError('Invalid GSTIN format. Must be 15 characters (e.g. 29AABCC1234D1Z5).');
      return;
    }

    const res = await apiFetch('/api/v1/business/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: newClientName || newCompanyName,
        companyName: newCompanyName,
        email: newClientEmail,
        phone: newClientPhone,
        gstin: newClientGstin.trim() ? newClientGstin.trim().toUpperCase() : undefined,
        billingAddress: newClientAddress,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setActionError(json?.error?.message || 'Failed to add client.');
      return;
    }
    setClients(prev => [...prev, json.data]);
    setShowClientModal(false);
    setNewClientName('');
    setNewCompanyName('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewClientGstin('');
    setNewClientAddress('');
    notifySuccess('Corporate client added.');
  };

  const handleDeleteClient = async (id: string) => {
    setActionError(null);
    const res = await apiFetch(`/api/v1/business/clients/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setClients(prev => prev.filter(c => c.id !== id));
      notifySuccess('Client removed.');
    }
  };

  const handleReceiptFileChange = (file: File | undefined) => {
    if (!file) {
      setExpReceipt(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setExpReceipt({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileBase64: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const amt = parseFloat(expAmount);
    if (!expName.trim() || !Number.isFinite(amt) || amt <= 0) {
      setActionError('Expense name and a positive amount are required.');
      return;
    }
    const res = await apiFetch('/api/v1/business/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: expName.trim(),
        category: expCategory,
        amount: amt,
        vendor: expVendor.trim() || 'Direct Vendor',
        expenseDate: expDate,
        paymentMethod: expMethod,
        notes: expNotes.trim() || undefined,
        receiptFile: expReceipt || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setActionError(json?.error?.message || 'Unable to log business expense.');
      return;
    }
    setExpenses(prev => [json.data, ...prev]);
    setShowExpenseModal(false);
    setExpName('');
    setExpAmount('');
    setExpVendor('');
    setExpNotes('');
    setExpReceipt(null);
    await refreshCashFlow();
    notifySuccess('Business expense logged.');
  };

  const handleDownloadReceipt = async (exp: BusinessExpense) => {
    setActionError(null);
    try {
      const res = await apiFetch(`/api/v1/business/expenses/${exp.id}/receipt`);
      if (!res.ok) throw new Error('Receipt file unavailable.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exp.receiptName || `receipt-${exp.id}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to download receipt.');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    setActionError(null);
    const res = await apiFetch(`/api/v1/business/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      await refreshCashFlow();
      notifySuccess('Business expense deleted.');
    }
  };

  // Live EMI calculation
  const calculatedEMI = calculateEMI(
    parseFloat(loanAmount) || 0,
    parseFloat(interestRate) || 0,
    parseInt(tenureMonths, 10) || 1
  );

  const handleSaveEMIPlan = async () => {
    setActionError(null);
    const res = await apiFetch('/api/v1/business/emi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planName: emiPlanName,
        loanAmount: parseFloat(loanAmount),
        annualInterestRate: parseFloat(interestRate),
        tenureMonths: parseInt(tenureMonths, 10),
        monthlyEMI: calculatedEMI.monthlyEMI,
        totalInterest: calculatedEMI.totalInterest,
        totalPayment: calculatedEMI.totalPayment,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setActionError(json?.error?.message || 'Unable to save EMI plan.');
      return;
    }
    setEmiPlans(prev => [...prev, json.data]);
    await refreshCashFlow();
    notifySuccess('Loan scenario saved.');
  };

  const handleDeleteEMIPlan = async (id: string) => {
    const res = await apiFetch(`/api/v1/business/emi/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setEmiPlans(prev => prev.filter(p => p.id !== id));
      await refreshCashFlow();
      notifySuccess('EMI plan removed.');
    }
  };

  // Business revenue and expenses aggregates
  const totalBilled = invoices.reduce((s, i) => s + i.total, 0);
  const totalReceived = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.balanceDue, 0);
  const totalBizExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const sellerPrefix = (businessProfile?.stateCode || '29').slice(0, 2);
  const supplyPrefix = placeOfSupply.slice(0, 2);
  const isInterStatePreview = /^\d{2}$/.test(supplyPrefix) ? supplyPrefix !== sellerPrefix : !placeOfSupply.includes('Karnataka');
  const invoicePreviewTotals = calculateInvoiceTotals(
    lineItems.map(li => ({
      quantity: parseFloat(li.quantity) || 0,
      unitPrice: parseFloat(li.unitPrice) || 0,
      taxRate: li.taxRate,
    })),
    isInterStatePreview
  );

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--fs-border)] pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] tracking-tight">
            Small Business Finance
          </h1>
          <p className="text-xs text-[var(--fs-text-body)] mt-1">
            {businessProfile?.businessName || 'Your Business'} · GST compliant invoicing, expenses, receivables aging, ledger reconciliation, and EMI planner.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="fs-btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Business Profile</span>
          </button>
          <button
            type="button"
            onClick={onOpenAI}
            className="fs-btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs text-[var(--fs-accent)]"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Ask Business AI</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/app/business/invoices/new')}
            className="fs-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Banners */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/40 text-xs text-[var(--fs-danger)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-[var(--fs-danger)] hover:opacity-80" aria-label="Dismiss error">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-[var(--fs-success)]/10 border border-[var(--fs-success)]/40 text-xs text-[var(--fs-success)] flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs including FinSight 2.0 Receivables & Reconciliation links */}
      <div className="flex items-center gap-2 border-b border-[var(--fs-border)] pb-2 overflow-x-auto whitespace-nowrap">
        {[
          { label: 'Overview', path: '/app/business', key: 'overview' },
          { label: 'Invoices', path: '/app/business/invoices', key: 'invoices' },
          { label: 'Create Invoice', path: '/app/business/invoices/new', key: 'new-invoice' },
          { label: 'Receivables & Follow-ups', path: '/app/business/receivables', key: 'receivables' },
          { label: 'Ledger Reconciliation', path: '/app/business/reconciliation', key: 'reconciliation' },
          { label: 'Clients', path: '/app/business/clients', key: 'clients' },
          { label: 'Business Expenses', path: '/app/business/expenses', key: 'expenses' },
          { label: 'Cash Flow Forecast', path: '/app/business/cash-flow', key: 'cash-flow' },
          { label: 'Loan & EMI Planner', path: '/app/business/emi-planner', key: 'emi-planner' },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onNavigate(tab.path)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              subview === tab.key
                ? 'bg-[var(--fs-brand)] text-white dark:bg-[#168366]'
                : 'text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-2)] hover:text-[var(--fs-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="fs-card p-6 text-xs text-[var(--fs-text-body)]">
          Loading business ledger, GST invoices, and cash flow projections...
        </div>
      )}

      {/* SUBVIEW 1: OVERVIEW */}
      {!isLoading && subview === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Total Billed (Invoices)</span>
              <div className="font-mono-num text-2xl font-bold text-[var(--fs-text)] tabular-nums">{formatINR(totalBilled)}</div>
              <span className="text-[11px] text-[var(--fs-text-muted)]">{invoices.length} GST invoice{invoices.length === 1 ? '' : 's'}</span>
            </div>
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Payments Collected</span>
              <div className="font-mono-num text-2xl font-bold text-[var(--fs-success)] tabular-nums">{formatINR(totalReceived)}</div>
              <span className="text-[11px] text-[var(--fs-success)]">Realized collections</span>
            </div>
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Outstanding Receivables</span>
              <div className="font-mono-num text-2xl font-bold text-[var(--fs-warning)] tabular-nums">{formatINR(totalOutstanding)}</div>
              <span className="text-[11px] text-[var(--fs-text-muted)]">Awaiting settlement</span>
            </div>
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Operational Expenses</span>
              <div className="font-mono-num text-2xl font-bold text-[var(--fs-danger)] tabular-nums">{formatINR(totalBizExpenses)}</div>
              <span className="text-[11px] text-[var(--fs-text-muted)]">{expenses.length} recorded expense{expenses.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          {/* FinSight 2.0 Quick Links for Receivables & Reconciliation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="fs-card p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--fs-text)]">
                  <Clock className="h-4 w-4 text-[var(--fs-warning)]" />
                  <span>Receivables Aging & Follow-up Queue</span>
                </div>
                <p className="text-xs text-[var(--fs-text-body)]">
                  Inspect overdue 1–30 / 31–60 / 61–90 / 90+ day invoice buckets and track client payment reminders.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/app/business/receivables')}
                className="fs-btn-secondary px-3 py-2 text-xs inline-flex items-center gap-1 shrink-0"
              >
                <span>Open</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="fs-card p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--fs-text)]">
                  <CheckSquare className="h-4 w-4 text-[var(--fs-accent)]" />
                  <span>Ledger & Invoice Reconciliation</span>
                </div>
                <p className="text-xs text-[var(--fs-text-body)]">
                  Match incoming bank credits against issued GST invoices and review unmatched payment exceptions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/app/business/reconciliation')}
                className="fs-btn-secondary px-3 py-2 text-xs inline-flex items-center gap-1 shrink-0"
              >
                <span>Open</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="fs-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--fs-text)]">Recent Invoices</h3>
              <button type="button" onClick={() => onNavigate('/app/business/invoices')} className="text-xs font-medium text-[var(--fs-accent)] hover:underline">
                View All Invoices →
              </button>
            </div>
            {invoices.length === 0 ? (
              <EmptyStateCard
                variant="invoices"
                title="No GST invoices generated yet"
                description="Issue compliant CGST/SGST or IGST tax invoices with multi-rate line items, downloadable PDFs, and automatic receivables tracking."
                actionLabel="Create Your First GST Invoice"
                onAction={() => onNavigate('/app/business/invoices/new')}
              />
            ) : (
              <div className="divide-y divide-[var(--fs-border)]">
                {invoices.slice(0, 6).map(inv => (
                  <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[var(--fs-text)]">{inv.invoiceNumber} · {inv.clientName}</div>
                      <div className="text-[10px] text-[var(--fs-text-muted)]">Issued: {inv.invoiceDate} · Due: {inv.dueDate}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono-num font-bold text-[var(--fs-text)] tabular-nums">{formatINR(inv.total)}</div>
                      <span className={`text-[10px] font-bold ${
                        inv.status === 'PAID'
                          ? 'text-[var(--fs-success)]'
                          : inv.status === 'PARTIALLY_PAID'
                          ? 'text-[var(--fs-info)]'
                          : 'text-[var(--fs-warning)]'
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW 2: INVOICES LIST */}
      {!isLoading && subview === 'invoices' && (
        <div className="space-y-4">
          <div className="fs-card overflow-hidden">
            <div className="p-4 border-b border-[var(--fs-border)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--fs-text)]">Invoices & Billing History</h3>
              <button
                type="button"
                onClick={() => onNavigate('/app/business/invoices/new')}
                className="fs-btn-primary px-3 py-1.5 text-xs"
              >
                + New Invoice
              </button>
            </div>
            {invoices.length === 0 ? (
              <div className="p-4">
                <EmptyStateCard
                  variant="invoices"
                  title="No GST invoices recorded"
                  description="Create a GST-compliant invoice to generate downloadable PDFs and track client settlements."
                  actionLabel="Create Invoice"
                  onAction={() => onNavigate('/app/business/invoices/new')}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--fs-surface-2)] border-b border-[var(--fs-border)] text-[var(--fs-text-muted)]">
                    <tr>
                      <th className="py-3 px-4 font-medium">Invoice #</th>
                      <th className="py-3 px-4 font-medium">Client</th>
                      <th className="py-3 px-4 font-medium">Due Date</th>
                      <th className="py-3 px-4 font-medium text-right">Subtotal</th>
                      <th className="py-3 px-4 font-medium text-right">GST</th>
                      <th className="py-3 px-4 font-medium text-right">Total</th>
                      <th className="py-3 px-4 font-medium text-right">Balance Due</th>
                      <th className="py-3 px-4 font-medium text-right">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--fs-border)]">
                    {invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-[var(--fs-surface-2)]/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-[var(--fs-text)] whitespace-nowrap">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 text-[var(--fs-text-body)]">
                          <div>{inv.clientName}</div>
                          {inv.clientGstin && <div className="text-[10px] font-mono text-[var(--fs-text-muted)]">{inv.clientGstin}</div>}
                        </td>
                        <td className="py-3 px-4 text-[var(--fs-text-muted)] whitespace-nowrap">{inv.dueDate}</td>
                        <td className="py-3 px-4 text-right font-mono-num tabular-nums text-[var(--fs-text-body)]">{formatINR(inv.subtotal)}</td>
                        <td className="py-3 px-4 text-right font-mono-num tabular-nums text-[var(--fs-text-body)]">{formatINR(inv.totalGst)}</td>
                        <td className="py-3 px-4 text-right font-mono-num font-bold tabular-nums text-[var(--fs-text)]">{formatINR(inv.total)}</td>
                        <td className="py-3 px-4 text-right font-mono-num tabular-nums text-[var(--fs-warning)]">{formatINR(inv.balanceDue)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-[var(--fs-success)]/15 text-[var(--fs-success)]'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-[var(--fs-info)]/15 text-[var(--fs-info)]'
                              : 'bg-[var(--fs-warning)]/15 text-[var(--fs-warning)]'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceForPdf(inv)}
                              className="fs-btn-secondary px-2 py-1 text-[11px] flex items-center gap-1"
                              title="Preview Tax Invoice"
                            >
                              <FileText className="h-3 w-3" />
                              <span>Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoicePdf(inv)}
                              disabled={isDownloadingPdfId === inv.id}
                              className="fs-btn-secondary px-2 py-1 text-[11px] text-[var(--fs-info)] flex items-center gap-1 disabled:opacity-50"
                              title="Download Binary PDF"
                            >
                              <Download className="h-3 w-3" />
                              <span>{isDownloadingPdfId === inv.id ? '...' : 'PDF'}</span>
                            </button>
                            {inv.status !== 'PAID' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentModalInvoice(inv);
                                  setPaymentAmountInput(String(inv.balanceDue));
                                }}
                                className="fs-btn-secondary px-2.5 py-1 text-[11px] text-[var(--fs-success)] flex items-center gap-1"
                              >
                                <CreditCard className="h-3 w-3" />
                                <span>Record Pay</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteInvoice(inv.id)}
                              className="rounded-lg border border-[var(--fs-border)] p-1 text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)] hover:border-[var(--fs-danger)]/40"
                              title="Delete Invoice"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW 3: CREATE INVOICE */}
      {!isLoading && subview === 'new-invoice' && (
        <div className="space-y-6 max-w-4xl">
          {invoiceSuccess && (
            <div className="p-4 rounded-xl bg-[var(--fs-success)]/10 border border-[var(--fs-success)]/40 text-xs text-[var(--fs-success)] flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Invoice generated successfully with verified GST breakdown.</span>
            </div>
          )}

          <div className="fs-card p-6 space-y-6">
            <h3 className="text-base font-bold text-[var(--fs-text)]">Create GST Compliant Invoice</h3>
            <form onSubmit={handleGenerateInvoice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Select Existing Client (Optional)</label>
                  <select
                    value={selectedClientId}
                    onChange={e => handleSelectClientForInvoice(e.target.value)}
                    className="fs-input"
                  >
                    <option value="">-- Enter client details manually --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} {c.gstin ? `(${c.gstin})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Place of Supply (GST Jurisdiction)</label>
                  <select
                    value={placeOfSupply}
                    onChange={e => setPlaceOfSupply(e.target.value)}
                    className="fs-input"
                  >
                    {PLACE_OF_SUPPLY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Client / Company Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="e.g. Zenith Tech Systems Pvt Ltd"
                    className="fs-input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Client GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={clientGstin}
                    onChange={e => setClientGstin(e.target.value.toUpperCase())}
                    placeholder="29AABCC1234D1Z5"
                    className="fs-input font-mono"
                  />
                  {clientGstin.trim() && !validateGSTIN(clientGstin) && (
                    <span className="text-[10px] text-[var(--fs-danger)]">Invalid 15-char GSTIN format</span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invoiceDueDate}
                    onChange={e => setInvoiceDueDate(e.target.value)}
                    className="fs-input"
                    required
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--fs-text)]">Line Items & Per-Item GST Slab</label>
                  <button
                    type="button"
                    onClick={() =>
                      setLineItems(prev => [
                        ...prev,
                        { id: `li-${Date.now()}`, description: '', quantity: '1', unitPrice: '10000', taxRate: 18 },
                      ])
                    }
                    className="text-xs font-medium text-[var(--fs-accent)] hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Line Item</span>
                  </button>
                </div>

                {lineItems.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)]">
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] text-[var(--fs-text-muted)] mb-1">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={e =>
                          setLineItems(prev => prev.map((it, i) => (i === idx ? { ...it, description: e.target.value } : it)))
                        }
                        placeholder="Item or service description"
                        className="fs-input"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[var(--fs-text-muted)] mb-1">Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.quantity}
                        onChange={e =>
                          setLineItems(prev => prev.map((it, i) => (i === idx ? { ...it, quantity: e.target.value } : it)))
                        }
                        className="fs-input"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[var(--fs-text-muted)] mb-1">Unit Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={e =>
                          setLineItems(prev => prev.map((it, i) => (i === idx ? { ...it, unitPrice: e.target.value } : it)))
                        }
                        className="fs-input"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[var(--fs-text-muted)] mb-1">GST Rate</label>
                      <select
                        value={item.taxRate}
                        onChange={e =>
                          setLineItems(prev =>
                            prev.map((it, i) => (i === idx ? { ...it, taxRate: Number(e.target.value) } : it))
                          )
                        }
                        className="fs-input"
                      >
                        {GST_SLABS.map(rate => (
                          <option key={rate} value={rate}>{rate}% GST</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 rounded-lg text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                          title="Remove line item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Notes / Payment Terms (Optional)</label>
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={e => setInvoiceNotes(e.target.value)}
                  placeholder="NEFT / RTGS within 30 days. SAC 998314."
                  className="fs-input"
                />
              </div>

              {/* Dynamic Multi-Rate GST Calculation Box */}
              <div className="p-4 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] space-y-2 text-xs">
                <div className="flex justify-between text-[var(--fs-text-body)]">
                  <span>Taxable Value:</span>
                  <span className="font-mono-num font-semibold text-[var(--fs-text)] tabular-nums">{formatINR(invoicePreviewTotals.taxableAmount)}</span>
                </div>
                {isInterStatePreview ? (
                  <div className="flex justify-between text-[var(--fs-text-body)]">
                    <span>IGST (Interstate Supply):</span>
                    <span className="font-mono-num font-semibold text-[var(--fs-text)] tabular-nums">{formatINR(invoicePreviewTotals.igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-[var(--fs-text-body)]">
                      <span>CGST (Intrastate Central Share):</span>
                      <span className="font-mono-num font-semibold text-[var(--fs-text)] tabular-nums">{formatINR(invoicePreviewTotals.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--fs-text-body)]">
                      <span>SGST (Intrastate State Share):</span>
                      <span className="font-mono-num font-semibold text-[var(--fs-text)] tabular-nums">{formatINR(invoicePreviewTotals.sgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm font-bold text-[var(--fs-text)] pt-2 border-t border-[var(--fs-border)]">
                  <span>Invoice Total:</span>
                  <span className="font-mono-num text-[var(--fs-accent)] tabular-nums">{formatINR(invoicePreviewTotals.totalInvoiceAmount)}</span>
                </div>
              </div>

              <button
                type="submit"
                className="fs-btn-primary w-full py-3 text-xs"
              >
                Generate GST Invoice
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUBVIEW 4: LOAN & EMI PLANNER */}
      {!isLoading && subview === 'emi-planner' && (
        <div className="space-y-6 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Input Form */}
            <div className="md:col-span-5 fs-card p-6 space-y-4">
              <h3 className="text-sm font-bold text-[var(--fs-text)]">Loan & Repayment Parameters</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Plan / Loan Name</label>
                  <input
                    type="text"
                    value={emiPlanName}
                    onChange={e => setEmiPlanName(e.target.value)}
                    className="fs-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Loan Amount (₹)</label>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={e => setLoanAmount(e.target.value)}
                    className="fs-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Annual Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={interestRate}
                    onChange={e => setInterestRate(e.target.value)}
                    className="fs-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Tenure (Months)</label>
                  <input
                    type="number"
                    value={tenureMonths}
                    onChange={e => setTenureMonths(e.target.value)}
                    className="fs-input"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveEMIPlan}
                  className="fs-btn-primary w-full py-2 text-xs"
                >
                  Save Scenario to Account
                </button>
              </div>
            </div>

            {/* Live Calculation Display */}
            <div className="md:col-span-7 fs-card p-6 space-y-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--fs-text)]">Reducing-Balance Repayment Summary</h3>
                <p className="text-xs text-[var(--fs-text-muted)] mt-0.5">Calculated using standard reducing-balance amortized interest.</p>

                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div className="p-3 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)]">
                    <div className="text-[10px] text-[var(--fs-text-muted)]">Monthly EMI</div>
                    <div className="font-mono-num text-lg font-bold text-[var(--fs-accent)] tabular-nums mt-1">{formatINR(calculatedEMI.monthlyEMI)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)]">
                    <div className="text-[10px] text-[var(--fs-text-muted)]">Total Interest</div>
                    <div className="font-mono-num text-lg font-bold text-[var(--fs-danger)] tabular-nums mt-1">{formatINR(calculatedEMI.totalInterest)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)]">
                    <div className="text-[10px] text-[var(--fs-text-muted)]">Total Payable</div>
                    <div className="font-mono-num text-lg font-bold text-[var(--fs-text)] tabular-nums mt-1">{formatINR(calculatedEMI.totalPayment)}</div>
                  </div>
                </div>

                {calculatedEMI.amortizationSchedule.length > 0 && (
                  <div className="mt-4 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] overflow-hidden">
                    <div className="px-3 py-2 border-b border-[var(--fs-border)] text-[11px] font-bold text-[var(--fs-text)]">
                      First 6 Months Amortization Preview
                    </div>
                    <table className="w-full text-left text-[11px]">
                      <thead className="text-[var(--fs-text-muted)] border-b border-[var(--fs-border)]">
                        <tr>
                          <th className="py-1.5 px-3">Month</th>
                          <th className="py-1.5 px-3 text-right">Principal</th>
                          <th className="py-1.5 px-3 text-right">Interest</th>
                          <th className="py-1.5 px-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--fs-border)]">
                        {calculatedEMI.amortizationSchedule.slice(0, 6).map(row => (
                          <tr key={row.month}>
                            <td className="py-1.5 px-3 text-[var(--fs-text-body)]">Month {row.month}</td>
                            <td className="py-1.5 px-3 text-right font-mono-num tabular-nums text-[var(--fs-success)]">{formatINR(row.principalPaid)}</td>
                            <td className="py-1.5 px-3 text-right font-mono-num tabular-nums text-[var(--fs-danger)]">{formatINR(row.interestPaid)}</td>
                            <td className="py-1.5 px-3 text-right font-mono-num tabular-nums text-[var(--fs-text)]">{formatINR(row.remainingBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Saved Plans */}
              <div className="space-y-2 border-t border-[var(--fs-border)] pt-4">
                <span className="text-xs font-bold text-[var(--fs-text)]">Saved Business Loan Scenarios:</span>
                {emiPlans.length === 0 ? (
                  <p className="text-xs text-[var(--fs-text-muted)]">No saved loan scenarios yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {emiPlans.map(plan => (
                      <div key={plan.id} className="p-2.5 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-[var(--fs-text)]">{plan.planName}</span>
                          <div className="text-[10px] text-[var(--fs-text-muted)]">
                            {formatINR(plan.loanAmount)} @ {plan.annualInterestRate}% · {plan.tenureMonths} mos
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-mono-num font-bold text-[var(--fs-accent)] tabular-nums">{formatINR(plan.monthlyEMI)}/mo</div>
                          <button
                            type="button"
                            onClick={() => handleDeleteEMIPlan(plan.id)}
                            className="text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                            title="Delete EMI scenario"
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
        </div>
      )}

      {/* SUBVIEWS: CASH FLOW, EXPENSES, CLIENTS */}
      {!isLoading && (subview === 'cash-flow' || subview === 'expenses' || subview === 'clients') && (
        <div className="space-y-6 max-w-5xl">
          <div className="fs-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--fs-text)]">
                  {subview === 'cash-flow' && 'Live Business Cash Flow Forecast'}
                  {subview === 'expenses' && 'Business Operational Expenses & Receipt Vault'}
                  {subview === 'clients' && 'Corporate Clients Directory'}
                </h3>
                <p className="text-xs text-[var(--fs-text-body)] mt-0.5">
                  {subview === 'cash-flow' && 'Calculated live from your opening balance, unpaid invoice receivables, logged expenses, and EMI obligations.'}
                  {subview === 'expenses' && 'Track deductible business operating expenses with attached PDF or image receipts.'}
                  {subview === 'clients' && 'Verified client directory with validated 15-character GSTIN numbers.'}
                </p>
              </div>
              {subview === 'clients' && (
                <button
                  type="button"
                  onClick={() => setShowClientModal(true)}
                  className="fs-btn-primary px-3 py-1.5 text-xs flex items-center gap-1 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Client</span>
                </button>
              )}
              {subview === 'expenses' && (
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(true)}
                  className="fs-btn-primary px-3 py-1.5 text-xs flex items-center gap-1 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Log Business Expense</span>
                </button>
              )}
              {subview === 'cash-flow' && (
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="fs-btn-secondary px-3 py-1.5 text-xs shrink-0"
                >
                  Update Opening Cash
                </button>
              )}
            </div>

            {subview === 'expenses' && (
              expenses.length === 0 ? (
                <EmptyStateCard
                  variant="transactions"
                  title="No business expenses logged yet"
                  description="Record vendor outlays, software subscriptions, rent, and attach PDF/image receipts for tax & ledger reconciliation."
                  actionLabel="Log Business Expense"
                  onAction={() => setShowExpenseModal(true)}
                />
              ) : (
                <div className="divide-y divide-[var(--fs-border)] pt-2">
                  {expenses.map(e => (
                    <div key={e.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-semibold text-[var(--fs-text)]">{e.name}</div>
                        <div className="text-[10px] text-[var(--fs-text-muted)]">
                          {e.category} · {e.vendor} · {e.expenseDate} · {e.paymentMethod}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {e.receiptName && (
                          <button
                            type="button"
                            onClick={() => handleDownloadReceipt(e)}
                            className="fs-btn-secondary px-2.5 py-1 text-[11px] flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            <span>Receipt</span>
                          </button>
                        )}
                        <div className="font-mono-num font-bold text-[var(--fs-danger)] tabular-nums">-{formatINR(e.amount)}</div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(e.id)}
                          className="p-1 text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                          title="Delete Expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {subview === 'clients' && (
              clients.length === 0 ? (
                <EmptyStateCard
                  variant="clients"
                  title="No corporate clients added yet"
                  description="Save clients with validated 15-character GSTIN numbers to prefill invoices in one click."
                  actionLabel="Add Client"
                  onAction={() => setShowClientModal(true)}
                />
              ) : (
                <div className="divide-y divide-[var(--fs-border)] pt-2">
                  {clients.map(c => (
                    <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-[var(--fs-text)]">{c.companyName}</div>
                        <div className="text-[10px] text-[var(--fs-text-muted)]">Contact: {c.clientName} · {c.email} · {c.phone}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono text-xs text-[var(--fs-accent)]">{c.gstin || 'Unregistered'}</div>
                          <div className="text-[10px] text-[var(--fs-text-muted)]">{c.billingAddress}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteClient(c.id)}
                          className="p-1 text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                          title="Delete Client"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {subview === 'cash-flow' && cashFlow && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--fs-text-body)]">Opening Cash + Collected Revenue:</span>
                    <span className="font-mono-num font-bold text-[var(--fs-text)] tabular-nums">{formatINR(cashFlow.openingBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--fs-text-body)]">Confirmed Receivables (Unpaid Invoices):</span>
                    <span className="font-mono-num font-bold text-[var(--fs-success)] tabular-nums">+{formatINR(cashFlow.confirmedReceivables)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--fs-text-body)]">Committed Outflows (Expenses + Monthly EMIs):</span>
                    <span className="font-mono-num font-bold text-[var(--fs-danger)] tabular-nums">-{formatINR(cashFlow.committedOutflows)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[var(--fs-border)] text-sm">
                    <span className="font-bold text-[var(--fs-text)]">Projected Closing Balance:</span>
                    <span className="font-mono-num font-extrabold text-[var(--fs-accent)] tabular-nums">{formatINR(cashFlow.projectedClosingBalance)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)]">
                    <div className="text-[11px] text-[var(--fs-text-muted)]">Monthly Burn Rate</div>
                    <div className="font-mono-num text-lg font-bold text-[var(--fs-danger)] tabular-nums mt-1">{formatINR(cashFlow.monthlyBurnRate)}/mo</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)]">
                    <div className="text-[11px] text-[var(--fs-text-muted)]">Estimated Cash Runway</div>
                    <div className="font-mono-num text-lg font-bold text-[var(--fs-accent)] tabular-nums mt-1">
                      {cashFlow.monthlyBurnRate > 0 ? `${cashFlow.runwayMonths} months` : 'Zero monthly burn'}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[var(--fs-surface-2)] border border-[var(--fs-border)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[var(--fs-border)] text-xs font-bold text-[var(--fs-text)]">
                    3-Month Cash Projection
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="text-[var(--fs-text-muted)] border-b border-[var(--fs-border)]">
                      <tr>
                        <th className="py-2 px-4">Period</th>
                        <th className="py-2 px-4 text-right">Expected Inflow</th>
                        <th className="py-2 px-4 text-right">Committed Outflow</th>
                        <th className="py-2 px-4 text-right">Projected Closing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--fs-border)]">
                      {cashFlow.monthlyProjection.map(row => (
                        <tr key={row.month}>
                          <td className="py-2.5 px-4 font-semibold text-[var(--fs-text)]">{row.month}</td>
                          <td className="py-2.5 px-4 text-right font-mono-num tabular-nums text-[var(--fs-success)]">+{formatINR(row.inflow)}</td>
                          <td className="py-2.5 px-4 text-right font-mono-num tabular-nums text-[var(--fs-danger)]">-{formatINR(row.outflow)}</td>
                          <td className="py-2.5 px-4 text-right font-mono-num font-bold tabular-nums text-[var(--fs-accent)]">{formatINR(row.closingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice PDF Preview Modal */}
      {selectedInvoiceForPdf && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl fs-card p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-[var(--fs-border)] pb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--fs-accent)]" />
                <h3 className="text-base font-bold text-[var(--fs-text)]">Tax Invoice · {selectedInvoiceForPdf.invoiceNumber}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoiceForPdf(null)}
                className="p-1 rounded-lg text-[var(--fs-text-muted)] hover:text-[var(--fs-text)]"
                aria-label="Close invoice preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-[var(--fs-surface-2)] border border-[var(--fs-border)] rounded-xl p-6 space-y-4 text-xs font-mono">
              <div className="flex justify-between border-b border-[var(--fs-border)] pb-4">
                <div>
                  <div className="text-sm font-bold text-[var(--fs-accent)]">{businessProfile?.businessName || 'FINSIGHT BUSINESS'}</div>
                  <div className="text-[11px] text-[var(--fs-text-body)]">GSTIN: {businessProfile?.gstin || 'Not Set'}</div>
                  <div className="text-[11px] text-[var(--fs-text-muted)]">{businessProfile?.address || 'India'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[var(--fs-text)]">TAX INVOICE</div>
                  <div className="text-[11px] text-[var(--fs-text-body)]">{selectedInvoiceForPdf.invoiceNumber}</div>
                  <div className="text-[11px] text-[var(--fs-text-muted)]">Date: {selectedInvoiceForPdf.invoiceDate}</div>
                  <div className="text-[11px] text-[var(--fs-text-muted)]">Due: {selectedInvoiceForPdf.dueDate}</div>
                </div>
              </div>

              <div className="flex justify-between py-2 border-b border-[var(--fs-border)]">
                <div>
                  <div className="text-[10px] text-[var(--fs-text-muted)]">BILLED TO:</div>
                  <div className="font-bold text-[var(--fs-text)]">{selectedInvoiceForPdf.clientName}</div>
                  {selectedInvoiceForPdf.clientGstin && (
                    <div className="text-[10px] text-[var(--fs-accent)]">GSTIN: {selectedInvoiceForPdf.clientGstin}</div>
                  )}
                  <div className="text-[10px] text-[var(--fs-text-body)]">{selectedInvoiceForPdf.placeOfSupply}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[var(--fs-text-muted)]">PAYMENT STATUS:</div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedInvoiceForPdf.status === 'PAID'
                      ? 'bg-[var(--fs-success)]/15 text-[var(--fs-success)]'
                      : 'bg-[var(--fs-warning)]/15 text-[var(--fs-warning)]'
                  }`}>
                    {selectedInvoiceForPdf.status}
                  </span>
                </div>
              </div>

              <table className="w-full text-left">
                <thead className="text-[var(--fs-text-muted)] border-b border-[var(--fs-border)]">
                  <tr>
                    <th className="py-2">Item Description</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-center">GST</th>
                    <th className="py-2 text-right">Rate</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--fs-border)]">
                  {selectedInvoiceForPdf.lineItems.map(item => (
                    <tr key={item.id}>
                      <td className="py-2.5 text-[var(--fs-text)]">{item.description}</td>
                      <td className="py-2.5 text-center text-[var(--fs-text-body)]">{item.quantity}</td>
                      <td className="py-2.5 text-center text-[var(--fs-text-body)]">{item.taxRate}%</td>
                      <td className="py-2.5 text-right text-[var(--fs-text-body)]">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right text-[var(--fs-text)]">₹{item.lineTotal.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-[var(--fs-border)] pt-3 space-y-1 text-right">
                <div className="flex justify-between text-[var(--fs-text-body)]">
                  <span>Subtotal:</span>
                  <span>{formatINR(selectedInvoiceForPdf.subtotal)}</span>
                </div>
                {selectedInvoiceForPdf.cgst > 0 && (
                  <div className="flex justify-between text-[var(--fs-text-body)]">
                    <span>CGST:</span>
                    <span>{formatINR(selectedInvoiceForPdf.cgst)}</span>
                  </div>
                )}
                {selectedInvoiceForPdf.sgst > 0 && (
                  <div className="flex justify-between text-[var(--fs-text-body)]">
                    <span>SGST:</span>
                    <span>{formatINR(selectedInvoiceForPdf.sgst)}</span>
                  </div>
                )}
                {selectedInvoiceForPdf.igst > 0 && (
                  <div className="flex justify-between text-[var(--fs-text-body)]">
                    <span>IGST:</span>
                    <span>{formatINR(selectedInvoiceForPdf.igst)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-[var(--fs-accent)] border-t border-[var(--fs-border)] pt-2">
                  <span>Grand Total (INR):</span>
                  <span>{formatINR(selectedInvoiceForPdf.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--fs-text-body)]">
                  <span>Balance Due:</span>
                  <span>{formatINR(selectedInvoiceForPdf.balanceDue)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedInvoiceForPdf(null)}
                className="fs-btn-secondary px-4 py-2 text-xs"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="fs-btn-secondary px-4 py-2 text-xs flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print View</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadInvoicePdf(selectedInvoiceForPdf)}
                disabled={isDownloadingPdfId === selectedInvoiceForPdf.id}
                className="fs-btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isDownloadingPdfId === selectedInvoiceForPdf.id ? 'Generating PDF...' : 'Download PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm fs-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--fs-text)]">Record Payment · {paymentModalInvoice.invoiceNumber}</h3>
            <p className="text-xs text-[var(--fs-text-body)]">
              Outstanding balance: <strong className="text-[var(--fs-warning)]">{formatINR(paymentModalInvoice.balanceDue)}</strong>
            </p>
            <div>
              <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Payment Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                max={paymentModalInvoice.balanceDue}
                value={paymentAmountInput}
                onChange={e => setPaymentAmountInput(e.target.value)}
                className="fs-input"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalInvoice(null)}
                className="fs-btn-secondary px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRecordPayment(paymentModalInvoice.id, parseFloat(paymentAmountInput) || 0)}
                className="fs-btn-primary px-4 py-2 text-xs"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Business Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md fs-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--fs-text)]">Business Profile & Cash Balance</h3>
            <form onSubmit={handleSaveBusinessProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Registered Business Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="fs-input"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Business GSTIN</label>
                  <input
                    type="text"
                    value={profileGstin}
                    onChange={e => setProfileGstin(e.target.value.toUpperCase())}
                    placeholder="29AAACF9876K1ZP"
                    className="fs-input font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">State GST Code</label>
                  <input
                    type="text"
                    value={profileStateCode}
                    onChange={e => setProfileStateCode(e.target.value)}
                    placeholder="29"
                    maxLength={2}
                    className="fs-input font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Registered Address</label>
                <input
                  type="text"
                  value={profileAddress}
                  onChange={e => setProfileAddress(e.target.value)}
                  className="fs-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Opening Cash Balance (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={profileOpeningCash}
                  onChange={e => setProfileOpeningCash(e.target.value)}
                  className="fs-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--fs-border)]">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="fs-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fs-btn-primary px-4 py-2 text-xs"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Business Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md fs-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--fs-text)]">Log Business Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Expense Title</label>
                <input
                  type="text"
                  value={expName}
                  onChange={e => setExpName(e.target.value)}
                  placeholder="e.g. Cloud Hosting Subscription"
                  className="fs-input"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Category</label>
                  <select
                    value={expCategory}
                    onChange={e => setExpCategory(e.target.value as BusinessExpense['category'])}
                    className="fs-input"
                  >
                    {['Rent', 'Salaries', 'Marketing', 'Utilities', 'Equipment', 'Travel', 'Software', 'Other'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={expAmount}
                    onChange={e => setExpAmount(e.target.value)}
                    placeholder="12500"
                    className="fs-input"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Vendor</label>
                  <input
                    type="text"
                    value={expVendor}
                    onChange={e => setExpVendor(e.target.value)}
                    placeholder="e.g. Google Cloud India"
                    className="fs-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={e => setExpDate(e.target.value)}
                    className="fs-input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Payment Method</label>
                <input
                  type="text"
                  value={expMethod}
                  onChange={e => setExpMethod(e.target.value)}
                  className="fs-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Attach Receipt (PDF/PNG/JPG, Optional)</label>
                <label className="flex items-center gap-2 rounded-xl bg-[var(--fs-bg)] border border-dashed border-[var(--fs-border)] px-3 py-2 text-xs text-[var(--fs-text-body)] cursor-pointer hover:border-[var(--fs-accent)]">
                  <Upload className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
                  <span className="truncate">{expReceipt ? expReceipt.fileName : 'Choose receipt file...'}</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={e => handleReceiptFileChange(e.target.files?.[0])}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--fs-border)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseModal(false);
                    setExpReceipt(null);
                  }}
                  className="fs-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fs-btn-primary px-4 py-2 text-xs"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md fs-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--fs-text)]">Add Corporate Client</h3>
            <form onSubmit={handleAddClient} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Company / Business Name</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Acme Tech Solutions Pvt Ltd"
                  className="fs-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Contact Person Name</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="e.g. Priya Nair"
                  className="fs-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Email</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={e => setNewClientEmail(e.target.value)}
                    placeholder="finance@acme.in"
                    className="fs-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Phone</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={e => setNewClientPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="fs-input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">GSTIN Number (Optional, 15 chars)</label>
                <input
                  type="text"
                  value={newClientGstin}
                  onChange={e => setNewClientGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 29AABCC1234D1Z5"
                  className="fs-input font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Billing Address</label>
                <input
                  type="text"
                  value={newClientAddress}
                  onChange={e => setNewClientAddress(e.target.value)}
                  placeholder="e.g. Whitefield, Bangalore, Karnataka"
                  className="fs-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--fs-border)]">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="fs-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fs-btn-primary px-4 py-2 text-xs"
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
