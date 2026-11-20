import React from 'react';
import { Search, Sparkles, Bell, Menu, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslations } from '../../utils/i18n';

interface AppTopbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenAI: () => void;
  onOpenCommandPalette?: () => void;
  onToggleMobileSidebar?: () => void;
}

export const AppTopbar: React.FC<AppTopbarProps> = ({
  currentPath,
  onNavigate,
  onOpenAI,
  onOpenCommandPalette,
  onToggleMobileSidebar,
}) => {
  const { user, preferences, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations(preferences?.language);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const pathParts = currentPath.split('/').filter(Boolean);
  const breadcrumb =
    pathParts.length > 1
      ? pathParts
          .slice(1)
          .map(p =>
            p
              .split('-')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          )
          .join(' / ')
      : 'Dashboard';

  return (
    <header className="h-[68px] border-b border-[var(--fs-border)] bg-[var(--fs-surface)]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Left: Mobile drawer trigger & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-1.5 rounded-lg text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)]"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-2 text-xs font-medium truncate">
          <span className="text-[var(--fs-text-muted)] hidden sm:inline">Workspace</span>
          <span className="text-[var(--fs-text-muted)] hidden sm:inline">/</span>
          <span className="text-[var(--fs-text)] font-semibold truncate">{breadcrumb}</span>
        </div>
      </div>

      {/* Center: Cmd+K Quick Search Trigger */}
      <div className="hidden lg:flex items-center w-80">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between rounded-lg bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] px-3 py-1.5 text-xs text-[var(--fs-text-muted)] hover:border-[var(--fs-accent)] transition-colors"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>{t.common.searchPlaceholder}</span>
          </span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--fs-border)] bg-[var(--fs-surface)]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Search icon (mobile), Theme Toggle, Ask FinSight AI, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="lg:hidden p-2 rounded-lg text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)]"
            aria-label="Quick search"
          >
            <Search className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] transition-colors"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          onClick={onOpenAI}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--fs-brand)] dark:bg-[#168366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t.common.askAi}</span>
        </button>

        <button
          onClick={() => onNavigate('/app/notifications')}
          className="rounded-lg p-2 text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] transition-colors"
          title={t.nav.notifications}
          aria-label={t.nav.notifications}
        >
          <Bell className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="h-8 w-8 rounded-full bg-[var(--fs-brand)] text-white flex items-center justify-center text-xs font-bold hover:opacity-90"
            aria-label="Account menu"
          >
            {user?.fullName?.charAt(0) || 'U'}
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-[var(--fs-border)] bg-[var(--fs-surface)] p-1.5 shadow-xl z-50">
              <div className="px-3 py-2 border-b border-[var(--fs-border)] text-xs">
                <div className="font-semibold text-[var(--fs-text)] truncate">{user?.fullName}</div>
                <div className="text-[11px] text-[var(--fs-text-muted)] truncate">{user?.email}</div>
              </div>
              <button
                onClick={() => {
                  onNavigate('/app/settings/profile');
                  setDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] hover:text-[var(--fs-text)] rounded-lg"
              >
                My Profile
              </button>
              <button
                onClick={() => {
                  onNavigate('/app/settings/financial-preferences');
                  setDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] hover:text-[var(--fs-text)] rounded-lg"
              >
                Preferences & Language
              </button>
              <button
                onClick={() => {
                  onNavigate('/app/settings/security');
                  setDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] hover:text-[var(--fs-text)] rounded-lg"
              >
                Security & Data
              </button>
              <button
                onClick={() => {
                  onNavigate('/app/help');
                  setDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] hover:text-[var(--fs-text)] rounded-lg"
              >
                Help Center
              </button>
              <div className="border-t border-[var(--fs-border)] mt-1 pt-1">
                <button
                  onClick={() => {
                    logout();
                    onNavigate('/');
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-[var(--fs-danger)] hover:bg-[var(--fs-surface-secondary)] rounded-lg"
                >
                  {t.common.signOut}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
