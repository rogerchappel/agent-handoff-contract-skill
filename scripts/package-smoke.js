#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const requiredFiles = ['src', 'scripts', 'fixtures', 'docs', 'SKILL.md', 'README.md', 'LICENSE', 'SECURITY.md'];

for (const file of requiredFiles) {
  if (!manifest.files?.includes(file)) {
    console.error(`package.json files must include ${file}`);
    process.exit(1);
  }
}

const pack = spawnSync('npm', ['pack', '--dry-run'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (pack.status !== 0) {
  process.stderr.write(pack.stderr);
  process.exit(pack.status ?? 1);
}

const listing = `${pack.stdout}\n${pack.stderr}`;
for (const expected of ['src/cli.js', 'src/index.js', 'fixtures/complete.md', 'SKILL.md', 'README.md', 'LICENSE', 'SECURITY.md']) {
  if (!listing.includes(expected)) {
    console.error(`npm pack dry-run did not include ${expected}`);
    process.exit(1);
  }
}
