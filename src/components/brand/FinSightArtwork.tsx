import React from 'react';

export const FinSightMark: React.FC<{ className?: string; size?: number }> = ({
  className = 'h-8 w-8',
  size,
}) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={size ? 'shrink-0' : className}
    style={size ? { width: size, height: size } : undefined}
    aria-hidden="true"
  >
    <rect width="36" height="36" rx="10" className="fill-[#123D32] dark:fill-[#17342A]" />
    <rect
      x="0.5"
      y="0.5"
      width="35"
      height="35"
      rx="9.5"
      className="stroke-[#168366]/40 dark:stroke-[#66C49F]/30"
    />
    {/* Abstract F-pillar */}
    <path
      d="M10.5 25.5V11.5C10.5 10.9477 10.9477 10.5 11.5 10.5H24"
      stroke="#BCE8D3"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <path
      d="M10.5 17.5H19"
      stroke="#BCE8D3"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    {/* Ascending clarity line */}
    <path
      d="M14.5 24L19 19L22 21L26.5 14.5"
      className="stroke-[#66C49F] dark:stroke-[#BCE8D3]"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="26.5" cy="14.5" r="2" className="fill-[#BCE8D3] dark:fill-[#66C49F]" />
  </svg>
);

export const FinSightLogo: React.FC<{
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}> = ({ compact = false, size = 'md', onClick, className = '' }) => {
  const markSize = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-9 w-9' : 'h-8 w-8';
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';
  const content = (
    <>
      <FinSightMark className={`${markSize} shrink-0`} />
      {!compact && (
        <span className={`font-display ${textSize} font-bold tracking-tight text-[#172923] dark:text-[#F0F6F2]`}>
          FinSight
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#168366] rounded-lg ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 ${className}`}>
      {content}
    </span>
  );
};

export const HeroConnectedFinanceArtwork: React.FC = () => (
  <div className="relative w-full rounded-[20px] border border-[#DEE7E0] dark:border-[#29453A] bg-[#FFFFFF] dark:bg-[#10231E] p-4 sm:p-8 overflow-hidden shadow-sm">
    {/* Subtle technical grid background */}
    <div
      className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
      style={{
        backgroundImage:
          'linear-gradient(to right, #DEE7E0 1px, transparent 1px), linear-gradient(to bottom, #DEE7E0 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }}
    />

    <div className="relative space-y-5 sm:space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DEE7E0] dark:border-[#29453A] pb-3.5 sm:pb-4">
        <div>
          <p className="text-xs font-medium text-[#819188] dark:text-[#A3B9AD]">
            Connected Financial Clarity Map
          </p>
          <p className="font-display text-base sm:text-lg font-bold text-[#172923] dark:text-[#F0F6F2]">
            Monthly Cash &amp; Risk Architecture
          </p>
        </div>
        <span className="font-mono-num text-[11px] sm:text-xs font-medium text-[#21845D] dark:text-[#58C993] whitespace-nowrap">
          Illustrative Preview
        </span>
      </div>

      {/* Connected Node Diagram SVG */}
      <svg
        viewBox="0 0 640 310"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        role="img"
        aria-label="Diagram connecting Income, Spending, Credit Cards, Goals, and Portfolio into Cash-Flow Projections"
      >
        {/* Connecting Curves */}
        <path
          d="M170 55 C245 55, 250 155, 315 155"
          className="stroke-[#168366]/45 dark:stroke-[#66C49F]/45"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d="M170 155 L315 155"
          className="stroke-[#168366]/60 dark:stroke-[#66C49F]/60"
          strokeWidth="2"
        />
        <path
          d="M170 255 C245 255, 250 155, 315 155"
          className="stroke-[#C48A32]/50 dark:stroke-[#E9BE70]/50"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d="M365 155 C425 155, 430 68, 480 68"
          className="stroke-[#21845D]/60 dark:stroke-[#58C993]/60"
          strokeWidth="2"
        />
        <path
          d="M365 155 C425 155, 430 155, 480 155"
          className="stroke-[#168366]/65 dark:stroke-[#66C49F]/65"
          strokeWidth="2"
        />
        <path
          d="M365 155 C425 155, 430 242, 480 242"
          className="stroke-[#477EAD]/60 dark:stroke-[#7BB9DC]/60"
          strokeWidth="2"
        />

        {/* Left Inputs */}
        <g>
          <rect x="16" y="22" width="154" height="66" rx="12" className="fill-[#EDF3EF] dark:fill-[#17342A] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <text x="30" y="45" className="fill-[#53675E] dark:fill-[#A3B9AD]" fontSize="11" fontFamily="Inter, sans-serif">Monthly Income</text>
          <text x="30" y="70" className="fill-[#172923] dark:fill-[#F0F6F2]" fontSize="16" fontWeight="600" fontFamily="IBM Plex Mono, monospace">₹1,45,000</text>
        </g>

        <g>
          <rect x="16" y="122" width="154" height="66" rx="12" className="fill-[#EDF3EF] dark:fill-[#17342A] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <text x="30" y="145" className="fill-[#53675E] dark:fill-[#A3B9AD]" fontSize="11" fontFamily="Inter, sans-serif">Categorized Spend</text>
          <text x="30" y="170" className="fill-[#172923] dark:fill-[#F0F6F2]" fontSize="16" fontWeight="600" fontFamily="IBM Plex Mono, monospace">₹68,400</text>
        </g>

        <g>
          <rect x="16" y="222" width="154" height="66" rx="12" className="fill-[#EDF3EF] dark:fill-[#17342A] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <text x="30" y="245" className="fill-[#53675E] dark:fill-[#A3B9AD]" fontSize="11" fontFamily="Inter, sans-serif">Upcoming Card & EMI</text>
          <text x="30" y="270" className="fill-[#C48A32] dark:fill-[#E9BE70]" fontSize="16" fontWeight="600" fontFamily="IBM Plex Mono, monospace">₹24,500</text>
        </g>

        {/* Center Intelligence Core */}
        <g>
          <circle cx="340" cy="155" r="44" className="fill-[#123D32] dark:fill-[#17342A] stroke-[#168366] dark:stroke-[#66C49F]" strokeWidth="2" />
          <path d="M326 168V142H346M326 155H340" stroke="#BCE8D3" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M332 167L339 158L344 161L353 148" stroke="#66C49F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Right Outputs */}
        <g>
          <rect x="480" y="34" width="144" height="68" rx="12" className="fill-[#FFFFFF] dark:fill-[#0A1815] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <text x="494" y="57" className="fill-[#53675E] dark:fill-[#A3B9AD]" fontSize="11" fontFamily="Inter, sans-serif">Safe Surplus</text>
          <text x="494" y="82" className="fill-[#21845D] dark:fill-[#58C993]" fontSize="16" fontWeight="600" fontFamily="IBM Plex Mono, monospace">₹52,100</text>
        </g>

        <g>
          <rect x="480" y="121" width="144" height="68" rx="12" className="fill-[#FFFFFF] dark:fill-[#0A1815] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <text x="494" y="144" className="fill-[#53675E] dark:fill-[#A3B9AD]" fontSize="11" fontFamily="Inter, sans-serif">Emergency Runway</text>
          <text x="494" y="169" className="fill-[#168366] dark:fill-[#66C49F]" fontSize="16" fontWeight="600" fontFamily="IBM Plex Mono, monospace">5.2 Months</text>
        </g>

        <g>
          <rect x="480" y="208" width="144" height="68" rx="12" className="fill-[#FFFFFF] dark:fill-[#0A1815] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <text x="494" y="231" className="fill-[#53675E] dark:fill-[#A3B9AD]" fontSize="11" fontFamily="Inter, sans-serif">Portfolio Equity</text>
          <text x="494" y="256" className="fill-[#477EAD] dark:fill-[#7BB9DC]" fontSize="16" fontWeight="600" fontFamily="IBM Plex Mono, monospace">₹6,84,200</text>
        </g>
      </svg>

      {/* Bottom Causal Summary */}
      <div className="rounded-xl bg-[#EDF3EF] dark:bg-[#17342A] border border-[#DEE7E0] dark:border-[#29453A] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <span className="text-[#172923] dark:text-[#F0F6F2] font-medium">
          Deterministic balances meet contextual Gemini explanations — zero hidden math.
        </span>
        <span className="font-mono-num text-[#168366] dark:text-[#66C49F] shrink-0">
          Income − Spend − Obligations = Projected Cash
        </span>
      </div>
    </div>
  </div>
);

export type FeatureIllustrationType =
  | 'budgeting'
  | 'investing'
  | 'markets'
  | 'tax'
  | 'fraud'
  | 'business';

export const FeatureIllustration: React.FC<{
  type?: FeatureIllustrationType;
  kind?: FeatureIllustrationType;
  className?: string;
}> = ({
  type,
  kind,
  className = 'w-full h-24',
}) => {
  switch (type || kind || 'budgeting') {
    case 'budgeting':
      return (
        <svg viewBox="0 0 220 96" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="10" width="208" height="76" rx="10" className="fill-[#EDF3EF] dark:fill-[#17342A] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <rect x="20" y="26" width="110" height="8" rx="4" className="fill-[#168366] dark:fill-[#66C49F]" />
          <rect x="20" y="44" width="152" height="8" rx="4" className="fill-[#123D32]/70 dark:fill-[#BCE8D3]/70" />
          <rect x="20" y="62" width="76" height="8" rx="4" className="fill-[#C48A32] dark:fill-[#E9BE70]" />
          <circle cx="188" cy="48" r="14" className="fill-[#FFFFFF] dark:fill-[#10231E] stroke-[#168366] dark:stroke-[#66C49F]" strokeWidth="2" />
          <path d="M183 48l3 3 7-7" className="stroke-[#21845D] dark:stroke-[#58C993]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'investing':
      return (
        <svg viewBox="0 0 220 96" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="10" width="208" height="76" rx="10" className="fill-[#EDF3EF] dark:fill-[#17342A] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <circle cx="52" cy="48" r="22" className="stroke-[#DEE7E0] dark:stroke-[#29453A]" strokeWidth="8" />
          <circle cx="52" cy="48" r="22" className="stroke-[#168366] dark:stroke-[#66C49F]" strokeWidth="8" strokeDasharray="88 140" strokeLinecap="round" />
          <rect x="92" y="28" width="96" height="8" rx="4" className="fill-[#123D32]/80 dark:fill-[#BCE8D3]/80" />
          <rect x="92" y="44" width="74" height="8" rx="4" className="fill-[#477EAD] dark:fill-[#7BB9DC]" />
          <rect x="92" y="60" width="54" height="8" rx="4" className="fill-[#819188]/60 dark:fill-[#A3B9AD]/50" />
        </svg>
      );
    case 'markets':
      return (
        <svg viewBox="0 0 220 96" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="10" width="208" height="76" rx="10" className="fill-[#EDF3EF] dark:fill-[#17342A] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <path d="M22 68 L56 54 L88 60 L124 38 L158 44 L196 24" className="stroke-[#168366] dark:stroke-[#66C49F]" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="124" cy="38" r="3.5" className="fill-[#123D32] dark:fill-[#BCE8D3]" />
          <circle cx="196" cy="24" r="4" className="fill-[#21845D] dark:fill-[#58C993]" />
          <line x1="22" y1="74" x2="198" y2="74" className="stroke-[#DEE7E0] dark:stroke-[#29453A]" />
        </svg>
      );
    case 'tax':
      return (
        <svg viewBox="0 0 220 96" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="10" width="208" height="76" rx="10" className="fill-[#EDF3EF] dark:fill-[#17342A] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <rect x="26" y="22" width="66" height="52" rx="8" className="fill-[#FFFFFF] dark:fill-[#10231E] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <rect x="128" y="22" width="66" height="52" rx="8" className="fill-[#FFFFFF] dark:fill-[#10231E] stroke-[#168366] dark:stroke-[#66C49F]" />
          <rect x="38" y="34" width="42" height="6" rx="3" className="fill-[#819188]/50" />
          <rect x="38" y="46" width="32" height="6" rx="3" className="fill-[#819188]/40" />
          <rect x="140" y="34" width="42" height="6" rx="3" className="fill-[#168366] dark:fill-[#66C49F]" />
          <rect x="140" y="46" width="28" height="6" rx="3" className="fill-[#21845D] dark:fill-[#58C993]" />
          <path d="M98 48h24" className="stroke-[#168366] dark:stroke-[#66C49F]" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'fraud':
      return (
        <svg viewBox="0 0 220 96" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="10" width="208" height="76" rx="10" className="fill-[#EDF3EF] dark:fill-[#17342A] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <path d="M62 24L84 32V48C84 61 73 70 62 74C51 70 40 61 40 48V32L62 24Z" className="fill-[#FFFFFF] dark:fill-[#10231E] stroke-[#168366] dark:stroke-[#66C49F]" strokeWidth="2" />
          <path d="M54 48l6 6 11-11" className="stroke-[#21845D] dark:stroke-[#58C993]" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="104" y="30" width="90" height="12" rx="4" className="fill-[#CB5252]/15 stroke-[#CB5252]/40" />
          <rect x="104" y="52" width="76" height="12" rx="4" className="fill-[#C48A32]/15 stroke-[#C48A32]/40" />
        </svg>
      );
    case 'business':
      return (
        <svg viewBox="0 0 220 96" fill="none" className={className} aria-hidden="true">
          <rect x="6" y="10" width="208" height="76" rx="10" className="fill-[#EDF3EF] dark:fill-[#17342A] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <rect x="26" y="48" width="22" height="24" rx="4" className="fill-[#123D32]/50 dark:fill-[#BCE8D3]/50" />
          <rect x="56" y="36" width="22" height="36" rx="4" className="fill-[#168366] dark:fill-[#66C49F]" />
          <rect x="86" y="26" width="22" height="46" rx="4" className="fill-[#21845D] dark:fill-[#58C993]" />
          <rect x="124" y="26" width="70" height="46" rx="8" className="fill-[#FFFFFF] dark:fill-[#10231E] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
          <rect x="134" y="36" width="46" height="6" rx="3" className="fill-[#168366] dark:fill-[#66C49F]" />
          <rect x="134" y="48" width="32" height="6" rx="3" className="fill-[#819188]/50" />
        </svg>
      );
  }
};

export type EmptyStateVariant =
  | 'transactions'
  | 'budgets'
  | 'portfolio'
  | 'watchlist'
  | 'tax'
  | 'fraud'
  | 'invoices'
  | 'clients'
  | 'recurring'
  | 'goals';

export const EmptyStateCard: React.FC<{
  variant: EmptyStateVariant;
  title: string;
  description?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ variant, title, description, body, actionLabel, onAction }) => (
  <div className="rounded-[14px] border border-[#DEE7E0] dark:border-[#29453A] bg-[#FFFFFF] dark:bg-[#10231E] p-8 text-center space-y-4">
    <div className="mx-auto w-28 h-20 flex items-center justify-center">
      <svg viewBox="0 0 120 84" fill="none" className="w-28 h-20" aria-hidden="true">
        <rect x="12" y="10" width="96" height="64" rx="12" className="fill-[#EDF3EF] dark:fill-[#17342A] stroke-[#DEE7E0] dark:stroke-[#29453A]" />
        {variant === 'fraud' ? (
          <path d="M60 22l18 7v12c0 11-8 19-18 22-10-3-18-11-18-22V29l18-7z" className="fill-[#FFFFFF] dark:fill-[#10231E] stroke-[#168366] dark:stroke-[#66C49F]" strokeWidth="2" />
        ) : variant === 'portfolio' || variant === 'watchlist' ? (
          <path d="M26 56L46 42L62 49L86 28" className="stroke-[#168366] dark:stroke-[#66C49F]" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : variant === 'goals' ? (
          <>
            <circle cx="60" cy="42" r="16" className="stroke-[#168366] dark:stroke-[#66C49F]" strokeWidth="2.2" />
            <circle cx="60" cy="42" r="7" className="fill-[#BCE8D3] dark:fill-[#66C49F]" />
          </>
        ) : (
          <>
            <rect x="28" y="28" width="64" height="8" rx="4" className="fill-[#168366]/35 dark:fill-[#66C49F]/35" />
            <rect x="28" y="42" width="46" height="7" rx="3.5" className="fill-[#819188]/30" />
            <rect x="28" y="54" width="34" height="7" rx="3.5" className="fill-[#819188]/20" />
          </>
        )}
      </svg>
    </div>
    <div className="max-w-md mx-auto space-y-1.5">
      <h3 className="font-display text-base font-bold text-[#172923] dark:text-[#F0F6F2]">{title}</h3>
      <p className="text-xs text-[#53675E] dark:text-[#A3B9AD] leading-relaxed">{description ?? body}</p>
    </div>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center justify-center rounded-[10px] bg-[#123D32] dark:bg-[#66C49F] px-4 py-2 text-xs font-semibold text-white dark:text-[#0A1815] hover:bg-[#168366] dark:hover:bg-[#BCE8D3] transition-colors whitespace-nowrap"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
