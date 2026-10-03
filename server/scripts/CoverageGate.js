import path from 'node:path';
import { globsToMatcher, replacePathSepForGlob } from 'jest-util';

// Gates each use case on its own coverage. The lines and branches of every
// file in a scope (coverage-scopes.json) are summed, and the scope fails when
// either total is below the threshold. Jest's per-path coverageThreshold
// can't do this: it checks glob entries file by file, not as one total.
export class CoverageGate {
  static THRESHOLD = 80;

  #rootDir;

  #scopes;

  #threshold;

  constructor({ rootDir, scopes, threshold = CoverageGate.THRESHOLD }) {
    this.#rootDir = rootDir;
    this.#scopes = scopes;
    this.#threshold = threshold;
  }

  /**
   * Totals a json-summary coverage report per scope. Scopes with no globs
   * are skipped; a scope whose globs match no file fails. Throws on an
   * unknown scope name.
   * @param {object} summary parsed coverage-summary.json (absolute file paths as keys)
   * @param {string[]} [scopeNames] defaults to every scope
   * @returns {{ scope: string, files: number, lines: object, branches: object, passed: boolean, skipped: boolean }[]}
   */
  evaluate(summary, scopeNames = Object.keys(this.#scopes)) {
    const files = Object.entries(summary)
      .filter(([key]) => key !== 'total')
      .map(([file, coverage]) => [
        replacePathSepForGlob(path.relative(this.#rootDir, file)),
        coverage,
      ]);

    return scopeNames.map((scope) => {
      if (!Object.hasOwn(this.#scopes, scope)) {
        throw new Error(`Unknown coverage scope "${scope}"`);
      }
      const globs = this.#scopes[scope];
      if (globs.length === 0) {
        return { scope, files: 0, lines: null, branches: null, passed: true, skipped: true };
      }
      const isMatch = globsToMatcher(globs);
      const matched = files.filter(([file]) => isMatch(file)).map(([, coverage]) => coverage);
      const lines = CoverageGate.#total(matched, 'lines');
      const branches = CoverageGate.#total(matched, 'branches');
      const passed =
        matched.length > 0 && lines.pct >= this.#threshold && branches.pct >= this.#threshold;
      return { scope, files: matched.length, lines, branches, passed, skipped: false };
    });
  }

  /**
   * One printable line per result.
   * @param {ReturnType<CoverageGate['evaluate']>[number]} result
   */
  static format({ scope, files, lines, branches, passed, skipped }) {
    if (skipped) return `${scope}  no files registered, skipped`;
    if (files === 0) return `${scope}  FAIL  its globs match no file in the coverage report`;
    const metric = (name, { covered, total, pct }) =>
      `${name} ${pct.toFixed(2)}% (${covered}/${total})`;
    return `${scope}  ${passed ? 'PASS' : 'FAIL'}  ${metric('lines', lines)}  ${metric('branches', branches)}  ${files} file${files === 1 ? '' : 's'}`;
  }

  /**
   * Prints the results under a header.
   * @returns {boolean} true when every scope passed
   */
  print(results) {
    console.log(`Coverage gate: ${this.#threshold}% lines and branches per use case`);
    results.forEach((result) => console.log(`  ${CoverageGate.format(result)}`));
    return results.every((result) => result.passed);
  }

  // Exact ratio, no rounding; nothing to cover counts as fully covered, as in Jest.
  static #total(coverages, metric) {
    const covered = coverages.reduce((sum, coverage) => sum + coverage[metric].covered, 0);
    const total = coverages.reduce((sum, coverage) => sum + coverage[metric].total, 0);
    return { covered, total, pct: total === 0 ? 100 : (covered / total) * 100 };
  }
}
