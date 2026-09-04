// Type declarations for @aeon-framework/compiler. Hand-written to match
// src/index.js — keep in sync by hand when the JS API changes.

/** How serious a finding is. `error` fails `aeon check`'s exit code (and is
 * reserved for problems with a real, provable failure mode: a binding kind
 * Aeon's compiler silently mis-treats, or a route that can literally never
 * be reached). `warning` surfaces something worth a look without failing
 * the run. */
export type Severity = 'error' | 'warning';

/** Which check produced a finding. */
export type Rule = 'binding-footgun' | 'unused-import' | 'unreachable-route' | 'route-collision';

export interface Finding {
  severity: Severity;
  rule: Rule;
  /** Path to the file the finding is in, relative to `projectDir`. */
  file: string;
  /** 1-based source line the finding anchors to. */
  line: number;
  message: string;
}

/**
 * Run every static-analysis check (binding-kind validation via Aeon's real
 * compiler, unused `@aeon-framework/*` imports, unreachable routes) against
 * a real project on disk under `projectDir/src`. Never eval()s or import()s
 * the target project's code.
 */
export function analyzeProject(args: { projectDir: string }): Promise<Finding[]>;
