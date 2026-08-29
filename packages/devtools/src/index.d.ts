// Type declarations for @aeon-framework/devtools. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.
import type { Signal, ReadonlySignal } from '@aeon-framework/core';

export interface TrackedEntry {
  name: string;
  signal: Signal<unknown> | ReadonlySignal<unknown>;
}

export interface DevtoolsRegistry {
  entries: Signal<TrackedEntry[]>;
  track(name: string, signal: Signal<unknown> | ReadonlySignal<unknown>): void;
  untrack(name: string): void;
}

/** Create an independent registry of tracked signals. */
export function createRegistry(): DevtoolsRegistry;

/** Mount the overlay into `container`. Returns a dispose function
 * (with `.registry` attached) — same contract as core's `mount()`. */
export function mountDevtoolsOverlay(
  container: Element,
  registry?: DevtoolsRegistry
): (() => void) & { registry: DevtoolsRegistry };

export interface AttachDevtoolsOptions {
  hotkey?: string;
  registry?: DevtoolsRegistry;
}

export interface AttachedDevtools {
  registry: DevtoolsRegistry;
  toggle(): void;
  destroy(): void;
}

/** Mounts a hidden overlay into document.body, toggled by `hotkey` (default "F2"). */
export function attachDevtools(options?: AttachDevtoolsOptions): AttachedDevtools;
