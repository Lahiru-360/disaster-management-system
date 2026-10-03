import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoverageGate } from './CoverageGate.js';

// Runs the whole server suite but reports coverage only for one use case's
// files, as registered in coverage-scopes.json, then applies the 80% gate:
//   node scripts/coverageScope.js uc03 [extra jest args]
// Config and rootDir are passed as absolute paths, so it also works from a
// folder without server/.env (e.g. the repo root).
const serverDir = fileURLToPath(new URL('..', import.meta.url));
const scopes = JSON.parse(readFileSync(path.join(serverDir, 'coverage-scopes.json')));

const [scope, ...jestArgs] = process.argv.slice(2);

if (!Object.hasOwn(scopes, scope)) {
  console.error(
    `Unknown coverage scope "${scope}". Expected one of: ${Object.keys(scopes).join(', ')}.`,
  );
  process.exit(1);
}

// Without globs Jest would fall back to the config's src/**, silently
// reporting the whole server as this use case's number.
if (scopes[scope].length === 0) {
  console.error(`No files registered for ${scope}. Add its globs to server/coverage-scopes.json.`);
  process.exit(1);
}

const coverageDir = path.join(serverDir, 'coverage', scope);
const result = spawnSync(
  process.execPath,
  [
    '--experimental-vm-modules',
    path.join(serverDir, 'node_modules/jest/bin/jest.js'),
    '--config',
    path.join(serverDir, 'jest.config.js'),
    '--rootDir',
    serverDir,
    '--coverage',
    `--collectCoverageFrom=${JSON.stringify(scopes[scope])}`,
    `--coverageDirectory=${coverageDir}`,
    ...jestArgs,
  ],
  { stdio: 'inherit' },
);

if (result.status !== 0) process.exit(result.status ?? 1);

const summary = JSON.parse(readFileSync(path.join(coverageDir, 'coverage-summary.json')));
const gate = new CoverageGate({ rootDir: serverDir, scopes });
process.exit(gate.print(gate.evaluate(summary, [scope])) ? 0 : 1);
