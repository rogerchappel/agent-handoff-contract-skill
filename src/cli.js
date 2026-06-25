#!/usr/bin/env node
import { readHandoff, validateHandoff, formatMarkdown } from "./index.js";

function parseArgs(argv) {
  const args = { file: null, format: "json" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--format") args.format = argv[++index];
    else if (value === "--help" || value === "-h") args.help = true;
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
  process.exit(1);
}
