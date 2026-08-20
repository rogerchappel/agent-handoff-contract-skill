import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const readme = readFileSync('README.md', 'utf8');
const releaseCandidate = readFileSync('docs/RELEASE_CANDIDATE.md', 'utf8');
const releaseChecklist = readFileSync('docs/release-checklist.md', 'utf8');
const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const failures = [];

function requireField(condition, message) {
  if (!condition) failures.push(message);
}

requireField(pkg.name === 'agent-handoff-contract-skill', 'package name must remain agent-handoff-contract-skill');
requireField(pkg.version === '0.1.0', 'release candidate version must be 0.1.0');
requireField(pkg.license === 'MIT', 'package must declare the MIT license');
requireField(pkg.engines?.node === '>=22', 'Node engine must document the supported runtime baseline');
requireField(pkg.repository?.url === 'git+https://github.com/rogerchappel/agent-handoff-contract-skill.git', 'repository metadata must point at GitHub');
requireField(pkg.bugs?.url === 'https://github.com/rogerchappel/agent-handoff-contract-skill/issues', 'bugs URL must point at GitHub issues');
requireField(pkg.homepage === 'https://github.com/rogerchappel/agent-handoff-contract-skill#readme', 'homepage must point at the README');
requireField(pkg.bin?.['handoff-contract'] === './src/cli.js', 'CLI bin must point at ./src/cli.js');
requireField(Array.isArray(pkg.files), 'package files allowlist is required');

const installSection = readme.match(/## Install\n([\s\S]*?)(?=\n## )/)?.[1] ?? '';
requireField(
  installSection.includes('git clone https://github.com/rogerchappel/agent-handoff-contract-skill.git') &&
    installSection.includes('npm install') &&
    installSection.includes('npm link'),
  'README install guidance must provide an executable source install path'
);
requireField(
  /After the package is published to npm,[\s\S]*npm install --global agent-handoff-contract-skill/.test(installSection),
  'README must gate the global npm install command on package publication'
);

const matrixMatch = ciWorkflow.match(/node-version:\s*\[([^\]]+)\]/);
const matrix = matrixMatch?.[1].split(',').map((value) => value.trim()) ?? [];
const documentedMatrix = matrix.join(', ');
requireField(matrix.length > 0, 'CI workflow must declare a Node.js matrix');
for (const [name, content] of [
  ['README', readme],
  ['release checklist', releaseChecklist],
  ['release candidate notes', releaseCandidate]
]) {
  requireField(
    content.includes(`Node.js ${documentedMatrix.replace(/, ([^,]+)$/, ', and $1')}`),
    `${name} must match the CI Node.js matrix (${documentedMatrix})`
  );
}

const testRun = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { encoding: 'utf8' });
requireField(testRun.status === 0, 'node:test must pass while validating release evidence');
const testCount = testRun.stdout.match(/^# tests (\d+)$/m)?.[1];
const documentedTestCounts = [...releaseCandidate.matchAll(/(\d+) node:test cases/g)].map((match) => match[1]);
requireField(Boolean(testCount), 'node:test output must report a test count');
requireField(
  documentedTestCounts.length === 1 && documentedTestCounts[0] === testCount,
  `release candidate notes must contain exactly one executable test count (${testCount})`
);

for (const file of [
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'SKILL.md',
  'docs/SAFETY.md',
  'docs/RELEASE_CANDIDATE.md',
  'fixtures/complete.md',
  'fixtures/incomplete.md',
  '.github/workflows/ci.yml'
]) {
  requireField(existsSync(file), `${file} must be present for release review`);
}

for (const entry of ['src', 'scripts', 'fixtures', 'docs', 'SKILL.md', 'README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md']) {
  requireField(pkg.files.includes(entry), `package files allowlist must include ${entry}`);
}

if (failures.length) {
  console.error(`release readiness failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('release readiness ok');
