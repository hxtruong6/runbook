// src/features/versions/ChangeList.tsx
import { useState } from "react";
import {
  Badge,
  Button,
  Collapse,
  Group,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClipboardCheck,
  IconAlertTriangle,
  IconNote,
  IconPlus,
  IconMinus,
  IconRefresh,
  IconBug,
} from "@tabler/icons-react";
import type { ChangeEntry, ChangeType } from "../../projects/types";

// ---------------------------------------------------------------------------
// Category grouping
// ---------------------------------------------------------------------------

const CATEGORY_ORDER: ChangeType[] = [
  "added",
  "modified",
  "fixed",
  "deprecated",
  "removed",
  "note",
];

const CATEGORY_META: Record<
  ChangeType,
  { label: string; color: string; icon: React.ReactNode }
> = {
  added: {
    label: "Added",
    color: "green",
    icon: <IconPlus size={14} />,
  },
  modified: {
    label: "Changed",
    color: "blue",
    icon: <IconRefresh size={14} />,
  },
  fixed: {
    label: "Fixed",
    color: "teal",
    icon: <IconBug size={14} />,
  },
  deprecated: {
    label: "Deprecated",
    color: "amber",
    icon: <IconAlertTriangle size={14} />,
  },
  removed: {
    label: "Removed",
    color: "coral",
    icon: <IconMinus size={14} />,
  },
  note: {
    label: "Notes",
    color: "gray",
    icon: <IconNote size={14} />,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildChecklist(changes: ChangeEntry[], versionLabel: string): string {
  const lines: string[] = [`## Upgrade checklist — ${versionLabel}`, ""];

  for (const type of CATEGORY_ORDER) {
    const group = changes.filter((c) => c.type === type);
    if (group.length === 0) continue;
    lines.push(`### ${CATEGORY_META[type].label}`);
    for (const c of group) {
      const target = c.target ? ` \`${c.target}\`` : "";
      const breaking = c.breaking ? " **BREAKING**" : "";
      lines.push(`- [ ]${breaking}${target}: ${c.summary}`);
      if (c.removeBy) {
        lines.push(`  - Will be removed in ${c.removeBy}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

// ---------------------------------------------------------------------------
// ChangeRow
// ---------------------------------------------------------------------------

function ChangeRow({ change }: { change: ChangeEntry }) {
  const meta = CATEGORY_META[change.type];
  return (
    <Group gap="xs" wrap="nowrap" py={4}>
      <Badge color={meta.color} variant="light" size="xs" tt="capitalize">
        {change.type}
      </Badge>
      {change.breaking && (
        <Badge color="coral" variant="filled" size="xs">
          BREAKING
        </Badge>
      )}
      {change.target && (
        <Text size="sm" fw={500} ff="monospace" style={{ flexShrink: 0 }}>
          {change.target}
        </Text>
      )}
      <Text size="sm" c="dimmed" style={{ flex: 1, minWidth: 0 }}>
        {change.summary}
      </Text>
      {change.removeBy && (
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
          Remove by {change.removeBy}
        </Text>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// CategorySection
// ---------------------------------------------------------------------------

function CategorySection({
  type,
  changes,
}: {
  type: ChangeType;
  changes: ChangeEntry[];
}) {
  const [open, setOpen] = useState(true);
  const meta = CATEGORY_META[type];

  return (
    <Stack gap={0}>
      <UnstyledButton
        onClick={() => setOpen((o) => !o)}
        py="xs"
        style={{ width: "100%" }}
      >
        <Group gap="xs">
          <ThemeIcon size="sm" color={meta.color} variant="light">
            {meta.icon}
          </ThemeIcon>
          <Text size="sm" fw={600}>
            {meta.label}
          </Text>
          <Badge size="xs" color={meta.color} variant="outline">
            {changes.length}
          </Badge>
          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </Group>
      </UnstyledButton>
      <Collapse in={open}>
        <Stack gap={0} pl="sm" style={{ borderLeft: "2px solid var(--mantine-color-default-border)" }}>
          {changes.map((c, i) => (
            <ChangeRow key={i} change={c} />
          ))}
        </Stack>
      </Collapse>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// ChangeList
// ---------------------------------------------------------------------------

export interface ChangeListProps {
  /** The newer version's label e.g. "2.1.0" */
  versionLabel: string;
  /** The authoritative changes[] from the newer version in the bundle */
  changes: ChangeEntry[];
}

export function ChangeList({ versionLabel, changes }: ChangeListProps) {
  const grouped = CATEGORY_ORDER.map((type) => ({
    type,
    entries: changes.filter((c) => c.type === type),
  })).filter(({ entries }) => entries.length > 0);

  function copyChecklist() {
    const md = buildChecklist(changes, versionLabel);
    navigator.clipboard
      .writeText(md)
      .then(() => {
        notifications.show({
          color: "green",
          icon: <IconCheck size={16} />,
          message: "Upgrade checklist copied to clipboard",
        });
      })
      .catch(() => {
        notifications.show({
          color: "coral",
          message: "Could not copy to clipboard",
        });
      });
  }

  if (changes.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No recorded changes for this version.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          {changes.length} change{changes.length !== 1 ? "s" : ""}
        </Text>
        <Button
          variant="default"
          size="xs"
          leftSection={<IconClipboardCheck size={14} />}
          onClick={copyChecklist}
        >
          Copy upgrade checklist
        </Button>
      </Group>

      {grouped.map(({ type, entries }) => (
        <CategorySection key={type} type={type} changes={entries} />
      ))}
    </Stack>
  );
}

// Export the helper for tests
export { buildChecklist };
