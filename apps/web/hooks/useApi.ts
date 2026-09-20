"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  getDataSourceStatus,
  subscribeDataSourceStatus,
  type DataSourceStatus,
} from "@/lib/api";

export interface ApiState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => void;
}

/** Tiny in-memory cache so navigating between pages does not refetch everything. */
const cache = new Map<string, unknown>();

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

interface Outcome<T> {
  key: string | null;
  tick: number;
  data: T | null;
  error: Error | null;
}

/**
 * Minimal data hook: resolves `fetcher` once per `key`, exposes loading/error,
 * and serves cached results instantly on revisit. Intentionally small; no
 * external state library.
 */
export function useApi<T>(key: string | null, fetcher: () => Promise<T>): ApiState<T> {
  const [tick, setTick] = useState(0);
  const [outcome, setOutcome] = useState<Outcome<T>>({ key: null, tick: -1, data: null, error: null });
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const cached = key ? (cache.get(key) as T | undefined) : undefined;
  const fresh = outcome.key === key && outcome.tick === tick;
  const data = fresh ? outcome.data : (cached ?? null);
  const error = fresh ? outcome.error : null;
  const loading = !!key && !fresh && cached === undefined;

  useEffect(() => {
    if (!key) return;
    if (cache.has(key) && tick === 0) return;
    let cancelled = false;
    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return;
        cache.set(key, result);
        setOutcome({ key, tick, data: result, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOutcome({ key, tick, data: null, error: err instanceof Error ? err : new Error(String(err)) });
      });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const refetch = useCallback(() => {
    if (key) cache.delete(key);
    setTick((value) => value + 1);
  }, [key]);

  return { data, error, loading, refetch };
}

export function useDataSourceStatus(): DataSourceStatus {
  return useSyncExternalStore(subscribeDataSourceStatus, getDataSourceStatus, () => "unknown");
}
