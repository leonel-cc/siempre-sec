import { config } from '../config';
import { currentAccessToken } from '../auth/manager';

interface ErrorPayload {
  message?: string | string[];
  error?: string;
}

function isErrorPayload(value: unknown): value is ErrorPayload {
  return typeof value === 'object' && value !== null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await currentAccessToken();
    if (!token) {
      throw new ApiError('La sesión no está disponible.', 401);
    }

    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${config.cloudApiUrl}${path}`, { ...init, headers });
    const contentType = response.headers.get('content-type') ?? '';
    const payload: unknown = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      let message = `La solicitud falló (${response.status}).`;
      if (isErrorPayload(payload)) {
        const apiMessage = payload.message;
        if (Array.isArray(apiMessage)) message = apiMessage.join(' ');
        else if (typeof apiMessage === 'string') message = apiMessage;
        else if (typeof payload.error === 'string') message = payload.error;
      } else if (typeof payload === 'string' && payload.trim()) {
        message = payload;
      }
      throw new ApiError(message, response.status, payload);
    }

    return payload as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  delete<T = void>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
