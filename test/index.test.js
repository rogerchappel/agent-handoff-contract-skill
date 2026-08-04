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
