export const API_BASE = 'http://localhost:3000/api';
export const BACKEND_URL = 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}

export const api = {
  cameras: {
    list: () => request<any[]>('/cameras'),
    get: (id: string) => request<any>(`/cameras/${id}`),
    create: (data: any) => request<any>('/cameras', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/cameras/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/cameras/${id}`, { method: 'DELETE' }),
    discover: () => request<any>('/cameras/discover', { method: 'POST' }),
    usbDevices: () => request<{ devices: Array<{ index: number; name: string }>; count: number }>('/cameras/usb-devices'),
  },
  events: {
    list: (limit = 50, offset = 0) => request<any[]>(`/events?limit=${limit}&offset=${offset}`),
    get: (id: string) => request<any>(`/events/${id}`),
    updateStatus: (id: string, status: string) =>
      request<any>(`/events/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    remove: (id: string) => request<void>(`/events/${id}`, { method: 'DELETE' }),
  },
  people: {
    list: () => request<any[]>('/people'),
    get: (id: string) => request<any>(`/people/${id}`),
    create: (data: any) => request<any>('/people', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/people/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/people/${id}`, { method: 'DELETE' }),
  },
  zones: {
    list: (cameraId?: string) => request<any[]>(`/zones${cameraId ? `?camera_id=${cameraId}` : ''}`),
    get: (id: string) => request<any>(`/zones/${id}`),
    create: (data: any) => request<any>('/zones', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/zones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/zones/${id}`, { method: 'DELETE' }),
  },
  rules: {
    list: () => request<any[]>('/rules'),
    get: (id: string) => request<any>(`/rules/${id}`),
    create: (data: any) => request<any>('/rules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/rules/${id}`, { method: 'DELETE' }),
  },
  system: {
    health: () => request<any>('/system/health'),
  },
  settings: {
    getAll: () => request<Record<string, Record<string, any>>>('/settings'),
    getSection: (section: string) => request<Record<string, any>>(`/settings/${section}`),
    updateSection: (section: string, data: Record<string, any>) =>
      request<void>(`/settings/${section}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
};
