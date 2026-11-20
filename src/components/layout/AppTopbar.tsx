import React from 'react';
import { Search, Sparkles, Bell, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AppTopbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
  onToggleMobileSidebar?: () => void;
}

export const AppTopbar: React.FC<AppTopbarProps> = ({
  currentPath,
  onNavigate,
  onOpenAI,
  onToggleMobileSidebar,
}) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  // Format breadcrumb from currentPath
  const pathParts = currentPath.split('/').filter(Boolean);
  const breadcrumb = pathParts.length > 1
    ? pathParts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ')
    : 'Dashboard';

  return (
    <header className="h-[72px] border-b border-[#28443C] bg-[#0B1C19]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile trigger & Breadcrumbs */}
      <div className="flex items-center gap-4">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden text-[#A7C1B8] hover:text-[#F5F7F5]"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-2 text-xs font-medium text-[#718D83]">
          <span className="text-[#A7C1B8]">Workspace</span>
          <span>/</span>
          <span className="text-[#F5F7F5]">{breadcrumb}</span>
        </div>
      </div>

      {/* Center: Search input */}
      <div className="hidden lg:flex items-center w-80">
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#718D83]" />
          <input
            type="text"
            placeholder="Search transactions, tools, and insights..."
            className="w-full rounded-lg bg-[#102722] border border-[#28443C] pl-9 pr-3 py-1.5 text-xs text-[#F5F7F5] placeholder-[#718D83] focus:border-[#A8E6CE] focus:outline-none"
          />
        </div>
      </div>

      {/* Right: AI Assistant, Notifications, User Avatar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenAI}
          className="flex items-center gap-2 rounded-lg bg-[#16352E] border border-[#28443C] px-3.5 py-1.5 text-xs font-semibold text-[#A8E6CE] hover:border-[#72C8B0] transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#A8E6CE]" />
          <span className="hidden sm:inline">Ask FinSight AI</span>
        </button>

        <button
          onClick={() => onNavigate('/app/notifications')}
          className="relative rounded-lg p-2 text-[#A7C1B8] hover:bg-[#16352E] hover:text-[#F5F7F5]"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#A8E6CE]" />
        </button>

        {/* User avatar menu */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="h-8 w-8 rounded-full bg-[#16352E] border border-[#28443C] flex items-center justify-center text-xs font-bold text-[#A8E6CE] hover:border-[#A8E6CE]"
          >
            {user?.fullName?.charAt(0) || 'U'}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[#28443C] bg-[#102722] p-1.5 shadow-2xl z-50">
              <div className="px-3 py-2 border-b border-[#28443C] text-xs">
                <div className="font-semibold text-[#F5F7F5] truncate">{user?.fullName}</div>
                <div className="text-[10px] text-[#718D83] truncate">{user?.email}</div>
              </div>
              <button
                onClick={() => { onNavigate('/app/settings/profile'); setDropdownOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-[#A7C1B8] hover:bg-[#16352E] hover:text-[#A8E6CE] rounded-lg"
              >
                My Profile
              </button>
              <button
                onClick={() => { onNavigate('/app/settings/financial-preferences'); setDropdownOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-[#A7C1B8] hover:bg-[#16352E] hover:text-[#A8E6CE] rounded-lg"
              >
                Financial Preferences
              </button>
              <button
                onClick={() => { onNavigate('/app/settings/security'); setDropdownOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-[#A7C1B8] hover:bg-[#16352E] hover:text-[#A8E6CE] rounded-lg"
              >
                Security
              </button>
              <button
                onClick={() => { onNavigate('/app/help'); setDropdownOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-[#A7C1B8] hover:bg-[#16352E] hover:text-[#A8E6CE] rounded-lg"
              >
                Help Center
              </button>
              <div className="border-t border-[#28443C] mt-1 pt-1">
                <button
                  onClick={() => { logout(); onNavigate('/'); setDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-[#EB7676] hover:bg-[#16352E] rounded-lg"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
