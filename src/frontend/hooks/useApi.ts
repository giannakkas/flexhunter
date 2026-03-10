// ==============================================
// API Hooks
// ==============================================

import { useState, useCallback } from 'react';

const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const shopId = sessionStorage.getItem('shopId') || 'dev-shop-id';

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-shop-id': shopId,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export function useApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const get = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ success: boolean; data: T }>(path);
      setData(result.data);
      return result.data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const post = useCallback(async (path: string, body?: any) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ success: boolean; data: T; message?: string }>(path, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      setData(result.data);
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const put = useCallback(async (path: string, body?: any) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ success: boolean; data: T }>(path, {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
      });
      setData(result.data);
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, get, post, put, setData };
}

export { apiFetch };
