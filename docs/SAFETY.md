# Safety

Agent Handoff Contract Skill validates a handoff packet; it does not perform the handoff.

## Default Boundary

- Reads one local Markdown or JSON file
- Emits JSON or Markdown to stdout
- Does not spawn agents, send messages, create tickets, update CRMs, merge code, or publish releases

## Blocking Conditions

Treat fail-level findings as blockers before delegation. Missing ownership, unclear approvals, hidden blockers, and absent verification evidence are especially risky in multi-agent workflows.

## External Actions

Any handoff that asks the receiving agent to send, publish, deploy, merge, release, delete, charge, or update production systems needs explicit human approval outside this checker.
