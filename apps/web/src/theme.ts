import { createTheme, MantineColorsTuple, rem } from "@mantine/core";

/* ============================================================
 * Design tokens — single source of truth.
 * Primary: indigo (#4F46E5) · Secondary: teal · Accent: amber
 * Semantic: sage (success) · coral (danger) · sky (info) · amber (warning)
 * Aligned with the Runbook Design System handoff bundle.
 * ============================================================ */

/* Indigo — primary. [7] = #4F46E5 (Tailwind indigo-600). */
const indigo: MantineColorsTuple = [
  "#EEF2FF",
  "#E0E7FF",
  "#C7D2FE",
  "#A5B4FC",
  "#818CF8",
  "#6366F1",
  "#5854ED",
  "#4F46E5",
  "#4338CA",
  "#3730A3",
];

const teal: MantineColorsTuple = [
  "#E6FCF5",
  "#C3FAE8",
  "#96F2D7",
  "#63E6BE",
  "#38D9A9",
  "#20C997",
  "#12B886",
  "#0CA678",
  "#099268",
  "#087F5B",
];

const amber: MantineColorsTuple = [
  "#FFF8E1",
  "#FFECB5",
  "#FFE082",
  "#FFD54F",
  "#FFCA28",
  "#FFC107",
  "#FFB300",
  "#F08C00",
  "#E67700",
  "#B26A00",
];

const warmGray: MantineColorsTuple = [
  "#FAFAF7",
  "#F3F1EA",
  "#E8E4D8",
  "#D6D1C2",
  "#A8A292",
  "#7C766A",
  "#5C564C",
  "#403B33",
  "#28241E",
  "#15120E",
];

/* Sage — success. [5] = #5DA06C (calmer than spec green). */
const sage: MantineColorsTuple = [
  "#ECF5EE",
  "#D4E8D8",
  "#B5D6BC",
  "#92C19D",
  "#74AD81",
  "#5DA06C",
  "#4D8B5C",
  "#3F764C",
  "#34613F",
  "#284C32",
];

/* Coral — danger. [5] = #D97056 (warm, not aggressive). */
const coral: MantineColorsTuple = [
  "#FDECE7",
  "#F9D2C6",
  "#F4B49E",
  "#ED9477",
  "#E58263",
  "#D97056",
  "#BF5C45",
  "#A24937",
  "#84392C",
  "#672C22",
];

/* Sky — info. [5] = #4A8FC4 (calm sky blue). */
const sky: MantineColorsTuple = [
  "#ECF3FA",
  "#D3E4F2",
  "#B0CFE7",
  "#88B5DA",
  "#67A1CF",
  "#4A8FC4",
  "#3E7CAB",
  "#336892",
  "#285478",
  "#1E405D",
];

/* Categorical palette for data viz — works in light & dark */
export const chartPalette = [
  "#4F46E5", // indigo
  "#0CA678", // teal
  "#F08C00", // amber
  "#D97056", // coral
  "#4A8FC4", // sky
  "#5DA06C", // sage
  "#7C766A", // warmGray-5
  "#5854ED", // indigo-6
];

/* Motion tokens — exported for use anywhere */
export const motion = {
  duration: { fast: 120, base: 180, slow: 280 },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.3, 0, 0, 1)",
  },
};

/* Spacing — Mantine defaults are on 4px grid; we expose them for docs */
export const spacing = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32 };

const sansStack =
  'Geist, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const monoStack =
  '"Geist Mono", ui-monospace, Menlo, Monaco, "Cascadia Code", "Courier New", monospace';

export const theme = createTheme({
  /* ---- Color ---- */
  primaryColor: "indigo",
  primaryShade: { light: 7, dark: 5 },
  colors: { indigo, teal, amber, warmGray, sage, coral, sky },

  white: "#FAFAF7",
  black: "#15120E",

  /* ---- Shape ---- */
  defaultRadius: "md",
  radius: { xs: "4px", sm: "6px", md: "10px", lg: "14px", xl: "20px" },

  /* ---- Type ---- */
  fontFamily: sansStack,
  fontFamilyMonospace: monoStack,
  headings: {
    fontFamily: sansStack,
    fontWeight: "650",
    sizes: {
      h1: { fontSize: "2.25rem", lineHeight: "1.2" },
      h2: { fontSize: "1.75rem", lineHeight: "1.25" },
      h3: { fontSize: "1.375rem", lineHeight: "1.3" },
      h4: { fontSize: "1.125rem", lineHeight: "1.35" },
    },
  },

  /* ---- Elevation ---- */
  shadows: {
    xs: "0 1px 2px rgba(15, 23, 42, 0.05)",
    sm: "0 2px 6px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.04)",
    md: "0 4px 12px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)",
    lg: "0 10px 24px rgba(15, 23, 42, 0.10), 0 4px 8px rgba(15, 23, 42, 0.05)",
    xl: "0 20px 40px rgba(15, 23, 42, 0.12), 0 8px 16px rgba(15, 23, 42, 0.06)",
  },

  /* ---- Custom tokens (motion, palette, density) ---- */
  other: {
    motion,
    chartPalette,
    spacingPx: spacing,
    /* Minimum touch target per WCAG 2.5.5 */
    minTouchTarget: rem(44),
    /* One border style across the app */
    borderColor: "rgba(15, 23, 42, 0.06)",
    borderColorDark: "rgba(255, 255, 255, 0.08)",
  },

  /* ---- Component defaults ---- */
  components: {
    Paper: {
      defaultProps: { radius: "lg", shadow: "xs", withBorder: true, p: "lg" },
    },
    Card: {
      defaultProps: {
        radius: "lg",
        shadow: "xs",
        withBorder: true,
        padding: "lg",
      },
    },
    Button: {
      defaultProps: { radius: "md", size: "sm" },
      styles: { root: { fontWeight: 600, letterSpacing: "-0.005em" } },
    },
    ActionIcon: {
      defaultProps: { radius: "md", variant: "subtle", size: "lg" },
    },
    TextInput: { defaultProps: { radius: "md", size: "sm" } },
    Textarea: { defaultProps: { radius: "md", size: "sm" } },
    Select: { defaultProps: { radius: "md", size: "sm" } },
    Badge: {
      defaultProps: { radius: "sm", variant: "light" },
      styles: { root: { fontWeight: 600, textTransform: "none" } },
    },
    Tabs: { defaultProps: { variant: "default", radius: "md" } },
    Modal: {
      defaultProps: {
        radius: "lg",
        shadow: "lg",
        centered: true,
        overlayProps: { backgroundOpacity: 0.55, color: "#0F172A", blur: 0 },
      },
    },
    Table: { defaultProps: { highlightOnHover: true, verticalSpacing: "sm" } },
  },
});
