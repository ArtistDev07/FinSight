import React from 'react';
import { ShieldCheck, ArrowRight, Menu, X, ChevronDown } from 'lucide-react';

interface PublicHeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({ currentPath, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [featuresDropdownOpen, setFeaturesDropdownOpen] = React.useState(false);

  const featureLinks = [
    { label: 'Smart Budgeting', path: '/features#budgeting' },
    { label: 'Investing & Portfolio Guide', path: '/features#investing' },
    { label: 'Trading & Market Insights', path: '/features#markets' },
    { label: 'Tax Helper', path: '/features#tax' },
    { label: 'Scam & Fraud Detector', path: '/features#fraud' },
    { label: 'Small Business Finance', path: '/features#business' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#28443C] bg-[#0B1C19]/90 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-6">
        {/* Brand Zone */}
        <div
          onClick={() => onNavigate('/')}
          className="flex cursor-pointer items-center gap-2.5 whitespace-nowrap shrink-0"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#16352E] border border-[#28443C] text-[#A8E6CE]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#F5F7F5]">FinSight</span>
        </div>

        {/* Desktop Nav Zone */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#A7C1B8]">
          <div className="relative">
            <button
              onClick={() => setFeaturesDropdownOpen(!featuresDropdownOpen)}
              className="flex items-center gap-1.5 hover:text-[#F5F7F5] transition-colors whitespace-nowrap shrink-0"
            >
              Features
              <ChevronDown className={`h-4 w-4 transition-transform ${featuresDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {featuresDropdownOpen && (
              <div className="absolute top-full left-0 mt-3 w-64 rounded-xl border border-[#28443C] bg-[#102722] p-2 shadow-2xl">
                {featureLinks.map(link => (
                  <button
                    key={link.label}
                    onClick={() => {
                      onNavigate('/features');
                      setFeaturesDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-[#A7C1B8] hover:bg-[#16352E] hover:text-[#A8E6CE] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onNavigate('/how-it-works')}
            className={`hover:text-[#F5F7F5] transition-colors whitespace-nowrap shrink-0 ${currentPath === '/how-it-works' ? 'text-[#A8E6CE]' : ''}`}
          >
            How It Works
          </button>
          <button
            onClick={() => onNavigate('/security')}
            className={`hover:text-[#F5F7F5] transition-colors whitespace-nowrap shrink-0 ${currentPath === '/security' ? 'text-[#A8E6CE]' : ''}`}
          >
            Security
          </button>
          <button
            onClick={() => onNavigate('/about')}
            className={`hover:text-[#F5F7F5] transition-colors whitespace-nowrap shrink-0 ${currentPath === '/about' ? 'text-[#A8E6CE]' : ''}`}
          >
            About
          </button>
          <button
            onClick={() => onNavigate('/contact')}
            className={`hover:text-[#F5F7F5] transition-colors whitespace-nowrap shrink-0 ${currentPath === '/contact' ? 'text-[#A8E6CE]' : ''}`}
          >
            Contact
          </button>
        </nav>

        {/* Action Zone */}
        <div className="hidden lg:flex items-center gap-4 shrink-0">
          <button
            onClick={() => onNavigate('/auth/sign-in')}
            className="text-sm font-medium text-[#A7C1B8] hover:text-[#F5F7F5] transition-colors px-3 py-2 whitespace-nowrap shrink-0"
          >
            Sign In
          </button>
          <button
            onClick={() => onNavigate('/auth/sign-up')}
            className="flex items-center gap-2 rounded-lg bg-[#A8E6CE] px-4 py-2 text-xs font-semibold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            Get Started
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden text-[#A7C1B8] hover:text-[#F5F7F5]"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#28443C] bg-[#102722] px-6 py-4 space-y-3">
          <button
            onClick={() => { onNavigate('/features'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-sm text-[#A7C1B8]"
          >
            Features
          </button>
          <button
            onClick={() => { onNavigate('/how-it-works'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-sm text-[#A7C1B8]"
          >
            How It Works
          </button>
          <button
            onClick={() => { onNavigate('/security'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-sm text-[#A7C1B8]"
          >
            Security
          </button>
          <button
            onClick={() => { onNavigate('/about'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-sm text-[#A7C1B8]"
          >
            About
          </button>
          <button
            onClick={() => { onNavigate('/contact'); setMobileMenuOpen(false); }}
            className="block w-full text-left py-2 text-sm text-[#A7C1B8]"
          >
            Contact
          </button>
          <div className="pt-4 border-t border-[#28443C] flex flex-col gap-2">
            <button
              onClick={() => { onNavigate('/auth/sign-in'); setMobileMenuOpen(false); }}
              className="w-full text-center py-2 text-sm text-[#A7C1B8] rounded-lg border border-[#28443C]"
            >
              Sign In
            </button>
            <button
              onClick={() => { onNavigate('/auth/sign-up'); setMobileMenuOpen(false); }}
              className="w-full text-center py-2 text-sm font-semibold text-[#0B1C19] bg-[#A8E6CE] rounded-lg"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
