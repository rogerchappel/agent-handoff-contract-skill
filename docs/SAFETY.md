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

Read-only review and local drafting do not require approval merely because they mention an external system or release. Explicitly negated actions such as "do not publish" also remain non-actionable; approval is required when the next action actually authorizes the external side effect.
