import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoverageGate } from './CoverageGate.js';

// Fails when any use case's scope is below 80% lines or branches. Reads the
// report `npm run test:coverage` writes, or the one given (relative to server/):
//   node scripts/checkCoverage.js [coverage/coverage-summary.json] [uc03 ...]
const serverDir = fileURLToPath(new URL('..', import.meta.url));
const scopes = JSON.parse(readFileSync(path.join(serverDir, 'coverage-scopes.json')));

const [summaryPath = 'coverage/coverage-summary.json', ...scopeNames] = process.argv.slice(2);
const summary = JSON.parse(readFileSync(path.resolve(serverDir, summaryPath)));

const gate = new CoverageGate({ rootDir: serverDir, scopes });
const passed = gate.print(gate.evaluate(summary, scopeNames.length > 0 ? scopeNames : undefined));

process.exit(passed ? 0 : 1);
