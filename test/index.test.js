import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
