# Release Candidate Notes

## Scope

Initial public build of `agent-handoff-contract-skill`.

## Verification

```bash
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
bash scripts/validate.sh
```

## Current verification snapshot

Verified 2026-08-23 against this release candidate:

- `npm run release:check`: passed, including release-readiness validation,
  syntax checks, 42 node:test cases, CLI help/version/fixture smoke, and
  package smoke.
- GitHub Actions CI passed the same release gate on Node.js 22, 24, and 26.
- `bash scripts/validate.sh`: passed.

The release-readiness validator derives the test count from a live `node:test`
run and the supported runtimes from `.github/workflows/ci.yml`, then rejects
documentation that disagrees with either executable source.

## Classification

`ship`: the checker catches incomplete and risky handoffs while passing a complete local-only fixture.
