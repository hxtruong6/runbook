import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Design-system guards.
 *
 * The goal: components should NOT hardcode colors, radius, or shadows.
 * The theme (src/theme.ts) is the single source of truth — anything that
 * bypasses it cannot be themed globally.
 *
 * If you need a new token, add it to theme.ts. If you genuinely need an
 * exception (e.g. a third-party brand color in a logo), add an
 * `// eslint-disable-next-line` with a one-line reason.
 */

const FORBIDDEN_COLOR_NAMES = [
  // Mantine color names that are NOT in our system. Use indigo/teal/amber/warmGray + semantic (sage/coral/sky/gray).
  "violet",
  "grape",
  "pink",
  "lime",
  "yellow",
  "orange",
  "cyan",
  // Note: red/green/blue remain temporarily permitted; design system prefers
  // sage (success) / coral (danger) / sky (info). Migrate component-by-component.
];

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "**/*.config.{js,ts}",
      "src/theme.ts", // theme.ts IS allowed to define hex literals
      "src/demo.tsx", // demo intentionally showcases raw values
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      /* ---- Design-system guards ---- */

      // Block hex literals in component code.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]",
          message:
            "❌ Hex color literals are not allowed in components. Use a theme token: useMantineTheme().colors.indigo[7], or a semantic color name like color=\"teal\". Add new colors to src/theme.ts.",
        },
        {
          selector: "TemplateElement[value.raw=/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})/]",
          message:
            "❌ Hex color in template literal. Use a theme token instead.",
        },
        // Block hardcoded `color="indigo"` etc. for non-system color names.
        ...FORBIDDEN_COLOR_NAMES.map((name) => ({
          selector: `JSXAttribute[name.name='color'] > Literal[value='${name}']`,
          message: `❌ color="${name}" is not in the design system. Use indigo (primary), teal (secondary), amber (accent), or a semantic color (sage, coral, sky, gray). Defined in src/theme.ts.`,
        })),
        // Block raw style={{ borderRadius: 10 }} — use Mantine radius prop or CSS variable.
        {
          selector:
            "JSXAttribute[name.name='style'] Property[key.name='borderRadius'] Literal[value=/^[0-9]+$/]",
          message:
            "❌ Hardcoded borderRadius. Use Mantine radius prop (radius=\"md\") or var(--mantine-radius-md).",
        },
        // Block raw style={{ padding: 16 }} numeric padding — use Mantine spacing prop.
        {
          selector:
            "JSXAttribute[name.name='style'] Property[key.name=/^(padding|margin|gap)$/] Literal[value=/^[0-9]+$/]",
          message:
            "❌ Hardcoded padding/margin/gap. Use Mantine props (p=\"md\", m=\"sm\") or var(--mantine-spacing-md).",
        },
      ],

      /* ---- Sensible defaults (warnings, never block commit) ---- */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  /* ---- Tests: relax further ---- */
  {
    files: ["**/*.test.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  }
);
