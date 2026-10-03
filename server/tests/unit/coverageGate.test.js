import { jest } from '@jest/globals';
import path from 'node:path';
import { CoverageGate } from '../../scripts/CoverageGate.js';

const rootDir = path.resolve('/srv/server');

const metric = (covered, total) => ({ covered, total });

// A json-summary report: absolute file paths as keys, plus Jest's 'total'.
const summaryOf = (files) => ({
  total: { lines: metric(0, 0), branches: metric(0, 0) },
  ...Object.fromEntries(
    Object.entries(files).map(([file, coverage]) => [path.join(rootDir, file), coverage]),
  ),
});

const file = (lines, branches) => ({ lines: metric(...lines), branches: metric(...branches) });

describe('CoverageGate.evaluate', () => {
  it('DMS-102: sums lines and branches across every file in the scope', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: ['src/services/*.js'] } });
    const summary = summaryOf({
      'src/services/ShelterService.js': file([90, 100], [18, 20]),
      'src/services/DispatchService.js': file([5, 10], [2, 4]),
    });

    const [result] = gate.evaluate(summary);

    expect(result).toMatchObject({
      scope: 'uc03',
      files: 2,
      lines: { covered: 95, total: 110 },
      branches: { covered: 20, total: 24 },
      passed: true,
      skipped: false,
    });
  });

  it('DMS-102: passes a scope on its total even when one file is below 80%', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: ['src/**/*.js'] } });
    const summary = summaryOf({
      'src/a.js': file([100, 100], [50, 50]),
      'src/b.js': file([1, 4], [1, 2]),
    });

    expect(gate.evaluate(summary)[0].passed).toBe(true);
  });

  it('DMS-102: fails a scope whose lines total is below 80%', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: ['src/a.js'] } });
    const summary = summaryOf({ 'src/a.js': file([79, 100], [10, 10]) });

    expect(gate.evaluate(summary)[0].passed).toBe(false);
  });

  it('DMS-102: fails a scope whose branches total is below 80%', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: ['src/a.js'] } });
    const summary = summaryOf({ 'src/a.js': file([10, 10], [7, 9]) });

    expect(gate.evaluate(summary)[0].passed).toBe(false);
  });

  it('DMS-102: passes a scope at exactly 80% lines and branches', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: ['src/a.js'] } });
    const summary = summaryOf({ 'src/a.js': file([80, 100], [4, 5]) });

    expect(gate.evaluate(summary)[0].passed).toBe(true);
  });

  it('DMS-102: compares the exact ratio, without rounding up', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: ['src/a.js'] } });
    const summary = summaryOf({ 'src/a.js': file([7999, 10000], [1, 1]) });

    const [result] = gate.evaluate(summary);

    expect(result.lines.pct).toBeCloseTo(79.99, 2);
    expect(result.passed).toBe(false);
  });

  it('DMS-102: counts a scope with no branches as fully covered on branches', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: ['src/a.js'] } });
    const summary = summaryOf({ 'src/a.js': file([9, 10], [0, 0]) });

    const [result] = gate.evaluate(summary);

    expect(result.branches.pct).toBe(100);
    expect(result.passed).toBe(true);
  });

  it('DMS-102: leaves out files excluded by a negated glob', () => {
    const gate = new CoverageGate({
      rootDir,
      scopes: { uc03: ['src/services/**/*.js', '!src/services/legacy/**'] },
    });
    const summary = summaryOf({
      'src/services/ShelterService.js': file([10, 10], [2, 2]),
      'src/services/legacy/Old.js': file([0, 50], [0, 10]),
    });

    const [result] = gate.evaluate(summary);

    expect(result.files).toBe(1);
    expect(result.passed).toBe(true);
  });

  it("DMS-102: ignores files outside the scope and Jest's 'total' entry", () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: ['src/a.js'] } });
    const summary = summaryOf({
      'src/a.js': file([10, 10], [2, 2]),
      'src/other.js': file([0, 100], [0, 100]),
    });
    summary.total = file([10, 210], [2, 102]);

    expect(gate.evaluate(summary)[0]).toMatchObject({ files: 1, passed: true });
  });

  it('DMS-102: skips a scope with no registered globs without failing', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc02: [] } });

    expect(gate.evaluate(summaryOf({}))[0]).toMatchObject({
      scope: 'uc02',
      skipped: true,
      passed: true,
    });
  });

  it('DMS-102: fails a scope whose globs match no file in the report', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: ['src/typo/*.js'] } });
    const summary = summaryOf({ 'src/a.js': file([10, 10], [2, 2]) });

    expect(gate.evaluate(summary)[0]).toMatchObject({ files: 0, passed: false, skipped: false });
  });

  it('DMS-102: evaluates only the scopes it is asked for', () => {
    const gate = new CoverageGate({
      rootDir,
      scopes: { uc01: ['src/typo/*.js'], uc03: ['src/a.js'] },
    });
    const summary = summaryOf({ 'src/a.js': file([10, 10], [2, 2]) });

    expect(gate.evaluate(summary, ['uc03']).map((result) => result.scope)).toEqual(['uc03']);
  });

  it('DMS-102: throws on an unknown scope name', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: [] } });

    expect(() => gate.evaluate(summaryOf({}), ['uc09'])).toThrow('Unknown coverage scope "uc09"');
  });

  it('DMS-102: applies a custom threshold', () => {
    const gate = new CoverageGate({ rootDir, scopes: { uc03: ['src/a.js'] }, threshold: 95 });
    const summary = summaryOf({ 'src/a.js': file([90, 100], [10, 10]) });

    expect(gate.evaluate(summary)[0].passed).toBe(false);
  });
});

describe('CoverageGate.format', () => {
  it('DMS-102: shows the totals and the verdict of a measured scope', () => {
    const line = CoverageGate.format({
      scope: 'uc03',
      files: 2,
      lines: { covered: 95, total: 110, pct: (95 / 110) * 100 },
      branches: { covered: 20, total: 24, pct: (20 / 24) * 100 },
      passed: true,
      skipped: false,
    });

    expect(line).toBe('uc03  PASS  lines 86.36% (95/110)  branches 83.33% (20/24)  2 files');
  });

  it('DMS-102: says when a scope was skipped or matched nothing', () => {
    expect(CoverageGate.format({ scope: 'uc02', files: 0, skipped: true, passed: true })).toBe(
      'uc02  no files registered, skipped',
    );
    expect(CoverageGate.format({ scope: 'uc01', files: 0, skipped: false, passed: false })).toBe(
      'uc01  FAIL  its globs match no file in the coverage report',
    );
  });
});

describe('CoverageGate.print', () => {
  it('DMS-102: returns false when any scope failed', () => {
    const gate = new CoverageGate({ rootDir, scopes: {} });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    const passed = gate.print([
      { scope: 'uc02', files: 0, skipped: true, passed: true },
      { scope: 'uc01', files: 0, skipped: false, passed: false },
    ]);

    expect(passed).toBe(false);
    expect(log).toHaveBeenCalledWith('Coverage gate: 80% lines and branches per use case');
    log.mockRestore();
  });
});
