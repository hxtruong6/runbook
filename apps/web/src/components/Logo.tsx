import { Group, Text, useMantineTheme } from "@mantine/core";

type Props = {
  size?: number;
  withWordmark?: boolean;
};

/**
 * Runbook mark — "Open runbook" variant (adopted May 2026).
 *
 * A two-page open book on an indigo rounded square, with a teal play
 * arrow on the right page. Literal: a runbook with a runnable page.
 * At ≤16px the page lines drop out; the silhouette still reads.
 */
export function Logo({ size = 28, withWordmark = true }: Props) {
  const theme = useMantineTheme();
  const indigo = theme.colors.indigo[7];
  const teal = theme.colors.teal[4];
  const surface = theme.white;

  return (
    <Group gap={10} align="center" wrap="nowrap" aria-label="Runbook">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-hidden="true"
      >
        <rect width="64" height="64" rx="14" fill={indigo} />
        {/* left page */}
        <path
          d="M10 18 L30 18 L30 48 L10 48 Z"
          fill="none"
          stroke={surface}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* right page */}
        <path
          d="M34 18 L54 18 L54 48 L34 48 Z"
          fill="none"
          stroke={surface}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* left-page lines — decorative, drop out at favicon sizes */}
        <rect x="14" y="24" width="12" height="2" rx="1" fill={surface} opacity={0.75} />
        <rect x="14" y="30" width="12" height="2" rx="1" fill={surface} opacity={0.55} />
        <rect x="14" y="36" width="9" height="2" rx="1" fill={surface} opacity={0.4} />
        {/* play arrow on right page — always teal */}
        <path d="M40 26 L50 33 L40 40 Z" fill={teal} />
      </svg>
      {withWordmark && (
        <Text
          fw={700}
          size="md"
          style={{ letterSpacing: "-0.01em", lineHeight: 1 }}
        >
          Runbook
        </Text>
      )}
    </Group>
  );
}
