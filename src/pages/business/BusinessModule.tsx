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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#28443C] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7F5] tracking-tight">
            Small Business Finance
          </h1>
          <p className="text-xs text-[#A7C1B8] mt-1">
            {businessProfile?.businessName || 'Your Business'} · GST compliant invoicing, expenses, cash flow forecast, and EMI planner.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#28443C] bg-[#102722] px-3 py-2 text-xs font-medium text-[#A7C1B8] hover:text-[#F5F7F5] hover:border-[#72C8B0] transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Business Profile</span>
          </button>
          <button
            onClick={onOpenAI}
            className="flex items-center gap-1.5 rounded-lg border border-[#28443C] bg-[#16352E] px-3 py-2 text-xs font-medium text-[#A8E6CE] hover:border-[#72C8B0] transition-colors"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Ask Business AI</span>
          </button>
          <button
            onClick={() => onNavigate('/app/business/invoices/new')}
            className="flex items-center gap-1.5 rounded-lg bg-[#A8E6CE] px-3.5 py-2 text-xs font-semibold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Banners */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-[#EB7676] hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/40 text-xs text-[#55C99A] flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#28443C] pb-2 overflow-x-auto whitespace-nowrap">
        {[
          { label: 'Overview', path: '/app/business', key: 'overview' },
          { label: 'Invoices', path: '/app/business/invoices', key: 'invoices' },
          { label: 'Create Invoice', path: '/app/business/invoices/new', key: 'new-invoice' },
          { label: 'Clients', path: '/app/business/clients', key: 'clients' },
          { label: 'Business Expenses', path: '/app/business/expenses', key: 'expenses' },
          { label: 'Cash Flow Forecast', path: '/app/business/cash-flow', key: 'cash-flow' },
          { label: 'Loan & EMI Planner', path: '/app/business/emi-planner', key: 'emi-planner' },
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

      {isLoading && (
        <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 text-xs text-[#A7C1B8]">
          Loading business ledger, GST invoices, and cash flow projections...
        </div>
      )}

      {/* SUBVIEW 1: OVERVIEW */}
      {!isLoading && subview === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Total Billed (Invoices)</span>
              <div className="text-2xl font-bold text-[#F5F7F5] tabular-nums">{formatINR(totalBilled)}</div>
              <span className="text-[11px] text-[#718D83]">{invoices.length} GST invoice{invoices.length === 1 ? '' : 's'}</span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Payments Collected</span>
              <div className="text-2xl font-bold text-[#55C99A] tabular-nums">{formatINR(totalReceived)}</div>
              <span className="text-[11px] text-[#55C99A]">Realized collections</span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Outstanding Receivables</span>
              <div className="text-2xl font-bold text-[#E5B764] tabular-nums">{formatINR(totalOutstanding)}</div>
              <span className="text-[11px] text-[#718D83]">Awaiting settlement</span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Operational Expenses</span>
              <div className="text-2xl font-bold text-[#EB7676] tabular-nums">{formatINR(totalBizExpenses)}</div>
              <span className="text-[11px] text-[#718D83]">{expenses.length} recorded expense{expenses.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Recent Invoices</h3>
              <button onClick={() => onNavigate('/app/business/invoices')} className="text-xs text-[#A8E6CE] hover:underline">
                View All Invoices →
              </button>
            </div>
            {invoices.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#718D83] space-y-2">
                <p>No invoices generated yet.</p>
                <button
                  onClick={() => onNavigate('/app/business/invoices/new')}
                  className="rounded-lg bg-[#A8E6CE] px-3 py-1.5 text-xs font-bold text-[#0B1C19]"
                >
                  Create Your First GST Invoice
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#28443C]/50">
                {invoices.slice(0, 6).map(inv => (
                  <div key={inv.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#F5F7F5]">{inv.invoiceNumber} · {inv.clientName}</div>
                      <div className="text-[10px] text-[#718D83]">Issued: {inv.invoiceDate} · Due: {inv.dueDate}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#F5F7F5] tabular-nums">{formatINR(inv.total)}</div>
                      <span className={`text-[10px] font-bold ${
                        inv.status === 'PAID'
                          ? 'text-[#55C99A]'
                          : inv.status === 'PARTIALLY_PAID'
                          ? 'text-[#7BB9DC]'
                          : 'text-[#E5B764]'
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
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] overflow-hidden">
            <div className="p-4 border-b border-[#28443C] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Invoices & Billing History</h3>
              <button
                onClick={() => onNavigate('/app/business/invoices/new')}
                className="rounded-lg bg-[#A8E6CE] px-3 py-1.5 text-xs font-bold text-[#0B1C19]"
              >
                + New Invoice
              </button>
            </div>
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#718D83] space-y-2">
                <p>No GST invoices recorded in your account.</p>
                <button
                  onClick={() => onNavigate('/app/business/invoices/new')}
                  className="rounded-lg bg-[#A8E6CE] px-3 py-1.5 text-xs font-bold text-[#0B1C19]"
                >
                  Create Invoice
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#16352E]/40 border-b border-[#28443C] text-[#718D83]">
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
                  <tbody className="divide-y divide-[#28443C]/40">
                    {invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-[#16352E]/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-[#F5F7F5] whitespace-nowrap">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 text-[#A7C1B8]">
                          <div>{inv.clientName}</div>
                          {inv.clientGstin && <div className="text-[10px] font-mono text-[#718D83]">{inv.clientGstin}</div>}
                        </td>
                        <td className="py-3 px-4 text-[#718D83] whitespace-nowrap">{inv.dueDate}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#718D83]">{formatINR(inv.subtotal)}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#718D83]">{formatINR(inv.totalGst)}</td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums text-[#F5F7F5]">{formatINR(inv.total)}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#E5B764]">{formatINR(inv.balanceDue)}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-[#55C99A]/20 text-[#55C99A]'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-[#7BB9DC]/20 text-[#7BB9DC]'
                              : 'bg-[#E5B764]/20 text-[#E5B764]'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedInvoiceForPdf(inv)}
                              className="rounded-lg bg-[#16352E] border border-[#28443C] px-2 py-1 text-[11px] text-[#A8E6CE] hover:border-[#72C8B0] flex items-center gap-1"
                              title="Preview Tax Invoice"
                            >
                              <FileText className="h-3 w-3" />
                              <span>Preview</span>
                            </button>
                            <button
                              onClick={() => handleDownloadInvoicePdf(inv)}
                              disabled={isDownloadingPdfId === inv.id}
                              className="rounded-lg bg-[#16352E] border border-[#28443C] px-2 py-1 text-[11px] text-[#7BB9DC] hover:border-[#7BB9DC] flex items-center gap-1 disabled:opacity-50"
                              title="Download Binary PDF"
                            >
                              <Download className="h-3 w-3" />
                              <span>{isDownloadingPdfId === inv.id ? '...' : 'PDF'}</span>
                            </button>
                            {inv.status !== 'PAID' && (
                              <button
                                onClick={() => {
                                  setPaymentModalInvoice(inv);
                                  setPaymentAmountInput(String(inv.balanceDue));
                                }}
                                className="rounded-lg bg-[#16352E] border border-[#28443C] px-2.5 py-1 text-[11px] text-[#55C99A] hover:border-[#55C99A] flex items-center gap-1"
                              >
                                <CreditCard className="h-3 w-3" />
                                <span>Record Pay</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteInvoice(inv.id)}
                              className="rounded-lg border border-[#28443C] p-1 text-[#718D83] hover:text-[#EB7676] hover:border-[#EB7676]/40"
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
            <div className="p-4 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/40 text-xs text-[#55C99A] flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Invoice generated successfully with verified GST breakdown.</span>
            </div>
          )}

          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-6">
            <h3 className="text-base font-bold text-[#F5F7F5]">Create GST Compliant Invoice</h3>
            <form onSubmit={handleGenerateInvoice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Select Existing Client (Optional)</label>
                  <select
                    value={selectedClientId}
                    onChange={e => handleSelectClientForInvoice(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
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
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Place of Supply (GST Jurisdiction)</label>
                  <select
                    value={placeOfSupply}
                    onChange={e => setPlaceOfSupply(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  >
                    {PLACE_OF_SUPPLY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Client / Company Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="e.g. Zenith Tech Systems Pvt Ltd"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Client GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={clientGstin}
                    onChange={e => setClientGstin(e.target.value.toUpperCase())}
                    placeholder="29AABCC1234D1Z5"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5] font-mono"
                  />
                  {clientGstin.trim() && !validateGSTIN(clientGstin) && (
                    <span className="text-[10px] text-[#EB7676]">Invalid 15-char GSTIN format</span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invoiceDueDate}
                    onChange={e => setInvoiceDueDate(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#F5F7F5]">Line Items & Per-Item GST Slab</label>
                  <button
                    type="button"
                    onClick={() =>
                      setLineItems(prev => [
                        ...prev,
                        { id: `li-${Date.now()}`, description: '', quantity: '1', unitPrice: '10000', taxRate: 18 },
                      ])
                    }
                    className="text-xs text-[#A8E6CE] hover:underline flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Line Item</span>
                  </button>
                </div>

                {lineItems.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-3 rounded-xl bg-[#0B1C19] border border-[#28443C]">
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] text-[#718D83] mb-1">Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={e =>
                          setLineItems(prev => prev.map((it, i) => (i === idx ? { ...it, description: e.target.value } : it)))
                        }
                        placeholder="Item or service description"
                        className="w-full rounded-lg bg-[#102722] border border-[#28443C] px-2.5 py-1.5 text-xs text-[#F5F7F5]"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[#718D83] mb-1">Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.quantity}
                        onChange={e =>
                          setLineItems(prev => prev.map((it, i) => (i === idx ? { ...it, quantity: e.target.value } : it)))
                        }
                        className="w-full rounded-lg bg-[#102722] border border-[#28443C] px-2.5 py-1.5 text-xs text-[#F5F7F5]"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[#718D83] mb-1">Unit Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={e =>
                          setLineItems(prev => prev.map((it, i) => (i === idx ? { ...it, unitPrice: e.target.value } : it)))
                        }
                        className="w-full rounded-lg bg-[#102722] border border-[#28443C] px-2.5 py-1.5 text-xs text-[#F5F7F5]"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-[#718D83] mb-1">GST Rate</label>
                      <select
                        value={item.taxRate}
                        onChange={e =>
                          setLineItems(prev =>
                            prev.map((it, i) => (i === idx ? { ...it, taxRate: Number(e.target.value) } : it))
                          )
                        }
                        className="w-full rounded-lg bg-[#102722] border border-[#28443C] px-2 py-1.5 text-xs text-[#F5F7F5]"
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
                          className="p-1.5 rounded-lg text-[#718D83] hover:text-[#EB7676]"
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
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Notes / Payment Terms (Optional)</label>
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={e => setInvoiceNotes(e.target.value)}
                  placeholder="NEFT / RTGS within 30 days. SAC 998314."
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>

              {/* Dynamic Multi-Rate GST Calculation Box */}
              <div className="p-4 rounded-xl bg-[#0B1C19] border border-[#28443C] space-y-2 text-xs">
                <div className="flex justify-between text-[#A7C1B8]">
                  <span>Taxable Value:</span>
                  <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(invoicePreviewTotals.taxableAmount)}</span>
                </div>
                {isInterStatePreview ? (
                  <div className="flex justify-between text-[#A7C1B8]">
                    <span>IGST (Interstate Supply):</span>
                    <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(invoicePreviewTotals.igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-[#A7C1B8]">
                      <span>CGST (Intrastate Central Share):</span>
                      <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(invoicePreviewTotals.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-[#A7C1B8]">
                      <span>SGST (Intrastate State Share):</span>
                      <span className="font-semibold text-[#F5F7F5] tabular-nums">{formatINR(invoicePreviewTotals.sgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm font-bold text-[#F5F7F5] pt-2 border-t border-[#28443C]">
                  <span>Invoice Total:</span>
                  <span className="text-[#A8E6CE] tabular-nums">{formatINR(invoicePreviewTotals.totalInvoiceAmount)}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#A8E6CE] py-3 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
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
            <div className="md:col-span-5 rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Loan & Repayment Parameters</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Plan / Loan Name</label>
                  <input
                    type="text"
                    value={emiPlanName}
                    onChange={e => setEmiPlanName(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Loan Amount (₹)</label>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={e => setLoanAmount(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Annual Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={interestRate}
                    onChange={e => setInterestRate(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Tenure (Months)</label>
                  <input
                    type="number"
                    value={tenureMonths}
                    onChange={e => setTenureMonths(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveEMIPlan}
                  className="w-full rounded-xl bg-[#16352E] border border-[#28443C] py-2 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0]"
                >
                  Save Scenario to Account
                </button>
              </div>
            </div>

            {/* Live Calculation Display */}
            <div className="md:col-span-7 rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#F5F7F5]">Reducing-Balance Repayment Summary</h3>
                <p className="text-xs text-[#718D83] mt-0.5">Calculated using standard reducing-balance amortized interest.</p>

                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div className="p-3 rounded-xl bg-[#0B1C19] border border-[#28443C]">
                    <div className="text-[10px] text-[#718D83]">Monthly EMI</div>
                    <div className="text-lg font-bold text-[#A8E6CE] tabular-nums mt-1">{formatINR(calculatedEMI.monthlyEMI)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0B1C19] border border-[#28443C]">
                    <div className="text-[10px] text-[#718D83]">Total Interest</div>
                    <div className="text-lg font-bold text-[#EB7676] tabular-nums mt-1">{formatINR(calculatedEMI.totalInterest)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0B1C19] border border-[#28443C]">
                    <div className="text-[10px] text-[#718D83]">Total Payable</div>
                    <div className="text-lg font-bold text-[#F5F7F5] tabular-nums mt-1">{formatINR(calculatedEMI.totalPayment)}</div>
                  </div>
                </div>

                {calculatedEMI.amortizationSchedule.length > 0 && (
                  <div className="mt-4 rounded-xl bg-[#0B1C19] border border-[#28443C] overflow-hidden">
                    <div className="px-3 py-2 border-b border-[#28443C] text-[11px] font-bold text-[#A7C1B8]">
                      First 6 Months Amortization Preview
                    </div>
                    <table className="w-full text-left text-[11px]">
                      <thead className="text-[#718D83] border-b border-[#28443C]/60">
                        <tr>
                          <th className="py-1.5 px-3">Month</th>
                          <th className="py-1.5 px-3 text-right">Principal</th>
                          <th className="py-1.5 px-3 text-right">Interest</th>
                          <th className="py-1.5 px-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#28443C]/40">
                        {calculatedEMI.amortizationSchedule.slice(0, 6).map(row => (
                          <tr key={row.month}>
                            <td className="py-1.5 px-3 text-[#A7C1B8]">Month {row.month}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-[#55C99A]">{formatINR(row.principalPaid)}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-[#EB7676]">{formatINR(row.interestPaid)}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-[#F5F7F5]">{formatINR(row.remainingBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Saved Plans */}
              <div className="space-y-2 border-t border-[#28443C] pt-4">
                <span className="text-xs font-bold text-[#F5F7F5]">Saved Business Loan Scenarios:</span>
                {emiPlans.length === 0 ? (
                  <p className="text-xs text-[#718D83]">No saved loan scenarios yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {emiPlans.map(plan => (
                      <div key={plan.id} className="p-2.5 rounded-xl bg-[#0B1C19] border border-[#28443C] flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-[#F5F7F5]">{plan.planName}</span>
                          <div className="text-[10px] text-[#718D83]">
                            {formatINR(plan.loanAmount)} @ {plan.annualInterestRate}% · {plan.tenureMonths} mos
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-[#A8E6CE] tabular-nums">{formatINR(plan.monthlyEMI)}/mo</div>
                          <button
                            onClick={() => handleDeleteEMIPlan(plan.id)}
                            className="text-[#718D83] hover:text-[#EB7676]"
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
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#F5F7F5]">
                  {subview === 'cash-flow' && 'Live Business Cash Flow Forecast'}
                  {subview === 'expenses' && 'Business Operational Expenses & Receipt Vault'}
                  {subview === 'clients' && 'Corporate Clients Directory'}
                </h3>
                <p className="text-xs text-[#A7C1B8] mt-0.5">
                  {subview === 'cash-flow' && 'Calculated live from your opening balance, unpaid invoice receivables, logged expenses, and EMI obligations.'}
                  {subview === 'expenses' && 'Track deductible business operating expenses with attached PDF or image receipts.'}
                  {subview === 'clients' && 'Verified client directory with validated 15-character GSTIN numbers.'}
                </p>
              </div>
              {subview === 'clients' && (
                <button
                  onClick={() => setShowClientModal(true)}
                  className="rounded-lg bg-[#A8E6CE] px-3 py-1.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0] flex items-center gap-1 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Client</span>
                </button>
              )}
              {subview === 'expenses' && (
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="rounded-lg bg-[#A8E6CE] px-3 py-1.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0] flex items-center gap-1 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Log Business Expense</span>
                </button>
              )}
              {subview === 'cash-flow' && (
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="rounded-lg border border-[#28443C] bg-[#16352E] px-3 py-1.5 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0] shrink-0"
                >
                  Update Opening Cash
                </button>
              )}
            </div>

            {subview === 'expenses' && (
              expenses.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#718D83]">
                  No business expenses logged yet. Click &ldquo;Log Business Expense&rdquo; to record vendor outlays and attach receipts.
                </div>
              ) : (
                <div className="divide-y divide-[#28443C]/50 pt-2">
                  {expenses.map(e => (
                    <div key={e.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-semibold text-[#F5F7F5]">{e.name}</div>
                        <div className="text-[10px] text-[#718D83]">
                          {e.category} · {e.vendor} · {e.expenseDate} · {e.paymentMethod}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {e.receiptName && (
                          <button
                            onClick={() => handleDownloadReceipt(e)}
                            className="rounded-lg border border-[#28443C] bg-[#0B1C19] px-2.5 py-1 text-[11px] text-[#A8E6CE] hover:border-[#72C8B0] flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            <span>Receipt</span>
                          </button>
                        )}
                        <div className="font-bold text-[#EB7676] tabular-nums">-{formatINR(e.amount)}</div>
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          className="p-1 text-[#718D83] hover:text-[#EB7676]"
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
                <div className="py-8 text-center text-xs text-[#718D83]">
                  No clients added yet. Add a corporate client to prefill GST invoices.
                </div>
              ) : (
                <div className="divide-y divide-[#28443C]/50 pt-2">
                  {clients.map(c => (
                    <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-[#F5F7F5]">{c.companyName}</div>
                        <div className="text-[10px] text-[#718D83]">Contact: {c.clientName} · {c.email} · {c.phone}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono text-xs text-[#A8E6CE]">{c.gstin || 'Unregistered'}</div>
                          <div className="text-[10px] text-[#718D83]">{c.billingAddress}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteClient(c.id)}
                          className="p-1 text-[#718D83] hover:text-[#EB7676]"
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
                <div className="p-4 rounded-xl bg-[#0B1C19] border border-[#28443C] space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#A7C1B8]">Opening Cash + Collected Revenue:</span>
                    <span className="font-bold text-[#F5F7F5] tabular-nums">{formatINR(cashFlow.openingBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7C1B8]">Confirmed Receivables (Unpaid Invoices):</span>
                    <span className="font-bold text-[#55C99A] tabular-nums">+{formatINR(cashFlow.confirmedReceivables)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7C1B8]">Committed Outflows (Expenses + Monthly EMIs):</span>
                    <span className="font-bold text-[#EB7676] tabular-nums">-{formatINR(cashFlow.committedOutflows)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#28443C] text-sm">
                    <span className="font-bold text-[#F5F7F5]">Projected Closing Balance:</span>
                    <span className="font-extrabold text-[#A8E6CE] tabular-nums">{formatINR(cashFlow.projectedClosingBalance)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#0B1C19] border border-[#28443C]">
                    <div className="text-[11px] text-[#718D83]">Monthly Burn Rate</div>
                    <div className="text-lg font-bold text-[#EB7676] tabular-nums mt-1">{formatINR(cashFlow.monthlyBurnRate)}/mo</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0B1C19] border border-[#28443C]">
                    <div className="text-[11px] text-[#718D83]">Estimated Cash Runway</div>
                    <div className="text-lg font-bold text-[#A8E6CE] tabular-nums mt-1">
                      {cashFlow.monthlyBurnRate > 0 ? `${cashFlow.runwayMonths} months` : 'Zero monthly burn'}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#0B1C19] border border-[#28443C] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#28443C] text-xs font-bold text-[#F5F7F5]">
                    3-Month Cash Projection
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="text-[#718D83] border-b border-[#28443C]">
                      <tr>
                        <th className="py-2 px-4">Period</th>
                        <th className="py-2 px-4 text-right">Expected Inflow</th>
                        <th className="py-2 px-4 text-right">Committed Outflow</th>
                        <th className="py-2 px-4 text-right">Projected Closing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#28443C]/40">
                      {cashFlow.monthlyProjection.map(row => (
                        <tr key={row.month}>
                          <td className="py-2.5 px-4 font-semibold text-[#F5F7F5]">{row.month}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#55C99A]">+{formatINR(row.inflow)}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#EB7676]">-{formatINR(row.outflow)}</td>
                          <td className="py-2.5 px-4 text-right font-bold tabular-nums text-[#A8E6CE]">{formatINR(row.closingBalance)}</td>
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
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-[#28443C] pb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#A8E6CE]" />
                <h3 className="text-base font-bold text-[#F5F7F5]">Tax Invoice · {selectedInvoiceForPdf.invoiceNumber}</h3>
              </div>
              <button
                onClick={() => setSelectedInvoiceForPdf(null)}
                className="p-1 rounded-lg text-[#718D83] hover:text-[#F5F7F5]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-[#0B1C19] border border-[#28443C] rounded-xl p-6 space-y-4 text-xs font-mono">
              <div className="flex justify-between border-b border-[#28443C] pb-4">
                <div>
                  <div className="text-sm font-bold text-[#A8E6CE]">{businessProfile?.businessName || 'FINSIGHT BUSINESS'}</div>
                  <div className="text-[11px] text-[#A7C1B8]">GSTIN: {businessProfile?.gstin || 'Not Set'}</div>
                  <div className="text-[11px] text-[#718D83]">{businessProfile?.address || 'India'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[#F5F7F5]">TAX INVOICE</div>
                  <div className="text-[11px] text-[#A7C1B8]">{selectedInvoiceForPdf.invoiceNumber}</div>
                  <div className="text-[11px] text-[#718D83]">Date: {selectedInvoiceForPdf.invoiceDate}</div>
                  <div className="text-[11px] text-[#718D83]">Due: {selectedInvoiceForPdf.dueDate}</div>
                </div>
              </div>

              <div className="flex justify-between py-2 border-b border-[#28443C]">
                <div>
                  <div className="text-[10px] text-[#718D83]">BILLED TO:</div>
                  <div className="font-bold text-[#F5F7F5]">{selectedInvoiceForPdf.clientName}</div>
                  {selectedInvoiceForPdf.clientGstin && (
                    <div className="text-[10px] text-[#A8E6CE]">GSTIN: {selectedInvoiceForPdf.clientGstin}</div>
                  )}
                  <div className="text-[10px] text-[#A7C1B8]">{selectedInvoiceForPdf.placeOfSupply}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#718D83]">PAYMENT STATUS:</div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedInvoiceForPdf.status === 'PAID' ? 'bg-[#55C99A]/20 text-[#55C99A]' : 'bg-[#E5B764]/20 text-[#E5B764]'
                  }`}>
                    {selectedInvoiceForPdf.status}
                  </span>
                </div>
              </div>

              <table className="w-full text-left">
                <thead className="text-[#718D83] border-b border-[#28443C]">
                  <tr>
                    <th className="py-2">Item Description</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-center">GST</th>
                    <th className="py-2 text-right">Rate</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#28443C]/40">
                  {selectedInvoiceForPdf.lineItems.map(item => (
                    <tr key={item.id}>
                      <td className="py-2.5 text-[#F5F7F5]">{item.description}</td>
                      <td className="py-2.5 text-center text-[#A7C1B8]">{item.quantity}</td>
                      <td className="py-2.5 text-center text-[#A7C1B8]">{item.taxRate}%</td>
                      <td className="py-2.5 text-right text-[#A7C1B8]">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 text-right text-[#F5F7F5]">₹{item.lineTotal.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-[#28443C] pt-3 space-y-1 text-right">
                <div className="flex justify-between text-[#A7C1B8]">
                  <span>Subtotal:</span>
                  <span>{formatINR(selectedInvoiceForPdf.subtotal)}</span>
                </div>
                {selectedInvoiceForPdf.cgst > 0 && (
                  <div className="flex justify-between text-[#A7C1B8]">
                    <span>CGST:</span>
                    <span>{formatINR(selectedInvoiceForPdf.cgst)}</span>
                  </div>
                )}
                {selectedInvoiceForPdf.sgst > 0 && (
                  <div className="flex justify-between text-[#A7C1B8]">
                    <span>SGST:</span>
                    <span>{formatINR(selectedInvoiceForPdf.sgst)}</span>
                  </div>
                )}
                {selectedInvoiceForPdf.igst > 0 && (
                  <div className="flex justify-between text-[#A7C1B8]">
                    <span>IGST:</span>
                    <span>{formatINR(selectedInvoiceForPdf.igst)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-[#A8E6CE] border-t border-[#28443C] pt-2">
                  <span>Grand Total (INR):</span>
                  <span>{formatINR(selectedInvoiceForPdf.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-[#A7C1B8]">
                  <span>Balance Due:</span>
                  <span>{formatINR(selectedInvoiceForPdf.balanceDue)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedInvoiceForPdf(null)}
                className="rounded-xl border border-[#28443C] px-4 py-2 text-xs text-[#718D83]"
              >
                Close Preview
              </button>
              <button
                onClick={() => window.print()}
                className="rounded-xl border border-[#28443C] bg-[#16352E] px-4 py-2 text-xs font-semibold text-[#A8E6CE] flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print View</span>
              </button>
              <button
                onClick={() => handleDownloadInvoicePdf(selectedInvoiceForPdf)}
                disabled={isDownloadingPdfId === selectedInvoiceForPdf.id}
                className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19] flex items-center gap-1.5 hover:bg-[#72C8B0] disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F7F5]">Record Payment · {paymentModalInvoice.invoiceNumber}</h3>
            <p className="text-xs text-[#A7C1B8]">
              Outstanding balance: <strong className="text-[#E5B764]">{formatINR(paymentModalInvoice.balanceDue)}</strong>
            </p>
            <div>
              <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Payment Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                max={paymentModalInvoice.balanceDue}
                value={paymentAmountInput}
                onChange={e => setPaymentAmountInput(e.target.value)}
                className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="rounded-xl border border-[#28443C] px-4 py-2 text-xs text-[#718D83]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRecordPayment(paymentModalInvoice.id, parseFloat(paymentAmountInput) || 0)}
                className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Business Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F7F5]">Business Profile & Cash Balance</h3>
            <form onSubmit={handleSaveBusinessProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Registered Business Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Business GSTIN</label>
                  <input
                    type="text"
                    value={profileGstin}
                    onChange={e => setProfileGstin(e.target.value.toUpperCase())}
                    placeholder="29AAACF9876K1ZP"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">State GST Code</label>
                  <input
                    type="text"
                    value={profileStateCode}
                    onChange={e => setProfileStateCode(e.target.value)}
                    placeholder="29"
                    maxLength={2}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5] font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Registered Address</label>
                <input
                  type="text"
                  value={profileAddress}
                  onChange={e => setProfileAddress(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Opening Cash Balance (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={profileOpeningCash}
                  onChange={e => setProfileOpeningCash(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#28443C]">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="rounded-xl border border-[#28443C] px-4 py-2 text-xs text-[#718D83]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
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
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F7F5]">Log Business Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Expense Title</label>
                <input
                  type="text"
                  value={expName}
                  onChange={e => setExpName(e.target.value)}
                  placeholder="e.g. Cloud Hosting Subscription"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Category</label>
                  <select
                    value={expCategory}
                    onChange={e => setExpCategory(e.target.value as BusinessExpense['category'])}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  >
                    {['Rent', 'Salaries', 'Marketing', 'Utilities', 'Equipment', 'Travel', 'Software', 'Other'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={expAmount}
                    onChange={e => setExpAmount(e.target.value)}
                    placeholder="12500"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Vendor</label>
                  <input
                    type="text"
                    value={expVendor}
                    onChange={e => setExpVendor(e.target.value)}
                    placeholder="e.g. Google Cloud India"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={e => setExpDate(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Payment Method</label>
                <input
                  type="text"
                  value={expMethod}
                  onChange={e => setExpMethod(e.target.value)}
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Attach Receipt (PDF/PNG/JPG, Optional)</label>
                <label className="flex items-center gap-2 rounded-xl bg-[#0B1C19] border border-dashed border-[#28443C] px-3 py-2 text-xs text-[#A7C1B8] cursor-pointer hover:border-[#72C8B0]">
                  <Upload className="h-3.5 w-3.5 text-[#A8E6CE]" />
                  <span className="truncate">{expReceipt ? expReceipt.fileName : 'Choose receipt file...'}</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={e => handleReceiptFileChange(e.target.files?.[0])}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#28443C]">
                <button
                  type="button"
                  onClick={() => {
                    setShowExpenseModal(false);
                    setExpReceipt(null);
                  }}
                  className="rounded-xl border border-[#28443C] px-4 py-2 text-xs text-[#718D83]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
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
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F7F5]">Add Corporate Client</h3>
            <form onSubmit={handleAddClient} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Company / Business Name</label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Acme Tech Solutions Pvt Ltd"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Contact Person Name</label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="e.g. Priya Nair"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Email</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={e => setNewClientEmail(e.target.value)}
                    placeholder="finance@acme.in"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Phone</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={e => setNewClientPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">GSTIN Number (Optional, 15 chars)</label>
                <input
                  type="text"
                  value={newClientGstin}
                  onChange={e => setNewClientGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 29AABCC1234D1Z5"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Billing Address</label>
                <input
                  type="text"
                  value={newClientAddress}
                  onChange={e => setNewClientAddress(e.target.value)}
                  placeholder="e.g. Whitefield, Bangalore, Karnataka"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#28443C]">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="rounded-xl border border-[#28443C] px-4 py-2 text-xs text-[#718D83]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
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
