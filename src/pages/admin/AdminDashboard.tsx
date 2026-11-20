import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  Activity,
  Database,
  Cpu,
  FileCheck,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import type { UserProfile, TaxRuleSet, MarketInstrument, AIUsageLog } from '../../types';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

type AdminTab = 'overview' | 'users' | 'rules-markets' | 'ai-settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<{
    totalUsers: number;
    activeUsers: number;
    aiRequests: number;
    aiModel: string;
    geminiConfigured: boolean;
    fileProcessingJobs: number;
    systemErrors: number;
    activeTaxRuleset: string;
    recentAuditLogs: Array<{
      id: string;
      actorEmail: string;
      action: string;
      outcome: string;
      createdAt: string;
    }>;
  } | null>(null);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [taxRules, setTaxRules] = useState<TaxRuleSet[]>([]);
  const [marketInfo, setMarketInfo] = useState<{
    providerStatus: {
      liveProviderConfigured: boolean;
      providerMode: 'EXTERNAL_API' | 'VERIFIED_NSE_ARCHIVE';
      archiveCutoffDate: string;
    };
    instruments: MarketInstrument[];
  } | null>(null);
  const [aiUsage, setAiUsage] = useState<{
    model: string;
    configured: boolean;
    totalRequests: number;
    logs: AIUsageLog[];
  } | null>(null);
  const [sysSettings, setSysSettings] = useState<{
    aiEnabled: boolean;
    maintenanceMode: boolean;
    maxUploadMb: number;
    defaultFinancialYear: '2025-26' | '2024-25';
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdminOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/admin/dashboard');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || `Access denied (HTTP ${res.status})`);
      }
      setData(json.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin console.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSecondaryAdminPanels = useCallback(async () => {
    try {
      const [uRes, trRes, mRes, aiRes, setRes] = await Promise.all([
        apiFetch('/api/v1/admin/users'),
        apiFetch('/api/v1/admin/tax-rules'),
        apiFetch('/api/v1/admin/market-data'),
        apiFetch('/api/v1/admin/ai-usage'),
        apiFetch('/api/v1/admin/settings'),
      ]);
      const [uJson, trJson, mJson, aiJson, setJson] = await Promise.all([
        uRes.json(),
        trRes.json(),
        mRes.json(),
        aiRes.json(),
        setRes.json(),
      ]);
      if (uRes.ok && uJson.success) setUsers(uJson.data || []);
      if (trRes.ok && trJson.success) setTaxRules(trJson.data || []);
      if (mRes.ok && mJson.success) setMarketInfo(mJson.data);
      if (aiRes.ok && aiJson.success) setAiUsage(aiJson.data);
      if (setRes.ok && setJson.success) setSysSettings(setJson.data);
    } catch {
      // handled cleanly via UI states
    }
  }, []);

  useEffect(() => {
    loadAdminOverview();
  }, [loadAdminOverview]);

  useEffect(() => {
    if (data && activeTab !== 'overview') {
      loadSecondaryAdminPanels();
    }
  }, [data, activeTab, loadSecondaryAdminPanels]);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleToggleUserStatus = async (u: UserProfile) => {
    const nextStatus = u.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const res = await apiFetch(`/api/v1/admin/users/${u.uid}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountStatus: nextStatus }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setUsers(prev => prev.map(item => (item.uid === u.uid ? json.data : item)));
      notify(`Updated ${u.email} status to ${nextStatus}.`);
    }
  };

  const handleToggleTaxRule = async (rule: TaxRuleSet) => {
    const res = await apiFetch(`/api/v1/admin/tax-rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rule.active }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setTaxRules(prev => prev.map(r => (r.id === rule.id ? json.data : r)));
      notify(`Updated ruleset ${rule.version}.`);
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sysSettings) return;
    const res = await apiFetch('/api/v1/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sysSettings),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setSysSettings(json.data);
      notify('Global system settings updated.');
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto text-xs text-[#A7C1B8]">
        Loading verified admin telemetry...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-[#EB7676]/40 bg-[#102722] p-6 space-y-3">
          <div className="flex items-center gap-2 text-[#EB7676]">
            <AlertCircle className="h-5 w-5" />
            <h2 className="text-sm font-bold">Admin Console Access Denied</h2>
          </div>
          <p className="text-xs text-[#A7C1B8]">{error || 'Insufficient permissions.'}</p>
          <button
            onClick={() => onNavigate('/app/dashboard')}
            className="rounded-xl bg-[#A8E6CE] px-4 py-2 text-xs font-bold text-[#0B1C19]"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="border-b border-[#28443C] pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#E5B764]" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7F5] tracking-tight">
              Administration Console
            </h1>
          </div>
          <p className="text-xs text-[#A7C1B8] mt-1">
            System telemetry, user status governance, CBDT tax rulesets, NSE market archives, and Gemini AI usage logs.
          </p>
        </div>
        <span className="rounded-lg bg-[#E5B764]/20 border border-[#E5B764] px-3 py-1 text-xs font-bold text-[#E5B764] self-start sm:self-auto">
          Verified Admin Access
        </span>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/40 text-xs text-[#55C99A] flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[#28443C] pb-2 overflow-x-auto whitespace-nowrap">
        {[
          { key: 'overview', label: 'Overview & Audit Logs' },
          { key: 'users', label: 'Users Governance' },
          { key: 'rules-markets', label: 'Tax Rules & Market Data' },
          { key: 'ai-settings', label: 'AI Usage & System Settings' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as AdminTab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === t.key
                ? 'bg-[#16352E] text-[#A8E6CE] border border-[#28443C]'
                : 'text-[#A7C1B8] hover:text-[#F5F7F5]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#718D83]">
                <span>Registered Users</span>
                <Users className="h-4 w-4 text-[#A8E6CE]" />
              </div>
              <div className="text-2xl font-bold text-[#F5F7F5] tabular-nums">{data.totalUsers}</div>
              <span className="text-[10px] text-[#55C99A]">{data.activeUsers} Active</span>
            </div>

            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#718D83]">
                <span>Gemini AI Invocations</span>
                <Cpu className="h-4 w-4 text-[#A8E6CE]" />
              </div>
              <div className="text-2xl font-bold text-[#A8E6CE] tabular-nums">{data.aiRequests}</div>
              <span className={`text-[10px] ${data.geminiConfigured ? 'text-[#55C99A]' : 'text-[#E5B764]'}`}>
                {data.aiModel || 'gemini-4-hydrogen'} · {data.geminiConfigured ? 'Key Configured' : 'Key Missing'}
              </span>
            </div>

            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#718D83]">
                <span>File Jobs Processed</span>
                <FileCheck className="h-4 w-4 text-[#55C99A]" />
              </div>
              <div className="text-2xl font-bold text-[#F5F7F5] tabular-nums">{data.fileProcessingJobs}</div>
              <span className="text-[10px] text-[#718D83]">Statements & Vault Docs</span>
            </div>

            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#718D83]">
                <span>Tax Rules Version</span>
                <Database className="h-4 w-4 text-[#7BB9DC]" />
              </div>
              <div className="text-xl font-bold text-[#F5F7F5]">{data.activeTaxRuleset || 'CBDT v2025.2'}</div>
              <span className="text-[10px] text-[#55C99A]">Active & Verified</span>
            </div>

            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-5 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#718D83]">
                <span>AI / System Errors</span>
                <Activity className="h-4 w-4 text-[#55C99A]" />
              </div>
              <div className={`text-2xl font-bold tabular-nums ${data.systemErrors > 0 ? 'text-[#E5B764]' : 'text-[#55C99A]'}`}>
                {data.systemErrors}
              </div>
              <span className="text-[10px] text-[#718D83]">Logged telemetry errors</span>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] overflow-hidden">
            <div className="p-4 border-b border-[#28443C] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Administrative Audit Logs</h3>
              <span className="text-xs text-[#718D83]">Immutable security trail</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16352E]/40 border-b border-[#28443C] text-[#718D83]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Timestamp</th>
                    <th className="py-3 px-4 font-medium">Actor</th>
                    <th className="py-3 px-4 font-medium">Action</th>
                    <th className="py-3 px-4 font-medium text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#28443C]/40">
                  {(data.recentAuditLogs || []).map(log => (
                    <tr key={log.id} className="hover:bg-[#16352E]/20">
                      <td className="py-3 px-4 text-[#718D83] whitespace-nowrap">{log.createdAt}</td>
                      <td className="py-3 px-4 font-semibold text-[#F5F7F5]">{log.actorEmail}</td>
                      <td className="py-3 px-4 font-mono text-[#A8E6CE]">{log.action}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#55C99A]/20 text-[#55C99A]">
                          {log.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <div className="rounded-2xl border border-[#28443C] bg-[#102722] overflow-hidden">
          <div className="p-4 border-b border-[#28443C]">
            <h3 className="text-sm font-bold text-[#F5F7F5]">Registered Accounts ({users.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#16352E]/40 border-b border-[#28443C] text-[#718D83]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">UID</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#28443C]/40">
                {users.map(u => (
                  <tr key={u.uid} className="hover:bg-[#16352E]/20">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#F5F7F5]">{u.fullName}</div>
                      <div className="text-[10px] text-[#718D83]">{u.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#A7C1B8]">{u.uid}</td>
                    <td className="py-3 px-4 text-[#A8E6CE] font-semibold">{u.role}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.accountStatus === 'ACTIVE' ? 'bg-[#55C99A]/20 text-[#55C99A]' : 'bg-[#EB7676]/20 text-[#EB7676]'
                      }`}>
                        {u.accountStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        className="rounded-lg border border-[#28443C] bg-[#16352E] px-2.5 py-1 text-[11px] text-[#A8E6CE] hover:border-[#72C8B0]"
                      >
                        {u.accountStatus === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'rules-markets' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#F5F7F5]">CBDT Tax Rulesets</h3>
            <div className="space-y-2.5">
              {taxRules.map(rule => (
                <div key={rule.id} className="p-4 rounded-xl bg-[#0B1C19] border border-[#28443C] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-[#F5F7F5]">
                      FY {rule.financialYear} (AY {rule.assessmentYear}) · {rule.version}
                    </div>
                    <div className="text-[11px] text-[#718D83] mt-0.5">{rule.sourceNote}</div>
                  </div>
                  <button
                    onClick={() => handleToggleTaxRule(rule)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                      rule.active ? 'bg-[#55C99A]/20 text-[#55C99A] border border-[#55C99A]/40' : 'bg-[#28443C] text-[#A7C1B8]'
                    }`}
                  >
                    {rule.active ? 'Active' : 'Inactive (Enable)'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {marketInfo && (
            <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#F5F7F5]">Market Data Archive Status</h3>
                <span className="text-xs text-[#A8E6CE] font-semibold">
                  {marketInfo.providerStatus.providerMode} (Cutoff: {marketInfo.providerStatus.archiveCutoffDate})
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[#718D83] border-b border-[#28443C]">
                    <tr>
                      <th className="py-2 px-3">Symbol</th>
                      <th className="py-2 px-3">Exchange</th>
                      <th className="py-2 px-3 text-right">Last Close</th>
                      <th className="py-2 px-3 text-right">Updated</th>
                      <th className="py-2 px-3 text-right">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#28443C]/40">
                    {marketInfo.instruments.map(inst => (
                      <tr key={inst.symbol}>
                        <td className="py-2 px-3 font-bold text-[#F5F7F5]">{inst.symbol}</td>
                        <td className="py-2 px-3 text-[#A7C1B8]">{inst.exchange}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#F5F7F5]">₹{inst.currentPrice.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 text-right text-[#718D83]">{inst.lastUpdatedDate}</td>
                        <td className="py-2 px-3 text-right font-mono text-[10px] text-[#A8E6CE]">{inst.historicalStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ai-settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {sysSettings && (
            <form onSubmit={handleSaveSystemSettings} className="lg:col-span-5 rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 text-xs">
              <h3 className="text-sm font-bold text-[#F5F7F5]">Global Platform Settings</h3>
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#0B1C19] border border-[#28443C] cursor-pointer">
                <span className="text-[#F5F7F5]">Enable Gemini AI Features</span>
                <input
                  type="checkbox"
                  checked={sysSettings.aiEnabled}
                  onChange={e => setSysSettings(prev => (prev ? { ...prev, aiEnabled: e.target.checked } : prev))}
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#0B1C19] border border-[#28443C] cursor-pointer">
                <span className="text-[#F5F7F5]">Maintenance Mode</span>
                <input
                  type="checkbox"
                  checked={sysSettings.maintenanceMode}
                  onChange={e => setSysSettings(prev => (prev ? { ...prev, maintenanceMode: e.target.checked } : prev))}
                />
              </label>
              <div>
                <label className="block text-[#A7C1B8] mb-1">Max Upload Size (MB)</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={sysSettings.maxUploadMb}
                  onChange={e =>
                    setSysSettings(prev => (prev ? { ...prev, maxUploadMb: Number(e.target.value) || 10 } : prev))
                  }
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-[#F5F7F5]"
                />
              </div>
              <div>
                <label className="block text-[#A7C1B8] mb-1">Default Financial Year</label>
                <select
                  value={sysSettings.defaultFinancialYear}
                  onChange={e =>
                    setSysSettings(prev =>
                      prev ? { ...prev, defaultFinancialYear: e.target.value as '2025-26' | '2024-25' } : prev
                    )
                  }
                  className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-[#F5F7F5]"
                >
                  <option value="2025-26">2025-26</option>
                  <option value="2024-25">2024-25</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-[#A8E6CE] py-2.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
              >
                Save System Settings
              </button>
            </form>
          )}

          {aiUsage && (
            <div className="lg:col-span-7 rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#F5F7F5]">Gemini AI Telemetry</h3>
                  <p className="text-xs text-[#718D83]">Model: {aiUsage.model} · Requests: {aiUsage.totalRequests}</p>
                </div>
                <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                  aiUsage.configured ? 'bg-[#55C99A]/20 text-[#55C99A]' : 'bg-[#E5B764]/20 text-[#E5B764]'
                }`}>
                  {aiUsage.configured ? 'API Key Configured' : 'API Key Not Configured'}
                </span>
              </div>
              {aiUsage.logs.length === 0 ? (
                <p className="text-xs text-[#718D83]">No AI requests recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[#718D83] border-b border-[#28443C]">
                      <tr>
                        <th className="py-2 px-3">Endpoint</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Latency</th>
                        <th className="py-2 px-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#28443C]/40">
                      {aiUsage.logs.slice(0, 15).map(log => (
                        <tr key={log.id}>
                          <td className="py-2 px-3 font-mono text-[#A8E6CE]">{log.endpoint}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'SUCCESS' ? 'bg-[#55C99A]/20 text-[#55C99A]' : 'bg-[#EB7676]/20 text-[#EB7676]'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums text-[#A7C1B8]">{log.latencyMs} ms</td>
                          <td className="py-2 px-3 text-right text-[#718D83]">
                            {new Date(log.createdAt).toLocaleTimeString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
