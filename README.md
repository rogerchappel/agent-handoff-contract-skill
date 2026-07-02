# Agent Handoff Contract Skill

Agent Handoff Contract Skill is a local-first CLI and reusable agent skill for validating handoff packets before another agent or human continues the work. It checks ownership, inputs, outputs, approvals, side-effect limits, blockers, verification evidence, and next actions.

## Quickstart

```bash
npm test
npm run smoke
node src/cli.js fixtures/complete.md --format markdown
```

## Install

```bash
npm install -g agent-handoff-contract-skill
```

## CLI

```bash
handoff-contract <handoff.md|handoff.json> [--format json|markdown]
```

Markdown handoffs use `##` sections such as `Objective`, `Owner`, `Current State`, `Inputs`, `Expected Outputs`, `Approval Boundaries`, `Side-Effect Limits`, `Verification`, `Blockers`, and `Next Action`.

## Example

```bash
node src/cli.js fixtures/incomplete.md --format json
```

The CLI exits `0` for pass or warn reports and `2` for fail reports.

## Verify

Run the release-readiness check before promoting the package:

```bash
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
```

Pull requests and pushes to `main` run the release gate in GitHub Actions.

## Package contents

`npm run package:smoke` performs a dry-run pack and asserts that the tarball
contains the CLI entrypoint, library source, fixtures, `SKILL.md`, README,
release notes, safety notes, license, and security policy.

## Limitations

- The checker validates handoff completeness; it does not create sessions or send messages.
- Risk detection is conservative and term-based.
- It cannot prove command output is authentic; it checks that evidence is disclosed.

## Safety Notes

This tool is local-only by default. It never writes tickets, opens sessions, sends chat messages, updates CRMs, merges PRs, or touches external systems. Any external action must be approved outside this checker.
