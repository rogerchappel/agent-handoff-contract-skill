import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readHandoff, validateHandoff, formatMarkdown, parseMarkdown } from "../src/index.js";

test("passes a complete local-only handoff", () => {
  const report = validateHandoff(readHandoff("fixtures/complete.md"));
  assert.equal(report.status, "pass");
  assert.equal(report.classification, "ship");
});

test("passes complete JSON and preserves valid Markdown behavior", () => {
  for (const fixture of ["fixtures/complete.json", "fixtures/complete.md"]) {
    const report = validateHandoff(readHandoff(fixture));
    assert.equal(report.status, "pass", fixture);
    assert.equal(report.classification, "ship", fixture);
  }
});

test("rejects non-string values for every JSON contract field", () => {
  const fields = [
    "title",
    "objective",
    "owner",
    "currentState",
    "inputs",
    "expectedOutputs",
    "approvalBoundaries",
    "sideEffectLimits",
    "verification",
    "blockers",
    "nextAction"
  ];
  const invalidValues = [{ nested: "text" }, ["text"], null, 42, true];
  const directory = mkdtempSync(join(tmpdir(), "handoff-contract-test-"));

  try {
    for (const [index, field] of fields.entries()) {
      const file = join(directory, `${field}.json`);
      writeFileSync(file, JSON.stringify({ [field]: invalidValues[index % invalidValues.length] }));
      assert.throws(
        () => readHandoff(file),
        new RegExp(`JSON field ${field} must be a string\\.`),
        field
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("reports invalid JSON field shapes as field-specific runtime errors", () => {
  const directory = mkdtempSync(join(tmpdir(), "handoff-contract-cli-"));
  const file = join(directory, "invalid.json");
  writeFileSync(file, JSON.stringify({ objective: {} }));

  try {
    const result = spawnSync("node", ["src/cli.js", file, "--format", "json"], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /^JSON field objective must be a string\./m);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("fails incomplete handoff notes", () => {
  const report = validateHandoff(readHandoff("fixtures/incomplete.md"));
  assert.equal(report.status, "fail");
  assert.ok(report.findings.some((finding) => finding.field === "owner"));
  assert.ok(report.findings.some((finding) => finding.field === "verification"));
});

test("does not flag explicitly unblocked states when blockers are absent", () => {
  for (const currentState of [
    "Work is unblocked and ready.",
    "The task is not blocked.",
    "No longer waiting; implementation can continue."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.currentState = currentState;
    handoff.blockers = "No blockers.";

    const report = validateHandoff(handoff);

    assert.equal(report.status, "pass", currentState);
    assert.ok(!report.findings.some((finding) => finding.field === "blockers"), currentState);
  }
});

test("flags affirmative blocked states when blockers are listed as absent", () => {
  for (const currentState of [
    "Work is blocked pending input.",
    "Waiting for the dependency update.",
    "Cannot continue until the decision is made."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.currentState = currentState;
    handoff.blockers = "None.";

    const report = validateHandoff(handoff);

    assert.equal(report.status, "warn", currentState);
    assert.ok(report.findings.some((finding) => finding.field === "blockers"), currentState);
  }
});

test("flags risky external actions without explicit approval", () => {
  const report = validateHandoff(readHandoff("fixtures/risky.json"));
  assert.equal(report.status, "fail");
  assert.ok(report.findings.some((finding) => finding.field === "approvalBoundaries"));
  assert.ok(report.findings.some((finding) => finding.field === "sideEffectLimits"));
});

test("allows read-only context that names external systems or releases", () => {
  for (const nextAction of [
    "Review the GitHub issue and prepare release notes locally.",
    "Inspect the production checklist and Slack transcript read-only.",
    "Compare CRM records with the local report without making changes."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.nextAction = nextAction;
    handoff.approvalBoundaries = "No approval is required for this read-only local review.";

    const report = validateHandoff(handoff);

    assert.equal(report.status, "pass", nextAction);
    assert.equal(report.classification, "ship", nextAction);
  }
});

test("allows explicitly negated external actions", () => {
  for (const nextAction of [
    "Prepare release notes locally; do not publish anything.",
    "Review the change, but do not deploy or merge it.",
    "Draft the message without sending or emailing it."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.nextAction = nextAction;
    handoff.approvalBoundaries = "No human approval is required for drafting only.";

    assert.equal(validateHandoff(handoff).status, "pass", nextAction);
  }
});

test("requires approval for genuine external actions", () => {
  for (const nextAction of [
    "Publish the package.",
    "Deploy the service to production.",
    "Merge the pull request.",
    "Create a GitHub release.",
    "Post the announcement to Slack.",
    "Update the CRM record."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.nextAction = nextAction;
    handoff.approvalBoundaries = "No approval is required.";

    const report = validateHandoff(handoff);

    assert.equal(report.status, "fail", nextAction);
    assert.ok(report.findings.some((finding) => finding.field === "approvalBoundaries"), nextAction);
  }
});

test("requires approval before creating a pull request", () => {
  for (const nextAction of [
    "Open a pull request.",
    "Create the PR.",
    "Submit a GitHub pull request for review.",
    "Raise a PR against main.",
    "File a pull request with these commits."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.nextAction = nextAction;
    handoff.approvalBoundaries = "No approval is required.";

    const report = validateHandoff(handoff);

    assert.equal(report.status, "fail", nextAction);
    assert.ok(report.findings.some((finding) => finding.field === "approvalBoundaries"), nextAction);
  }
});

test("allows local pull-request drafting and review contexts", () => {
  for (const nextAction of [
    "Draft the pull request description locally.",
    "Prepare a local PR draft without opening it.",
    "Review pull request 42 read-only.",
    "Inspect the PR diff and suggest comments locally."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.nextAction = nextAction;
    handoff.approvalBoundaries = "No approval is required for local read-only work.";

    assert.equal(validateHandoff(handoff).status, "pass", nextAction);
  }
});

test("allows explicitly prohibited pull-request creation", () => {
  for (const nextAction of [
    "Do not open a pull request; prepare the description locally.",
    "Never create a PR from this handoff.",
    "Draft the change without submitting a pull request."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.nextAction = nextAction;
    handoff.approvalBoundaries = "No approval is required for drafting only.";

    assert.equal(validateHandoff(handoff).status, "pass", nextAction);
  }
});

test("reports pull-request creation approval failures through the CLI", () => {
  const directory = mkdtempSync(join(tmpdir(), "handoff-contract-pr-action-"));
  const file = join(directory, "handoff.json");
  const handoff = readHandoff("fixtures/complete.json");
  handoff.nextAction = "Open a pull request.";
  handoff.approvalBoundaries = "No approval required.";
  const serialized = Object.fromEntries(
    ["title", "objective", "owner", "currentState", "inputs", "expectedOutputs", "approvalBoundaries", "sideEffectLimits", "verification", "blockers", "nextAction"]
      .map((field) => [field, handoff[field]])
  );
  writeFileSync(file, JSON.stringify(serialized));

  try {
    const result = spawnSync("node", ["src/cli.js", file, "--format", "json"], { encoding: "utf8" });
    const report = JSON.parse(result.stdout);
    assert.equal(result.status, 2);
    assert.equal(report.status, "fail");
    assert.ok(report.findings.some((finding) => finding.field === "approvalBoundaries"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects negated approval language for risky actions", () => {
  const handoff = readHandoff("fixtures/complete.md");
  handoff.nextAction = "Deploy to production";
  handoff.approvalBoundaries = "Human approval is not required.";

  const report = validateHandoff(handoff);

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "incubate");
  assert.ok(report.findings.some((finding) => finding.field === "approvalBoundaries"));
});

test("rejects negated side-effect limits for external outputs", () => {
  const handoff = readHandoff("fixtures/complete.md");
  handoff.expectedOutputs = "Release output";
  handoff.sideEffectLimits = "This is not local-only and is not read-only.";

  const report = validateHandoff(handoff);

  assert.equal(report.status, "warn");
  assert.ok(report.findings.some((finding) => finding.field === "sideEffectLimits"));
});

test("accepts affirmative approval and side-effect limits", () => {
  const handoff = readHandoff("fixtures/complete.md");
  handoff.nextAction = "Deploy to production";
  handoff.expectedOutputs = "Release output";
  handoff.approvalBoundaries = "Human approval is required.";
  handoff.sideEffectLimits = "Approved local-only output.";

  const report = validateHandoff(handoff);

  assert.equal(report.status, "pass");
  assert.equal(report.classification, "ship");
});

test("does not treat unrelated required language as approval", () => {
  const handoff = readHandoff("fixtures/complete.md");
  handoff.nextAction = "Deploy to production";
  handoff.approvalBoundaries = "Required documentation is attached.";

  const report = validateHandoff(handoff);

  assert.equal(report.status, "fail");
  assert.equal(report.classification, "incubate");
  assert.ok(report.findings.some((finding) => finding.field === "approvalBoundaries"));
});

test("accepts contextual approval phrases but rejects negated boundaries", () => {
  for (const approvalBoundaries of [
    "This must be approved by the release manager.",
    "Proceed only after human approval.",
    "Do not deploy without human approval."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.nextAction = "Deploy to production";
    handoff.approvalBoundaries = approvalBoundaries;
    assert.equal(validateHandoff(handoff).status, "pass", approvalBoundaries);
  }

  for (const approvalBoundaries of ["Not approved.", "Deploy without human approval."]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.nextAction = "Deploy to production";
    handoff.approvalBoundaries = approvalBoundaries;
    assert.equal(validateHandoff(handoff).status, "fail", approvalBoundaries);
  }
});

test("does not treat unrelated do-not language as a side-effect limit", () => {
  const handoff = readHandoff("fixtures/complete.md");
  handoff.expectedOutputs = "Release output";
  handoff.sideEffectLimits = "Do not omit the changelog.";

  const report = validateHandoff(handoff);

  assert.equal(report.status, "warn");
  assert.ok(report.findings.some((finding) => finding.field === "sideEffectLimits"));
});

test("accepts explicit side-effect restrictions", () => {
  for (const sideEffectLimits of [
    "No external writes.",
    "Do not publish the release.",
    "Read-only review."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.expectedOutputs = "Release output";
    handoff.sideEffectLimits = sideEffectLimits;
    assert.equal(validateHandoff(handoff).status, "pass", sideEffectLimits);
  }
});

test("does not treat an incidental path word as verification evidence", () => {
  const handoff = readHandoff("fixtures/complete.md");
  handoff.verification = "The path forward is clear.";

  const report = validateHandoff(handoff);

  assert.equal(report.status, "warn");
  assert.ok(report.findings.some((finding) => finding.field === "verification"));
});

test("accepts affirmative verification evidence and explicit not-run status", () => {
  for (const verification of [
    "Tests passed.",
    "npm run release:check completed successfully.",
    "Not run; environment unavailable.",
    "Artifact path: docs/RELEASE_CANDIDATE.md.",
    "Log: tmp/release-check.log.",
    "CI output: https://example.com/actions/runs/123."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.verification = verification;
    assert.equal(validateHandoff(handoff).status, "pass", verification);
  }
});

test("recognizes ordinary observed check outcomes", () => {
  for (const verification of [
    "test passed",
    "tests passed",
    "check failed",
    "smoke completed"
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.verification = verification;
    assert.equal(validateHandoff(handoff).status, "pass", verification);
  }
});

test("rejects prospective check outcomes", () => {
  for (const verification of [
    "test will pass",
    "tests should pass",
    "check pending",
    "smoke planned"
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.verification = verification;
    const report = validateHandoff(handoff);
    assert.equal(report.status, "warn", verification);
    assert.ok(report.findings.some((finding) => finding.field === "verification"), verification);
  }
});

test("rejects prospective URL and path references as verification evidence", () => {
  for (const verification of [
    "Tests will be run after approval; plan at https://example.com/check.",
    "The report will be saved to tmp/release-check.log.",
    "See docs/verification.md for the planned test run."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.verification = verification;
    const report = validateHandoff(handoff);
    assert.equal(report.status, "warn", verification);
    assert.ok(report.findings.some((finding) => finding.field === "verification"), verification);
  }
});

test("uses explicit observed or not-run outcomes in mixed verification text", () => {
  for (const verification of [
    "Tests will be rerun tomorrow; current tests passed. Log: tmp/test.log.",
    "Report will be saved to tmp/report.json; tests were not run because CI is unavailable."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.verification = verification;
    assert.equal(validateHandoff(handoff).status, "pass", verification);
  }
});

test("rejects bare package-manager commands and command mentions as evidence", () => {
  for (const verification of [
    "npm test",
    "npm run release:check",
    "pnpm test",
    "yarn check",
    "bun test",
    "Run npm test before handoff."
  ]) {
    const handoff = readHandoff("fixtures/complete.md");
    handoff.verification = verification;
    const report = validateHandoff(handoff);
    assert.equal(report.status, "warn", verification);
    assert.ok(report.findings.some((finding) => finding.field === "verification"), verification);
  }
});

test("parses markdown sections into contract keys", () => {
  const parsed = parseMarkdown("## Expected Outputs\nDraft\n\n## Side-Effect Limits\nLocal-only");
  assert.equal(parsed.expectedOutputs, "Draft");
  assert.equal(parsed.sideEffectLimits, "Local-only");
});

test("rejects duplicate recognized Markdown contract sections", () => {
  for (const [heading, field] of [
    ["Approval Boundaries", "approvalBoundaries"],
    ["Expected Outputs", "expectedOutputs"]
  ]) {
    assert.throws(
      () => parseMarkdown(`## ${heading}\nFirst value\n\n## ${heading}\nSecond value`),
      new RegExp(`Duplicate Markdown section ${heading} \\(${field}\\)\\.`),
      heading
    );
  }
});

test("reports duplicate Markdown sections as field-specific CLI errors", () => {
  const directory = mkdtempSync(join(tmpdir(), "handoff-contract-duplicate-"));
  const file = join(directory, "duplicate.md");
  writeFileSync(file, "## Approval Boundaries\nHuman approval required.\n\n## Approval Boundaries\nNone.\n");

  try {
    const result = spawnSync("node", ["src/cli.js", file], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /^Duplicate Markdown section Approval Boundaries \(approvalBoundaries\)\./m
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("formats a markdown report", () => {
  const report = validateHandoff(readHandoff("fixtures/complete.md"));
  const markdown = formatMarkdown(report);
  assert.match(markdown, /Handoff Contract Report/);
  assert.match(markdown, /Status: pass/);
});

test("prints usage help", () => {
  const output = execFileSync("node", ["src/cli.js", "--help"], { encoding: "utf8" });
  assert.match(output, /Usage: handoff-contract/);
  assert.match(output, /handoff\.md\|handoff\.json/);
  assert.match(output, /--format json\|markdown/);
});

test("prints the package version", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const output = execFileSync("node", ["src/cli.js", "--version"], { encoding: "utf8" });
  assert.equal(output.trim(), packageJson.version);
});

test("treats help and version flags as complete top-level invocations", () => {
  const cases = [
    ["--help", "fixtures/complete.md"],
    ["fixtures/complete.md", "-h"],
    ["--version", "fixtures/does-not-exist.md"],
    ["fixtures/does-not-exist.md", "-v"],
    ["--help", "--format", "json"],
    ["--format", "markdown", "--version"]
  ];

  for (const args of cases) {
    const result = spawnSync("node", ["src/cli.js", ...args], { encoding: "utf8" });

    assert.equal(result.status, 1, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(result.stderr, /must be used alone/, args.join(" "));
    assert.match(result.stderr, /Usage: handoff-contract/, args.join(" "));
    assert.doesNotMatch(result.stderr, /ENOENT|fixtures\/does-not-exist/, args.join(" "));
  }
});

test("reports a missing --format value as a usage error", () => {
  const result = spawnSync("node", ["src/cli.js", "fixtures/complete.md", "--format"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing value for --format \(expected json or markdown\)/);
  assert.match(result.stderr, /Usage: handoff-contract/);
});

test("rejects unknown options before attempting a file read", () => {
  const result = spawnSync("node", ["src/cli.js", "--bogus"], { encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /^Unknown option: --bogus/m);
  assert.match(result.stderr, /Usage: handoff-contract/);
  assert.doesNotMatch(result.stderr, /ENOENT|open '--bogus'/);
});

test("rejects repeated --format options", () => {
  const result = spawnSync("node", [
    "src/cli.js",
    "fixtures/complete.md",
    "--format",
    "json",
    "--format",
    "markdown"
  ], { encoding: "utf8" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /^Duplicate option: --format/m);
  assert.match(result.stderr, /Usage: handoff-contract/);
  assert.equal(result.stdout, "");
});

test("rejects an unsupported output format", () => {
  const result = spawnSync("node", ["src/cli.js", "fixtures/complete.md", "--format", "yaml"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported format: yaml/);
});

test("accepts each documented output format", () => {
  for (const format of ["json", "markdown"]) {
    const result = spawnSync("node", ["src/cli.js", "fixtures/complete.md", "--format", format], {
      encoding: "utf8"
    });

    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.length > 0);
  }
});

test("preserves exit status 2 for failed validation reports", () => {
  const result = spawnSync("node", ["src/cli.js", "fixtures/incomplete.md", "--format", "json"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stdout).status, "fail");
});
