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
} from 'lucide-react';
import { Holding, Portfolio } from '../../types';
import { formatINR } from '../../utils/financialMath';
import { apiFetch, parseApiResponse } from '../../utils/api';

interface InvestmentsModuleProps {
  subview: 'overview' | 'portfolio' | 'learn';
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

export const InvestmentsModule: React.FC<InvestmentsModuleProps> = ({
  subview,
  onNavigate,
  onOpenAI,
}) => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('ALL');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDesc, setNewPortfolioDesc] = useState('');
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [symbol, setSymbol] = useState('NIFTYBEES');
  const [name, setName] = useState('Nippon India Nifty 50 ETF');
  const [assetType, setAssetType] = useState<Holding['assetType']>('Index Funds');
  const [quantity, setQuantity] = useState('100');
  const [purchasePrice, setPurchasePrice] = useState('250.00');
  const [currentPrice, setCurrentPrice] = useState('272.50');
  const [holdingPortfolioId, setHoldingPortfolioId] = useState('');

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
      const [pRes, hRes] = await Promise.all([
        apiFetch('/api/v1/portfolios'),
        apiFetch('/api/v1/holdings'),
      ]);
      const [pJson, hJson] = await Promise.all([pRes.json(), hRes.json()]);
      if (pJson.success) {
        const list = (pJson.data || []) as Portfolio[];
        setPortfolios(list);
        if (list.length > 0 && !holdingPortfolioId) {
          setHoldingPortfolioId(list[0].id);
        }
      }
      if (hJson.success) setHoldings(hJson.data || []);
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
    } else {
      setErrorMsg(json?.error?.message || 'Failed to save holding.');
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
          question: 'Analyze my portfolio diversification, concentration risk, and unrealized gain/loss with 3 educational suggestions.',
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
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#28443C] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7F5] tracking-tight">
            Investment & Portfolio Guide
          </h1>
          <p className="text-xs text-[#A7C1B8] mt-1">
            Track multi-portfolio holdings, asset allocation, and SIP compounding fundamentals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('/app/investments/learn')}
            className="flex items-center gap-1.5 rounded-lg border border-[#28443C] bg-[#102722] px-3.5 py-2 text-xs font-semibold text-[#A8E6CE] hover:bg-[#16352E] transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Investment Learning</span>
          </button>
          <button
            onClick={() => setShowPortfolioModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#28443C] bg-[#16352E] px-3.5 py-2 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Portfolio</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 rounded-lg bg-[#A8E6CE] px-3.5 py-2 text-xs font-semibold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Holding</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#28443C] pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('/app/investments')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
              subview !== 'learn' ? 'bg-[#16352E] text-[#A8E6CE] border border-[#28443C]' : 'text-[#A7C1B8]'
            }`}
          >
            My Portfolio
          </button>
          <button
            onClick={() => onNavigate('/app/investments/learn')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
              subview === 'learn' ? 'bg-[#16352E] text-[#A8E6CE] border border-[#28443C]' : 'text-[#A7C1B8]'
            }`}
          >
            Educational Concepts & SIP Calculator
          </button>
        </div>

        {subview !== 'learn' && portfolios.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#718D83]">Portfolio:</span>
            <select
              value={selectedPortfolioId}
              onChange={e => setSelectedPortfolioId(e.target.value)}
              className="rounded-lg bg-[#102722] border border-[#28443C] px-3 py-1.5 text-xs text-[#F5F7F5]"
            >
              <option value="ALL">All Portfolios ({portfolios.length})</option>
              {portfolios.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {subview !== 'learn' ? (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Estimated Portfolio Value</span>
              <div className="text-2xl font-bold text-[#F5F7F5] tabular-nums">{formatINR(totalCurrent)}</div>
              <span className="text-[11px] text-[#55C99A]">Tracked as of {todayLabel}</span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Total Cost Basis</span>
              <div className="text-2xl font-bold text-[#F5F7F5] tabular-nums">{formatINR(totalInvested)}</div>
              <span className="text-[11px] text-[#718D83]">{filteredHoldings.length} tracked holding{filteredHoldings.length === 1 ? '' : 's'}</span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Unrealized Gain / Loss</span>
              <div className={`text-2xl font-bold tabular-nums ${unrealizedGain >= 0 ? 'text-[#55C99A]' : 'text-[#EB7676]'}`}>
                {formatINR(unrealizedGain)}
              </div>
              <span className={`text-[11px] ${unrealizedGain >= 0 ? 'text-[#55C99A]' : 'text-[#EB7676]'}`}>
                {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}% total return
              </span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Dominant Asset Class</span>
              <div className="text-2xl font-bold text-[#A8E6CE]">{dominantAssetClass}</div>
              <span className="text-[11px] text-[#718D83]">
                {filteredHoldings.length > 0 ? `${dominantSharePct}% of portfolio value` : 'Add holdings to analyze mix'}
              </span>
            </div>
          </div>

          {/* Holdings Table */}
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] overflow-x-auto">
            <div className="p-4 border-b border-[#28443C] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Current Holdings</h3>
              <button onClick={handleOpenAdd} className="text-xs text-[#A8E6CE] hover:underline">
                + Add Holding
              </button>
            </div>
            {filteredHoldings.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs text-[#718D83]">
                  No holdings recorded in this portfolio yet. Add an ETF, stock, mutual fund, or fixed deposit to track cost basis and allocation.
                </p>
                <button
                  onClick={handleOpenAdd}
                  className="rounded-lg bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
                >
                  Add First Holding
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16352E]/40 border-b border-[#28443C] text-[#718D83]">
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
                <tbody className="divide-y divide-[#28443C]/40">
                  {filteredHoldings.map(h => {
                    const val = h.quantity * h.currentPrice;
                    const cost = h.quantity * h.purchasePrice;
                    const gain = val - cost;
                    const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
                    return (
                      <tr key={h.id} className="hover:bg-[#16352E]/20 transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#F5F7F5]">
                          <div>{h.instrumentSymbol}</div>
                          <div className="text-[10px] text-[#718D83]">{h.instrumentName}</div>
                        </td>
                        <td className="py-3 px-4 text-[#A7C1B8]">{h.assetType}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#F5F7F5]">{h.quantity}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#718D83]">₹{h.purchasePrice.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#F5F7F5]">₹{h.currentPrice.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#F5F7F5]">{formatINR(val)}</td>
                        <td className={`py-3 px-4 text-right font-semibold tabular-nums ${gain >= 0 ? 'text-[#55C99A]' : 'text-[#EB7676]'}`}>
                          {gain >= 0 ? '+' : ''}{formatINR(gain)} ({gainPct.toFixed(1)}%)
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(h)}
                              className="p-1 rounded text-[#718D83] hover:text-[#A8E6CE] hover:bg-[#16352E]"
                              title="Edit Holding"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteHolding(h.id)}
                              className="p-1 rounded text-[#718D83] hover:text-[#EB7676] hover:bg-[#EB7676]/10"
                              title="Delete Holding"
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
            )}
          </div>

          {aiRiskBrief && (
            <div className="p-4 rounded-xl bg-[#102722] border border-[#A8E6CE]/40 space-y-2">
              <div className="text-xs font-bold text-[#A8E6CE]">Gemini 4 Hydrogen Portfolio Analysis</div>
              <div className="text-xs text-[#F5F7F5] whitespace-pre-wrap leading-relaxed">{aiRiskBrief}</div>
            </div>
          )}

          {aiRiskError && (
            <div className="p-3 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{aiRiskError}</span>
            </div>
          )}

          <div className="p-4 rounded-xl border border-[#28443C] bg-[#16352E]/30 text-xs text-[#718D83] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#A8E6CE] shrink-0" />
              <span>Investment portfolio values are for educational tracking and do not constitute certified valuations.</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleRequestRiskInsight}
                disabled={aiRiskLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#16352E] border border-[#28443C] px-3 py-1.5 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0]"
              >
                {aiRiskLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>{aiRiskLoading ? 'Analyzing...' : 'AI Portfolio Risk Brief'}</span>
              </button>
              <button onClick={onOpenAI} className="text-xs font-semibold text-[#A8E6CE] hover:underline">
                Open Chat →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* SUBVIEW: LEARN & CALCULATORS */
        <div className="space-y-8 max-w-5xl">
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-[#28443C] pb-3">
              <Calculator className="h-5 w-5 text-[#A8E6CE]" />
              <div>
                <h3 className="text-base font-bold text-[#F5F7F5]">Interactive SIP Compounding Calculator</h3>
                <p className="text-xs text-[#718D83]">Illustrative growth for Systematic Investment Plans in broad equity funds.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-[#A7C1B8] mb-1">
                    <span>Monthly Investment</span>
                    <span className="font-bold text-[#F5F7F5]">{formatINR(sipMonthly)}</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="100000"
                    step="1000"
                    value={sipMonthly}
                    onChange={e => setSipMonthly(parseInt(e.target.value, 10))}
                    className="w-full accent-[#A8E6CE]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[#A7C1B8] mb-1">
                    <span>Expected Annual Return (%)</span>
                    <span className="font-bold text-[#F5F7F5]">{sipRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="20"
                    step="0.5"
                    value={sipRate}
                    onChange={e => setSipRate(parseFloat(e.target.value))}
                    className="w-full accent-[#A8E6CE]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[#A7C1B8] mb-1">
                    <span>Time Horizon (Years)</span>
                    <span className="font-bold text-[#F5F7F5]">{sipYears} Years</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={sipYears}
                    onChange={e => setSipYears(parseInt(e.target.value, 10))}
                    className="w-full accent-[#A8E6CE]"
                  />
                </div>
              </div>

              <div className="md:col-span-2 rounded-xl bg-[#0B1C19] border border-[#28443C] p-6 flex flex-col justify-between">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-[11px] text-[#718D83]">Invested Capital</div>
                    <div className="text-lg font-bold text-[#F5F7F5] mt-1 tabular-nums">{formatINR(sipTotalInvested)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#718D83]">Estimated Returns</div>
                    <div className="text-lg font-bold text-[#55C99A] mt-1 tabular-nums">+{formatINR(sipEstimatedReturns)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#718D83]">Future Corpus</div>
                    <div className="text-xl font-extrabold text-[#A8E6CE] mt-1 tabular-nums">{formatINR(sipFutureValue)}</div>
                  </div>
                </div>

                <div className="mt-6 text-[10px] text-[#718D83] text-center border-t border-[#28443C] pt-3">
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
              <div key={idx} className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F5F7F5]">{c.title}</span>
                  <span className="text-[10px] text-[#A8E6CE] border border-[#28443C] px-2 py-0.5 rounded-full">{c.level}</span>
                </div>
                <p className="text-xs text-[#A7C1B8] leading-relaxed">{c.desc}</p>
                <button
                  onClick={onOpenAI}
                  className="text-[11px] font-semibold text-[#A8E6CE] hover:underline pt-1 inline-block"
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F7F5]">
              {editingHoldingId ? 'Edit Portfolio Holding' : 'Add Portfolio Holding'}
            </h3>
            <form onSubmit={handleAddHolding} className="space-y-3">
              {portfolios.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Target Portfolio</label>
                  <select
                    value={holdingPortfolioId || portfolios[0]?.id}
                    onChange={e => setHoldingPortfolioId(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  >
                    {portfolios.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Symbol</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={e => setSymbol(e.target.value)}
                  placeholder="e.g. NIFTYBEES"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Instrument Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Nippon India Nifty 50 ETF"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Asset Class</label>
                  <select
                    value={assetType}
                    onChange={e => setAssetType(e.target.value as Holding['assetType'])}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
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
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Avg Purchase Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Current Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={currentPrice}
                    onChange={e => setCurrentPrice(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
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
                  {editingHoldingId ? 'Update Holding' : 'Save Holding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Portfolio Modal */}
      {showPortfolioModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[#F5F7F5]">Create Investment Portfolio</h3>
            <form onSubmit={handleCreatePortfolio} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Portfolio Name</label>
                <input
                  type="text"
                  value={newPortfolioName}
                  onChange={e => setNewPortfolioName(e.target.value)}
                  placeholder="e.g. Retirement Long-Term Equity"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newPortfolioDesc}
                  onChange={e => setNewPortfolioDesc(e.target.value)}
                  placeholder="Core index funds and sovereign bonds"
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#28443C]">
                <button
                  type="button"
                  onClick={() => setShowPortfolioModal(false)}
                  className="rounded-xl border border-[#28443C] px-4 py-2 text-xs text-[#718D83]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
                >
                  Create Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
