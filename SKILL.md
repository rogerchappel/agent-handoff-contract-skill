# Agent Handoff Contract Skill

Use this skill before handing work from one agent to another agent or human when context, approvals, and verification evidence must survive the transfer.

## Required Inputs

- Markdown or JSON handoff packet
- Current objective and state
- Owner or receiving role
- Inputs and expected outputs
- Approval and side-effect boundaries
- Verification evidence: an observed outcome, artifact/log/output path or URL,
  or an explicit not-run note (a bare command is not evidence)

## Workflow

1. Write or collect the handoff packet.
2. Run `handoff-contract <handoff-file> --format markdown`.
3. Treat fail-level findings as blocking.
4. Resolve unclear ownership, missing approvals, hidden blockers, or absent verification.
5. Include the final report with the handoff.

## Side-Effect Boundaries

The CLI reads a local file and writes a report to stdout. It must not create sessions, send messages, update tickets, write to CRMs, merge code, publish releases, or perform connector actions.

## Approval Requirements

Explicit human approval is required before a handoff can authorize external writes, public communication, production updates, payments, merges, releases, or account changes.

## Examples

```bash
handoff-contract handoff.md --format markdown
handoff-contract handoff.json --format json
```

## Validation

Run `npm run validate`. A valid report has no fail-level findings and includes clear ownership, next action, side-effect limits, and verification evidence.
