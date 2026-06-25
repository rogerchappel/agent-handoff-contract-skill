# Security Policy

## Supported Versions

Security fixes are handled on the latest `main` branch and the most recent npm
package version.

## Reporting a Vulnerability

Please report suspected vulnerabilities by opening a private GitHub security
advisory for this repository. Include:

- the affected version or commit
- a minimal handoff file or command that reproduces the issue
- expected and observed behavior
- any known workaround

Do not include production secrets, private handoff notes, customer data, or
unpublished incident details in public issues.

## Scope

This package is a local CLI and reusable skill. It validates supplied handoff
content and prints reports; it should not open sessions, send messages, or touch
external systems as part of normal operation.
