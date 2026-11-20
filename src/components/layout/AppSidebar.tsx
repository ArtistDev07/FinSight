import React from 'react';
import {
  LayoutDashboard,
  Activity,
  Calendar,
  Wallet,
  ReceiptText,
  Upload,
  PieChart,
  Repeat,
  CreditCard,
  Target,
  TrendingUp,
  BarChart3,
  Briefcase,
  ShieldAlert,
  Building2,
  FileSpreadsheet,
  Clock,
  CheckSquare,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Shield,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { FinSightLogo } from '../brand/FinSightArtwork';
import { useTranslations } from '../../utils/i18n';

interface AppSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed?: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ currentPath, onNavigate }) => {
  const { user, preferences, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations(preferences?.language);

  const navigationSections = [
    {
      title: t.nav.overview,
      items: [
        { label: t.nav.dashboard, path: '/app/dashboard', icon: LayoutDashboard },
        { label: t.nav.financialHealth, path: '/app/financial-health', icon: Activity },
        { label: t.nav.moneyCalendar, path: '/app/money-calendar', icon: Calendar },
      ],
    },
    {
      title: t.nav.myMoney,
      items: [
        { label: t.nav.transactions, path: '/app/budgeting/transactions', icon: ReceiptText },
        { label: t.nav.moneyInbox, path: '/app/budgeting/import', icon: Upload },
        { label: t.nav.budgets, path: '/app/budgeting/budgets', icon: PieChart },
        { label: t.nav.recurring, path: '/app/recurring-payments', icon: Repeat },
        { label: t.nav.creditCards, path: '/app/credit-cards', icon: CreditCard },
      ],
    },
    {
      title: t.nav.plan,
      items: [
        { label: t.nav.goals, path: '/app/goals', icon: Target },
        { label: t.nav.taxCenter, path: '/app/tax', icon: FileSpreadsheet },
      ],
    },
    {
      title: t.nav.invest,
      items: [
        { label: t.nav.investments, path: '/app/investments', icon: Briefcase },
        { label: t.nav.markets, path: '/app/markets', icon: BarChart3 },
        { label: t.nav.paperTrading, path: '/app/markets/paper-trading', icon: TrendingUp },
      ],
    },
    {
      title: t.nav.protect,
      items: [
        { label: t.nav.scamShield, path: '/app/fraud', icon: ShieldAlert },
      ],
    },
    {
      title: t.nav.business,
      items: [
        { label: t.nav.businessHome, path: '/app/business', icon: Building2 },
        { label: t.nav.invoices, path: '/app/business/invoices', icon: Wallet },
        { label: t.nav.receivables, path: '/app/business/receivables', icon: Clock },
        { label: t.nav.reconciliation, path: '/app/business/reconciliation', icon: CheckSquare },
      ],
    },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-[var(--fs-border)] bg-[var(--fs-surface)] flex flex-col h-screen sticky top-0 transition-colors">
      {/* Brand Header */}
      <div className="h-[68px] flex items-center justify-between px-5 border-b border-[var(--fs-border)]">
        <FinSightLogo size="sm" onClick={() => onNavigate('/app/dashboard')} />
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-1.5 rounded-lg border border-[var(--fs-border)] text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] transition-colors"
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navigationSections.map(sec => (
          <div key={sec.title} className="space-y-0.5">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fs-text-muted)]">
              {sec.title}
            </div>
            {sec.items.map(item => {
              const Icon = item.icon;
              const isActive =
                currentPath === item.path ||
                (item.path !== '/app/dashboard' &&
                  item.path !== '/app/business' &&
                  item.path !== '/app/markets' &&
                  currentPath.startsWith(item.path + '/'));
              return (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--fs-brand)] text-white dark:bg-[#168366]'
                      : 'text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] hover:text-[var(--fs-text)]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}

        {user?.role === 'ADMIN' && (
          <div className="pt-2 border-t border-[var(--fs-border)]">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fs-warning)]">
              Admin Control
            </div>
            <button
              onClick={() => onNavigate('/admin/dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium ${
                currentPath.startsWith('/admin')
                  ? 'bg-[var(--fs-brand)] text-white'
                  : 'text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)]'
              }`}
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span>Admin Console</span>
            </button>
          </div>
        )}
      </div>

      {/* Account Footer */}
      <div className="p-3 border-t border-[var(--fs-border)] space-y-1 bg-[var(--fs-surface-secondary)]/50">
        <button
          onClick={() => onNavigate('/app/notifications')}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] hover:text-[var(--fs-text)]"
        >
          <div className="flex items-center gap-2.5">
            <Bell className="h-3.5 w-3.5" />
            <span>{t.nav.notifications}</span>
          </div>
        </button>
        <button
          onClick={() => onNavigate('/app/settings/profile')}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] hover:text-[var(--fs-text)]"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>{t.nav.settings}</span>
        </button>
        <button
          onClick={() => onNavigate('/app/help')}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] hover:text-[var(--fs-text)]"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>{t.nav.help}</span>
        </button>

        {/* User Row */}
        <div className="pt-2 mt-1 border-t border-[var(--fs-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-[var(--fs-brand)] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="truncate text-left">
              <div className="text-xs font-semibold text-[var(--fs-text)] truncate">{user?.fullName || 'Member'}</div>
              <div className="text-[10px] text-[var(--fs-text-muted)] truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              onNavigate('/');
            }}
            title={t.common.signOut}
            className="text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)] p-1.5 rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
