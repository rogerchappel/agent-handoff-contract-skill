import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { readHandoff, validateHandoff, formatMarkdown, parseMarkdown } from "../src/index.js";

test("passes a complete local-only handoff", () => {
  const report = validateHandoff(readHandoff("fixtures/complete.md"));
  assert.equal(report.status, "pass");
  assert.equal(report.classification, "ship");
});

test("fails incomplete handoff notes", () => {
  const report = validateHandoff(readHandoff("fixtures/incomplete.md"));
  assert.equal(report.status, "fail");
  assert.ok(report.findings.some((finding) => finding.field === "owner"));
  assert.ok(report.findings.some((finding) => finding.field === "verification"));
});

test("flags risky external actions without explicit approval", () => {
  const report = validateHandoff(readHandoff("fixtures/risky.json"));
  assert.equal(report.status, "fail");
  assert.ok(report.findings.some((finding) => finding.field === "approvalBoundaries"));
  assert.ok(report.findings.some((finding) => finding.field === "sideEffectLimits"));
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
