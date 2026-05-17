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
import { IconPlus, IconPencil, IconTrash, IconCloudDownload, IconTerminal2 } from "@tabler/icons-react";
import type { BlockDefData } from "../blocks/dataBlock";
import { BlockEditorModal } from "./BlockEditorModal";
import { OpenApiImporterModal } from "./OpenApiImporterModal";
import { PasteCurlModal } from "../features/paste-curl/PasteCurlModal";
import { EmptyState } from "./EmptyState";

type Props = {
  localBlocks: BlockDefData[];
  onAdd: (block: BlockDefData) => void;
  onUpdate: (block: BlockDefData) => void;
  onDelete: (kind: string) => void;
};

export function BlockDefsPanel({ localBlocks, onAdd, onUpdate, onDelete }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BlockDefData | undefined>(undefined);
  const [importerOpen, setImporterOpen] = useState(false);
  const [pasteCurlOpen, setPasteCurlOpen] = useState(false);

  const existingKinds = localBlocks.map((b) => b.kind);

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
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconTerminal2 size={14} />}
              onClick={() => setPasteCurlOpen(true)}
            >
              Paste cURL
            </Button>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconCloudDownload size={14} />}
              onClick={() => setImporterOpen(true)}
            >
              Import from OpenAPI
            </Button>
            <Button
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={handleAddNew}
            >
              New API block
            </Button>
          </Group>
        </Group>

        {/* Local blocks */}
        <Stack gap="xs">
          <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Local</Text>
          {localBlocks.length === 0 ? (
            <EmptyState
              icon={<IconTerminal2 size={20} />}
              title="No API blocks yet"
              helper="Paste a cURL command or import from OpenAPI to create your first block."
              primaryCta={{ label: "Paste cURL", onClick: () => setPasteCurlOpen(true) }}
              samples={[{ slug: "github", name: "GitHub REST API" }]}
            />
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

      <OpenApiImporterModal
        opened={importerOpen}
        onClose={() => setImporterOpen(false)}
        onImport={(blocks) => {
          blocks.forEach((b) => {
            if (existingKinds.includes(b.kind)) {
              onUpdate(b);
            } else {
              onAdd(b);
            }
          });
        }}
      />

      <PasteCurlModal
        opened={pasteCurlOpen}
        onClose={() => setPasteCurlOpen(false)}
        onInserted={(block) => {
          if (existingKinds.includes(block.kind)) {
            onUpdate(block);
          } else {
            onAdd(block);
          }
        }}
      />
    </>
  );
}
