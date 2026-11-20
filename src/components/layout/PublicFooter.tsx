import React from 'react';
import { FinSightLogo } from '../brand/FinSightArtwork';

interface PublicFooterProps {
  onNavigate: (path: string) => void;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-[var(--fs-border)] bg-[var(--fs-surface)] text-[var(--fs-text-body)] transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Brand Summary */}
          <div className="md:col-span-4 space-y-3">
            <FinSightLogo size="sm" />
            <p className="text-xs leading-relaxed text-[var(--fs-text-body)] max-w-xs">
              Financial clarity. Intelligent decisions. Better control. Designed for households, salaried professionals, investors, and small businesses in India.
            </p>
            <p className="text-[11px] font-mono text-[var(--fs-text-muted)]">
              INR (₹) · CBDT FY 2025-26 · NSE India Archive
            </p>
          </div>

          {/* Product */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--fs-text)]">Platform</h4>
            <ul className="space-y-1.5 text-xs">
              <li><button onClick={() => onNavigate('/features')} className="hover:text-[var(--fs-text)]">Features</button></li>
              <li><button onClick={() => onNavigate('/how-it-works')} className="hover:text-[var(--fs-text)]">How It Works</button></li>
              <li><button onClick={() => onNavigate('/app/financial-health')} className="hover:text-[var(--fs-text)]">Financial Health Index</button></li>
              <li><button onClick={() => onNavigate('/app/money-calendar')} className="hover:text-[var(--fs-text)]">Cash-Flow Radar</button></li>
              <li><button onClick={() => onNavigate('/app/fraud')} className="hover:text-[var(--fs-text)]">Scam & Fraud Shield</button></li>
            </ul>
          </div>

          {/* Company & Trust */}
          <div className="md:col-span-2 space-y-2.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--fs-text)]">Trust</h4>
            <ul className="space-y-1.5 text-xs">
              <li><button onClick={() => onNavigate('/security')} className="hover:text-[var(--fs-text)]">Security Model</button></li>
              <li><button onClick={() => onNavigate('/about')} className="hover:text-[var(--fs-text)]">About FinSight</button></li>
              <li><button onClick={() => onNavigate('/contact')} className="hover:text-[var(--fs-text)]">Contact Support</button></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--fs-text)]">Disclosures</h4>
            <ul className="space-y-1.5 text-xs">
              <li><button onClick={() => onNavigate('/privacy')} className="hover:text-[var(--fs-text)]">Privacy Policy</button></li>
              <li><button onClick={() => onNavigate('/terms')} className="hover:text-[var(--fs-text)]">Terms of Service</button></li>
              <li><button onClick={() => onNavigate('/disclaimer')} className="hover:text-[var(--fs-text)]">Financial & Tax Disclaimer</button></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[var(--fs-border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-[11px] text-[var(--fs-text-muted)]">
          <p>© {new Date().getFullYear()} FinSight Platform. Educational & personal financial clarity workspace.</p>
          <p>Not SEBI-registered advisory. Always verify tax filings with a qualified Chartered Accountant.</p>
        </div>
      </div>
    </footer>
  );
};
