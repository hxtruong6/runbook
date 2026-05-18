# Flow 30 — CLI Guide & Keyboard Shortcuts

## Summary
A user discovers and uses keyboard shortcuts to run scenarios faster, and views the CLI guide to learn how to run Runbook scenarios from the terminal.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- An active scenario exists

## Steps

### Happy Path — Keyboard Shortcuts Modal
1. User presses **?** anywhere in the workspace.
2. Keyboard shortcuts modal opens showing all available shortcuts.
3. User reads the shortcuts:
   | Shortcut | Action |
   |----------|--------|
   | Cmd+Enter | Run scenario from start |
   | Cmd+Shift+Enter | Run from selected block |
   | ? | Show keyboard shortcuts |
   | g | Toggle list ↔ graph mode |
   | Cmd+K | Open command palette |
4. User presses **Escape** to close the modal.

### Happy Path — Keyboard Shortcuts in Use
1. User selects a scenario.
2. User presses **Cmd+Enter** → scenario runs from the first block.
3. User clicks on a block card to focus it.
4. User presses **Cmd+Shift+Enter** → scenario runs from that block.
5. User presses **g** → scenario switches to graph mode.
6. User presses **g** again → scenario switches back to list mode.

### Happy Path — CLI Guide Modal
1. User opens the TopBar **More actions** menu.
2. User clicks **CLI guide**.
3. `CLIGuideModal` opens showing:
   - Installation instructions
   - Authentication command
   - Run scenario command with examples
   - Environment flag usage
   - Exit code behavior
4. User copies a CLI command snippet.
5. User closes the modal.

## Edge Cases
- **Shortcut conflicts with browser** → shortcut is no-op; no error.
- **? pressed in a text input** → character is typed; modal does not open.
- **Cmd+Enter with no scenario** → shortcut is no-op.

## Related Flows
- [01-new-user-onboarding.md](./01-new-user-onboarding.md)
- [24-command-palette.md](./24-command-palette.md)
