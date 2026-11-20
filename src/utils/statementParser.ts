/**
 * Bank Statement, CSV, XLSX, PDF, Plain Text & SMS Transaction Parser
 * Pure deterministic parsing with normalization, categorization, and duplicate matching.
 */
import { parse as parseCsvSync } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import type { Transaction } from '../types';

export interface ParsedTransactionCandidate {
  description: string;
  merchant: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  account: string;
  transactionDate: string;
  referenceId?: string;
  source: 'CSV' | 'XLSX' | 'PDF' | 'SMS' | 'STATEMENT';
  isDuplicate?: boolean;
  duplicateReason?: string;
}

export function classifyMerchantCategory(text: string, type: 'INCOME' | 'EXPENSE'): string {
  const lower = text.toLowerCase();
  if (type === 'INCOME') {
    if (/salary|payroll|stipend|employer|infosys|tcs|wipro/i.test(lower)) return 'Salary';
    if (/dividend|interest|fd|mutual/i.test(lower)) return 'Investments';
    if (/invoice|consulting|freelance|client/i.test(lower)) return 'Consulting';
    return 'Income';
  }
  if (/zomato|swiggy|blinkit|zepto|instamart|restaurant|cafe|food|grocer|bigbasket|dmart/i.test(lower)) return 'Food';
  if (/rent|maintenance|sobha|nobroker|housing|society/i.test(lower)) return 'Housing';
  if (/uber|ola|rapido|metro|irctc|fuel|petrol|indigo|flight|toll/i.test(lower)) return 'Transport';
  if (/airtel|jio|vi |bescom|electricity|internet|broadband|water|gas|recharge/i.test(lower)) return 'Utilities';
  if (/sip|zerodha|groww|kite|coin|mf|mutual fund|ppf|nps|etf/i.test(lower)) return 'Investments';
  if (/amazon|flipkart|myntra|ajio|nykaa|mall|store/i.test(lower)) return 'Shopping';
  if (/hospital|pharmacy|apollo|1mg|pharmeasy|clinic|medical/i.test(lower)) return 'Healthcare';
  return 'General Expense';
}

export function extractMerchantName(text: string): string {
  const cleaned = text.trim();
  if (/zomato/i.test(cleaned)) return 'Zomato';
  if (/swiggy/i.test(cleaned)) return 'Swiggy';
  if (/blinkit/i.test(cleaned)) return 'Blinkit';
  if (/amazon/i.test(cleaned)) return 'Amazon India';
  if (/flipkart/i.test(cleaned)) return 'Flipkart';
  if (/uber/i.test(cleaned)) return 'Uber India';
  if (/ola/i.test(cleaned)) return 'Ola Cabs';
  if (/airtel/i.test(cleaned)) return 'Airtel';
  if (/jio/i.test(cleaned)) return 'Jio';
  if (/zerodha/i.test(cleaned)) return 'Zerodha';
  if (/groww/i.test(cleaned)) return 'Groww';

  const toMatch = cleaned.match(/\b(?:to|at|from)\s+([A-Za-z0-9][A-Za-z0-9 &._-]{2,30}?)(?:\s+(?:on|via|ref|upi|dt|$))/i);
  if (toMatch?.[1]) return toMatch[1].trim();

  const words = cleaned.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).slice(0, 4).join(' ');
  return words || 'Bank Transfer';
}

export function normalizeDateString(raw?: string): string {
  if (!raw || typeof raw !== 'string') return new Date().toISOString().split('T')[0];
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const yrRaw = dmyMatch[3];
    const year = yrRaw.length === 2 ? `20${yrRaw}` : yrRaw;
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

export function parseAmountValue(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.abs(raw) : 0;
  if (typeof raw !== 'string') return 0;
  const cleaned = raw.replace(/[₹$,\s]/g, '').replace(/(Cr|Dr|INR|Rs\.?)/gi, '').trim();
  const val = parseFloat(cleaned);
  return Number.isFinite(val) ? Math.abs(val) : 0;
}

export function parseBankSMS(text: string): ParsedTransactionCandidate {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('SMS text cannot be empty');
  }

  const amtMatch =
    trimmed.match(/(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    trimmed.match(/([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:debited|credited|spent|paid|received)/i);

  if (!amtMatch?.[1]) {
    throw new Error('Could not detect a valid transaction amount in the SMS text.');
  }

  const amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Detected transaction amount must be greater than zero.');
  }

  const isCredit = /credited|received|deposited|salary/i.test(trimmed) && !/debited|spent|sent/i.test(trimmed);
  const type: 'INCOME' | 'EXPENSE' = isCredit ? 'INCOME' : 'EXPENSE';
  const merchant = extractMerchantName(trimmed);
  const category = classifyMerchantCategory(`${trimmed} ${merchant}`, type);
  const refMatch = trimmed.match(/(?:Ref|UPI\s*Ref|UTR|Txn)\s*(?:No\.?|#|:)?\s*([A-Za-z0-9]{6,24})/i);
  const acctMatch = trimmed.match(/(?:A\/C|Account|Card)\s*(?:\*\*|XX|x+)?(\d{4})/i);
  const dateMatch = trimmed.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/);

  return {
    description: trimmed.slice(0, 140),
    merchant,
    amount,
    type,
    category,
    account: acctMatch ? `Bank A/C *${acctMatch[1]}` : 'Bank Account via SMS Alert',
    transactionDate: normalizeDateString(dateMatch?.[1]),
    referenceId: refMatch?.[1],
    source: 'SMS',
  };
}

function mapTableRowsToTransactions(
  rows: Array<Record<string, unknown>>,
  source: 'CSV' | 'XLSX'
): ParsedTransactionCandidate[] {
  const results: ParsedTransactionCandidate[] = [];

  for (const row of rows) {
    const normalizedEntries = Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v] as const);
    const findCol = (patterns: RegExp[]) => {
      for (const p of patterns) {
        const hit = normalizedEntries.find(([k]) => p.test(k));
        if (hit && hit[1] !== undefined && hit[1] !== null && String(hit[1]).trim() !== '') {
          return String(hit[1]).trim();
        }
      }
      return '';
    };

    const rawDate = findCol([/date/, /txn\s*dt/, /value\s*dt/]);
    const rawDesc = findCol([/desc/, /narration/, /particulars/, /remark/, /merchant/, /detail/]);
    const rawDebit = findCol([/debit/, /withdrawal/, /dr\b/, /outflow/]);
    const rawCredit = findCol([/credit/, /deposit/, /cr\b/, /inflow/]);
    const rawAmt = findCol([/amount/, /value/, /amt/]);
    const rawType = findCol([/type/, /dr\/?cr/]);
    const rawRef = findCol([/ref/, /utr/, /chq/, /id/]);
    const rawCat = findCol([/category/]);
    const rawAccount = findCol([/account/, /bank/]);

    let amount = 0;
    let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';

    const debitAmt = parseAmountValue(rawDebit);
    const creditAmt = parseAmountValue(rawCredit);

    if (creditAmt > 0 && debitAmt === 0) {
      amount = creditAmt;
      type = 'INCOME';
    } else if (debitAmt > 0) {
      amount = debitAmt;
      type = 'EXPENSE';
    } else if (rawAmt) {
      const signed = parseFloat(rawAmt.replace(/[₹$,\s]/g, ''));
      if (Number.isFinite(signed) && signed !== 0) {
        amount = Math.abs(signed);
        if (/cr|credit|income|deposit/i.test(rawType) || (signed > 0 && !/dr|debit|expense/i.test(rawType) && rawAmt.trim().startsWith('+'))) {
          type = 'INCOME';
        } else if (/dr|debit|expense/i.test(rawType) || signed < 0) {
          type = 'EXPENSE';
        }
      }
    }

    if (amount <= 0 || !rawDesc) continue;

    const merchant = extractMerchantName(rawDesc);
    const category = rawCat || classifyMerchantCategory(rawDesc, type);

    results.push({
      description: rawDesc.slice(0, 180),
      merchant,
      amount: Math.round(amount * 100) / 100,
      type,
      category,
      account: rawAccount || `${source} Statement Import`,
      transactionDate: normalizeDateString(rawDate),
      referenceId: rawRef || undefined,
      source,
    });
  }

  return results;
}

export function parseCsvStatement(content: string): ParsedTransactionCandidate[] {
  const cleaned = content.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];
  const records = parseCsvSync(cleaned, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Array<Record<string, unknown>>;
  return mapTableRowsToTransactions(records, 'CSV');
}

export function parseXlsxStatement(buffer: Buffer): ParsedTransactionCandidate[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return mapTableRowsToTransactions(rows, 'XLSX');
}

export function parsePlainTextLines(text: string, source: 'PDF' | 'STATEMENT' = 'STATEMENT'): ParsedTransactionCandidate[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 8);
  const candidates: ParsedTransactionCandidate[] = [];

  for (const line of lines) {
    const dateMatch = line.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);
    if (!dateMatch) continue;
    const dateStr = dateMatch[1];
    const lineWithoutDate = line.replace(dateStr, ' ').trim();
    const amtMatches = [...lineWithoutDate.matchAll(/(?:₹|Rs\.?|INR)?\s*([0-9]+(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?)\s*(Cr|Dr)?/gi)];
    if (amtMatches.length === 0) continue;

    const validAmts = amtMatches.filter(m => parseAmountValue(m[1]) > 0);
    if (validAmts.length === 0) continue;

    const chosen = validAmts[0];
    const amount = parseAmountValue(chosen[1]);
    if (amount <= 0 || amount > 100000000) continue;

    const indicator = `${chosen[2] || ''} ${lineWithoutDate}`;
    const type: 'INCOME' | 'EXPENSE' = /\bcr\b|credit|salary|deposit/i.test(indicator) && !/\bdr\b|debit|paid|purchase/i.test(indicator)
      ? 'INCOME'
      : 'EXPENSE';
    const desc = lineWithoutDate.replace(/\s+/g, ' ').trim().slice(0, 160);
    const merchant = extractMerchantName(desc);

    candidates.push({
      description: desc || `${merchant} transaction`,
      merchant,
      amount: Math.round(amount * 100) / 100,
      type,
      category: classifyMerchantCategory(desc, type),
      account: `${source} Statement`,
      transactionDate: normalizeDateString(dateStr),
      source,
    });
  }

  return candidates;
}

export async function parsePdfStatement(buffer: Buffer): Promise<ParsedTransactionCandidate[]> {
  const { extractText } = await import('unpdf');
  const data = await extractText(new Uint8Array(buffer), { mergePages: true });
  const text = Array.isArray(data.text) ? data.text.join('\n') : String(data.text || '');
  return parsePlainTextLines(text, 'PDF');
}

export function flagDuplicateCandidates(
  candidates: ParsedTransactionCandidate[],
  existingTransactions: Transaction[]
): ParsedTransactionCandidate[] {
  return candidates.map(cand => {
    const match = existingTransactions.find(t => {
      if (cand.referenceId && t.referenceId && cand.referenceId.toLowerCase() === t.referenceId.toLowerCase()) {
        return true;
      }
      const sameAmt = Math.abs(t.amount - cand.amount) < 0.01;
      const sameDate = t.transactionDate === cand.transactionDate;
      const tMerch = t.merchant.toLowerCase();
      const cMerch = cand.merchant.toLowerCase();
      const sameMerchant =
        tMerch === cMerch ||
        tMerch.includes(cMerch) ||
        cMerch.includes(tMerch) ||
        t.description.toLowerCase().includes(cand.description.toLowerCase().slice(0, 16));
      return sameAmt && sameDate && sameMerchant;
    });

    if (match) {
      return {
        ...cand,
        isDuplicate: true,
        duplicateReason: `Matches existing transaction "${match.description}" (${match.transactionDate})`,
      };
    }
    return { ...cand, isDuplicate: false };
  });
}
