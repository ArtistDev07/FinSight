import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  BookOpen,
  ShieldCheck,
  Calculator,
  Edit3,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
  Activity,
  NotebookPen,
} from 'lucide-react';
import { Holding, InvestmentJournalEntry, Portfolio } from '../../types';
import { formatINR } from '../../utils/financialMath';
import { apiFetch, parseApiResponse } from '../../utils/api';
import { AllocationRingChart } from '../../components/charts/FinSightCharts';
import { EmptyStateCard } from '../../components/brand/FinSightArtwork';

interface InvestmentsModuleProps {
  subview: 'overview' | 'portfolio' | 'learn';
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

interface PortfolioRiskData {
  totalValue: number;
  totalCost: number;
  topHoldingConcentrationPct: number;
  topAssetClass: string;
  topAssetClassPct: number;
  estimatedAnnualVolatilityPct: number;
  estimatedMaxDrawdownPct: number;
  tenPctShockImpact: number;
  shockedPortfolioValue: number;
  classBreakdown: Array<{ assetClass: string; value: number; pct: number }>;
}

const SLICE_COLORS = ['#168366', '#123D32', '#477EAD', '#C48A32', '#21845D', '#7BB9DC'];

export const InvestmentsModule: React.FC<InvestmentsModuleProps> = ({
  subview,
  onNavigate,
  onOpenAI,
}) => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('ALL');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [riskData, setRiskData] = useState<PortfolioRiskData | null>(null);
  const [journalEntries, setJournalEntries] = useState<InvestmentJournalEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDesc, setNewPortfolioDesc] = useState('');
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Holding Form states
  const [symbol, setSymbol] = useState('NIFTYBEES');
  const [name, setName] = useState('Nippon India Nifty 50 ETF');
  const [assetType, setAssetType] = useState<Holding['assetType']>('Index Funds');
  const [quantity, setQuantity] = useState('100');
  const [purchasePrice, setPurchasePrice] = useState('250.00');
  const [currentPrice, setCurrentPrice] = useState('272.50');
  const [holdingPortfolioId, setHoldingPortfolioId] = useState('');

  // Journal Form states
  const [jName, setJName] = useState('');
  const [jReason, setJReason] = useState('');
  const [jHorizon, setJHorizon] = useState('3–5 Years');
  const [jRisks, setJRisks] = useState('');
  const [jNotes, setJNotes] = useState('');
  const [jReviewDate, setJReviewDate] = useState(() =>
    new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
  );

  // SIP Calculator State
  const [sipMonthly, setSipMonthly] = useState(15000);
  const [sipRate, setSipRate] = useState(12);
  const [sipYears, setSipYears] = useState(10);

  // AI Portfolio Risk Brief
  const [aiRiskBrief, setAiRiskBrief] = useState<string | null>(null);
  const [aiRiskError, setAiRiskError] = useState<string | null>(null);
  const [aiRiskLoading, setAiRiskLoading] = useState(false);

  const loadPortfolioData = useCallback(async () => {
    try {
      const [pRes, hRes, rRes, jRes] = await Promise.all([
        apiFetch('/api/v1/portfolios'),
        apiFetch('/api/v1/holdings'),
        apiFetch('/api/v1/investments/risk'),
        apiFetch('/api/v1/investments/journal'),
      ]);
      const [pJson, hJson, rJson, jJson] = await Promise.all([
        pRes.json(),
        hRes.json(),
        rRes.json(),
        jRes.json(),
      ]);
      if (pJson.success) {
        const list = (pJson.data || []) as Portfolio[];
        setPortfolios(list);
        if (list.length > 0 && !holdingPortfolioId) {
          setHoldingPortfolioId(list[0].id);
        }
      }
      if (hJson.success) setHoldings(hJson.data || []);
      if (rJson.success && rJson.data) setRiskData(rJson.data);
      if (jJson.success && Array.isArray(jJson.data)) setJournalEntries(jJson.data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load portfolio data.');
    }
  }, [holdingPortfolioId]);

  useEffect(() => {
    loadPortfolioData();
  }, [loadPortfolioData]);

  const handleOpenAdd = () => {
    setEditingHoldingId(null);
    setSymbol('NIFTYBEES');
    setName('Nippon India Nifty 50 ETF');
    setAssetType('Index Funds');
    setQuantity('100');
    setPurchasePrice('250.00');
    setCurrentPrice('272.50');
    if (selectedPortfolioId !== 'ALL') {
      setHoldingPortfolioId(selectedPortfolioId);
    } else if (portfolios[0]) {
      setHoldingPortfolioId(portfolios[0].id);
    }
    setShowAddModal(true);
  };

  const handleOpenEdit = (h: Holding) => {
    setEditingHoldingId(h.id);
    setSymbol(h.instrumentSymbol);
    setName(h.instrumentName);
    setAssetType(h.assetType);
    setQuantity(h.quantity.toString());
    setPurchasePrice(h.purchasePrice.toString());
    setCurrentPrice(h.currentPrice.toString());
    setHoldingPortfolioId(h.portfolioId);
    setShowAddModal(true);
  };

  const handleDeleteHolding = async (id: string) => {
    const res = await apiFetch(`/api/v1/holdings/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (res.ok && json.success) {
      setHoldings(prev => prev.filter(h => h.id !== id));
      apiFetch('/api/v1/investments/risk')
        .then(r => r.json())
        .then(r => r.success && r.data && setRiskData(r.data))
        .catch(() => undefined);
    }
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;
    const res = await apiFetch('/api/v1/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newPortfolioName.trim(),
        description: newPortfolioDesc.trim() || undefined,
      }),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      setPortfolios(prev => [...prev, json.data]);
      setSelectedPortfolioId(json.data.id);
      setHoldingPortfolioId(json.data.id);
      setShowPortfolioModal(false);
      setNewPortfolioName('');
      setNewPortfolioDesc('');
    } else {
      setErrorMsg(json?.error?.message || 'Unable to create portfolio.');
    }
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const payload = {
      portfolioId: holdingPortfolioId || portfolios[0]?.id,
      instrumentSymbol: symbol.trim().toUpperCase(),
      instrumentName: name.trim(),
      assetType,
      quantity: parseFloat(quantity),
      purchasePrice: parseFloat(purchasePrice),
      currentPrice: parseFloat(currentPrice) || parseFloat(purchasePrice),
    };

    const url = editingHoldingId ? `/api/v1/holdings/${editingHoldingId}` : '/api/v1/holdings';
    const method = editingHoldingId ? 'PUT' : 'POST';

    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      if (editingHoldingId) {
        setHoldings(prev => prev.map(h => (h.id === editingHoldingId ? json.data : h)));
      } else {
        setHoldings(prev => [...prev, json.data]);
      }
      setShowAddModal(false);
      setEditingHoldingId(null);
      apiFetch('/api/v1/investments/risk')
        .then(r => r.json())
        .then(r => r.success && r.data && setRiskData(r.data))
        .catch(() => undefined);
    } else {
      setErrorMsg(json?.error?.message || 'Failed to save holding.');
    }
  };

  const handleCreateJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jName.trim() || !jReason.trim()) return;
    setErrorMsg(null);
    const res = await apiFetch('/api/v1/investments/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        investmentName: jName.trim(),
        reasonForResearch: jReason.trim(),
        expectedHoldingPeriod: jHorizon.trim(),
        risksConsidered: jRisks.trim(),
        userNotes: jNotes.trim(),
        reviewDate: jReviewDate,
      }),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      setJournalEntries(prev => [json.data, ...prev]);
      setShowJournalModal(false);
      setJName('');
      setJReason('');
      setJRisks('');
      setJNotes('');
    } else {
      setErrorMsg(json?.error?.message || 'Unable to save journal entry.');
    }
  };

  const handleDeleteJournalEntry = async (id: string) => {
    const res = await apiFetch(`/api/v1/investments/journal/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setJournalEntries(prev => prev.filter(j => j.id !== id));
    }
  };

  const handleRequestRiskInsight = async () => {
    setAiRiskLoading(true);
    setAiRiskError(null);
    try {
      const res = await apiFetch('/api/v1/ai/module-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'Investment Portfolio & Asset Allocation',
          question:
            'Analyze my portfolio diversification, concentration risk, and unrealized gain/loss with 3 educational suggestions.',
        }),
      });
      const parsed = await parseApiResponse<{ success: boolean; data?: { insight?: string } }>(res);
      if (!parsed.ok || !parsed.json?.data?.insight) {
        throw new Error(parsed.errorMessage || 'Gemini AI portfolio analysis unavailable.');
      }
      setAiRiskBrief(parsed.json.data.insight);
    } catch (err) {
      setAiRiskError(err instanceof Error ? err.message : 'Unable to generate portfolio risk insight.');
    } finally {
      setAiRiskLoading(false);
    }
  };

  const filteredHoldings =
    selectedPortfolioId === 'ALL'
      ? holdings
      : holdings.filter(h => h.portfolioId === selectedPortfolioId);

  let totalInvested = 0;
  let totalCurrent = 0;
  const allocationByClass = new Map<string, number>();

  filteredHoldings.forEach(h => {
    const cost = h.quantity * h.purchasePrice;
    const val = h.quantity * h.currentPrice;
    totalInvested += cost;
    totalCurrent += val;
    allocationByClass.set(h.assetType, (allocationByClass.get(h.assetType) || 0) + val);
  });

  const unrealizedGain = totalCurrent - totalInvested;
  const returnPct = totalInvested > 0 ? (unrealizedGain / totalInvested) * 100 : 0;

  let dominantAssetClass = 'None yet';
  let dominantSharePct = 0;
  let maxClassVal = 0;
  for (const [cls, val] of allocationByClass.entries()) {
    if (val > maxClassVal) {
      maxClassVal = val;
      dominantAssetClass = cls;
      dominantSharePct = totalCurrent > 0 ? Math.round((val / totalCurrent) * 100) : 0;
    }
  }

  const allocationSlices = Array.from(allocationByClass.entries()).map(([label, value], idx) => ({
    label,
    value,
    color: SLICE_COLORS[idx % SLICE_COLORS.length],
  }));

  // SIP Future Value
  const i = sipRate / 100 / 12;
  const n = sipYears * 12;
  const sipTotalInvested = sipMonthly * n;
  const sipFutureValue = Math.round(sipMonthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i));
  const sipEstimatedReturns = sipFutureValue - sipTotalInvested;

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--fs-border)] pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--fs-accent)]">
            Asset Allocation · Risk Analytics · Decision Journal
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--fs-text)] tracking-tight mt-1">
            Investment &amp; Portfolio Guide
          </h1>
          <p className="text-xs text-[var(--fs-text-body)] mt-1">
            Track multi-portfolio holdings, concentration risk, research theses, and SIP compounding fundamentals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('/app/investments/learn')}
            className="fs-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs"
          >
            <BookOpen className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
            <span>Investment Learning</span>
          </button>
          <button
            onClick={() => setShowPortfolioModal(true)}
            className="fs-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
            <span>New Portfolio</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="fs-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Holding</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/30 text-xs text-[var(--fs-danger)] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--fs-border)] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/app/investments')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              subview !== 'learn'
                ? 'bg-[var(--fs-surface-secondary)] text-[var(--fs-text)] border border-[var(--fs-border)]'
                : 'text-[var(--fs-text-body)] hover:text-[var(--fs-text)]'
            }`}
          >
            My Portfolio &amp; Risk
          </button>
          <button
            onClick={() => onNavigate('/app/investments/learn')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              subview === 'learn'
                ? 'bg-[var(--fs-surface-secondary)] text-[var(--fs-text)] border border-[var(--fs-border)]'
                : 'text-[var(--fs-text-body)] hover:text-[var(--fs-text)]'
            }`}
          >
            Educational Concepts &amp; SIP Calculator
          </button>
        </div>

        {subview !== 'learn' && portfolios.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="portfolio-select" className="text-[var(--fs-text-muted)]">
              Portfolio:
            </label>
            <select
              id="portfolio-select"
              value={selectedPortfolioId}
              onChange={e => setSelectedPortfolioId(e.target.value)}
              className="fs-input w-auto py-1.5"
            >
              <option value="ALL">All Portfolios ({portfolios.length})</option>
              {portfolios.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {subview !== 'learn' ? (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Estimated Portfolio Value</span>
              <div className="text-2xl font-bold font-mono-num text-[var(--fs-text)] tabular-nums">
                {formatINR(totalCurrent)}
              </div>
              <span className="text-[11px] text-[var(--fs-success)]">Tracked as of {todayLabel}</span>
            </div>
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Total Cost Basis</span>
              <div className="text-2xl font-bold font-mono-num text-[var(--fs-text)] tabular-nums">
                {formatINR(totalInvested)}
              </div>
              <span className="text-[11px] text-[var(--fs-text-muted)]">
                {filteredHoldings.length} tracked holding{filteredHoldings.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Unrealized Gain / Loss</span>
              <div
                className={`text-2xl font-bold font-mono-num tabular-nums ${
                  unrealizedGain >= 0 ? 'text-[var(--fs-success)]' : 'text-[var(--fs-danger)]'
                }`}
              >
                {formatINR(unrealizedGain)}
              </div>
              <span
                className={`text-[11px] ${
                  unrealizedGain >= 0 ? 'text-[var(--fs-success)]' : 'text-[var(--fs-danger)]'
                }`}
              >
                {returnPct >= 0 ? '+' : ''}
                {returnPct.toFixed(1)}% total return
              </span>
            </div>
            <div className="fs-card p-5 space-y-1">
              <span className="text-xs text-[var(--fs-text-muted)]">Dominant Asset Class</span>
              <div className="text-2xl font-bold text-[var(--fs-accent)]">{dominantAssetClass}</div>
              <span className="text-[11px] text-[var(--fs-text-muted)]">
                {filteredHoldings.length > 0
                  ? `${dominantSharePct}% of portfolio value`
                  : 'Add holdings to analyze mix'}
              </span>
            </div>
          </div>

          {/* Allocation Chart + Deterministic Portfolio Risk Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 fs-card p-6 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--fs-text)]">Asset Allocation Mix</h3>
                <p className="text-xs text-[var(--fs-text-muted)] mt-0.5">
                  Weighting across equity, index funds, mutual funds, debt, and cash instruments.
                </p>
              </div>
              {allocationSlices.length > 0 ? (
                <AllocationRingChart
                  slices={allocationSlices}
                  centerLabel="Holdings"
                  centerValue={formatINR(totalCurrent)}
                />
              ) : (
                <div className="p-6 rounded-xl bg-[var(--fs-surface-secondary)] text-xs text-[var(--fs-text-muted)] text-center">
                  Add at least one holding to visualize asset allocation slices.
                </div>
              )}
            </div>

            <div className="lg:col-span-6 fs-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--fs-accent)]" />
                  <h3 className="text-sm font-bold text-[var(--fs-text)]">
                    Portfolio Risk &amp; Stress Simulation
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[var(--fs-text-muted)]">
                  Heuristic Volatility Model
                </span>
              </div>
              {riskData && riskData.totalValue > 0 ? (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)]">
                    <div className="text-[11px] text-[var(--fs-text-muted)]">Top Holding Weight</div>
                    <div className="font-mono-num text-base font-bold text-[var(--fs-text)] mt-1">
                      {riskData.topHoldingConcentrationPct.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-[var(--fs-text-muted)] mt-0.5">
                      {riskData.topHoldingConcentrationPct > 40
                        ? 'High single-asset concentration'
                        : 'Reasonable concentration'}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)]">
                    <div className="text-[11px] text-[var(--fs-text-muted)]">Est. Annual Volatility</div>
                    <div className="font-mono-num text-base font-bold text-[var(--fs-warning)] mt-1">
                      ±{riskData.estimatedAnnualVolatilityPct.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-[var(--fs-text-muted)] mt-0.5">
                      Est. max drawdown: -{riskData.estimatedMaxDrawdownPct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="col-span-2 p-3.5 rounded-xl bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] text-[var(--fs-text-muted)]">
                        10% Market Correction Shock Impact
                      </div>
                      <div className="text-xs font-semibold text-[var(--fs-text)] mt-0.5">
                        Projected value after 10% broad equity dip:{' '}
                        <span className="font-mono-num">{formatINR(riskData.shockedPortfolioValue)}</span>
                      </div>
                    </div>
                    <div className="font-mono-num text-sm font-bold text-[var(--fs-danger)] shrink-0">
                      -{formatINR(riskData.tenPctShockImpact)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-[var(--fs-surface-secondary)] text-xs text-[var(--fs-text-muted)] text-center">
                  Add portfolio holdings to calculate single-asset concentration, volatility bands, and 10% shock sensitivity.
                </div>
              )}
            </div>
          </div>

          {/* Holdings Table */}
          <div className="fs-card overflow-hidden">
            <div className="p-4 border-b border-[var(--fs-border)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--fs-text)]">Current Holdings</h3>
              <button
                onClick={handleOpenAdd}
                className="text-xs font-semibold text-[var(--fs-accent)] hover:underline"
              >
                + Add Holding
              </button>
            </div>
            {filteredHoldings.length === 0 ? (
              <div className="p-4">
                <EmptyStateCard
                  variant="portfolio"
                  title="No holdings recorded in this portfolio yet"
                  description="Add an ETF, Indian stock, mutual fund, bond, or fixed deposit to track cost basis, unrealized returns, and concentration risk."
                  actionLabel="Add First Holding"
                  onAction={handleOpenAdd}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--fs-surface-secondary)] border-b border-[var(--fs-border)] text-[var(--fs-text-muted)]">
                    <tr>
                      <th className="py-3 px-4 font-medium">Instrument</th>
                      <th className="py-3 px-4 font-medium">Asset Class</th>
                      <th className="py-3 px-4 font-medium text-right">Quantity</th>
                      <th className="py-3 px-4 font-medium text-right">Avg Purchase</th>
                      <th className="py-3 px-4 font-medium text-right">Current Price</th>
                      <th className="py-3 px-4 font-medium text-right">Est. Value</th>
                      <th className="py-3 px-4 font-medium text-right">Gain / Loss</th>
                      <th className="py-3 px-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--fs-border)]">
                    {filteredHoldings.map(h => {
                      const val = h.quantity * h.currentPrice;
                      const cost = h.quantity * h.purchasePrice;
                      const gain = val - cost;
                      const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
                      return (
                        <tr key={h.id} className="hover:bg-[var(--fs-surface-secondary)]/50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-[var(--fs-text)]">
                            <div>{h.instrumentSymbol}</div>
                            <div className="text-[10px] font-normal text-[var(--fs-text-muted)]">
                              {h.instrumentName}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[var(--fs-text-body)]">{h.assetType}</td>
                          <td className="py-3 px-4 text-right font-mono-num tabular-nums text-[var(--fs-text)]">
                            {h.quantity}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num tabular-nums text-[var(--fs-text-muted)]">
                            ₹{h.purchasePrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-num tabular-nums text-[var(--fs-text)]">
                            ₹{h.currentPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold font-mono-num tabular-nums text-[var(--fs-text)]">
                            {formatINR(val)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-semibold font-mono-num tabular-nums ${
                              gain >= 0 ? 'text-[var(--fs-success)]' : 'text-[var(--fs-danger)]'
                            }`}
                          >
                            {gain >= 0 ? '+' : ''}
                            {formatINR(gain)} ({gainPct.toFixed(1)}%)
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(h)}
                                aria-label={`Edit ${h.instrumentSymbol}`}
                                className="p-1.5 rounded-lg text-[var(--fs-text-muted)] hover:text-[var(--fs-accent)] hover:bg-[var(--fs-surface-secondary)]"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteHolding(h.id)}
                                aria-label={`Delete ${h.instrumentSymbol}`}
                                className="p-1.5 rounded-lg text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)] hover:bg-[var(--fs-danger)]/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Investment Decision Journal */}
          <div className="fs-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--fs-border)] pb-3">
              <div className="flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-[var(--fs-accent)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--fs-text)]">Investment Decision Journal</h3>
                  <p className="text-xs text-[var(--fs-text-muted)]">
                    Document why you researched an asset, expected holding period, and key risks before investing.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowJournalModal(true)}
                className="fs-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs self-start"
              >
                <Plus className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
                <span>Log Research Thesis</span>
              </button>
            </div>

            {journalEntries.length === 0 ? (
              <div className="p-5 rounded-xl bg-[var(--fs-surface-secondary)] text-xs text-[var(--fs-text-muted)]">
                No journal notes yet. Recording your thesis before buying prevents impulsive exits during market dips.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {journalEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="p-4 rounded-xl bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-[var(--fs-text)]">{entry.investmentName}</h4>
                        <span className="text-[10px] font-mono text-[var(--fs-accent)]">
                          Horizon: {entry.expectedHoldingPeriod} · Review: {entry.reviewDate}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteJournalEntry(entry.id)}
                        aria-label={`Delete journal ${entry.investmentName}`}
                        className="p-1 text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-[var(--fs-text-body)]">
                      <span className="font-semibold text-[var(--fs-text)]">Thesis: </span>
                      {entry.reasonForResearch}
                    </p>
                    {entry.risksConsidered && (
                      <p className="text-[11px] text-[var(--fs-text-muted)]">
                        <span className="font-semibold">Risks: </span>
                        {entry.risksConsidered}
                      </p>
                    )}
                    {entry.userNotes && (
                      <p className="text-[11px] text-[var(--fs-text-muted)] italic">{entry.userNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {aiRiskBrief && (
            <div className="fs-card p-5 border-[var(--fs-accent)]/40 space-y-2">
              <div className="text-xs font-bold text-[var(--fs-accent)]">
                Gemini Portfolio Educational Analysis
              </div>
              <div className="text-xs text-[var(--fs-text)] whitespace-pre-wrap leading-relaxed">
                {aiRiskBrief}
              </div>
            </div>
          )}

          {aiRiskError && (
            <div className="p-3 rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/30 text-xs text-[var(--fs-danger)] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{aiRiskError}</span>
            </div>
          )}

          <div className="fs-card-secondary p-4 text-xs text-[var(--fs-text-muted)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--fs-accent)] shrink-0" />
              <span>
                Investment portfolio values are for educational tracking and do not constitute certified valuations or SEBI investment advice.
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleRequestRiskInsight}
                disabled={aiRiskLoading}
                className="fs-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                {aiRiskLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--fs-accent)]" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-[var(--fs-accent)]" />
                )}
                <span>{aiRiskLoading ? 'Analyzing...' : 'AI Portfolio Risk Brief'}</span>
              </button>
              <button
                onClick={onOpenAI}
                className="text-xs font-semibold text-[var(--fs-accent)] hover:underline"
              >
                Open Chat →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* SUBVIEW: LEARN & CALCULATORS */
        <div className="space-y-8 max-w-5xl">
          <div className="fs-card p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-[var(--fs-border)] pb-3">
              <Calculator className="h-5 w-5 text-[var(--fs-accent)]" />
              <div>
                <h3 className="text-base font-bold text-[var(--fs-text)]">
                  Interactive SIP Compounding Calculator
                </h3>
                <p className="text-xs text-[var(--fs-text-muted)]">
                  Illustrative growth for Systematic Investment Plans in broad equity funds.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-[var(--fs-text-body)] mb-1">
                    <span>Monthly Investment</span>
                    <span className="font-bold font-mono-num text-[var(--fs-text)]">
                      {formatINR(sipMonthly)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="100000"
                    step="1000"
                    value={sipMonthly}
                    onChange={e => setSipMonthly(parseInt(e.target.value, 10))}
                    className="w-full accent-[var(--fs-accent)]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[var(--fs-text-body)] mb-1">
                    <span>Expected Annual Return (%)</span>
                    <span className="font-bold font-mono-num text-[var(--fs-text)]">{sipRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    step="0.5"
                    value={sipRate}
                    onChange={e => setSipRate(parseFloat(e.target.value))}
                    className="w-full accent-[var(--fs-accent)]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[var(--fs-text-body)] mb-1">
                    <span>Time Horizon (Years)</span>
                    <span className="font-bold font-mono-num text-[var(--fs-text)]">
                      {sipYears} Years
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={sipYears}
                    onChange={e => setSipYears(parseInt(e.target.value, 10))}
                    className="w-full accent-[var(--fs-accent)]"
                  />
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] p-6 flex flex-col justify-between">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-[11px] text-[var(--fs-text-muted)]">Invested Capital</div>
                    <div className="text-lg font-bold font-mono-num text-[var(--fs-text)] mt-1 tabular-nums">
                      {formatINR(sipTotalInvested)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--fs-text-muted)]">Estimated Returns</div>
                    <div className="text-lg font-bold font-mono-num text-[var(--fs-success)] mt-1 tabular-nums">
                      +{formatINR(sipEstimatedReturns)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[var(--fs-text-muted)]">Future Corpus</div>
                    <div className="text-xl font-extrabold font-mono-num text-[var(--fs-accent)] mt-1 tabular-nums">
                      {formatINR(sipFutureValue)}
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-[10px] text-[var(--fs-text-muted)] text-center border-t border-[var(--fs-border)] pt-3">
                  Disclaimer: Mutual fund investments are subject to market risks. Past performance does not guarantee future returns.
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: 'SIP Basics vs Lump Sum',
                desc: 'A Systematic Investment Plan averages out market volatility across cycles (Rupee Cost Averaging), eliminating the need to time entry points.',
                level: 'Beginner',
              },
              {
                title: 'Index Funds & Low Expense Ratios',
                desc: 'Nifty 50 and Sensex index funds passively mirror top Indian enterprises with expense ratios as low as 0.05% to 0.15%.',
                level: 'Beginner',
              },
              {
                title: 'Fixed Deposits & Inflation Drag',
                desc: 'While FDs offer guaranteed nominal capital safety, after-tax real returns often lag CPI inflation in India.',
                level: 'Intermediate',
              },
              {
                title: 'Asset Allocation Principle',
                desc: 'Balancing equity for inflation-beating growth with debt instruments for downside stability protects against steep market drawdowns.',
                level: 'Intermediate',
              },
            ].map((c, idx) => (
              <div key={idx} className="fs-card p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--fs-text)]">{c.title}</span>
                  <span className="text-[10px] text-[var(--fs-accent)] border border-[var(--fs-border)] bg-[var(--fs-surface-secondary)] px-2 py-0.5 rounded-full">
                    {c.level}
                  </span>
                </div>
                <p className="text-xs text-[var(--fs-text-body)] leading-relaxed">{c.desc}</p>
                <button
                  onClick={onOpenAI}
                  className="text-[11px] font-semibold text-[var(--fs-accent)] hover:underline pt-1 inline-block"
                >
                  Ask FinSight AI to explain further →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Holding Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md fs-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--fs-text)]">
              {editingHoldingId ? 'Edit Portfolio Holding' : 'Add Portfolio Holding'}
            </h3>
            <form onSubmit={handleAddHolding} className="space-y-3">
              {portfolios.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                    Target Portfolio
                  </label>
                  <select
                    value={holdingPortfolioId || portfolios[0]?.id}
                    onChange={e => setHoldingPortfolioId(e.target.value)}
                    className="fs-input"
                  >
                    {portfolios.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">Symbol</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  placeholder="e.g. NIFTYBEES"
                  className="fs-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Instrument Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Nippon India Nifty 50 ETF"
                  className="fs-input"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                    Asset Class
                  </label>
                  <select
                    value={assetType}
                    onChange={e => setAssetType(e.target.value as Holding['assetType'])}
                    className="fs-input"
                  >
                    <option value="Index Funds">Index Funds</option>
                    <option value="Equity">Equity</option>
                    <option value="Mutual Funds">Mutual Funds</option>
                    <option value="Fixed Deposits">Fixed Deposits</option>
                    <option value="ETFs">ETFs</option>
                    <option value="Bonds">Bonds</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="fs-input font-mono-num"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                    Avg Purchase Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(e.target.value)}
                    className="fs-input font-mono-num"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                    Current Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={currentPrice}
                    onChange={e => setCurrentPrice(e.target.value)}
                    className="fs-input font-mono-num"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--fs-border)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="fs-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="fs-btn-primary px-4 py-2 text-xs">
                  {editingHoldingId ? 'Update Holding' : 'Save Holding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Portfolio Modal */}
      {showPortfolioModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md fs-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--fs-text)]">Create Investment Portfolio</h3>
            <form onSubmit={handleCreatePortfolio} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Portfolio Name
                </label>
                <input
                  type="text"
                  value={newPortfolioName}
                  onChange={e => setNewPortfolioName(e.target.value)}
                  placeholder="e.g. Retirement Long-Term Equity"
                  className="fs-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newPortfolioDesc}
                  onChange={e => setNewPortfolioDesc(e.target.value)}
                  placeholder="Core index funds and sovereign bonds"
                  className="fs-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--fs-border)]">
                <button
                  type="button"
                  onClick={() => setShowPortfolioModal(false)}
                  className="fs-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="fs-btn-primary px-4 py-2 text-xs">
                  Create Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decision Journal Modal */}
      {showJournalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md fs-card p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--fs-text)]">Log Investment Research Thesis</h3>
            <form onSubmit={handleCreateJournalEntry} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Asset / Fund Name
                </label>
                <input
                  type="text"
                  value={jName}
                  onChange={e => setJName(e.target.value)}
                  placeholder="e.g. Nifty 50 Index Direct Growth"
                  className="fs-input"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Why I Researched This Asset
                </label>
                <textarea
                  rows={2}
                  value={jReason}
                  onChange={e => setJReason(e.target.value)}
                  placeholder="Low expense ratio core equity exposure for long-term compounding"
                  className="fs-input"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                    Expected Holding Period
                  </label>
                  <input
                    type="text"
                    value={jHorizon}
                    onChange={e => setJHorizon(e.target.value)}
                    placeholder="5+ Years"
                    className="fs-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                    Next Review Date
                  </label>
                  <input
                    type="date"
                    value={jReviewDate}
                    onChange={e => setJReviewDate(e.target.value)}
                    className="fs-input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Risks Considered
                </label>
                <input
                  type="text"
                  value={jRisks}
                  onChange={e => setJRisks(e.target.value)}
                  placeholder="Short-term equity drawdown of 15–25%"
                  className="fs-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--fs-text-body)] mb-1">
                  Personal Notes
                </label>
                <input
                  type="text"
                  value={jNotes}
                  onChange={e => setJNotes(e.target.value)}
                  placeholder="Rebalance annually if weight > 50%"
                  className="fs-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--fs-border)]">
                <button
                  type="button"
                  onClick={() => setShowJournalModal(false)}
                  className="fs-btn-secondary px-4 py-2 text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="fs-btn-primary px-4 py-2 text-xs">
                  Save Thesis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
