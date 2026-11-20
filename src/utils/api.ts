import { auth, waitForAuthReady } from '../lib/firebase';

let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export function registerUnauthorizedHandler(handler: (() => void | Promise<void>) | null) {
  unauthorizedHandler = handler;
}

function isApiRequest(input: RequestInfo | URL): boolean {
  if (typeof input === 'string') {
    return input.startsWith('/api/') || (typeof window !== 'undefined' && input.startsWith(`${window.location.origin}/api/`));
  }
  if (input instanceof URL) {
    return input.pathname.startsWith('/api/');
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    try {
      const url = new URL(input.url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      return url.pathname.startsWith('/api/');
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Authenticated API fetch wrapper that retrieves a fresh Firebase ID token
 * via Firebase Auth SDK (`user.getIdToken()`) and sends it as `Authorization: Bearer <token>`.
 * Never mutates window.fetch or globalThis.fetch and never uses localStorage user IDs.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  const needsAuthAttachment = isApiRequest(input) && !headers.has('Authorization');

  if (needsAuthAttachment) {
    await waitForAuthReady();
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      } catch (err) {
        console.warn('Failed to retrieve Firebase ID token:', err);
      }
    }
  }

  const response = await globalThis.fetch(input, { ...init, headers });

  // Handle expired/revoked token automatically: force-refresh once if 401 while signed in
  if (response.status === 401 && needsAuthAttachment && auth.currentUser) {
    try {
      const refreshedToken = await auth.currentUser.getIdToken(true);
      if (refreshedToken) {
        const retryHeaders = new Headers(init?.headers || {});
        retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
        const retryResponse = await globalThis.fetch(input, { ...init, headers: retryHeaders });
        if (retryResponse.status === 401 && unauthorizedHandler) {
          await unauthorizedHandler();
        }
        return retryResponse;
      }
    } catch {
      if (unauthorizedHandler) {
        await unauthorizedHandler();
      }
    }
  }

  return response;
}

export interface ParsedApiResponse<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  json: T | null;
  rawText: string;
  errorMessage: string | null;
}

/**
 * Reads response.text() first and parses JSON safely so HTML fallbacks, empty bodies,
 * or malformed JSON never crash blindly and instead expose the exact server/raw error.
 */
export async function parseApiResponse<T = Record<string, unknown>>(
  res: Response
): Promise<ParsedApiResponse<T>> {
  const rawText = await res.text();
  const contentType = res.headers.get('content-type') || '';
  let json: T | null = null;
  let parseFailed = false;

  if (rawText.trim()) {
    try {
      json = JSON.parse(rawText) as T;
    } catch {
      parseFailed = true;
    }
  }

  const record = (json && typeof json === 'object' ? json : null) as
    | { success?: boolean; message?: string; error?: string | { message?: string } }
    | null;

  const isSuccess = res.ok && record !== null && record.success !== false && !parseFailed;
  let errorMessage: string | null = null;

  if (!isSuccess) {
    const serverMsg =
      (typeof record?.error === 'object' ? record.error?.message : undefined) ||
      (typeof record?.error === 'string' ? record.error : undefined) ||
      record?.message;

    if (serverMsg) {
      errorMessage = serverMsg;
    } else {
      const snippet = rawText.replace(/\s+/g, ' ').trim().slice(0, 180);
      if (!rawText.trim()) {
        errorMessage = `Server returned an empty response (HTTP ${res.status}).`;
      } else if (parseFailed) {
        errorMessage = `Unexpected non-JSON response (HTTP ${res.status}${contentType ? `, ${contentType}` : ''}): ${snippet}`;
      } else {
        errorMessage = `Request failed (HTTP ${res.status}): ${snippet}`;
      }
    }
  }

  return {
    ok: isSuccess,
    status: res.status,
    json,
    rawText,
    errorMessage,
  };
}
