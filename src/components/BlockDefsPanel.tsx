// src/components/BlockDefsPanel.tsx
import { useState } from "react";
import {
  Stack,
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  Paper,
} from "@mantine/core";
import { openConfirmModal } from "@mantine/modals";
import { IconPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import type { BlockDefData } from "../blocks/dataBlock";
import { COMPILED_BLOCKS } from "../blocks/index";
import { BlockEditorModal } from "./BlockEditorModal";

type Props = {
  localBlocks: BlockDefData[];
  onAdd: (block: BlockDefData) => void;
  onUpdate: (block: BlockDefData) => void;
  onDelete: (kind: string) => void;
};

export function BlockDefsPanel({ localBlocks, onAdd, onUpdate, onDelete }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BlockDefData | undefined>(undefined);

  const existingKinds = localBlocks.map((b) => b.kind);
  const compiledBlocksList = Object.values(COMPILED_BLOCKS);

  function handleEdit(block: BlockDefData) {
    setEditing(block);
    setEditorOpen(true);
  }

  function handleAddNew() {
    setEditing(undefined);
    setEditorOpen(true);
  }

  function handleSave(block: BlockDefData) {
    if (editing) {
      onUpdate(block);
    } else {
      onAdd(block);
    }
    setEditorOpen(false);
    setEditing(undefined);
  }

  function handleDelete(kind: string, label: string) {
    openConfirmModal({
      title: "Delete API block",
      children: (
        <Text size="sm">Delete &ldquo;{label}&rdquo;? This cannot be undone.</Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => onDelete(kind),
    });
  }

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>API Blocks</Text>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={handleAddNew}
          >
            New API block
          </Button>
        </Group>

        {/* Local blocks */}
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Local</Text>
          {localBlocks.length === 0 ? (
            <Text size="sm" c="dimmed">
              No local API blocks yet. Click &ldquo;New API block&rdquo; to create one.
            </Text>
          ) : (
            localBlocks.map((block) => (
              <Paper key={block.kind} withBorder p="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Badge size="xs" color="teal">local</Badge>
                      <Text fw={500}>{block.label}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {block.request.method} {block.request.urlTemplate}
                    </Text>
                  </Stack>
                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      aria-label={`Edit ${block.label}`}
                      variant="subtle"
                      onClick={() => handleEdit(block)}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon
                      aria-label={`Delete ${block.label}`}
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(block.kind, block.label)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            ))
          )}
        </Stack>

        {/* Built-in blocks */}
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Built-in</Text>
          {compiledBlocksList.map((block) => (
            <Paper key={block.kind} withBorder p="sm">
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Group gap="xs">
                    <Badge size="xs" color="gray">built-in</Badge>
                    <Text fw={500}>{block.label}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {block.kind}
                  </Text>
                </Stack>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Stack>

      <BlockEditorModal
        opened={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditing(undefined);
        }}
        initial={editing}
        existingKinds={existingKinds}
        onSave={handleSave}
      />
    </>
  );
}
