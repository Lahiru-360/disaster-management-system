import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Runs the whole server suite but reports coverage only for one use case's
// files, as registered in coverage-scopes.json:
//   node scripts/coverageScope.js uc03 [extra jest args]
// Config and rootDir are passed as absolute paths, so it also works from a
// folder without server/.env (e.g. the repo root).
const serverDir = fileURLToPath(new URL('..', import.meta.url));
const scopes = JSON.parse(readFileSync(new URL('../coverage-scopes.json', import.meta.url)));

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

const result = spawnSync(
  process.execPath,
  [
    '--experimental-vm-modules',
    fileURLToPath(new URL('../node_modules/jest/bin/jest.js', import.meta.url)),
    '--config',
    fileURLToPath(new URL('../jest.config.js', import.meta.url)),
    '--rootDir',
    serverDir,
    '--coverage',
    `--collectCoverageFrom=${JSON.stringify(scopes[scope])}`,
    `--coverageDirectory=coverage/${scope}`,
    ...jestArgs,
  ],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
