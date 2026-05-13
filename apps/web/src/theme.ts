import { createTheme, MantineColorsTuple, rem } from "@mantine/core";

/* ============================================================
 * Design tokens — single source of truth.
 * Primary: violet · Secondary: teal · Accent: amber
 * ============================================================ */

const violet: MantineColorsTuple = [
  "#F3F0FF",
  "#E5DBFF",
  "#D0BFFF",
  "#B197FC",
  "#9775FA",
  "#845EF7",
  "#7048E8",
  "#6741D9",
  "#5F3DC4",
  "#5028B8",
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

/* Categorical palette for data viz — works in light & dark */
export const chartPalette = [
  "#6741D9", // violet
  "#0CA678", // teal
  "#F08C00", // amber
  "#E03E52", // rose
  "#3B5BDB", // blue
  "#1098AD", // cyan
  "#C2255C", // pink
  "#74B816", // lime
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

export const theme = createTheme({
  /* ---- Color ---- */
  primaryColor: "violet",
  primaryShade: { light: 7, dark: 5 },
  colors: { violet, teal, amber, warmGray },

  white: "#FAFAF7",
  black: "#15120E",

  /* ---- Shape ---- */
  defaultRadius: "md",
  radius: { xs: "4px", sm: "6px", md: "10px", lg: "14px", xl: "20px" },

  /* ---- Type ---- */
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, Menlo, Monaco, "Cascadia Code", "Courier New", monospace',
  headings: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
    Modal: { defaultProps: { radius: "lg", shadow: "lg", centered: true } },
    Table: { defaultProps: { highlightOnHover: true, verticalSpacing: "sm" } },
  },
});
