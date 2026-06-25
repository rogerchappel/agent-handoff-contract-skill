# Release Candidate Notes

## Scope

Initial public build of `agent-handoff-contract-skill`.

## Verification

```bash
npm run check
npm test
npm run smoke
bash scripts/validate.sh
```

## 2026-06-25 Verification Result

- `npm run check`: passed
- `npm test`: passed, 5 tests
- `npm run smoke`: passed through `scripts/validate.sh`
- `bash scripts/validate.sh`: passed

## Classification

`ship`: the checker catches incomplete and risky handoffs while passing a complete local-only fixture.
