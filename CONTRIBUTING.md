# Contributing

Thanks for improving `agent-handoff-contract-skill`. Keep changes small,
reviewable, and focused on the local handoff validation workflow.

## Local Verification

Run the release gate before opening a pull request:

```sh
npm run release:check
```

For smaller edits, these checks are also useful:

```sh
npm run check
npm test
npm run smoke
npm run package:smoke
```

## Contributor Expectations

- Do not add network calls, account writes, session creation, or automatic
  external side effects to the default CLI path.
- Keep fixture changes realistic and tied to documented handoff sections.
- Update `README.md` or `docs/` when behavior, limits, or release checks
  change.
- Include command output or a short verification note in the pull request.
