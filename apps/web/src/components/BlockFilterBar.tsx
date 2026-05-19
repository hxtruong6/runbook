import {
  ActionIcon,
  Badge,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconSearch, IconX } from "@tabler/icons-react";
import type { GroupingMode } from "@runbook/shared";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  selectedTags: Set<string>;
  onToggleTag: (tag: string) => void;
  groupingMode: GroupingMode;
  onGroupingModeChange: (mode: GroupingMode) => void;
  hasActiveFilter: boolean;
  onClear: () => void;
  matchCount: number;
  totalCount: number;
};

export function BlockFilterBar({
  query,
  onQueryChange,
  selectedTags,
  onToggleTag,
  groupingMode,
  onGroupingModeChange,
  hasActiveFilter,
  onClear,
  matchCount,
  totalCount,
}: Props) {
  return (
    <Stack gap="xs">
      <Group gap={6} wrap="nowrap">
        <TextInput
          flex={1}
          size="xs"
          placeholder="Filter…"
          leftSection={<IconSearch size={12} />}
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          rightSection={
            query ? (
              <ActionIcon
                aria-label="Clear search"
                onClick={() => onQueryChange("")}
                size="xs"
                variant="subtle"
              >
                <IconX size={12} />
              </ActionIcon>
            ) : null
          }
        />
        <Select
          aria-label="Grouping mode"
          size="xs"
          value={groupingMode}
          onChange={(v) => v && onGroupingModeChange(v as GroupingMode)}
          data={[
            { value: "tag", label: "By tag" },
            { value: "path", label: "By path" },
            { value: "flat", label: "Flat" },
          ]}
          w={90}
          allowDeselect={false}
        />
      </Group>

      {selectedTags.size > 0 && (
        <Group gap={6}>
          {Array.from(selectedTags).map((tag) => (
            <Badge
              key={tag}
              color="violet"
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  color="violet"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => onToggleTag(tag)}
                >
                  <IconX size={10} />
                </ActionIcon>
              }
            >
              {tag}
            </Badge>
          ))}
        </Group>
      )}

      {hasActiveFilter && (
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Showing {matchCount} of {totalCount}
          </Text>
          <Text
            component="button"
            size="xs"
            c="violet"
            onClick={onClear}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Clear filters
          </Text>
        </Group>
      )}
    </Stack>
  );
}
