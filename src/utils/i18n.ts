/**
 * Regional Bilingual Dictionary for FinSight (English + Hindi)
 * Provides clean financial terminology in both English and Hindi (हिन्दी).
 */

export type FinSightLanguage = 'English' | 'Hindi';

export interface TranslationDictionary {
  overviewGroup: string;
  myMoneyGroup: string;
  planGroup: string;
  investGroup: string;
  protectGroup: string;
  businessGroup: string;
  accountGroup: string;
  dashboard: string;
  financialHealth: string;
  smartBudgeting: string;
  transactions: string;
  moneyInbox: string;
  budgets: string;
  recurringPayments: string;
  moneyCalendar: string;
  financialGoals: string;
  creditCardsDebt: string;
  portfolio: string;
  markets: string;
  watchlist: string;
  backtesting: string;
  paperTrading: string;
  learnExplore: string;
  taxHelper: string;
  scamShield: string;
  businessOverview: string;
  invoices: string;
  receivables: string;
  expenses: string;
  reconciliation: string;
  cashFlow: string;
  emiPlanner: string;
  notifications: string;
  helpCenter: string;
  settings: string;
  signOut: string;
  askFinSightAI: string;
  quickActions: string;
  searchPlaceholder: string;
  greetingMorning: string;
  greetingSubtitle: string;
  netWorth: string;
  monthlyIncome: string;
  monthlyExpenses: string;
  availableBalance: string;
  moneyInMotion: string;
  comingUp: string;
  progressWorthTracking: string;
  whereYourMoneyGoes: string;
  investmentPicture: string;
  monthlyReview: string;
  financialDataQuality: string;
  addTransaction: string;
  importStatement: string;
  addGoal: string;
  addCreditCard: string;
  createBudget: string;
  analyzeMessage: string;
  createInvoice: string;
  lightTheme: string;
  darkTheme: string;
  nav: {
    overview: string;
    dashboard: string;
    financialHealth: string;
    moneyCalendar: string;
    myMoney: string;
    transactions: string;
    moneyInbox: string;
    budgets: string;
    recurring: string;
    creditCards: string;
    plan: string;
    goals: string;
    taxCenter: string;
    invest: string;
    investments: string;
    markets: string;
    paperTrading: string;
    protect: string;
    scamShield: string;
    business: string;
    businessHome: string;
    invoices: string;
    receivables: string;
    reconciliation: string;
    notifications: string;
    settings: string;
    help: string;
  };
  common: {
    signOut: string;
    askAi: string;
    searchPlaceholder: string;
  };
  modules: {
    financialHealthTitle: string;
    moneyCalendarTitle: string;
    creditCardsTitle: string;
    recurringTitle: string;
    goalsTitle: string;
    receivablesTitle: string;
    reconciliationTitle: string;
  };
}

const EN: TranslationDictionary = {
  overviewGroup: 'OVERVIEW',
  myMoneyGroup: 'MY MONEY',
  planGroup: 'PLAN',
  investGroup: 'INVEST',
  protectGroup: 'PROTECT',
  businessGroup: 'BUSINESS',
  accountGroup: 'ACCOUNT',
  dashboard: 'Dashboard',
  financialHealth: 'Financial Health',
  smartBudgeting: 'Smart Budgeting',
  transactions: 'Transactions',
  moneyInbox: 'Money Inbox',
  budgets: 'Budgets',
  recurringPayments: 'Recurring Payments',
  moneyCalendar: 'Money Calendar',
  financialGoals: 'Financial Goals',
  creditCardsDebt: 'Credit Cards & Debt',
  portfolio: 'Portfolio',
  markets: 'Markets',
  watchlist: 'Watchlist',
  backtesting: 'Backtesting',
  paperTrading: 'Paper Trading',
  learnExplore: 'Learn & Explore',
  taxHelper: 'Tax Helper',
  scamShield: 'Scam Shield',
  businessOverview: 'Business Overview',
  invoices: 'Invoices',
  receivables: 'Receivables',
  expenses: 'Expenses',
  reconciliation: 'Reconciliation',
  cashFlow: 'Cash Flow',
  emiPlanner: 'EMI Planner',
  notifications: 'Notifications',
  helpCenter: 'Help Center',
  settings: 'Settings',
  signOut: 'Sign Out',
  askFinSightAI: 'Ask FinSight AI',
  quickActions: 'Quick Actions',
  searchPlaceholder: 'Search tools, transactions, bills, goals...',
  greetingMorning: 'Good morning',
  greetingSubtitle: 'Here is what is happening with your money today.',
  netWorth: 'Net Worth',
  monthlyIncome: 'Monthly Income',
  monthlyExpenses: 'Monthly Expenses',
  availableBalance: 'Available Balance',
  moneyInMotion: 'Your Money in Motion',
  comingUp: 'Coming Up',
  progressWorthTracking: 'Progress Worth Tracking',
  whereYourMoneyGoes: 'Where Your Money Goes',
  investmentPicture: 'Your Investment Picture',
  monthlyReview: 'Your Monthly Money Review',
  financialDataQuality: 'Your Financial Data',
  addTransaction: 'Add Transaction',
  importStatement: 'Import Statement',
  addGoal: 'Add Goal',
  addCreditCard: 'Add Credit Card',
  createBudget: 'Create Budget',
  analyzeMessage: 'Analyze Message',
  createInvoice: 'Create Invoice',
  lightTheme: 'Light',
  darkTheme: 'Dark',
  nav: {
    overview: 'OVERVIEW',
    dashboard: 'Dashboard',
    financialHealth: 'Financial Health',
    moneyCalendar: 'Money Calendar',
    myMoney: 'MY MONEY',
    transactions: 'Transactions',
    moneyInbox: 'Money Inbox',
    budgets: 'Budgets',
    recurring: 'Recurring Payments',
    creditCards: 'Credit Cards & Debt',
    plan: 'PLAN',
    goals: 'Financial Goals',
    taxCenter: 'Tax Helper',
    invest: 'INVEST',
    investments: 'Portfolio',
    markets: 'Markets',
    paperTrading: 'Paper Trading',
    protect: 'PROTECT',
    scamShield: 'Scam Shield',
    business: 'BUSINESS',
    businessHome: 'Business Overview',
    invoices: 'Invoices',
    receivables: 'Receivables',
    reconciliation: 'Reconciliation',
    notifications: 'Notifications',
    settings: 'Settings',
    help: 'Help Center',
  },
  common: {
    signOut: 'Sign Out',
    askAi: 'Ask FinSight AI',
    searchPlaceholder: 'Search tools, transactions, bills, goals...',
  },
  modules: {
    financialHealthTitle: 'Financial Health Index',
    moneyCalendarTitle: 'Money Calendar & Cash-Flow Radar',
    creditCardsTitle: 'Credit Cards & Debt Control',
    recurringTitle: 'Recurring Payments & Subscriptions',
    goalsTitle: 'Financial Goals & Milestones',
    receivablesTitle: 'Receivables & Invoice Aging',
    reconciliationTitle: 'Business Reconciliation Workbench',
  },
};

const HI: TranslationDictionary = {
  overviewGroup: 'अवलोकन',
  myMoneyGroup: 'मेरा धन',
  planGroup: 'योजना',
  investGroup: 'निवेश',
  protectGroup: 'सुरक्षा',
  businessGroup: 'व्यापार',
  accountGroup: 'खाता',
  dashboard: 'डैशबोर्ड',
  financialHealth: 'वित्तीय स्वास्थ्य',
  smartBudgeting: 'स्मार्ट बजटिंग',
  transactions: 'लेन-देन',
  moneyInbox: 'मनी इनबॉक्स',
  budgets: 'बजट',
  recurringPayments: 'नियमित भुगतान',
  moneyCalendar: 'मनी कैलेंडर',
  financialGoals: 'वित्तीय लक्ष्य',
  creditCardsDebt: 'क्रेडिट कार्ड और ऋण',
  portfolio: 'पोर्टफोलियो',
  markets: 'बाज़ार और एनएसई',
  watchlist: 'वॉचलिस्ट',
  backtesting: 'बैकटेस्टिंग',
  paperTrading: 'पेपर ट्रेडिंग',
  learnExplore: 'निवेश सीखें',
  taxHelper: 'टैक्स सहायक',
  scamShield: 'स्कैम शील्ड',
  businessOverview: 'व्यापार अवलोकन',
  invoices: 'चालान (इनवॉइस)',
  receivables: 'प्राप्य राशि',
  expenses: 'व्यापार खर्च',
  reconciliation: 'वित्तीय मिलान',
  cashFlow: 'नकदी प्रवाह',
  emiPlanner: 'ईएमआई योजनाकार',
  notifications: 'सूचनाएं',
  helpCenter: 'सहायता केंद्र',
  settings: 'सेटिंग्स',
  signOut: 'साइन आउट',
  askFinSightAI: 'FinSight AI से पूछें',
  quickActions: 'त्वरित कार्य',
  searchPlaceholder: 'टूल, लेन-देन, बिल या लक्ष्य खोजें...',
  greetingMorning: 'सुप्रभात',
  greetingSubtitle: 'आज आपके धन और वित्तीय स्थिति का पूरा विवरण।',
  netWorth: 'कुल नेट वर्थ',
  monthlyIncome: 'मासिक आय',
  monthlyExpenses: 'मासिक खर्च',
  availableBalance: 'उपलब्ध शेष',
  moneyInMotion: 'आपके धन का प्रवाह',
  comingUp: 'आगामी भुगतान और देनदारियाँ',
  progressWorthTracking: 'लक्ष्यों की प्रगति',
  whereYourMoneyGoes: 'आपका पैसा कहाँ जा रहा है',
  investmentPicture: 'आपकी निवेश स्थिति',
  monthlyReview: 'मासिक वित्तीय समीक्षा',
  financialDataQuality: 'आपके डेटा की गुणवत्ता',
  addTransaction: 'लेन-देन जोड़ें',
  importStatement: 'स्टेटमेंट आयात करें',
  addGoal: 'लक्ष्य जोड़ें',
  addCreditCard: 'क्रेडिट कार्ड जोड़ें',
  createBudget: 'बजट बनाएं',
  analyzeMessage: 'संदेश जांचें',
  createInvoice: 'इनवॉइस बनाएं',
  lightTheme: 'लाइट',
  darkTheme: 'डार्क',
  nav: {
    overview: 'अवलोकन',
    dashboard: 'डैशबोर्ड',
    financialHealth: 'वित्तीय स्वास्थ्य',
    moneyCalendar: 'मनी कैलेंडर',
    myMoney: 'मेरा धन',
    transactions: 'लेन-देन',
    moneyInbox: 'मनी इनबॉक्स',
    budgets: 'बजट',
    recurring: 'नियमित भुगतान',
    creditCards: 'क्रेडिट कार्ड और ऋण',
    plan: 'योजना',
    goals: 'वित्तीय लक्ष्य',
    taxCenter: 'टैक्स सहायक',
    invest: 'निवेश',
    investments: 'पोर्टफोलियो',
    markets: 'बाज़ार और एनएसई',
    paperTrading: 'पेपर ट्रेडिंग',
    protect: 'सुरक्षा',
    scamShield: 'स्कैम शील्ड',
    business: 'व्यापार',
    businessHome: 'व्यापार अवलोकन',
    invoices: 'इनवॉइस',
    receivables: 'प्राप्य राशि',
    reconciliation: 'वित्तीय मिलान',
    notifications: 'सूचनाएं',
    settings: 'सेटिंग्स',
    help: 'सहायता केंद्र',
  },
  common: {
    signOut: 'साइन आउट',
    askAi: 'FinSight AI से पूछें',
    searchPlaceholder: 'टूल, लेन-देन, बिल या लक्ष्य खोजें...',
  },
  modules: {
    financialHealthTitle: 'वित्तीय स्वास्थ्य सूचकांक',
    moneyCalendarTitle: 'मनी कैलेंडर और नकदी रडार',
    creditCardsTitle: 'क्रेडिट कार्ड और ऋण नियंत्रण',
    recurringTitle: 'नियमित भुगतान और सब्सक्रिप्शन',
    goalsTitle: 'वित्तीय लक्ष्य और प्रगति',
    receivablesTitle: 'प्राप्य राशि और चालान आयु',
    reconciliationTitle: 'व्यापार वित्तीय मिलान केंद्र',
  },
};

export function useTranslations(language?: string): TranslationDictionary {
  return language === 'Hindi' ? HI : EN;
}
