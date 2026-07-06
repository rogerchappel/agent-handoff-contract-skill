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

## 2026-06-25 Verification Result

- `npm run check`: passed
- `npm test`: passed, 5 tests
- `npm run smoke`: passed through `scripts/validate.sh`
- `npm run package:smoke`: passed package boundary dry run
- `npm run release:check`: passed the maintained release gate
- `bash scripts/validate.sh`: passed

## 2026-07-06 Verification Result

- `npm run release:check`: passed locally, including syntax checks, 7 node:test cases, CLI help/version/fixture smoke, and package smoke.
- Added a GitHub Actions release gate for pull requests and pushes to `main` on Node.js 20 and 22.

## Classification

`ship`: the checker catches incomplete and risky handoffs while passing a complete local-only fixture.
