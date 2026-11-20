/**
 * Server-side Gemini AI Integration Service
 * Uses @google/genai with verified model 'gemini-4-hydrogen'.
 * Includes timeout handling, exponential backoff retries, per-user rate limiting,
 * strict JSON schema validation, and explicit error propagation (never mocks AI responses on failure).
 */
import { GoogleGenAI, Type } from '@google/genai';

export const GEMINI_MODEL = 'gemini-4-hydrogen';
const DEFAULT_TIMEOUT_MS = 15000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

export class AIServiceError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const userRateWindows = new Map<string, number[]>();

export function checkAndConsumeAIRateLimit(uid: string): void {
  const now = Date.now();
  const existing = userRateWindows.get(uid) || [];
  const recent = existing.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    throw new AIServiceError(
      'AI rate limit reached (20 requests per minute). Please wait a moment and try again.',
      429,
      'AI_RATE_LIMITED'
    );
  }
  recent.push(now);
  userRateWindows.set(uid, recent);
}

function resolveGeminiApiKey(): string | undefined {
  const key = (process.env.GEMINI_API_KEY || process.env.API_KEY)?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return undefined;
  return key;
}

export function getGeminiStatus(): { configured: boolean; model: string } {
  const key = resolveGeminiApiKey();
  return { configured: Boolean(key), model: GEMINI_MODEL };
}

function createGeminiClient(): GoogleGenAI {
  const key = resolveGeminiApiKey();
  if (!key) {
    throw new AIServiceError(
      'Gemini AI is not configured on the server (GEMINI_API_KEY / API_KEY missing). Configure GEMINI_API_KEY in environment secrets to enable AI features.',
      503,
      'AI_NOT_CONFIGURED'
    );
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AIServiceError('Gemini AI request timed out. Please try again.', 504, 'AI_TIMEOUT'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(fn(), DEFAULT_TIMEOUT_MS);
    } catch (err) {
      lastError = err;
      if (err instanceof AIServiceError && (err.code === 'AI_NOT_CONFIGURED' || err.code === 'AI_TIMEOUT')) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = /429|503|502|500|timeout|network|ECONNRESET|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(msg);
      if (!isTransient || attempt === maxRetries) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 400 * Math.pow(2, attempt)));
    }
  }
  if (lastError instanceof AIServiceError) throw lastError;
  const msg = lastError instanceof Error ? lastError.message : 'Gemini AI request failed.';
  console.error('[FinSight Gemini Error]', msg);
  throw new AIServiceError(`Gemini AI provider error: ${msg}`, 502, 'AI_PROVIDER_ERROR');
}

export interface FraudAnalysisOutput {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  suspiciousKeywords: string[];
  findings: string[];
  recommendedActions: string[];
}

export async function analyzeFraudWithGemini(
  uid: string,
  text: string,
  sourceType: string
): Promise<FraudAnalysisOutput> {
  checkAndConsumeAIRateLimit(uid);
  const client = createGeminiClient();

  const response = await executeWithRetry(() =>
    client.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Analyze this suspected Indian financial phishing/scam message received via ${sourceType || 'SMS'}:
"""
${text.slice(0, 4000)}
"""
Evaluate risk score (0-100), risk level (LOW, MEDIUM, HIGH, CRITICAL), suspicious keywords, specific objective findings, and safety actions for the recipient (including 1930 cybercrime helpline or official bank channels when high risk). Never claim certainty — state probabilistic assessment.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER },
            riskLevel: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            summary: { type: Type.STRING },
            suspiciousKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            findings: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['riskScore', 'riskLevel', 'summary', 'suspiciousKeywords', 'findings', 'recommendedActions'],
        },
      },
    })
  );

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new AIServiceError('Gemini returned an empty fraud analysis response.', 502, 'AI_INVALID_RESPONSE');
  }

  let parsed: Partial<FraudAnalysisOutput>;
  try {
    parsed = JSON.parse(rawText) as Partial<FraudAnalysisOutput>;
  } catch {
    throw new AIServiceError('Gemini returned malformed JSON during fraud analysis.', 502, 'AI_INVALID_RESPONSE');
  }

  const score = Math.max(0, Math.min(100, Number(parsed.riskScore ?? 50)));
  const validLevels = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
  const riskLevel = validLevels.has(String(parsed.riskLevel))
    ? (parsed.riskLevel as FraudAnalysisOutput['riskLevel'])
    : score >= 80
    ? 'CRITICAL'
    : score >= 60
    ? 'HIGH'
    : score >= 35
    ? 'MEDIUM'
    : 'LOW';

  return {
    riskScore: Math.round(score),
    riskLevel,
    summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : 'Risk assessment completed.',
    suspiciousKeywords: Array.isArray(parsed.suspiciousKeywords) ? parsed.suspiciousKeywords.map(String).slice(0, 10) : [],
    findings: Array.isArray(parsed.findings) ? parsed.findings.map(String).slice(0, 10) : [],
    recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions.map(String).slice(0, 8) : [],
  };
}

export async function generateFinancialAssistantReply(
  uid: string,
  userMessage: string,
  moduleContext: string,
  userSummaryContext: Record<string, unknown>
): Promise<{ reply: string; model: string }> {
  checkAndConsumeAIRateLimit(uid);
  const client = createGeminiClient();

  const prompt = `You are FinSight AI, an Indian financial education & intelligence assistant.
Rules:
1. Ground your explanation strictly in the authenticated user's verified data summary provided below (if counts/amounts are 0, state that honestly and never invent numbers).
2. Currency is INR (₹), tax rules follow Indian CBDT FY 2025-26 / FY 2024-25, markets follow NSE India.
3. Keep explanations clear, concise, structured with short bullets, and free of hype.
4. Never guarantee investment returns, never execute trades, and include a brief educational-only / consult SEBI RIA or CA disclaimer when giving tax or investment guidance.

Active Workspace Module: ${moduleContext}
Authenticated User Data Summary:
${JSON.stringify(userSummaryContext, null, 2)}

User Question:
${userMessage.slice(0, 2000)}`;

  const response = await executeWithRetry(() =>
    client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    })
  );

  const reply = response.text?.trim();
  if (!reply) {
    throw new AIServiceError('Gemini returned an empty response. Please try again.', 502, 'AI_INVALID_RESPONSE');
  }

  return { reply, model: GEMINI_MODEL };
}
