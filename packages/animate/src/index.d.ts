// Type declarations for @aeon-framework/animate. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.

export interface TransitionOptions {
  className?: string;
  duration?: number;
}

/** Drive a single element's enter/leave transition via class toggle +
 * transitionend-or-timeout (whichever comes first). */
export const transition: {
  enter(el: Element, opts?: TransitionOptions): Promise<void>;
  leave(el: Element, opts?: TransitionOptions): Promise<void>;
};

export interface AnimatedListOptions<T> {
  items(): readonly T[];
  key?: (item: T, index: number) => unknown;
  render(item: T, index: number): Element;
  enterClass?: string;
  leaveClass?: string;
  duration?: number;
}

/** A keyed list of real DOM elements under `container`, reactive over
 * `items()`, where removed rows animate out before being removed and new
 * rows animate in after being inserted. Returns a stop function. */
export function animatedList<T>(container: Element, options: AnimatedListOptions<T>): () => void;
