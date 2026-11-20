import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Star,
  BarChart2,
  Trash2,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { MarketInstrument, MarketCandle, BacktestRecord, PaperTrade, WatchlistItem } from '../../types';
import { formatINR } from '../../utils/financialMath';
import { apiFetch, parseApiResponse } from '../../utils/api';

interface MarketsModuleProps {
  subview: 'overview' | 'watchlist' | 'backtest' | 'paper-trading';
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
}

interface WatchlistEntry extends WatchlistItem {
  instrument: MarketInstrument | null;
}

export const MarketsModule: React.FC<MarketsModuleProps> = ({
  subview,
  onNavigate,
  onOpenAI,
}) => {
  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [marketMeta, setMarketMeta] = useState<{ liveProviderConfigured: boolean; archiveCutoffDate: string } | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [backtests, setBacktests] = useState<BacktestRecord[]>([]);
  const [paperAccount, setPaperAccount] = useState<{
    availableVirtualBalance: number;
    simulatedPortfolioValue: number;
    positions?: Record<string, { quantity: number; avgPrice: number }>;
  }>({ availableVirtualBalance: 0, simulatedPortfolioValue: 0 });
  const [paperTrades, setPaperTrades] = useState<PaperTrade[]>([]);

  // Historical OHLCV Drawer
  const [historySymbol, setHistorySymbol] = useState<string | null>(null);
  const [historyCandles, setHistoryCandles] = useState<MarketCandle[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyAiInsight, setHistoryAiInsight] = useState<string | null>(null);
  const [historyAiError, setHistoryAiError] = useState<string | null>(null);
  const [historyAiLoading, setHistoryAiLoading] = useState(false);

  // Backtest form
  const [btName, setBtName] = useState('Nifty Moving Average Strategy');
  const [btSymbol, setBtSymbol] = useState('NIFTY 50');
  const [btCapital, setBtCapital] = useState('500000');
  const [btStrategy, setBtStrategy] = useState<BacktestRecord['strategyType']>('Moving Average Crossover');
  const [btStopLoss, setBtStopLoss] = useState('3.5');
  const [btTarget, setBtTarget] = useState('8.0');
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  // Paper Trade Form
  const [ptSymbol, setPtSymbol] = useState('NIFTY 50');
  const [ptAction, setPtAction] = useState<'BUY' | 'SELL'>('BUY');
  const [ptQuantity, setPtQuantity] = useState('10');
  const [ptPrice, setPtPrice] = useState('24350');
  const [tradeStatus, setTradeStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadMarketWorkspace = useCallback(async () => {
    const [instRes, wlRes, btRes, ptRes] = await Promise.all([
      apiFetch('/api/v1/markets/instruments'),
      apiFetch('/api/v1/watchlist'),
      apiFetch('/api/v1/backtests'),
      apiFetch('/api/v1/paper-trading/account'),
    ]);
    const [instJson, wlJson, btJson, ptJson] = await Promise.all([
      instRes.json(),
      wlRes.json(),
      btRes.json(),
      ptRes.json(),
    ]);
    if (instJson.success) {
      setInstruments(instJson.data || []);
      if (instJson.meta) setMarketMeta(instJson.meta);
    }
    if (wlJson.success) setWatchlist(wlJson.data || []);
    if (btJson.success) setBacktests(btJson.data || []);
    if (ptJson.success && ptJson.data) {
      setPaperAccount(ptJson.data.account);
      setPaperTrades(ptJson.data.trades || []);
    }
  }, []);

  useEffect(() => {
    loadMarketWorkspace();
  }, [loadMarketWorkspace]);

  const isStarred = (symbol: string) => watchlist.some(w => w.symbol === symbol);

  const handleToggleWatchlist = async (symbol: string) => {
    if (isStarred(symbol)) {
      const res = await apiFetch(`/api/v1/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
      if (res.ok) {
        setWatchlist(prev => prev.filter(w => w.symbol !== symbol));
      }
    } else {
      const res = await apiFetch('/api/v1/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setWatchlist(prev => [...prev.filter(w => w.symbol !== symbol), json.data]);
      }
    }
  };

  const handleOpenHistory = async (symbol: string) => {
    setHistorySymbol(symbol);
    setHistoryCandles([]);
    setHistoryAiInsight(null);
    setHistoryAiError(null);
    setHistoryLoading(true);
    try {
      const res = await apiFetch(`/api/v1/markets/history/${encodeURIComponent(symbol)}?days=60`);
      const json = await res.json();
      if (res.ok && json.success) {
        setHistoryCandles(json.data.candles || []);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleExplainSymbolWithAi = async () => {
    if (!historySymbol) return;
    setHistoryAiLoading(true);
    setHistoryAiError(null);
    try {
      const res = await apiFetch('/api/v1/ai/module-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: `NSE Markets - ${historySymbol}`,
          question: `Provide an educational overview of ${historySymbol}, key risks to watch when backtesting strategies, and how it fits in a diversified Indian portfolio.`,
        }),
      });
      const parsed = await parseApiResponse<{ success: boolean; data?: { insight?: string } }>(res);
      if (!parsed.ok || !parsed.json?.data?.insight) {
        throw new Error(parsed.errorMessage || 'Gemini AI explanation unavailable.');
      }
      setHistoryAiInsight(parsed.json.data.insight);
    } catch (err) {
      setHistoryAiError(err instanceof Error ? err.message : 'Unable to fetch AI explanation.');
    } finally {
      setHistoryAiLoading(false);
    }
  };

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBacktesting(true);
    setBacktestError(null);

    try {
      const res = await apiFetch('/api/v1/backtests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyName: btName,
          symbol: btSymbol,
          startingCapital: parseFloat(btCapital),
          strategyType: btStrategy,
          stopLossPct: parseFloat(btStopLoss),
          targetPct: parseFloat(btTarget),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Backtest execution failed.');
      }
      setBacktests(prev => [json.data, ...prev]);
    } catch (err) {
      setBacktestError(err instanceof Error ? err.message : 'Unable to run backtest.');
    } finally {
      setIsBacktesting(false);
    }
  };

  const handleDeleteBacktest = async (id: string) => {
    const res = await apiFetch(`/api/v1/backtests/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setBacktests(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleSimulateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setTradeStatus(null);

    const res = await apiFetch('/api/v1/paper-trading/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: ptSymbol,
        action: ptAction,
        quantity: parseFloat(ptQuantity),
        simulatedPrice: parseFloat(ptPrice),
      }),
    });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      setPaperTrades(prev => [json.data.trade, ...prev]);
      setPaperAccount(json.data.account);
      setTradeStatus({
        ok: true,
        msg: `Simulated ${ptAction} order of ${ptQuantity} units of ${ptSymbol} executed at ₹${ptPrice}.`,
      });
    } else {
      setTradeStatus({
        ok: false,
        msg: json?.error?.message || 'Trade simulation rejected.',
      });
    }
  };

  const handleResetPaperAccount = async () => {
    setTradeStatus(null);
    const res = await apiFetch('/api/v1/paper-trading/reset', { method: 'POST' });
    const json = await res.json();
    if (res.ok && json.success && json.data) {
      setPaperAccount(json.data.account);
      setPaperTrades(json.data.trades || []);
      setTradeStatus({ ok: true, msg: json.message || 'Virtual paper trading account reset to ₹10,00,000.' });
    }
  };

  const displayedInstruments =
    subview === 'watchlist'
      ? instruments.filter(inst => isStarred(inst.symbol))
      : instruments;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#28443C] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7F5] tracking-tight">
            Trading & Market Insights
          </h1>
          <p className="text-xs text-[#A7C1B8] mt-1">
            Verified historical NSE OHLCV archive, quantitative strategy backtesting, and isolated paper trading.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl bg-[#16352E] border border-[#28443C] px-3.5 py-2 text-xs text-[#55C99A]">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>
            {marketMeta?.liveProviderConfigured
              ? 'External Market Data Connected · Paper Trading Simulator'
              : `Verified NSE Archive (${marketMeta?.archiveCutoffDate || 'Historical'}) · Paper Simulator Only`}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#28443C] pb-2 overflow-x-auto whitespace-nowrap">
        {[
          { label: 'Market Overview', path: '/app/markets', key: 'overview' },
          { label: `Watchlist (${watchlist.length})`, path: '/app/markets/watchlist', key: 'watchlist' },
          { label: 'Strategy Backtester', path: '/app/markets/backtest', key: 'backtest' },
          { label: 'Paper Trading Simulator', path: '/app/markets/paper-trading', key: 'paper-trading' },
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

      {/* SUBVIEW 1: OVERVIEW & WATCHLIST */}
      {(subview === 'overview' || subview === 'watchlist') && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] overflow-x-auto">
            <div className="p-4 border-b border-[#28443C] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F7F5]">
                {subview === 'watchlist' ? 'Your Tracked Watchlist' : 'NSE Benchmark Indices & Key Instruments'}
              </h3>
              <span className="text-xs text-[#718D83]">VERIFIED_NSE_ARCHIVE</span>
            </div>

            {displayedInstruments.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs text-[#718D83]">
                  Your watchlist is empty. Star any NSE instrument in Market Overview to track it here.
                </p>
                <button
                  onClick={() => onNavigate('/app/markets')}
                  className="rounded-lg bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
                >
                  Browse NSE Instruments
                </button>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16352E]/40 border-b border-[#28443C] text-[#718D83]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Watch</th>
                    <th className="py-3 px-4 font-medium">Symbol</th>
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium text-right">Reference Price</th>
                    <th className="py-3 px-4 font-medium text-right">Day Change</th>
                    <th className="py-3 px-4 font-medium text-right">52W Range</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#28443C]/40">
                  {displayedInstruments.map(inst => {
                    const starred = isStarred(inst.symbol);
                    return (
                      <tr key={inst.symbol} className="hover:bg-[#16352E]/20 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleWatchlist(inst.symbol)}
                            className={`p-1 rounded hover:bg-[#16352E] ${starred ? 'text-[#E5B764]' : 'text-[#718D83]'}`}
                            title={starred ? 'Remove from Watchlist' : 'Add to Watchlist'}
                          >
                            <Star className={`h-4 w-4 ${starred ? 'fill-current' : ''}`} />
                          </button>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#F5F7F5]">{inst.symbol}</td>
                        <td className="py-3 px-4 text-[#A7C1B8]">{inst.name}</td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#F5F7F5]">₹{inst.currentPrice.toFixed(2)}</td>
                        <td className={`py-3 px-4 text-right font-semibold tabular-nums ${inst.changePct >= 0 ? 'text-[#55C99A]' : 'text-[#EB7676]'}`}>
                          {inst.changePct >= 0 ? '+' : ''}{inst.changePct.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-right text-[#718D83] tabular-nums">
                          ₹{inst.low52w.toFixed(0)} - ₹{inst.high52w.toFixed(0)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenHistory(inst.symbol)}
                              className="rounded-lg bg-[#0B1C19] border border-[#28443C] px-2.5 py-1 text-[11px] text-[#A7C1B8] hover:text-[#A8E6CE] inline-flex items-center gap-1"
                            >
                              <BarChart2 className="h-3 w-3" />
                              <span>OHLCV</span>
                            </button>
                            <button
                              onClick={() => {
                                setPtSymbol(inst.symbol);
                                setPtPrice(inst.currentPrice.toString());
                                onNavigate('/app/markets/paper-trading');
                              }}
                              className="rounded-lg bg-[#16352E] border border-[#28443C] px-2.5 py-1 text-[11px] font-semibold text-[#A8E6CE] hover:border-[#72C8B0]"
                            >
                              Trade Virtual
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
        </div>
      )}

      {/* SUBVIEW 2: BACKTESTER */}
      {subview === 'backtest' && (
        <div className="space-y-6 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5 rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Run OHLCV Historical Backtest</h3>
              <form onSubmit={handleRunBacktest} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Strategy Name</label>
                  <input
                    type="text"
                    value={btName}
                    onChange={e => setBtName(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Instrument</label>
                  <select
                    value={btSymbol}
                    onChange={e => setBtSymbol(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  >
                    {instruments.map(inst => (
                      <option key={inst.symbol} value={inst.symbol}>{inst.symbol} — {inst.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Starting Virtual Capital (₹)</label>
                  <input
                    type="number"
                    min="1000"
                    value={btCapital}
                    onChange={e => setBtCapital(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Strategy Model</label>
                  <select
                    value={btStrategy}
                    onChange={e => setBtStrategy(e.target.value as BacktestRecord['strategyType'])}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  >
                    <option value="Moving Average Crossover">Moving Average Crossover (8 vs 20 SMA)</option>
                    <option value="RSI-Based Strategy">RSI Oversold Bounce (14-Period RSI)</option>
                    <option value="Breakout Strategy">15-Day Range Breakout</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Stop Loss (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.25"
                      value={btStopLoss}
                      onChange={e => setBtStopLoss(e.target.value)}
                      className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Target (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      value={btTarget}
                      onChange={e => setBtTarget(e.target.value)}
                      className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                      required
                    />
                  </div>
                </div>
                {backtestError && (
                  <div className="p-2.5 rounded-lg bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676]">
                    {backtestError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isBacktesting}
                  className="w-full rounded-xl bg-[#A8E6CE] py-2.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0] flex items-center justify-center gap-2"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>{isBacktesting ? 'Executing Candle Simulation...' : 'Run Historical Backtest'}</span>
                </button>
              </form>
            </div>

            <div className="md:col-span-7 space-y-4">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Simulated Backtest Runs</h3>
              {backtests.length === 0 ? (
                <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-8 text-center text-xs text-[#718D83]">
                  No backtests executed yet. Configure a strategy on the left to evaluate it across 140 historical NSE trading sessions.
                </div>
              ) : (
                backtests.map(bt => (
                  <div key={bt.id} className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#28443C] pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-[#F5F7F5]">{bt.strategyName}</h4>
                        <div className="text-[11px] text-[#718D83]">
                          {bt.symbol} · {bt.startDate} to {bt.endDate} · {bt.tradeCount} trade{bt.tradeCount === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold tabular-nums ${bt.totalReturnPct >= 0 ? 'text-[#55C99A]' : 'text-[#EB7676]'}`}>
                          {bt.totalReturnPct >= 0 ? '+' : ''}{bt.totalReturnPct}% Return
                        </span>
                        <button
                          onClick={() => handleDeleteBacktest(bt.id)}
                          className="text-[#718D83] hover:text-[#EB7676]"
                          title="Delete Backtest"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-[#0B1C19] border border-[#28443C]">
                        <div className="text-[10px] text-[#718D83]">Initial Capital</div>
                        <div className="font-bold text-[#F5F7F5] tabular-nums mt-0.5">{formatINR(bt.startingCapital)}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-[#0B1C19] border border-[#28443C]">
                        <div className="text-[10px] text-[#718D83]">Final Capital</div>
                        <div className={`font-bold tabular-nums mt-0.5 ${bt.finalCapital >= bt.startingCapital ? 'text-[#55C99A]' : 'text-[#EB7676]'}`}>
                          {formatINR(bt.finalCapital)}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-[#0B1C19] border border-[#28443C]">
                        <div className="text-[10px] text-[#718D83]">Win Rate</div>
                        <div className="font-bold text-[#A8E6CE] tabular-nums mt-0.5">{bt.winRatePct}%</div>
                      </div>
                      <div className="p-2 rounded-xl bg-[#0B1C19] border border-[#28443C]">
                        <div className="text-[10px] text-[#718D83]">Max Drawdown</div>
                        <div className="font-bold text-[#EB7676] tabular-nums mt-0.5">{bt.maximumDrawdownPct}%</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW 3: PAPER TRADING SIMULATOR */}
      {subview === 'paper-trading' && (
        <div className="space-y-6 max-w-5xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#A7C1B8]">Isolated virtual capital ledger for risk-free strategy practice.</span>
            <button
              onClick={handleResetPaperAccount}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#28443C] bg-[#102722] px-3 py-1.5 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Virtual Account (₹10L)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Available Virtual Cash</span>
              <div className="text-2xl font-bold text-[#55C99A] tabular-nums">
                {formatINR(paperAccount.availableVirtualBalance)}
              </div>
              <span className="text-[11px] text-[#718D83]">Simulated ₹10L initial allotment</span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Simulated Portfolio Value</span>
              <div className="text-2xl font-bold text-[#A8E6CE] tabular-nums">
                {formatINR(paperAccount.simulatedPortfolioValue)}
              </div>
              <span className="text-[11px] text-[#718D83]">
                {Object.keys(paperAccount.positions || {}).length} open virtual position(s)
              </span>
            </div>
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <span className="text-xs text-[#718D83]">Total Virtual Net Worth</span>
              <div className="text-2xl font-bold text-[#F5F7F5] tabular-nums">
                {formatINR(paperAccount.availableVirtualBalance + paperAccount.simulatedPortfolioValue)}
              </div>
              <span className="text-[11px] text-[#55C99A]">Zero real money exposure</span>
            </div>
          </div>

          {tradeStatus && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
              tradeStatus.ok
                ? 'bg-[#55C99A]/10 border-[#55C99A]/40 text-[#55C99A]'
                : 'bg-[#EB7676]/10 border-[#EB7676]/40 text-[#EB7676]'
            }`}>
              {tradeStatus.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{tradeStatus.msg}</span>
            </div>
          )}

          {/* Open Virtual Positions */}
          {paperAccount.positions && Object.keys(paperAccount.positions).length > 0 && (
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-4 space-y-2">
              <h3 className="text-xs font-bold text-[#F5F7F5] uppercase tracking-wider">Open Simulated Positions</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(paperAccount.positions).map(([sym, pos]) => (
                  <div key={sym} className="rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs">
                    <span className="font-bold text-[#F5F7F5]">{sym}</span>{' '}
                    <span className="text-[#A8E6CE] tabular-nums">{pos.quantity} units</span>{' '}
                    <span className="text-[#718D83]">@ avg ₹{pos.avgPrice.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5 rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Simulate Market Order</h3>
              <form onSubmit={handleSimulateTrade} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Instrument</label>
                  <select
                    value={ptSymbol}
                    onChange={e => {
                      setPtSymbol(e.target.value);
                      const inst = instruments.find(i => i.symbol === e.target.value);
                      if (inst) setPtPrice(inst.currentPrice.toString());
                    }}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                  >
                    {instruments.map(inst => (
                      <option key={inst.symbol} value={inst.symbol}>{inst.symbol} (₹{inst.currentPrice})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Action</label>
                    <select
                      value={ptAction}
                      onChange={e => setPtAction(e.target.value as 'BUY' | 'SELL')}
                      className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Quantity</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={ptQuantity}
                      onChange={e => setPtQuantity(e.target.value)}
                      className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Execution Price (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={ptPrice}
                    onChange={e => setPtPrice(e.target.value)}
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5]"
                    required
                  />
                </div>
                <div className="p-3 rounded-xl bg-[#0B1C19] border border-[#28443C] text-xs space-y-1">
                  <div className="flex justify-between text-[#718D83]">
                    <span>Simulated Value:</span>
                    <span className="font-bold text-[#F5F7F5] tabular-nums">
                      {formatINR((parseFloat(ptQuantity) || 0) * (parseFloat(ptPrice) || 0))}
                    </span>
                  </div>
                </div>
                <button
                  type="submit"
                  className={`w-full rounded-xl py-2.5 text-xs font-bold text-[#0B1C19] ${
                    ptAction === 'BUY' ? 'bg-[#55C99A] hover:bg-[#48b588]' : 'bg-[#EB7676] hover:bg-[#d66565]'
                  }`}
                >
                  Submit Virtual {ptAction} Order
                </button>
              </form>
            </div>

            <div className="md:col-span-7 rounded-2xl border border-[#28443C] bg-[#102722] overflow-x-auto">
              <div className="p-4 border-b border-[#28443C]">
                <h3 className="text-sm font-bold text-[#F5F7F5]">Simulated Trade History</h3>
              </div>
              {paperTrades.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#718D83]">
                  No simulated orders executed yet. Place a BUY order on the left to start practicing.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#16352E]/40 border-b border-[#28443C] text-[#718D83]">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Sim. Price</th>
                      <th className="py-2.5 px-3 text-right">Cash Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#28443C]/40">
                    {paperTrades.map(tr => (
                      <tr key={tr.id}>
                        <td className="py-2.5 px-3 text-[#718D83]">{tr.historicalReferenceDate}</td>
                        <td className="py-2.5 px-3 font-bold text-[#F5F7F5]">{tr.symbol}</td>
                        <td className={`py-2.5 px-3 font-semibold ${tr.action === 'BUY' ? 'text-[#55C99A]' : 'text-[#EB7676]'}`}>
                          {tr.action}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-[#F5F7F5]">{tr.quantity}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-[#F5F7F5]">₹{tr.simulatedPrice.toFixed(2)}</td>
                        <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${tr.cashImpact >= 0 ? 'text-[#55C99A]' : 'text-[#F5F7F5]'}`}>
                          {formatINR(tr.cashImpact)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Historical OHLCV Drawer Modal */}
      {historySymbol && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#28443C] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#F5F7F5]">{historySymbol} · Historical OHLCV Archive</h3>
                <p className="text-[11px] text-[#718D83]">Source: VERIFIED_NSE_ARCHIVE (Last 60 Trading Sessions)</p>
              </div>
              <button
                onClick={() => setHistorySymbol(null)}
                className="p-1.5 rounded-lg text-[#718D83] hover:text-[#F5F7F5]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {historyLoading ? (
              <div className="py-10 text-center text-xs text-[#A7C1B8]">Loading historical OHLCV candles...</div>
            ) : (
              <>
                {historyCandles.length > 0 && (() => {
                  const closes = historyCandles.map(c => c.close);
                  const minC = Math.min(...closes);
                  const maxC = Math.max(...closes);
                  const span = Math.max(maxC - minC, 1);
                  return (
                    <div className="p-4 rounded-xl bg-[#0B1C19] border border-[#28443C] space-y-2">
                      <div className="flex justify-between text-[11px] text-[#718D83]">
                        <span>Close Price Range: ₹{minC.toFixed(2)} – ₹{maxC.toFixed(2)}</span>
                        <span>{historyCandles[0].date} → {historyCandles[historyCandles.length - 1].date}</span>
                      </div>
                      <div className="h-24 flex items-end gap-0.5 pt-2">
                        {historyCandles.map(c => {
                          const hPct = Math.max(8, Math.round(((c.close - minC) / span) * 100));
                          const isUp = c.close >= c.open;
                          return (
                            <div
                              key={c.date}
                              title={`${c.date}: Close ₹${c.close}`}
                              className={`flex-1 rounded-t ${isUp ? 'bg-[#55C99A]' : 'bg-[#EB7676]'}`}
                              style={{ height: `${hPct}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="max-h-56 overflow-y-auto rounded-xl border border-[#28443C]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#16352E]/50 text-[#718D83] sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-right">Open</th>
                        <th className="py-2 px-3 text-right">High</th>
                        <th className="py-2 px-3 text-right">Low</th>
                        <th className="py-2 px-3 text-right">Close</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#28443C]/40">
                      {historyCandles.slice(-15).reverse().map(c => (
                        <tr key={c.date}>
                          <td className="py-1.5 px-3 text-[#718D83]">{c.date}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-[#A7C1B8]">₹{c.open.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-[#55C99A]">₹{c.high.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right tabular-nums text-[#EB7676]">₹{c.low.toFixed(2)}</td>
                          <td className="py-1.5 px-3 text-right font-semibold tabular-nums text-[#F5F7F5]">₹{c.close.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {historyAiInsight && (
              <div className="p-3.5 rounded-xl bg-[#16352E]/60 border border-[#A8E6CE]/40 text-xs text-[#F5F7F5] whitespace-pre-wrap leading-relaxed">
                {historyAiInsight}
              </div>
            )}

            {historyAiError && (
              <div className="p-3 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676]">
                {historyAiError}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleExplainSymbolWithAi}
                disabled={historyAiLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#16352E] border border-[#28443C] px-4 py-2 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0]"
              >
                {historyAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>{historyAiLoading ? 'Analyzing...' : `Explain ${historySymbol} with Gemini AI`}</span>
              </button>
              <button
                onClick={onOpenAI}
                className="text-xs font-semibold text-[#A8E6CE] hover:underline"
              >
                Open Full AI Drawer →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
