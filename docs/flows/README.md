# User Flow Documentation

This directory contains one markdown file per user journey in the Runbook application.
Each file documents the happy path, edge cases, key state, and related flows.
Every flow maps 1:1 to a Playwright spec file in `apps/web/e2e/journeys/`.

## Flow Index

| # | Flow | Spec file |
|---|------|-----------|
| 01 | [New User Onboarding](./01-new-user-onboarding.md) | `onboarding.spec.ts` |
| 02 | [API Testing via cURL Paste](./02-api-testing-curl.md) | `api-testing.spec.ts` |
| 03 | [OpenAPI Import](./03-openapi-import.md) | `openapi-import.spec.ts` |
| 04 | [Block Library Management](./04-block-library.md) | `block-library.spec.ts` |
| 05 | [Environment & Auth Configuration](./05-environments.md) | `environments.spec.ts` |
| 06 | [Schema Inference](./06-schema-inference.md) | `inference.spec.ts` |
| 07 | [Project Management](./07-project-management.md) | `project-mgmt.spec.ts` |
| 08 | [Burst Runner](./08-burst-runner.md) | `burst-runner.spec.ts` |
| 09 | [Graph Mode](./09-graph-mode.md) | `graph-mode.spec.ts` |
| 10 | [Gallery & Run-from-URL](./10-gallery-run-from-url.md) | `gallery.spec.ts` |
| 11 | [Password Reset](./11-password-reset.md) | `password-reset.spec.ts` |
| 12 | [Guest Access & Sign-in Prompt](./12-guest-access.md) | `guest-access.spec.ts` |
| 13 | [Scenario Lifecycle Management](./13-scenario-lifecycle.md) | `scenario-lifecycle.spec.ts` |
| 14 | [Nested Scenarios (Scenario Ref)](./14-nested-scenarios.md) | `nested-scenarios.spec.ts` |
| 15 | [Block Assertions & Validation](./15-block-assertions.md) | `block-assertions.spec.ts` |
| 16 | [Context & Data Flow](./16-context-data-flow.md) | `context-data-flow.spec.ts` |
| 17 | [Save Block to Library](./17-save-block-to-library.md) | `save-block-to-library.spec.ts` |
| 18 | [Postman Collection Import](./18-postman-import.md) | `postman-import.spec.ts` |
| 19 | [GitHub Repository Import](./19-github-import.md) | `github-import.spec.ts` |
| 20 | [Bundle Publish & Embed Badge](./20-bundle-publish-embed.md) | `bundle-publish.spec.ts` |
| 21 | [Shared Run View](./21-shared-run-view.md) | `shared-run.spec.ts` |
| 22 | [Project Version History](./22-version-history.md) | `version-history.spec.ts` |
| 23 | [Run History & Diff](./23-run-history-diff.md) | `run-history.spec.ts` |
| 24 | [Command Palette](./24-command-palette.md) | `command-palette.spec.ts` |
| 25 | [What's New & Release Notes](./25-whats-new.md) | `whats-new.spec.ts` |
| 26 | [Data Block & URL Template](./26-data-block-url-template.md) | `data-block.spec.ts` |
| 27 | [Socket Connect Block](./27-socket-connect-block.md) | `socket-connect.spec.ts` |
| 28 | [Error & Recovery States](./28-error-recovery-states.md) | `error-recovery.spec.ts` |
| 29 | [Block Editor Modal](./29-block-editor-modal.md) | `block-editor-modal.spec.ts` |
| 30 | [CLI Guide & Keyboard Shortcuts](./30-cli-guide-keyboard-shortcuts.md) | `cli-shortcuts.spec.ts` |

## Adding a New Flow

1. Create `docs/flows/NN-slug.md` following the template below.
2. Add the spec file to `apps/web/e2e/journeys/`.
3. Add a row to the index table above.

### Template

```markdown
# Flow NN — Title

## Summary
One paragraph describing what the user accomplishes.

## Actors
- Who performs this flow

## Preconditions
- What must be true before the flow starts

## Steps

### Happy Path
1. Step-by-step numbered list

## Edge Cases
- Bullet list of error/edge conditions and expected UI responses

## Key State
Table of localStorage keys and values after the flow completes (if applicable)

## Related Flows
- Links to related flow docs
```
