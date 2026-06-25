# Product Requirements

## Goal

Create a reusable local skill that validates agent handoff notes for completeness, safety, approval boundaries, and verification evidence.

## Non-Goals

- Sending handoffs to other agents
- Creating tickets or sessions
- Approving external actions
- Replacing human review for risky work

## MVP Requirements

- Accept Markdown and JSON handoff files
- Validate objective, owner, state, inputs, outputs, approvals, side effects, blockers, verification, and next action
- Flag risky external actions when approvals or limits are unclear
- Emit JSON and Markdown reports
- Include complete, incomplete, and risky fixtures

## Success Criteria

- Complete local-only handoff passes
- Incomplete handoff fails deterministically
- Risky external-action handoff fails without explicit approval boundaries
