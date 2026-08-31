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

const JSON_TEXT_FIELDS = ["title", ...REQUIRED_FIELDS.map(([key]) => key)];

const DIRECT_EXTERNAL_ACTION = /\b(?:push|publish|deploy|send|email|delete|charge|purchase|merge)\b/i;
const RELEASE_ACTION = /\brelease\s+(?:the\s+)?(?:package|version|build|software|artifact)\b/i;
const SYSTEM_ACTION = /\b(?:create|post|update|modify|write|push|publish|deploy|send|delete)\b[^.;\n]{0,60}\b(?:production|crm|slack|github)\b/i;
const GITHUB_RELEASE_ACTION = /\bcreate\b[^.;\n]{0,30}\bgithub\s+release\b/i;
const NEGATED_EXTERNAL_ACTION = /\b(?:do\s+not|don't|must\s+not|never|without)\s+(?:(?:push|publish|deploy|send|email|delete|charge|purchase|merge|release|create|post|update|modify|write)(?:ing|d|s|ed)?\b[^.;\n]*)/gi;
const EXTERNAL_OUTPUT_TERMS = /\b(?:push|publish|deploy|send|email|delete|charge|purchase|merge|release|production|crm|slack|github)\b/i;

export function readHandoff(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    const value = JSON.parse(raw);
    validateJsonFieldShapes(value);
    return normalize(value, raw, filePath);
  }
  return normalize(parseMarkdown(raw), raw, filePath);
}

function validateJsonFieldShapes(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new TypeError("JSON handoff must be an object.");
  }

  for (const field of JSON_TEXT_FIELDS) {
    if (Object.hasOwn(value, field) && typeof value[field] !== "string") {
      throw new TypeError(`JSON field ${field} must be a string.`);
    }
  }
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

  if (containsExternalOutput(handoff.expectedOutputs) && !mentionsSideEffectLimit(handoff.sideEffectLimits)) {
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

  if (mentionsNoBlockers(handoff.blockers) && soundsBlocked(handoff.currentState)) {
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
  const recognizedFields = new Set(JSON_TEXT_FIELDS);
  let current = "title";
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = toKey(heading[1]);
      if (recognizedFields.has(current) && Object.hasOwn(sections, current)) {
        throw new TypeError(`Duplicate Markdown section ${heading[1]} (${current}).`);
      }
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
  const actionableText = String(value || "").replace(NEGATED_EXTERNAL_ACTION, "");
  return DIRECT_EXTERNAL_ACTION.test(actionableText)
    || RELEASE_ACTION.test(actionableText)
    || SYSTEM_ACTION.test(actionableText)
    || GITHUB_RELEASE_ACTION.test(actionableText);
}

function containsExternalOutput(value) {
  return EXTERNAL_OUTPUT_TERMS.test(String(value || ""));
}

function mentionsNoBlockers(value) {
  return /\b(?:none|n\/a|no blockers?)\b/i.test(String(value || ""));
}

function soundsBlocked(value) {
  const text = String(value || "");
  const withoutNegatedStates = text.replace(
    /\b(?:not|no longer)\s+(?:currently\s+)?(?:blocked|waiting)\b/gi,
    ""
  );
  return /\b(?:blocked|cannot|waiting)\b/i.test(withoutNegatedStates);
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
  const observedOutcome = /\b(?:tests?|checks?|smoke)(?:\s+tests?)?\s+(?:passed|failed|not run)\b|\b(?:passed|failed|succeeded|completed|errored|timed out)\b|\b(?:not\s+(?:run|executed)|skipped)\b/i;
  if (observedOutcome.test(text)) return true;

  const prospective = /\b(?:will|would|should|shall|must|plan(?:ned)?\s+to|intend(?:ed)?\s+to|to\s+be)\s+(?:\w+\s+){0,4}(?:run|execute[ds]?|perform(?:ed)?|save[ds]?|writ(?:e|ten)|generate[ds]?|publish(?:ed)?|upload(?:ed)?|check(?:ed)?|verif(?:y|ied)|test(?:ed)?)\b|\b(?:planned|prospective|future|pending|after\s+approval)\b/i;
  if (prospective.test(text)) return false;

  return /\b(?:artifact|log|output|report|screenshot)\s+(?:(?:path|at|in|saved\s+(?:at|to))\s*[:=]?|:\s*)\S+|https?:\/\/\S+|(?:^|\s)(?:\.{0,2}\/)?[\w.-]+(?:\/[\w.-]+)+(?=$|[\s,.;])/i.test(text);
}
