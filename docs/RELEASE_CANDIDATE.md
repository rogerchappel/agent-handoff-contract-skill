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

## Classification

`ship`: the checker catches incomplete and risky handoffs while passing a complete local-only fixture.
