import React from 'react';
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  TrendingUp,
  ReceiptText,
  ShieldAlert,
  Building2,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Shield,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AppSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed?: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ currentPath, onNavigate }) => {
  const { user, logout } = useAuth();

  const navigationSections = [
    {
      title: 'Workspace',
      items: [
        { label: 'Overview', path: '/app/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Personal Finance',
      items: [
        { label: 'Smart Budgeting', path: '/app/budgeting', icon: Wallet },
        { label: 'Transactions', path: '/app/budgeting/transactions', icon: ReceiptText },
        { label: 'Budgets', path: '/app/budgeting/budgets', icon: PieChart },
        { label: 'Spending Insights', path: '/app/budgeting/insights', icon: TrendingUp },
      ],
    },
    {
      title: 'Invest & Learn',
      items: [
        { label: 'Portfolio Guide', path: '/app/investments', icon: PieChart },
        { label: 'Markets & NSE', path: '/app/markets', icon: TrendingUp },
        { label: 'Watchlist', path: '/app/markets/watchlist', icon: ChevronRight },
        { label: 'Paper Trading', path: '/app/markets/paper-trading', icon: Wallet },
      ],
    },
    {
      title: 'Tax & Security',
      items: [
        { label: 'Tax Helper', path: '/app/tax', icon: ReceiptText },
        { label: 'Scam Detector', path: '/app/fraud', icon: ShieldAlert },
      ],
    },
    {
      title: 'Business',
      items: [
        { label: 'Business Overview', path: '/app/business', icon: Building2 },
        { label: 'Invoices', path: '/app/business/invoices', icon: ReceiptText },
        { label: 'Expenses', path: '/app/business/expenses', icon: Wallet },
        { label: 'Cash Flow', path: '/app/business/cash-flow', icon: TrendingUp },
        { label: 'EMI Planner', path: '/app/business/emi-planner', icon: PieChart },
      ],
    },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-[#28443C] bg-[#0B1C19] flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div
        onClick={() => onNavigate('/app/dashboard')}
        className="h-[72px] flex items-center gap-3 px-6 border-b border-[#28443C] cursor-pointer"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#16352E] border border-[#28443C] text-[#A8E6CE]">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-bold text-[#F5F7F5] tracking-tight">FinSight</div>
          <div className="text-[10px] text-[#718D83] uppercase tracking-wider">Financial Workspace</div>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {navigationSections.map(sec => (
          <div key={sec.title} className="space-y-1">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#718D83]">
              {sec.title}
            </div>
            {sec.items.map(item => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#16352E] text-[#A8E6CE] border border-[#28443C]'
                      : 'text-[#A7C1B8] hover:bg-[#102722] hover:text-[#F5F7F5]'
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
          <div className="pt-2 border-t border-[#28443C]">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#E5B764]">
              Admin Control
            </div>
            <button
              onClick={() => onNavigate('/admin/dashboard')}
              className={`w-full mt-1 flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                currentPath.startsWith('/admin')
                  ? 'bg-[#16352E] text-[#E5B764] border border-[#28443C]'
                  : 'text-[#A7C1B8] hover:bg-[#102722] hover:text-[#F5F7F5]'
              }`}
            >
              <Shield className="h-4 w-4 shrink-0" />
              <span>Admin Console</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Nav & Profile */}
      <div className="p-4 border-t border-[#28443C] space-y-2 bg-[#102722]/50">
        <button
          onClick={() => onNavigate('/app/notifications')}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-[#A7C1B8] hover:bg-[#16352E] hover:text-[#F5F7F5]"
        >
          <div className="flex items-center gap-2.5">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </div>
          <span className="h-1.5 w-1.5 rounded-full bg-[#A8E6CE]" />
        </button>
        <button
          onClick={() => onNavigate('/app/settings/profile')}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-[#A7C1B8] hover:bg-[#16352E] hover:text-[#F5F7F5]"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
        <button
          onClick={() => onNavigate('/app/help')}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-[#A7C1B8] hover:bg-[#16352E] hover:text-[#F5F7F5]"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help Center</span>
        </button>

        {/* User Card */}
        <div className="pt-2 border-t border-[#28443C] flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-[#16352E] border border-[#28443C] flex items-center justify-center text-xs font-bold text-[#A8E6CE]">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="truncate text-left">
              <div className="text-xs font-medium text-[#F5F7F5] truncate">{user?.fullName || 'User'}</div>
              <div className="text-[10px] text-[#718D83] truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); onNavigate('/'); }}
            title="Sign Out"
            className="text-[#718D83] hover:text-[#EB7676] p-1.5 rounded-md transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
