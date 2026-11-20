import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { apiFetch, parseApiResponse } from '../../utils/api';
import type { AIConversationMessage } from '../../types';

interface GlobalAIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  currentModule: string;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  modelUsed?: string;
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome-1',
  sender: 'assistant',
  text: 'Welcome to FinSight AI — Understand your money. Every explanation uses your verified account records and distinguishes facts from projections. Ask about spending patterns, upcoming cash-flow tightness, credit card payoff options, tax regime comparison, or business receivables.',
  time: 'Ready',
};

export const GlobalAIAssistant: React.FC<GlobalAIAssistantProps> = ({
  isOpen,
  onClose,
  currentModule,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [errorState, setErrorState] = useState<{ message: string; retryText?: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await apiFetch('/api/v1/ai/conversations');
      const parsed = await parseApiResponse<{ success: boolean; data?: AIConversationMessage[] }>(res);
      if (parsed.ok && Array.isArray(parsed.json?.data)) {
        const records = parsed.json.data;
        if (records.length === 0) {
          setMessages([WELCOME_MESSAGE]);
        } else {
          setMessages(
            records.map(r => ({
              id: r.id,
              sender: r.role,
              text: r.text,
              modelUsed: r.modelUsed,
              time: new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }))
          );
        }
      }
    } catch {
      // Keep current chat state if fetch fails
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);

  if (!isOpen) return null;

  const quickPrompts = [
    'What needs my financial attention next?',
    'Explain my spending & savings rate clearly.',
    'Compare Old vs New Tax Regime on my numbers.',
    'Review my portfolio concentration & risks.',
  ];

  const handleClearHistory = async () => {
    setErrorState(null);
    try {
      const res = await apiFetch('/api/v1/ai/conversations', { method: 'DELETE' });
      if (res.ok) {
        setMessages([WELCOME_MESSAGE]);
      }
    } catch {
      setErrorState({ message: 'Unable to clear conversation history.' });
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSend = async (textToSend?: string, skipAppendUser = false) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    setErrorState(null);
    if (!skipAppendUser) {
      const userMsg: Message = {
        id: `u-${Date.now()}`,
        sender: 'user',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, userMsg]);
      if (!textToSend) setInput('');
    }
    setIsLoading(true);

    try {
      const res = await apiFetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, moduleContext: currentModule }),
      });
      const parsed = await parseApiResponse<{
        success?: boolean;
        error?: { message?: string } | string;
        message?: string;
        data?: { reply?: string; model?: string; messageRecord?: { id?: string } };
      }>(res);

      if (!parsed.ok) {
        const msg =
          parsed.errorMessage ||
          (res.status === 401
            ? 'Your session expired. Please sign in again to use FinSight AI.'
            : res.status === 503
            ? 'Gemini AI service is not configured on the server.'
            : res.status === 504
            ? 'FinSight AI request timed out. Please retry.'
            : res.status === 429
            ? 'AI rate limit reached. Please wait a minute and retry.'
            : `AI request failed (HTTP ${res.status}).`);
        setErrorState({ message: msg, retryText: text });
        return;
      }

      const reply = parsed.json?.data?.reply;
      if (!reply) {
        setErrorState({ message: 'AI returned an empty reply field. Please retry.', retryText: text });
        return;
      }

      setMessages(prev => [
        ...prev,
        {
          id: parsed.json?.data?.messageRecord?.id || `a-${Date.now()}`,
          sender: 'assistant',
          text: reply,
          modelUsed: parsed.json?.data?.model,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setErrorState({
        message: 'Unable to reach FinSight AI backend. Please verify your network connection and retry.',
        retryText: text,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[410px] md:w-[440px] bg-[var(--fs-surface)] border-l border-[var(--fs-border)] shadow-2xl flex flex-col">
      {/* Header */}
      <div className="h-[68px] px-5 border-b border-[var(--fs-border)] flex items-center justify-between bg-[var(--fs-surface-secondary)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-[var(--fs-brand)] dark:bg-[#168366] flex items-center justify-center text-white shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--fs-text)] truncate">FinSight AI — Understand your money</h3>
            <p className="text-[11px] text-[var(--fs-text-muted)] truncate">
              Context: {currentModule}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleClearHistory}
            className="text-[var(--fs-text-muted)] hover:text-[var(--fs-danger)] p-1.5 rounded-lg hover:bg-[var(--fs-surface)]"
            title="Clear conversation history"
            aria-label="Clear conversation history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="text-[var(--fs-text-muted)] hover:text-[var(--fs-text)] p-1.5 rounded-lg hover:bg-[var(--fs-surface)]"
            aria-label="Close assistant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isHistoryLoading && (
          <div className="text-[11px] text-[var(--fs-text-muted)] flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--fs-accent)]" />
            <span>Loading saved conversation...</span>
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'assistant' && (
              <div className="h-7 w-7 rounded-lg bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] flex items-center justify-center text-[var(--fs-accent)] shrink-0">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-[var(--fs-brand)] text-white dark:bg-[#168366]'
                  : 'bg-[var(--fs-surface-secondary)] text-[var(--fs-text)] border border-[var(--fs-border)]'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
              <div
                className={`mt-1.5 flex items-center justify-between gap-2 text-[10px] ${
                  m.sender === 'user' ? 'text-white/75' : 'text-[var(--fs-text-muted)]'
                }`}
              >
                <span>
                  {m.modelUsed ? `${m.modelUsed} · ` : ''}
                  {m.time}
                </span>
                {m.sender === 'assistant' && m.id !== 'welcome-1' && (
                  <button
                    onClick={() => handleCopy(m.id, m.text)}
                    className="hover:text-[var(--fs-accent)] flex items-center gap-1"
                    title="Copy response"
                  >
                    {copiedId === m.id ? <Check className="h-3 w-3 text-[var(--fs-success)]" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>
            {m.sender === 'user' && (
              <div className="h-7 w-7 rounded-lg bg-[var(--fs-surface-secondary)] border border-[var(--fs-border)] flex items-center justify-center text-[var(--fs-text)] shrink-0">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {errorState && (
          <div className="p-3 rounded-xl border border-[var(--fs-danger)]/40 bg-[var(--fs-danger)]/10 text-xs text-[var(--fs-danger)] space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorState.message}</span>
            </div>
            {errorState.retryText && (
              <button
                onClick={() => handleSend(errorState.retryText, true)}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--fs-danger)] text-white px-2.5 py-1 text-[11px] font-semibold"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry Request</span>
              </button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-[var(--fs-text-muted)] p-2">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--fs-accent)]" />
            <span>Analyzing your financial records...</span>
          </div>
        )}
      </div>

      {/* Prompt Suggestions */}
      <div className="px-4 py-2 border-t border-[var(--fs-border)] bg-[var(--fs-surface-secondary)]/50 overflow-x-auto whitespace-nowrap space-x-2">
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="inline-block px-2.5 py-1 text-[11px] rounded-lg bg-[var(--fs-surface)] border border-[var(--fs-border)] text-[var(--fs-text-body)] hover:border-[var(--fs-accent)] hover:text-[var(--fs-text)] disabled:opacity-50 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--fs-border)] bg-[var(--fs-surface)]">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about spending, tax, goals, or cash flow..."
            className="fs-input flex-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="fs-btn-primary px-3.5 py-2 disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 text-[10px] text-[var(--fs-text-muted)] text-center">
          Verified numbers vs estimates are separated. FinSight never executes automatic payments or trades.
        </p>
      </div>
    </div>
  );
};
