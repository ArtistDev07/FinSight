import React, { useState } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { FinSightLogo } from '../brand/FinSightArtwork';
import { useTheme } from '../../contexts/ThemeContext';

interface PublicHeaderProps {
  onNavigate: (path: string) => void;
  currentPath: string;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({ onNavigate, currentPath }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const navLinks = [
    { label: 'Features', path: '/features' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Security', path: '/security' },
    { label: 'About', path: '/about' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--fs-border)] bg-[var(--fs-bg)]/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Zone 1: Brand */}
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="flex items-center shrink-0 text-left focus:outline-none"
          aria-label="FinSight Home"
        >
          <FinSightLogo size="md" />
        </button>

        {/* Zone 2: Primary Navigation (4 concise links) */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`text-[14px] font-medium whitespace-nowrap transition-colors ${
                currentPath === item.path
                  ? 'text-[var(--fs-brand)] dark:text-[#A8E6CE] font-semibold'
                  : 'text-[var(--fs-text-body)] hover:text-[var(--fs-text)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Actions */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-[var(--fs-border)] text-[var(--fs-text-body)] hover:bg-[var(--fs-surface-secondary)] transition-colors"
            aria-label="Toggle color theme"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/auth/sign-in')}
            className="px-3 py-2 text-[14px] font-medium text-[var(--fs-text)] hover:text-[var(--fs-accent)] whitespace-nowrap transition-colors"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/auth/sign-up')}
            className="fs-btn-primary px-4 py-2 text-[14px] whitespace-nowrap"
          >
            Get Started
          </button>
        </div>

        {/* Mobile menu trigger */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-[var(--fs-border)] text-[var(--fs-text-body)]"
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-[var(--fs-text)] hover:bg-[var(--fs-surface-secondary)]"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--fs-border)] bg-[var(--fs-surface)] px-4 py-4 space-y-2">
          {navLinks.map(item => (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                onNavigate(item.path);
                setMobileMenuOpen(false);
              }}
              className="block w-full text-left py-2 text-sm font-medium text-[var(--fs-text)] hover:text-[var(--fs-accent)]"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-3 border-t border-[var(--fs-border)] flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                onNavigate('/auth/sign-in');
                setMobileMenuOpen(false);
              }}
              className="w-full py-2.5 text-center text-sm font-medium text-[var(--fs-text)] border border-[var(--fs-border)] rounded-lg"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigate('/auth/sign-up');
                setMobileMenuOpen(false);
              }}
              className="w-full py-2.5 text-center text-sm font-semibold fs-btn-primary"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
