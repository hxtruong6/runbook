// src/components/BurstTimeline.tsx
import { Box, Group } from "@mantine/core";

export type TickState = "pending" | "running" | "ok" | "err";

export function tickColor(state: TickState): string {
  switch (state) {
    case "pending": return "var(--mantine-color-gray-3)";
    case "running": return "var(--mantine-color-yellow-4)";
    case "ok":      return "var(--mantine-color-teal-5)";
    case "err":     return "var(--mantine-color-red-5)";
  }
}

type Props = {
  tickStates: TickState[];
  selectedIdx?: number | null;
  onSelect?: (i: number) => void;
};

export function BurstTimeline({ tickStates, selectedIdx, onSelect }: Props) {
  const count = tickStates.length;
  const w = count > 80 ? Math.max(6, Math.floor(720 / count)) : 12;
  return (
    <Group gap={2} wrap="wrap" mt="xs">
      {tickStates.map((state, i) => (
        <Box
          key={i}
          w={w}
          h={24}
          bg={tickColor(state)}
          onClick={() => onSelect?.(i)}
          style={{
            borderRadius: 2,
            cursor: onSelect ? "pointer" : "default",
            outline: selectedIdx === i ? "2px solid var(--mantine-color-indigo-6)" : undefined,
            outlineOffset: 1,
            flexShrink: 0,
          }}
        />
      ))}
    </Group>
  );
}
