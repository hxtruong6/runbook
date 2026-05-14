// src/components/SearchModal.tsx
import { useState } from "react";
import {
  Group,
  Modal,
  NavLink,
  ScrollArea,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import {
  IconClipboardList,
  IconCube,
  IconKey,
} from "@tabler/icons-react";
import type { Scenario } from "../scenarios/types";
import type { BlockDef } from "../blocks/types";

type SearchModalProps = {
  opened: boolean;
  onClose: () => void;
  scenarios: Scenario[];
  onSelectScenario: (id: string) => void;
  registry: Record<string, BlockDef>;
  envKeys: string[];
};

type ResultItem =
  | { category: "scenario"; id: string; label: string }
  | { category: "block"; id: string; label: string; subtitle: string }
  | { category: "env"; id: string; label: string };

export function SearchModal({
  opened,
  onClose,
  scenarios,
  onSelectScenario,
  registry,
  envKeys,
}: SearchModalProps) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const results: ResultItem[] = [];

  if (!q) {
    // Empty query: show first 5 scenarios
    scenarios.slice(0, 5).forEach((s) => {
      results.push({ category: "scenario", id: s.id, label: s.name });
    });
  } else {
    // Scenarios
    scenarios
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach((s) => {
        results.push({ category: "scenario", id: s.id, label: s.name });
      });

    // Blocks
    Object.values(registry)
      .filter(
        (def) =>
          def.label.toLowerCase().includes(q) ||
          def.kind.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach((def) => {
        results.push({
          category: "block",
          id: def.kind,
          label: def.label,
          subtitle: def.kind,
        });
      });

    // Env keys
    envKeys
      .filter((k) => k.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach((k) => {
        results.push({ category: "env", id: k, label: k });
      });
  }

  function handleSelect(item: ResultItem) {
    if (item.category === "scenario") {
      onSelectScenario(item.id);
    }
    onClose();
    setQuery("");
  }

  function handleClose() {
    onClose();
    setQuery("");
  }

  function iconFor(category: ResultItem["category"]) {
    if (category === "scenario") return <IconClipboardList size={14} />;
    if (category === "block") return <IconCube size={14} />;
    return <IconKey size={14} />;
  }

  function colorFor(category: ResultItem["category"]) {
    if (category === "scenario") return "violet";
    if (category === "block") return "teal";
    return "amber";
  }

  function subtitleFor(item: ResultItem) {
    if (item.category === "scenario") return "Scenario";
    if (item.category === "block") return `Block definition · ${item.subtitle}`;
    return "Environment key";
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      withCloseButton={false}
      p={0}
      size="md"
      styles={{
        body: { padding: 0 },
        content: { overflow: "hidden" },
      }}
    >
      <TextInput
        placeholder="Search scenarios, blocks, env keys…"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        data-autofocus
        size="md"
        styles={{
          input: {
            border: "none",
            borderBottom: "1px solid var(--mantine-color-default-border)",
            borderRadius: 0,
          },
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") handleClose();
        }}
      />

      {results.length > 0 && (
        <ScrollArea mah={320}>
          {results.map((item) => (
            <NavLink
              key={`${item.category}-${item.id}`}
              label={
                <Text size="sm" fw={500}>
                  {item.label}
                </Text>
              }
              description={subtitleFor(item)}
              leftSection={
                <ThemeIcon size="sm" variant="light" color={colorFor(item.category)}>
                  {iconFor(item.category)}
                </ThemeIcon>
              }
              onClick={() => handleSelect(item)}
              style={{ cursor: "pointer" }}
            />
          ))}
        </ScrollArea>
      )}

      {results.length === 0 && q && (
        <Group justify="center" p="md">
          <Text size="sm" c="dimmed">
            No results for &ldquo;{query}&rdquo;
          </Text>
        </Group>
      )}
    </Modal>
  );
}
