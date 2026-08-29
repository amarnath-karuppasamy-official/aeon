// Type declarations for @aeon-framework/http. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.
import type { Signal, ReadonlySignal } from '@aeon-framework/core';

export class HttpError extends Error {
  constructor(status: number, statusText: string, body: unknown);
  status: number;
  statusText: string;
  body: unknown;
}

export interface FetchOpts extends Omit<RequestInit, 'method' | 'body'> {}

export const http: {
  get<T = unknown>(url: string, opts?: FetchOpts): Promise<T>;
  del<T = unknown>(url: string, opts?: FetchOpts): Promise<T>;
  post<T = unknown>(url: string, body?: unknown, opts?: FetchOpts): Promise<T>;
  put<T = unknown>(url: string, body?: unknown, opts?: FetchOpts): Promise<T>;
  patch<T = unknown>(url: string, body?: unknown, opts?: FetchOpts): Promise<T>;
};

export interface Resource<T> {
  data: Signal<T | undefined>;
  error: Signal<unknown>;
  loading: Signal<boolean>;
  /** Re-run the fetch immediately, aborting any in-flight request. */
  refetch(): void;
  /** Abort any in-flight request and stop reacting to source changes. */
  dispose(): void;
}

/** Reactive data tied to a source signal; call inside a component so
 * unmount aborts an in-flight request automatically. A source of
 * `null`/`undefined`/`false` skips fetching. */
export function resource<S, T>(
  sourceFn: () => S | null | undefined | false,
  fetcher: (source: S, opts: { signal: AbortSignal }) => Promise<T> | T
): Resource<T>;

export interface Mutation<T, Args extends unknown[]> {
  data: Signal<T | undefined>;
  error: Signal<unknown>;
  loading: Signal<boolean>;
  /** Trigger the action. Rejects like the underlying promise on failure. */
  run(...args: Args): Promise<T>;
}

/** An imperative action (POST/PUT/DELETE, form submit) triggered by calling
 * run(...args) — the same {data, error, loading} shape as resource(), but
 * not tied to a reactive source. */
export function mutation<T, Args extends unknown[] = unknown[]>(
  actionFn: (...args: Args) => Promise<T> | T
): Mutation<T, Args>;
