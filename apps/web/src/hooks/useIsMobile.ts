import { useMediaQuery } from "@mantine/hooks";

/**
 * Returns true when the viewport is narrower than 768px (mobile breakpoint).
 * Backed by Mantine's `useMediaQuery` so it reacts to resize events.
 *
 * Signature: `useIsMobile(): boolean`
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 768px)") ?? false;
}
