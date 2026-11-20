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
  text: 'Hello! I am FinSight AI, powered by Gemini 4 Hydrogen and grounded in your saved financial data. How can I clarify your spending, portfolio allocation, tax deductions, or business cash flow today?',
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
      // keep existing UI state if network fetch fails silently on open
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
    'How can I reduce my monthly spending?',
    'Explain my portfolio allocation.',
    'Compare Old vs New Tax Regime for my profile.',
    'Help me understand my business cash flow.',
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
      // clipboard unavailable in restricted environments
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
        console.error('FinSight AI chat error:', { status: parsed.status, raw: parsed.rawText.slice(0, 300) });
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
    } catch (err) {
      console.error('FinSight AI backend request failed:', err);
      setErrorState({
        message: 'Unable to reach FinSight AI backend. Please verify your network connection and retry.',
        retryText: text,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 md:w-[420px] bg-[#0B1C19] border-l border-[#28443C] shadow-2xl flex flex-col">
      {/* Header */}
      <div className="h-[72px] px-5 border-b border-[#28443C] flex items-center justify-between bg-[#102722]">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#F5F7F5]">Ask FinSight AI</h3>
            <p className="text-[11px] text-[#718D83]">Gemini 4 Hydrogen · {currentModule}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleClearHistory}
            className="text-[#718D83] hover:text-[#EB7676] p-1.5 rounded-lg hover:bg-[#16352E]"
            title="Clear conversation history"
            aria-label="Clear conversation history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="text-[#718D83] hover:text-[#F5F7F5] p-1.5 rounded-lg hover:bg-[#16352E]"
            aria-label="Close assistant"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isHistoryLoading && (
          <div className="text-[11px] text-[#718D83] flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#A8E6CE]" />
            <span>Loading saved conversation...</span>
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'assistant' && (
              <div className="h-7 w-7 rounded-lg bg-[#16352E] border border-[#28443C] flex items-center justify-center text-[#A8E6CE] shrink-0">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-[#16352E] text-[#F5F7F5] border border-[#28443C]'
                  : 'bg-[#102722] text-[#A7C1B8] border border-[#28443C]'
              }`}
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-[#718D83]">
                <span>{m.modelUsed ? `${m.modelUsed} · ` : ''}{m.time}</span>
                {m.sender === 'assistant' && m.id !== 'welcome-1' && (
                  <button
                    onClick={() => handleCopy(m.id, m.text)}
                    className="hover:text-[#A8E6CE] flex items-center gap-1"
                    title="Copy response"
                  >
                    {copiedId === m.id ? <Check className="h-3 w-3 text-[#55C99A]" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>
            {m.sender === 'user' && (
              <div className="h-7 w-7 rounded-lg bg-[#28443C] flex items-center justify-center text-[#F5F7F5] shrink-0">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {errorState && (
          <div className="p-3 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/40 text-xs text-[#EB7676] space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorState.message}</span>
            </div>
            {errorState.retryText && (
              <button
                onClick={() => handleSend(errorState.retryText, true)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#EB7676]/20 px-2.5 py-1 text-[11px] font-semibold text-[#F5F7F5] hover:bg-[#EB7676]/30"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry Request</span>
              </button>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-[#718D83] p-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#A8E6CE]" />
            <span>FinSight AI is analyzing your financial context...</span>
          </div>
        )}
      </div>

      {/* Suggested Prompts */}
      <div className="px-4 py-2 border-t border-[#28443C] bg-[#102722]/40 overflow-x-auto whitespace-nowrap space-x-2">
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="inline-block px-2.5 py-1 text-[11px] rounded-lg bg-[#16352E] border border-[#28443C] text-[#A7C1B8] hover:text-[#A8E6CE] hover:border-[#72C8B0] disabled:opacity-50 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#28443C] bg-[#102722]">
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
            placeholder="Ask a question about your finances..."
            className="flex-1 rounded-lg bg-[#0B1C19] border border-[#28443C] px-3 py-2 text-xs text-[#F5F7F5] placeholder-[#718D83] focus:border-[#A8E6CE] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-lg bg-[#A8E6CE] px-3 py-2 text-[#0B1C19] hover:bg-[#72C8B0] disabled:opacity-50 transition-colors"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 text-[10px] text-[#718D83] text-center">
          Educational guidance only. Not formal investment or tax advice.
        </p>
      </div>
    </div>
  );
};
