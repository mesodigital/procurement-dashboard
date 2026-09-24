import { useEffect, useState, useCallback } from 'react';

const qs = (params?: Record<string, any>) =>
  Object.entries(params || {})
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

export function useApi(path: string, params?: Record<string, any>) {
  const [state, setState] = useState({ data: null, loading: true, error: null, key: null });
  const key = `${path}?${JSON.stringify(params || {})}`;

  const load = useCallback(() => {
    setState({ data: null, loading: true, error: null, key });
    fetch(`/api/${path}${qs(params) ? '?' + qs(params) : ''}`)
      .then((r) => r.json())
      .then((d) => setState({ data: d, loading: false, error: null, key }))
      .catch((e) => setState({ data: null, loading: false, error: e.message, key }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const current = state.key === key ? state : { data: null, loading: true, error: null };
  return { data: current.data, loading: current.loading, error: current.error, reload: load };
}

export const fmtIDR = (v) => {
  if (v == null) return '-';
  const abs = Math.abs(v);
  if (abs >= 1e12) return `Rp ${(v / 1e12).toFixed(2)} T`;
  if (abs >= 1e9) return `Rp ${(v / 1e9).toFixed(2)} M`;
  if (abs >= 1e6) return `Rp ${(v / 1e6).toFixed(1)} jt`;
  if (abs >= 1e3) return `Rp ${(v / 1e3).toFixed(1)} rb`;
  return `Rp ${v.toFixed(0)}`;
};

export const fmtNum = (v, d = 0) => (v == null ? '-' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: d }));
export const fmtPct = (v, d = 1) => (v == null ? '-' : `${Number(v).toFixed(d)}%`);
