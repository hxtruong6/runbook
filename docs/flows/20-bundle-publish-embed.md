# Flow 20 — Bundle Publish & Embed Badge

## Summary
A user publishes their project bundle to get a shareable URL, then generates an embed badge to add to a README or website.

## Actors
- Authenticated user (project owner/admin)

## Preconditions
- User is signed in
- An active project with at least one scenario exists

## Steps

### Happy Path — Publish Bundle
1. User opens the sidebar **Import/Export** menu.
2. User clicks **Publish bundle**.
3. `PublishBundleModal` opens.
4. Modal shows the bundle JSON preview.
5. User clicks **Publish**.
6. A shareable URL is generated and displayed.
7. User clicks **Copy URL**.

### Happy Path — Embed Badge
1. User opens the TopBar **More actions** menu.
2. User clicks **Embed badge**.
3. `EmbedBadgeModal` opens showing:
   - Badge preview (SVG)
   - Scenario selector dropdown
   - Markdown embed code
   - HTML embed code
4. User selects a scenario from the dropdown.
5. Badge preview updates with the scenario name.
6. User copies the Markdown snippet.
7. User pastes it into their README.

### Happy Path — Share Run
1. After running a scenario, user clicks **Share run** button on the TopBar.
2. `ShareRunButton` generates a unique run URL.
3. URL is copied to clipboard.
4. Another user opens the URL → `SharedRun` page shows the read-only run results.

## Edge Cases
- **Empty project** → Publish button disabled with tooltip.
- **Publish fails** → error alert; URL not generated.
- **No scenarios in project** → scenario dropdown in embed modal is empty.

## Related Flows
- [10-gallery-run-from-url.md](./10-gallery-run-from-url.md)
- [21-shared-run-view.md](./21-shared-run-view.md)
