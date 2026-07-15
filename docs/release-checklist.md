# Release checklist

Use this checklist before cutting a public release for agent-handoff-contract-skill.

## Required checks

- Run `npm run release:check` from a clean checkout.
- Confirm the CI release-readiness job passes on the release PR.
- Review the npm pack dry-run output for unexpected files or missing runtime assets.
- Exercise the CLI smoke path for `handoff-contract` with the checked-in fixture.

## Review notes

- Keep fixture updates in the same PR as behavior changes.
- Call out limitations, required inputs, and operator follow-up in the PR body.
- Do not publish until the pack contents and smoke output match the README.
