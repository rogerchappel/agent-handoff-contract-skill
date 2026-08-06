import fs from "node:fs";
import path from "node:path";

const REQUIRED_FIELDS = [
  ["objective", "Objective"],
  ["owner", "Owner"],
  ["currentState", "Current State"],
  ["inputs", "Inputs"],
  ["expectedOutputs", "Expected Outputs"],
  ["approvalBoundaries", "Approval Boundaries"],
  ["sideEffectLimits", "Side-Effect Limits"],
  ["verification", "Verification"],
  ["blockers", "Blockers"],
  ["nextAction", "Next Action"]
];

const RISK_TERMS = /\b(push|publish|deploy|send|email|delete|charge|purchase|merge|release|production|crm|slack|github)\b/i;

export function readHandoff(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    return normalize(JSON.parse(raw), raw, filePath);
  }
  return normalize(parseMarkdown(raw), raw, filePath);
}

export function validateHandoff(handoff) {
  const findings = [];
  for (const [key, label] of REQUIRED_FIELDS) {
    if (isEmpty(handoff[key])) {
      findings.push({ level: "fail", field: key, message: `${label} is required.` });
    }
  }

  if (containsRisk(handoff.nextAction) && !mentionsApproval(handoff.approvalBoundaries)) {
    findings.push({
      level: "fail",
      field: "approvalBoundaries",
      message: "Risky next action requires explicit approval boundaries."
    });
  }

  if (containsRisk(handoff.expectedOutputs) && !mentionsSideEffectLimit(handoff.sideEffectLimits)) {
    findings.push({
      level: "warn",
      field: "sideEffectLimits",
      message: "Expected output references external side effects; confirm local-only or approved limits."
    });
  }

  if (!mentionsEvidence(handoff.verification)) {
    findings.push({
      level: "warn",
      field: "verification",
      message: "Verification should include command output, artifact paths, or explicit not-run status."
    });
  }

  if (/none|n\/a|no blockers/i.test(String(handoff.blockers || "")) && /blocked|cannot|waiting/i.test(String(handoff.currentState || ""))) {
    findings.push({
      level: "warn",
      field: "blockers",
      message: "Current state sounds blocked but blockers are listed as none."
    });
  }

  return {
    handoff,
    findings,
    status: findings.some((finding) => finding.level === "fail") ? "fail" : findings.length ? "warn" : "pass",
    classification: findings.some((finding) => finding.level === "fail") ? "incubate" : "ship"
  };
}

export function formatMarkdown(report) {
  const lines = [
    `# Handoff Contract Report: ${report.handoff.title}`,
    "",
    `Status: ${report.status}`,
    `Classification: ${report.classification}`,
    "",
    "## Required Fields"
  ];
  for (const [key, label] of REQUIRED_FIELDS) {
    lines.push(`- ${label}: ${isEmpty(report.handoff[key]) ? "missing" : "present"}`);
  }
  lines.push("", "## Findings");
  if (report.findings.length === 0) {
    lines.push("- None");
  } else {
    for (const finding of report.findings) {
      lines.push(`- ${finding.level} (${finding.field}): ${finding.message}`);
    }
  }
  lines.push("", "## Next Action", String(report.handoff.nextAction || "missing"));
  return `${lines.join("\n")}\n`;
}

export function parseMarkdown(markdown) {
  const sections = {};
  let current = "title";
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = toKey(heading[1]);
      sections[current] = [];
      continue;
    }
    if (line.startsWith("# ") && !sections.title) {
      sections.title = line.replace(/^#\s+/, "").trim();
      continue;
    }
    if (!Array.isArray(sections[current])) continue;
    if (!sections[current]) sections[current] = [];
    sections[current].push(line);
  }
  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join("\n").trim() : value
    ])
  );
}

function normalize(value, raw, filePath) {
  return {
    title: value.title || path.basename(filePath),
    objective: value.objective,
    owner: value.owner,
    currentState: value.currentState,
    inputs: value.inputs,
    expectedOutputs: value.expectedOutputs,
    approvalBoundaries: value.approvalBoundaries,
    sideEffectLimits: value.sideEffectLimits,
    verification: value.verification,
    blockers: value.blockers,
    nextAction: value.nextAction,
    sourcePath: filePath,
    raw
  };
}

function toKey(label) {
  return label
    .trim()
    .replace(/[- ]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (_, char) => char.toLowerCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

function isEmpty(value) {
  return value == null || String(value).trim() === "";
}

function containsRisk(value) {
  return RISK_TERMS.test(String(value || ""));
}

function mentionsApproval(value) {
  const text = String(value || "");
  if (/\bdo\s+not\s+\w+(?:\s+\w+){0,5}\s+without\s+(?:human\s+)?approval\b/i.test(text)) {
    return true;
  }
  if (/\b(?:human\s+)?approval\s+(?:is\s+)?not\s+required\b|\bno\s+(?:human\s+)?approval\s+(?:is\s+)?required\b|\b(?:do|does)\s+not\s+require\s+(?:human\s+)?approval\b|\bwithout\s+(?:human\s+)?approval\b|\bnot\s+approved\b/i.test(text)) {
    return false;
  }
  return /\b(?:human\s+)?approval\s+(?:is\s+)?required\b|\brequires?\s+(?:human\s+)?approval\b|\bmust\s+be\s+approved\b|\bapproved\s+by\b|\bonly\s+after\s+(?:human\s+)?approval\b/i.test(text);
}

function mentionsSideEffectLimit(value) {
  const text = String(value || "");
  if (/\bnot\s+(?:local-only|read-only|dry-run|approved)\b/i.test(text)) {
    return false;
  }
  return /\b(?:local[- ]only|read[- ]only|dry[- ]run)\b|\bno\s+external\s+(?:writes?|changes?|actions?|side effects?|systems?)\b|\bdo\s+not\s+(?:write|modify|update|send|publish|post|push|deploy|merge|release|delete|charge|purchase)\b/i.test(text);
}

function mentionsEvidence(value) {
  const text = String(value || "");
  return /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?[\w:-]+\b|\b(?:tests?|checks?|smoke)(?:\s+tests?)?\s+(?:passed|failed|not run)\b|\bnot\s+run\b|\b(?:artifact|log|output|screenshot)\s+(?:path|at|saved\s+(?:at|to))\s*[:=]?\s*\S+|https?:\/\/\S+|(?:^|\s)(?:\.{0,2}\/)?[\w.-]+(?:\/[\w.-]+)+(?=$|[\s,.;])/i.test(text);
}
