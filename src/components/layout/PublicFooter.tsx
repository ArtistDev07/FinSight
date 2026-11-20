import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface PublicFooterProps {
  onNavigate: (path: string) => void;
}

export const PublicFooter: React.FC<PublicFooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-[#28443C] bg-[#0B1C19] text-[#A7C1B8] pt-16 pb-12">
      <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 md:grid-cols-5 gap-10">
        {/* Brand Column */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-2 text-[#F5F7F5]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#16352E] border border-[#28443C] text-[#A8E6CE]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold">FinSight</span>
          </div>
          <p className="text-xs text-[#718D83] max-w-sm leading-relaxed">
            Financial clarity, powered by intelligent insights. Bringing budgeting, investments, historical market research, Indian taxes, fraud detection, and business finance together.
          </p>
          <div className="pt-2 text-xs text-[#718D83]">
            Engineered for India · INR (₹) · Asia/Kolkata
          </div>
        </div>

        {/* Product Column */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F5F7F5]">Product</h4>
          <ul className="space-y-2 text-xs">
            <li><button onClick={() => onNavigate('/features')} className="hover:text-[#A8E6CE] transition-colors">Features</button></li>
            <li><button onClick={() => onNavigate('/app/budgeting')} className="hover:text-[#A8E6CE] transition-colors">Smart Budgeting</button></li>
            <li><button onClick={() => onNavigate('/app/investments')} className="hover:text-[#A8E6CE] transition-colors">Portfolio Guide</button></li>
            <li><button onClick={() => onNavigate('/app/markets')} className="hover:text-[#A8E6CE] transition-colors">Market Insights</button></li>
            <li><button onClick={() => onNavigate('/app/tax')} className="hover:text-[#A8E6CE] transition-colors">Tax Helper</button></li>
            <li><button onClick={() => onNavigate('/app/fraud')} className="hover:text-[#A8E6CE] transition-colors">Fraud Detector</button></li>
            <li><button onClick={() => onNavigate('/app/business')} className="hover:text-[#A8E6CE] transition-colors">Business Finance</button></li>
          </ul>
        </div>

        {/* Resources Column */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F5F7F5]">Resources</h4>
          <ul className="space-y-2 text-xs">
            <li><button onClick={() => onNavigate('/how-it-works')} className="hover:text-[#A8E6CE] transition-colors">How It Works</button></li>
            <li><button onClick={() => onNavigate('/app/help')} className="hover:text-[#A8E6CE] transition-colors">Help Center</button></li>
            <li><button onClick={() => onNavigate('/security')} className="hover:text-[#A8E6CE] transition-colors">Security Architecture</button></li>
            <li><button onClick={() => onNavigate('/contact')} className="hover:text-[#A8E6CE] transition-colors">Contact Support</button></li>
          </ul>
        </div>

        {/* Legal Column */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F5F7F5]">Legal</h4>
          <ul className="space-y-2 text-xs">
            <li><button onClick={() => onNavigate('/privacy')} className="hover:text-[#A8E6CE] transition-colors">Privacy Policy</button></li>
            <li><button onClick={() => onNavigate('/terms')} className="hover:text-[#A8E6CE] transition-colors">Terms of Service</button></li>
            <li><button onClick={() => onNavigate('/disclaimer')} className="hover:text-[#A8E6CE] transition-colors">Financial Disclaimer</button></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 mt-12 pt-6 border-t border-[#28443C] flex flex-col md:flex-row items-center justify-between text-xs text-[#718D83] gap-4">
        <div>© 2026 FinSight. All rights reserved. Built for responsible financial intelligence.</div>
        <div className="flex items-center gap-6">
          <span>India</span>
          <span>·</span>
          <span>English</span>
          <span>·</span>
          <button onClick={() => onNavigate('/privacy')} className="hover:underline">Privacy</button>
          <span>·</span>
          <button onClick={() => onNavigate('/terms')} className="hover:underline">Terms</button>
        </div>
      </div>
    </footer>
  );
};
