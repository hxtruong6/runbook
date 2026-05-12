import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "indigo",
  defaultRadius: "md",

  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, Menlo, Monaco, "Cascadia Code", "Courier New", monospace',

  headings: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },

  // Off-white paper surface — Mantine uses `white` as the base surface color
  white: "#fafaf7",

  shadows: {
    xs: "0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 0 rgba(15, 23, 42, 0.04)",
    sm: "0 2px 6px rgba(15, 23, 42, 0.09), 0 1px 2px rgba(15, 23, 42, 0.06)",
    md: "0 4px 12px rgba(15, 23, 42, 0.10), 0 2px 4px rgba(15, 23, 42, 0.06)",
    lg: "0 8px 24px rgba(15, 23, 42, 0.12), 0 4px 8px rgba(15, 23, 42, 0.06)",
    xl: "0 16px 40px rgba(15, 23, 42, 0.14), 0 8px 16px rgba(15, 23, 42, 0.06)",
  },

  components: {
    Paper: {
      defaultProps: {
        withBorder: true,
        radius: "md",
        shadow: "xs",
      },
    },
  },
});
