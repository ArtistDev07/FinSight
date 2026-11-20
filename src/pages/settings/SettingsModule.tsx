import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Download,
  Trash2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/api';
import type { AppNotification, UserPreferences } from '../../types';

interface SettingsModuleProps {
  subview: 'notifications' | 'profile' | 'preferences' | 'security' | 'data' | 'help';
  onNavigate: (path: string) => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  subview,
}) => {
  const { user, preferences, updateProfile, updatePreferences, sendResetEmail } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Preferences form state
  const [currency, setCurrency] = useState(preferences?.currency || 'INR');
  const [language, setLanguage] = useState(preferences?.language || 'English');
  const [numberFormat, setNumberFormat] = useState<'INDIAN' | 'INTERNATIONAL'>(preferences?.numberFormat || 'INDIAN');
  const [financialYear, setFinancialYear] = useState(preferences?.financialYear || '2025-26');
  const [experienceLevel, setExperienceLevel] = useState<UserPreferences['experienceLevel']>(preferences?.experienceLevel || 'Intermediate');
  const [explanationLevel, setExplanationLevel] = useState<UserPreferences['explanationLevel']>(preferences?.explanationLevel || 'Balanced');
  const [notifPrefs, setNotifPrefs] = useState<UserPreferences['notificationPreferences']>(
    preferences?.notificationPreferences || {
      budgetAlerts: true,
      spendingAlerts: true,
      securityAlerts: true,
      taxReminders: true,
      businessReminders: true,
      productUpdates: false,
    }
  );

  // Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // Feedback states
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [dataActionMessage, setDataActionMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);

  // FAQ Accordions State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    if (preferences) {
      setCurrency(preferences.currency || 'INR');
      setLanguage(preferences.language || 'English');
      setNumberFormat(preferences.numberFormat || 'INDIAN');
      setFinancialYear(preferences.financialYear || '2025-26');
      setExperienceLevel(preferences.experienceLevel || 'Intermediate');
      setExplanationLevel(preferences.explanationLevel || 'Balanced');
      if (preferences.notificationPreferences) {
        setNotifPrefs(preferences.notificationPreferences);
      }
    }
  }, [preferences]);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const res = await apiFetch('/api/v1/notifications');
      const json = await res.json();
      if (res.ok && json.success) {
        setNotifications(json.data || []);
      }
    } catch {
      setActionError('Unable to load notifications.');
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subview === 'notifications') {
      fetchNotifications();
    }
  }, [subview, fetchNotifications]);

  const showSavedBanner = (msg: string) => {
    setActionError(null);
    setSavedSuccess(msg);
    setTimeout(() => setSavedSuccess(null), 2500);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({ fullName, phone });
      showSavedBanner('Profile updated successfully.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save profile.');
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updatePreferences({
        currency,
        language,
        numberFormat,
        financialYear,
        experienceLevel,
        explanationLevel,
        notificationPreferences: notifPrefs,
      });
      showSavedBanner('Financial preferences saved to your account.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save preferences.');
    }
  };

  const handleMarkRead = async (id: string) => {
    const res = await apiFetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
    if (res.ok) {
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    }
  };

  const handleMarkAllRead = async () => {
    const res = await apiFetch('/api/v1/notifications/read-all', { method: 'POST' });
    if (res.ok) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleDeleteAllRecords = async () => {
    setIsDeletingData(true);
    setActionError(null);
    setDataActionMessage(null);
    try {
      const res = await apiFetch('/api/v1/user/records', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || `Delete failed (HTTP ${res.status})`);
      }
      setShowDeleteConfirm(false);
      setDataActionMessage(json.message || 'All financial records associated with your account have been permanently deleted.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete financial records.');
    } finally {
      setIsDeletingData(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const faqs = [
    {
      q: 'Does FinSight execute real financial trades or transfer funds?',
      a: 'No. FinSight is strictly an educational financial intelligence, budgeting, tax advisory, and paper simulation workspace. It does not execute live trades, broker transactions, or real-money transfers.',
    },
    {
      q: 'How does FinSight process Indian UPI SMS and bank statement files?',
      a: 'FinSight parses CSV, XLSX, PDF, TXT, and bank SMS alerts using deterministic parsers and flags duplicate entries before importing into your ledger. It never requests bank passwords, card PINs, or UPI PINs.',
    },
    {
      q: 'Are the Old vs New Tax Regime calculations official?',
      a: 'Calculations use versioned CBDT rulesets (FY 2025-26 and FY 2024-25) including Section 115BAC slabs, Section 87A rebates, surcharge tiers, and 4% health & education cess. Always confirm final ITR filings with a chartered accountant.',
    },
    {
      q: 'How does the Scam & Fraud Detector work?',
      a: 'When you submit a suspicious SMS or payment request, Gemini 4 Hydrogen evaluates patterns against documented Indian financial phishing tactics and returns a structured risk score, flagged keywords, and safe next steps.',
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#28443C] pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7F5] tracking-tight">
          {subview === 'notifications' && 'Notifications'}
          {subview === 'profile' && 'Profile Settings'}
          {subview === 'preferences' && 'Financial Preferences'}
          {subview === 'security' && 'Account Security'}
          {subview === 'data' && 'Your Data Management'}
          {subview === 'help' && 'Help Center & FAQs'}
        </h1>
        <p className="text-xs text-[#A7C1B8] mt-1">
          Manage your personal information, preferences, privacy, and system alerts.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/40 text-xs text-[#55C99A] flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          <span>{savedSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676] flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{actionError}</span>
        </div>
      )}

      {/* SUBVIEW: NOTIFICATIONS */}
      {subview === 'notifications' && (
        <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#A8E6CE]" />
              <h3 className="text-sm font-bold text-[#F5F7F5]">Financial Alerts</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-[#A8E6CE]/20 text-[10px] font-bold text-[#A8E6CE]">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#A8E6CE] hover:underline font-medium"
              >
                Mark All Read
              </button>
            )}
          </div>

          {notifLoading ? (
            <div className="text-xs text-[#718D83] py-4">Loading alerts...</div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#718D83]">
              No notifications or budget alerts yet. Alerts appear here automatically when budget thresholds or security events occur.
            </div>
          ) : (
            <div className="divide-y divide-[#28443C]/50">
              {notifications.map(n => (
                <div key={n.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                        n.read ? 'bg-[#28443C]' : n.type === 'WARNING' || n.type === 'ALERT' ? 'bg-[#E5B764]' : 'bg-[#A8E6CE]'
                      }`}
                    />
                    <div>
                      <h4 className={`text-xs font-bold ${n.read ? 'text-[#A7C1B8]' : 'text-[#F5F7F5]'}`}>{n.title}</h4>
                      <p className="text-xs text-[#A7C1B8] mt-0.5">{n.message}</p>
                      <span className="text-[10px] text-[#718D83]">
                        {new Date(n.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="rounded-lg border border-[#28443C] px-2.5 py-1 text-[10px] text-[#A8E6CE] hover:border-[#72C8B0] shrink-0 flex items-center gap-1"
                    >
                      <Check className="h-3 w-3" />
                      <span>Mark Read</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBVIEW: PROFILE */}
      {subview === 'profile' && (
        <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 max-w-xl">
          <h3 className="text-sm font-bold text-[#F5F7F5]">Personal Information</h3>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2 text-xs text-[#F5F7F5]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Email (Authenticated)</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full rounded-xl bg-[#0B1C19]/50 border border-[#28443C] px-3.5 py-2 text-xs text-[#718D83]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] px-3.5 py-2 text-xs text-[#F5F7F5]"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[#A8E6CE] px-6 py-2.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
            >
              Save Changes
            </button>
          </form>
        </div>
      )}

      {/* SUBVIEW: FINANCIAL PREFERENCES */}
      {subview === 'preferences' && (
        <form onSubmit={handleSavePreferences} className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-5 max-w-2xl">
          <h3 className="text-sm font-bold text-[#F5F7F5]">Financial Localization & AI Personalization</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[#A7C1B8] mb-1">Primary Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] p-2.5 text-[#F5F7F5]"
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
              </select>
            </div>
            <div>
              <label className="block text-[#A7C1B8] mb-1">Display Language</label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value)}
                className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] p-2.5 text-[#F5F7F5]"
              >
                <option value="English">English (India)</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
              </select>
            </div>
            <div>
              <label className="block text-[#A7C1B8] mb-1">Number Formatting System</label>
              <select
                value={numberFormat}
                onChange={e => setNumberFormat(e.target.value as 'INDIAN' | 'INTERNATIONAL')}
                className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] p-2.5 text-[#F5F7F5]"
              >
                <option value="INDIAN">Indian Numbering (Lakhs, Crores)</option>
                <option value="INTERNATIONAL">International (Millions, Billions)</option>
              </select>
            </div>
            <div>
              <label className="block text-[#A7C1B8] mb-1">Active Financial Year</label>
              <select
                value={financialYear}
                onChange={e => setFinancialYear(e.target.value)}
                className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] p-2.5 text-[#F5F7F5]"
              >
                <option value="2025-26">April to March (FY 2025-26)</option>
                <option value="2024-25">April to March (FY 2024-25)</option>
              </select>
            </div>
            <div>
              <label className="block text-[#A7C1B8] mb-1">Experience Level</label>
              <select
                value={experienceLevel}
                onChange={e => setExperienceLevel(e.target.value as UserPreferences['experienceLevel'])}
                className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] p-2.5 text-[#F5F7F5]"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block text-[#A7C1B8] mb-1">AI Explanation Depth</label>
              <select
                value={explanationLevel}
                onChange={e => setExplanationLevel(e.target.value as UserPreferences['explanationLevel'])}
                className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] p-2.5 text-[#F5F7F5]"
              >
                <option value="Simple">Simple</option>
                <option value="Balanced">Balanced</option>
                <option value="Detailed">Detailed</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-[#28443C] space-y-2">
            <h4 className="text-xs font-bold text-[#F5F7F5]">Notification Subscriptions</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#A7C1B8]">
              {[
                { key: 'budgetAlerts', label: 'Budget Threshold Alerts' },
                { key: 'spendingAlerts', label: 'Unusual Spending Alerts' },
                { key: 'securityAlerts', label: 'Fraud & Security Advisories' },
                { key: 'taxReminders', label: 'CBDT Tax Filing Reminders' },
                { key: 'businessReminders', label: 'Invoice Due Reminders' },
                { key: 'productUpdates', label: 'Platform Feature Updates' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(notifPrefs[item.key as keyof typeof notifPrefs])}
                    onChange={e =>
                      setNotifPrefs(prev => ({
                        ...prev,
                        [item.key]: e.target.checked,
                      }))
                    }
                    className="rounded border-[#28443C] bg-[#0B1C19] text-[#A8E6CE]"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="rounded-xl bg-[#A8E6CE] px-6 py-2.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
          >
            Save Financial Preferences
          </button>
        </form>
      )}

      {/* SUBVIEW: SECURITY */}
      {subview === 'security' && (
        <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 max-w-xl">
          <h3 className="text-sm font-bold text-[#F5F7F5]">Account Security & Sessions</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#0B1C19] border border-[#28443C] flex items-center justify-between">
              <div>
                <div className="font-bold text-[#F5F7F5]">Firebase Verified Session</div>
                <div className="text-[10px] text-[#718D83]">Bearer ID Token · {user?.email}</div>
              </div>
              <span className="text-[#55C99A] font-semibold">Active Now</span>
            </div>
            <div className="pt-2 space-y-3">
              <button
                onClick={async () => {
                  if (!user?.email) return;
                  try {
                    await sendResetEmail(user.email);
                    setSecurityMessage('Password reset link sent to your registered email via Firebase Authentication.');
                  } catch (err) {
                    setSecurityMessage(err instanceof Error ? err.message : 'Unable to send reset email.');
                  }
                }}
                className="rounded-xl border border-[#28443C] bg-[#16352E] px-4 py-2 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0]"
              >
                Send Password Reset Email
              </button>
              {securityMessage && (
                <div className="p-3 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/40 text-xs text-[#55C99A] flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{securityMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW: DATA MANAGEMENT */}
      {subview === 'data' && (
        <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4 max-w-xl">
          <h3 className="text-sm font-bold text-[#F5F7F5]">Data Ownership & Export</h3>
          <p className="text-xs text-[#A7C1B8]">
            You have full ownership of your financial records. Export all transactions, holdings, tax data, and invoices in JSON format, or purge all stored financial records from your account.
          </p>
          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={async () => {
                try {
                  const res = await apiFetch('/api/v1/user/export');
                  const json = await res.json();
                  if (!res.ok || !json.success) throw new Error(json?.error?.message || 'Export failed.');
                  const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'finsight-user-data-export.json';
                  a.click();
                  URL.revokeObjectURL(url);
                  setDataActionMessage('Complete account archive exported to JSON.');
                } catch (err) {
                  setActionError(err instanceof Error ? err.message : 'Unable to export records right now.');
                }
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#A8E6CE] px-4 py-2.5 text-xs font-bold text-[#0B1C19]"
            >
              <Download className="h-4 w-4" />
              <span>Export My Data (JSON)</span>
            </button>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#EB7676]/40 text-[#EB7676] px-4 py-2.5 text-xs font-semibold hover:bg-[#EB7676]/10"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete My Financial Records</span>
              </button>
            ) : (
              <div className="p-4 rounded-xl border border-[#EB7676]/40 bg-[#EB7676]/10 space-y-2 text-xs">
                <div className="font-bold text-[#EB7676]">Confirm Financial Record Deletion</div>
                <p className="text-[#A7C1B8]">
                  Are you sure you want to delete all transactions, holdings, tax files, invoices, and AI conversations? This action is irreversible.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleDeleteAllRecords}
                    disabled={isDeletingData}
                    className="rounded-lg bg-[#EB7676] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#D9534F] disabled:opacity-50"
                  >
                    {isDeletingData ? 'Deleting...' : 'Confirm Permanent Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeletingData}
                    className="rounded-lg border border-[#28443C] px-3 py-1.5 text-xs text-[#A7C1B8]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {dataActionMessage && (
              <div className="p-3 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/40 text-xs text-[#55C99A] flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{dataActionMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW: HELP CENTER */}
      {subview === 'help' && (
        <div className="space-y-4 max-w-3xl">
          <div className="rounded-2xl border border-[#28443C] bg-[#102722] p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#F5F7F5]">Frequently Asked Questions</h3>
            <div className="space-y-3">
              {faqs.map((f, idx) => (
                <div key={idx} className="rounded-xl border border-[#28443C] bg-[#0B1C19] overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full text-left p-4 flex items-center justify-between text-xs font-bold text-[#F5F7F5]"
                  >
                    <span>{f.q}</span>
                    {openFaq === idx ? <ChevronUp className="h-4 w-4 text-[#A8E6CE]" /> : <ChevronDown className="h-4 w-4 text-[#718D83]" />}
                  </button>
                  {openFaq === idx && (
                    <div className="px-4 pb-4 text-xs text-[#A7C1B8] leading-relaxed border-t border-[#28443C]/40 pt-2">
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
