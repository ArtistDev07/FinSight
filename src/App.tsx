import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ArrowLeft,
  LayoutDashboard,
  Upload,
  Calendar,
  Target,
  Sparkles,
} from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppTopbar } from './components/layout/AppTopbar';
import { CommandPaletteModal } from './components/layout/CommandPaletteModal';
import { GlobalAIAssistant } from './components/ai/GlobalAIAssistant';

// Existing Pages
import { LandingPage } from './pages/public/LandingPage';
import { PublicStaticPage } from './pages/public/PublicStaticPage';
import { AuthPage } from './pages/auth/AuthPage';
import { OnboardingFlow } from './pages/onboarding/OnboardingFlow';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { BudgetingModule } from './pages/budgeting/BudgetingModule';
import { InvestmentsModule } from './pages/investments/InvestmentsModule';
import { MarketsModule } from './pages/markets/MarketsModule';
import { TaxModule } from './pages/tax/TaxModule';
import { FraudModule } from './pages/fraud/FraudModule';
import { BusinessModule } from './pages/business/BusinessModule';
import { SettingsModule } from './pages/settings/SettingsModule';
import { AdminDashboard } from './pages/admin/AdminDashboard';

// FinSight 2.0 Pages
import { FinancialHealthPage } from './pages/financial-health/FinancialHealthPage';
import { MoneyCalendarPage } from './pages/money-calendar/MoneyCalendarPage';
import { CreditCardsPage } from './pages/credit-cards/CreditCardsPage';
import { RecurringPaymentsPage } from './pages/recurring/RecurringPaymentsPage';
import { GoalsPage } from './pages/goals/GoalsPage';
import { ReceivablesPage } from './pages/business/ReceivablesPage';
import { ReconciliationPage } from './pages/business/ReconciliationPage';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <MainRouter />
      </ThemeProvider>
    </AuthProvider>
  );
}

function MainRouter() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname !== '/' ? window.location.pathname : '/';
  });
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Global Ctrl/Cmd + K Command Palette shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        if (!isAuthenticated) return;
        e.preventDefault();
        setCmdPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAuthenticated]);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    window.scrollTo(0, 0);
    setMobileSidebarOpen(false);
    setCmdPaletteOpen(false);
  };

  const getContextModule = () => {
    if (currentPath.includes('/financial-health')) return 'Financial Health Score & Net Worth Breakdown';
    if (currentPath.includes('/money-calendar')) return 'Money Calendar & 30-Day Cash Flow Radar';
    if (currentPath.includes('/credit-cards')) return 'Credit Card Utilization & Debt Payoff Strategy';
    if (currentPath.includes('/recurring-payments')) return 'Recurring Payments & Subscriptions Audit';
    if (currentPath.includes('/goals')) return 'Financial Goals & Monthly Contribution Planning';
    if (currentPath.includes('/budgeting')) return 'Smart Budgeting, Money Inbox & UPI Transactions';
    if (currentPath.includes('/investments')) return 'Portfolio Guide, Risk & Decision Journal';
    if (currentPath.includes('/markets')) return 'NSE Markets & Historical Paper Trading';
    if (currentPath.includes('/tax')) return 'Indian Tax Helper, Filing Readiness & Section 80C/80D';
    if (currentPath.includes('/fraud')) return 'Scam Shield, Lookalike Domain Check & Cybercrime 1930';
    if (currentPath.includes('/business/receivables')) return 'Business Receivables Aging & Payment Follow-Ups';
    if (currentPath.includes('/business/reconciliation')) return 'Business Ledger & Bank Reconciliation';
    if (currentPath.includes('/business')) return 'Small Business Finance & GST Invoicing';
    return 'General Indian Financial Intelligence';
  };

  // Public Website Routes
  if (currentPath === '/') {
    return <LandingPage onNavigate={handleNavigate} />;
  }

  if (
    currentPath === '/features' ||
    currentPath === '/how-it-works' ||
    currentPath === '/security' ||
    currentPath === '/about' ||
    currentPath === '/contact' ||
    currentPath === '/privacy' ||
    currentPath === '/terms' ||
    currentPath === '/disclaimer'
  ) {
    const pageName = currentPath.replace('/', '') as
      | 'features'
      | 'how-it-works'
      | 'security'
      | 'about'
      | 'contact'
      | 'privacy'
      | 'terms'
      | 'disclaimer';
    return <PublicStaticPage page={pageName} onNavigate={handleNavigate} />;
  }

  // Authentication routes
  if (currentPath.startsWith('/auth/')) {
    const rawMode = currentPath.replace('/auth/', '');
    const validModes = ['sign-in', 'sign-up', 'forgot-password', 'reset-password', 'verify-email'];
    const authMode = validModes.includes(rawMode)
      ? (rawMode as 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password' | 'verify-email')
      : 'sign-in';
    return <AuthPage mode={authMode} onNavigate={handleNavigate} />;
  }

  // Wait for Firebase Auth initialization on protected routes
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--fs-bg)] text-[var(--fs-text)] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-[var(--fs-border)] border-t-[var(--fs-accent)] animate-spin" />
          <p className="text-xs text-[var(--fs-text-body)]">Verifying your FinSight session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage mode="sign-in" onNavigate={handleNavigate} />;
  }

  if (currentPath.startsWith('/onboarding/')) {
    return <OnboardingFlow onNavigate={handleNavigate} />;
  }

  // Admin Routes
  if (currentPath.startsWith('/admin') || currentPath.startsWith('/app/admin')) {
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-[var(--fs-bg)] text-[var(--fs-text)] flex items-center justify-center p-6">
          <div className="max-w-md w-full fs-card border-[var(--fs-danger)]/40 p-8 text-center space-y-4">
            <div className="h-12 w-12 mx-auto rounded-xl bg-[var(--fs-danger)]/10 border border-[var(--fs-danger)]/30 flex items-center justify-center text-[var(--fs-danger)]">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-[var(--fs-text)]">
              403 — Administrator Access Required
            </h1>
            <p className="text-xs text-[var(--fs-text-body)]">
              Your account does not have verified administrator privileges to view the FinSight Admin Console.
            </p>
            <button
              onClick={() => handleNavigate('/app/dashboard')}
              className="fs-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen bg-[var(--fs-bg)] text-[var(--fs-text)] transition-colors">
        <div className="hidden md:block shrink-0">
          <AppSidebar currentPath={currentPath} onNavigate={handleNavigate} />
        </div>
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-black/60 flex">
            <div className="w-64 bg-[var(--fs-surface)] h-full shadow-2xl">
              <AppSidebar currentPath={currentPath} onNavigate={handleNavigate} />
            </div>
            <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
          </div>
        )}
        <div className="flex-1 flex flex-col min-w-0">
          <AppTopbar
            currentPath={currentPath}
            onNavigate={handleNavigate}
            onOpenAI={() => setIsAIOpen(true)}
            onOpenCommandPalette={() => setCmdPaletteOpen(true)}
            onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          />
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            <AdminDashboard onNavigate={handleNavigate} />
          </main>
        </div>
        <GlobalAIAssistant
          isOpen={isAIOpen}
          onClose={() => setIsAIOpen(false)}
          currentModule={getContextModule()}
        />
        <CommandPaletteModal
          isOpen={cmdPaletteOpen}
          onClose={() => setCmdPaletteOpen(false)}
          onNavigate={handleNavigate}
          onOpenAI={() => {
            setCmdPaletteOpen(false);
            setIsAIOpen(true);
          }}
        />
      </div>
    );
  }

  // Authenticated Workspace Layout (/app/*)
  return (
    <div className="flex min-h-screen bg-[var(--fs-bg)] text-[var(--fs-text)] transition-colors">
      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0">
        <AppSidebar currentPath={currentPath} onNavigate={handleNavigate} />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/60 flex">
          <div className="w-64 bg-[var(--fs-surface)] h-full shadow-2xl">
            <AppSidebar currentPath={currentPath} onNavigate={handleNavigate} />
          </div>
          <div className="flex-1" onClick={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppTopbar
          currentPath={currentPath}
          onNavigate={handleNavigate}
          onOpenAI={() => setIsAIOpen(true)}
          onOpenCommandPalette={() => setCmdPaletteOpen(true)}
          onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {currentPath === '/app' || currentPath === '/app/dashboard' ? (
            <DashboardPage onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/financial-health' ? (
            <FinancialHealthPage onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/money-calendar' ? (
            <MoneyCalendarPage onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/credit-cards' || currentPath.startsWith('/app/credit-cards/') ? (
            <CreditCardsPage onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/recurring-payments' ? (
            <RecurringPaymentsPage onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/goals' || currentPath.startsWith('/app/goals/') ? (
            <GoalsPage onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/budgeting' ? (
            <BudgetingModule subview="overview" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/budgeting/transactions' ? (
            <BudgetingModule subview="transactions" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/budgeting/import' ? (
            <BudgetingModule subview="import" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/budgeting/budgets' ? (
            <BudgetingModule subview="budgets" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/budgeting/insights' ? (
            <BudgetingModule subview="insights" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/investments' || currentPath === '/app/investments/portfolio' ? (
            <InvestmentsModule subview="overview" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/investments/learn' ? (
            <InvestmentsModule subview="learn" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/markets' ? (
            <MarketsModule subview="overview" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/markets/watchlist' ? (
            <MarketsModule subview="watchlist" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/markets/backtest' ? (
            <MarketsModule subview="backtest" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/markets/paper-trading' ? (
            <MarketsModule subview="paper-trading" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/tax' ? (
            <TaxModule subview="overview" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/tax/compare' ? (
            <TaxModule subview="compare" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/tax/calculator' ? (
            <TaxModule subview="calculator" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/tax/deductions' ? (
            <TaxModule subview="deductions" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/tax/documents' ? (
            <TaxModule subview="documents" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/tax/summary' ? (
            <TaxModule subview="summary" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/fraud' ? (
            <FraudModule subview="overview" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/fraud/analyze' ? (
            <FraudModule subview="analyze" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/fraud/reports' ? (
            <FraudModule subview="reports" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/business/receivables' ? (
            <ReceivablesPage onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/business/reconciliation' ? (
            <ReconciliationPage onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/business' ? (
            <BusinessModule subview="overview" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/business/invoices' ? (
            <BusinessModule subview="invoices" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/business/invoices/new' ? (
            <BusinessModule subview="new-invoice" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/business/clients' ? (
            <BusinessModule subview="clients" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/business/expenses' ? (
            <BusinessModule subview="expenses" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/business/cash-flow' ? (
            <BusinessModule subview="cash-flow" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/business/emi-planner' ? (
            <BusinessModule subview="emi-planner" onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          ) : currentPath === '/app/notifications' ? (
            <SettingsModule subview="notifications" onNavigate={handleNavigate} />
          ) : currentPath === '/app/settings/profile' ? (
            <SettingsModule subview="profile" onNavigate={handleNavigate} />
          ) : currentPath === '/app/settings/financial-preferences' ? (
            <SettingsModule subview="preferences" onNavigate={handleNavigate} />
          ) : currentPath === '/app/settings/security' ? (
            <SettingsModule subview="security" onNavigate={handleNavigate} />
          ) : currentPath === '/app/settings/data-management' ? (
            <SettingsModule subview="data" onNavigate={handleNavigate} />
          ) : currentPath === '/app/help' ? (
            <SettingsModule subview="help" onNavigate={handleNavigate} />
          ) : (
            <DashboardPage onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--fs-border)] bg-[var(--fs-surface)]/95 backdrop-blur-md px-2 py-1.5 flex items-center justify-around"
      >
        {[
          { label: 'Home', path: '/app/dashboard', icon: LayoutDashboard },
          { label: 'Inbox', path: '/app/budgeting/import', icon: Upload },
          { label: 'Calendar', path: '/app/money-calendar', icon: Calendar },
          { label: 'Goals', path: '/app/goals', icon: Target },
        ].map(item => {
          const Icon = item.icon;
          const active = currentPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold ${
                active ? 'text-[var(--fs-accent)]' : 'text-[var(--fs-text-muted)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setIsAIOpen(true)}
          className="flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-[var(--fs-accent)]"
        >
          <Sparkles className="h-4 w-4" />
          <span>Ask AI</span>
        </button>
      </nav>

      {/* Global AI Assistant slide-over */}
      <GlobalAIAssistant
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        currentModule={getContextModule()}
      />

      {/* Global Command Palette (Ctrl/Cmd + K) */}
      <CommandPaletteModal
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNavigate={handleNavigate}
        onOpenAI={() => {
          setCmdPaletteOpen(false);
          setIsAIOpen(true);
        }}
      />
    </div>
  );
}
