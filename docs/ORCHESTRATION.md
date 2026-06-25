# Orchestration

## Agent Flow

1. Draft the handoff packet before delegating.
2. Run the checker locally.
3. Fix fail-level findings before transfer.
4. Attach the report to the handoff notes.
5. Ask for explicit approval before any receiving agent performs external writes.

## Tool Boundaries

The checker is read-only and local. It does not send messages, spawn agents, create issues, update CRMs, merge PRs, publish releases, or alter remote state.

## Failure Handling

- Missing owner, objective, verification, approval boundaries, or next action blocks the handoff.
- Risky actions require explicit human approval language.
- Warnings should be reviewed and either fixed or disclosed.
