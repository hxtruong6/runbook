import { Group, Text, useMantineTheme } from "@mantine/core";

type Props = {
  size?: number;
  withWordmark?: boolean;
};

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
        <rect x="12" y="18" width="22" height="4" rx="2" fill={surface} />
        <rect x="12" y="30" width="22" height="4" rx="2" fill={surface} />
        <rect
          x="12"
          y="42"
          width="16"
          height="4"
          rx="2"
          fill={surface}
          opacity={0.7}
        />
        <path d="M40 18 L52 32 L40 46 Z" fill={teal} />
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
