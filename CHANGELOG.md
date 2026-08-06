# Changelog

## [Unreleased]

- Require contextual approval, side-effect, and verification evidence instead of accepting unrelated keywords.
- Add release-readiness checks for package metadata, pack contents, and CI verification.
All notable changes to this project will be documented in this file.

## 0.1.0 - Release candidate

- Added the `handoff-contract` CLI for validating handoff packets from Markdown or JSON input.
- Added local checks for required handoff sections, ownership, approval boundaries, blockers, verification evidence, and next actions.
- Added fixture-backed tests, smoke verification, package dry-run verification, and CI release gates.
- Documented local-only safety boundaries and current validation limitations.
- Added an explicit release-readiness gate for package metadata, docs, fixtures,
  CI presence, and npm allowlist coverage.
