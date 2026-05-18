# Flow 29 — Block Editor Modal

## Summary
A user opens the Block Editor Modal to edit a block's definition (inputs, outputs, request shape), saves changes, and verifies the updated block is reflected in the scenario.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- A scenario with at least one block exists

## Steps

### Happy Path
1. User opens the **⋯** menu on a block card.
2. User clicks **Edit block definition**.
3. `BlockEditorModal` opens showing the block's full schema:
   - Label field
   - Input definitions (name, type, required, default)
   - Output definitions
   - Request template (method, URL, headers, body)
4. User modifies the block label from "Get User" to "Get User by ID".
5. User adds a new input field: `userId` (type: number, required: true).
6. User clicks **Save**.
7. Modal closes.
8. Block card updates to show the new label and the new `userId` input field.

### Happy Path — Split Panel Resize
1. User drags the divider between the editor and preview panels.
2. Panel widths adjust.
3. User reloads → split position is preserved (`rb_block_editor_split` key).

## Edge Cases
- **Invalid schema JSON** → editor shows parse error; save blocked.
- **Remove required input that has a value** → warning shown; save still allowed.
- **Cancel without saving** → block definition unchanged.
- **Block from bundle (read-only)** → editor opens in read-only mode; save disabled with tooltip.

## Related Flows
- [04-block-library.md](./04-block-library.md)
- [17-save-block-to-library.md](./17-save-block-to-library.md)
