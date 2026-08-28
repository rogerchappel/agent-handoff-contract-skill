#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { readHandoff, validateHandoff, formatMarkdown } from "./index.js";

function packageVersion() {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  return packageJson.version;
}

function parseArgs(argv) {
  const topLevelFlag = argv.find((value) => ["--help", "-h", "--version", "-v"].includes(value));
  if (topLevelFlag && argv.length !== 1) {
    throw new Error(`${topLevelFlag} must be used alone`);
  }

  const args = { file: null, format: "json" };
  let formatSeen = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--format") {
      if (formatSeen) {
        throw new Error("Duplicate option: --format");
      }
      const format = argv[index + 1];
      if (!format || format.startsWith("-")) {
        throw new Error("Missing value for --format (expected json or markdown)");
      }
      if (!["json", "markdown"].includes(format)) {
        throw new Error(`Unsupported format: ${format}`);
      }
      args.format = format;
      formatSeen = true;
      index += 1;
    }
    else if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--version" || value === "-v") args.version = true;
    else if (value.startsWith("-")) throw new Error(`Unknown option: ${value}`);
    else if (!args.file) args.file = value;
    else throw new Error(`Unexpected argument: ${value}`);
  }
  return args;
}

function usage() {
  return `Usage: handoff-contract <handoff.md|handoff.json> [--format json|markdown]\n`;
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.version) {
    process.stdout.write(`${packageVersion()}\n`);
    process.exit(0);
  }
  if (args.help || !args.file) {
    process.stdout.write(usage());
    process.exit(args.help ? 0 : 1);
  }
  const report = validateHandoff(readHandoff(args.file));
  if (args.format === "markdown") {
    process.stdout.write(formatMarkdown(report));
  } else if (args.format === "json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    throw new Error(`Unsupported format: ${args.format}`);
  }
  process.exit(report.status === "fail" ? 2 : 0);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.stderr.write(usage());
  process.exit(1);
}
