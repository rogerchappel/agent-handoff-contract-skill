# Agent Handoff Contract Skill

Agent Handoff Contract Skill is a local-first CLI and reusable agent skill for validating handoff packets before another agent or human continues the work. It checks ownership, inputs, outputs, approvals, side-effect limits, blockers, verification evidence, and next actions.

## Quickstart

```bash
npm test
npm run smoke
node src/cli.js --help
node src/cli.js fixtures/complete.md --format markdown
```

## Install

The package is not yet published to npm. Install the current source locally:

```bash
git clone https://github.com/rogerchappel/agent-handoff-contract-skill.git
cd agent-handoff-contract-skill
npm install
npm link
```

This makes the `handoff-contract` command available from the checked-out
source. After the package is published to npm, a global registry install will
also be available:

```bash
npm install --global agent-handoff-contract-skill
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

The CLI accepts one input file and at most one `--format` option. Unknown
options, repeated `--format` options, missing option values, and unsupported
formats are usage errors; they print a concise error and usage text without
reading the input file.

The CLI exits `0` for pass or warn reports, `1` for usage or runtime errors,
and `2` for fail reports.

## Verify

Run the release-readiness check before promoting the package:

```bash
npm run check
npm test
npm run smoke
npm run package:smoke
npm run release:check
```

`npm run release:readiness` verifies package metadata, CLI bin metadata,
support docs, fixtures, CI presence, and the npm files allowlist before the
runtime smoke and package dry-run checks run.

Pull requests and pushes to `main` run the release gate in GitHub Actions.

## Package contents

`npm run package:smoke` performs a dry-run pack and asserts that the tarball
contains the CLI entrypoint, library source, fixtures, `SKILL.md`, README,
release notes, safety notes, license, and security policy.


## Verification

Run the local quality gates before opening a pull request:

```sh
npm run lint
npm test
npm run smoke
```

`npm run lint` is an alias for the repository static check so contributors can use the common npm workflow without guessing the project-specific command.

## Limitations

- The checker validates handoff completeness; it does not create sessions or send messages.
- Risk detection is conservative and term-based.
- It cannot prove command output is authentic; it checks that evidence is disclosed.

## Safety Notes

This tool is local-only by default. It never writes tickets, opens sessions, sends chat messages, updates CRMs, merges PRs, or touches external systems. Any external action must be approved outside this checker.

## Release notes

Before tagging a release, confirm the smoke fixture still represents the intended workflow and summarize any changed output, limitations, or operator steps in the PR.
