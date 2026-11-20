import React, { useState, useEffect } from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppTopbar } from './components/layout/AppTopbar';
import { GlobalAIAssistant } from './components/ai/GlobalAIAssistant';

// Pages
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

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}

function MainRouter() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname !== '/' ? window.location.pathname : '/';
  });
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Sync route navigation
  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    window.scrollTo(0, 0);
    setMobileSidebarOpen(false);
  };

  // Determine current active module for AI contextualization
  const getContextModule = () => {
    if (currentPath.includes('/budgeting')) return 'Smart Budgeting & UPI Transactions';
    if (currentPath.includes('/investments')) return 'Portfolio Guide & Asset Allocation';
    if (currentPath.includes('/markets')) return 'NSE Markets & Historical Paper Trading';
    if (currentPath.includes('/tax')) return 'Indian Tax Helper & Section 80C/80D';
    if (currentPath.includes('/fraud')) return 'Scam & Phishing Message Scanner';
    if (currentPath.includes('/business')) return 'Small Business Finance & GST Invoicing';
    return 'General Indian Financial Intelligence';
  };

  // Render Public Website routes
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
    const pageName = currentPath.replace('/', '') as any;
    return <PublicStaticPage page={pageName} onNavigate={handleNavigate} />;
  }

  // Authentication routes
  if (currentPath.startsWith('/auth/')) {
    const rawMode = currentPath.replace('/auth/', '');
    const validModes = ['sign-in', 'sign-up', 'forgot-password', 'reset-password', 'verify-email'];
    const authMode = validModes.includes(rawMode) ? (rawMode as any) : 'sign-in';
    return <AuthPage mode={authMode} onNavigate={handleNavigate} />;
  }

  // Wait for Firebase Auth initialization on protected routes
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1C19] text-[#F5F7F5] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-[#28443C] border-t-[#A8E6CE] animate-spin" />
          <p className="text-xs text-[#A7C1B8]">Verifying your FinSight session...</p>
        </div>
      </div>
    );
  }

  // Enforce authentication for onboarding, app workspace, and admin routes
  if (!isAuthenticated) {
    return <AuthPage mode="sign-in" onNavigate={handleNavigate} />;
  }

  // Onboarding routes
  if (currentPath.startsWith('/onboarding/')) {
    return <OnboardingFlow onNavigate={handleNavigate} />;
  }

  // Admin Routes (Strictly protected by verified backend admin authorization)
  if (currentPath.startsWith('/admin') || currentPath.startsWith('/app/admin')) {
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-[#0B1C19] text-[#F5F7F5] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-[#EB7676]/40 bg-[#102722] p-8 text-center space-y-4">
            <div className="h-12 w-12 mx-auto rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/30 flex items-center justify-center text-[#EB7676]">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-[#F5F7F5]">403 — Administrator Access Required</h1>
            <p className="text-xs text-[#A7C1B8]">
              Your account does not have verified administrator privileges to view the FinSight Admin Console.
            </p>
            <button
              onClick={() => handleNavigate('/app/dashboard')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#A8E6CE] px-5 py-2.5 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen bg-[#0B1C19]">
        <div className="hidden md:block shrink-0">
          <AppSidebar currentPath={currentPath} onNavigate={handleNavigate} />
        </div>
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-black/70 flex">
            <div className="w-64 bg-[#0B1C19] h-full shadow-2xl">
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
            onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          />
          <main className="flex-1 overflow-y-auto">
            <AdminDashboard onNavigate={handleNavigate} />
          </main>
        </div>
        <GlobalAIAssistant
          isOpen={isAIOpen}
          onClose={() => setIsAIOpen(false)}
          currentModule={getContextModule()}
        />
      </div>
    );
  }

  // Authenticated Application Layout (/app/*)
  return (
    <div className="flex min-h-screen bg-[#0B1C19]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0">
        <AppSidebar currentPath={currentPath} onNavigate={handleNavigate} />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/70 flex">
          <div className="w-64 bg-[#0B1C19] h-full shadow-2xl">
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
          onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {currentPath === '/app' || currentPath === '/app/dashboard' ? (
            <DashboardPage onNavigate={handleNavigate} onOpenAI={() => setIsAIOpen(true)} />
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
          ) : currentPath === '/app/investments' ? (
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

      {/* Global AI Assistant slide-over */}
      <GlobalAIAssistant
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
        currentModule={getContextModule()}
      />
    </div>
  );
}
