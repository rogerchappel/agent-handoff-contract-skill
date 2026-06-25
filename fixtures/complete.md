# Launch Prep Handoff

## Objective

Prepare a launch note from the verified repository state.

## Owner

content-agent

## Current State

Implementation is complete and tests passed locally.

## Inputs

- Repository path: ./sample
- Evidence: docs/RELEASE_CANDIDATE.md

## Expected Outputs

- Draft launch note
- No posting or publishing

## Approval Boundaries

Human approval required before any public post, GitHub release, merge, or external send.

## Side-Effect Limits

Local-only and dry-run. Do not write to external systems.

## Verification

npm test passed; npm run smoke passed; artifact path docs/RELEASE_CANDIDATE.md.

## Blockers

None.

## Next Action

Draft the launch note in Markdown and return it for review.
