import { API_BASE } from './constants';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiError {
  error: string;
  details?: unknown;
}

export class FetchError extends Error {
  status: number;
  details?: unknown;
  retryAfterSec?: number;

  constructor(status: number, message: string, details?: unknown, retryAfterSec?: number) {
    super(message);
    this.status = status;
    this.details = details;
    this.retryAfterSec = retryAfterSec;
  }
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    credentials: 'include', // Send HTTP-only cookies with every request
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Request failed' }));
    // Capture Retry-After header / retryAfterSec field — set by the backend
    // rate limiters when status === 429.
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSec =
      retryAfterHeader != null
        ? Number(retryAfterHeader)
        : typeof data.retryAfterSec === 'number'
          ? data.retryAfterSec
          : undefined;
    throw new FetchError(
      response.status,
      data.error || 'Request failed',
      data.details,
      Number.isFinite(retryAfterSec) ? retryAfterSec : undefined,
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// FormData version (for file uploads)
export async function apiFormData<T>(endpoint: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
    // No Content-Type header — browser sets it with boundary for multipart
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new FetchError(response.status, data.error || 'Upload failed', data.details);
  }

  return response.json();
}