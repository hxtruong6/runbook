# Project conventions — read before editing UI

## Design system

**Single source of truth: `src/theme.ts`.** Every color, radius, shadow, spacing, font size, and motion duration is defined there. Components must NOT hardcode these values.

### The rule

> **Only specify a prop when it's intentionally different from the system default.**
> If you're just repeating a default, leave it off — let the theme decide.

### Token cheat sheet

| Need | Use | Don't |
|---|---|---|
| Primary action | `<Button>` | `<Button color="indigo">` |
| Secondary color | `color="teal"` | `style={{ color: "#0CA678" }}` |
| Accent color | `color="amber"` | `style={{ color: "#F08C00" }}` |
| Status: success | `color="green"` (Mantine built-in) | hardcoded green |
| Status: danger | `color="red"` | hardcoded red |
| Status: info | `color="blue"` | hardcoded blue |
| Border radius | `radius="md"` (or omit — `md` is default) | `style={{ borderRadius: 10 }}` |
| Shadow | `shadow="sm"` | `style={{ boxShadow: "0 2px 4px..." }}` |
| Padding/margin | `p="md"`, `m="sm"` | `style={{ padding: 16 }}` |
| In CSS files | `var(--mantine-color-violet-7)` | `#6741D9` |
| Custom token (motion, chart palette) | `useMantineTheme().other.motion` | redefine inline |

### Allowed system colors

- **Brand**: `violet` (primary), `teal` (secondary), `amber` (accent), `warmGray` (neutral)
- **Semantic**: `green` (success), `red` (danger), `blue` (info), `gray` (muted)
- **Auth-method badges only** (special semantic set): `blue`, `teal`, `grape`, `amber`, `gray`

Anything else (`indigo`, `pink`, `lime`, `orange`, `yellow`, `cyan`) — **don't use**. ESLint will block them. If you need a new color, add it to the `colors` object in `theme.ts`.

### Adding new tokens

If you genuinely need a new color/spacing/shadow:

1. Add it to `src/theme.ts` (in `colors`, `shadows`, or `other`)
2. Use it via the theme: `useMantineTheme().colors.newName[7]` or `color="newName"`
3. Update the cheat sheet above if it's reusable

Never inline a new value in a component "just for now."

### Component defaults already in theme

These are set in `theme.ts` and apply automatically — don't repeat them on every component:

- `Paper` / `Card`: `radius="lg"`, `shadow="xs"`, `withBorder`, `p="lg"`
- `Button`: `radius="md"`, `size="sm"`, `fontWeight: 600`
- `TextInput` / `Textarea` / `Select`: `radius="md"`, `size="sm"`
- `Badge`: `radius="sm"`, `variant="light"`
- `ActionIcon`: `radius="md"`, `variant="subtle"`, `size="lg"`
- `Modal`: `radius="lg"`, `shadow="lg"`, `centered`
- `Table`: `highlightOnHover`, `verticalSpacing="sm"`

### Button hierarchy (strict 4 levels)

| Level | Variant | Use for |
|---|---|---|
| 1 | `<Button>` (filled, primary) | The single most important action on a screen |
| 2 | `variant="light"` | Secondary actions of equal weight |
| 3 | `variant="default"` | Tertiary / supporting actions |
| 4 | `variant="subtle"` | Cancel, dismiss, low-emphasis |

Only one filled primary button per screen section.

### States required for every data view

Every screen that loads data must render four states:

1. **Loading** — `<Skeleton>`
2. **Empty** — icon + title + helper text + primary CTA (see `App.tsx` "No scenario selected")
3. **Error** — `<Alert>` with retry action
4. **Data** — the happy path

### Accessibility (already enforced globally in `src/index.css`)

- `:focus-visible` ring (WCAG 2.4.7) — don't override
- `prefers-reduced-motion` respected (WCAG 2.3.3)
- Skip-link in `App.tsx`
- Always pair status with text + icon, never color alone (WCAG 1.4.1)
- Touch targets ≥ 44px on mobile (use `size="md"` minimum on mobile)
- Every `ActionIcon` needs an `aria-label`

### Icons

Use `@tabler/icons-react`. Sizes: 14 / 16 / 18 / 20 / 24. Don't use unicode glyphs (`✓`, `+`) in production code.

### Color scheme

`main.tsx` already wires `defaultColorScheme="auto"` — components must work in both light and dark. Don't hardcode background or text colors; use Mantine tokens.

## Linting

```bash
pnpm lint        # check for design-system violations
pnpm lint:fix    # auto-fix what's auto-fixable
```

ESLint will fail if you:
- Use a hex color literal anywhere outside `theme.ts` / `demo.tsx`
- Use a forbidden color name (`indigo`, `grape`, etc.) outside the allow-list
- Hardcode `borderRadius`, `padding`, `margin`, or `gap` as a number in `style={{}}`

## Demo / reference

- **Live design system reference**: http://localhost:3002/demo.html (run `pnpm dev`)
- **Source**: `src/demo.tsx`

When in doubt about how a pattern should look, consult the demo first.
