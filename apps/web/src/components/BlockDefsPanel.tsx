// src/components/BlockDefsPanel.tsx
import { useState } from "react";
import {
  Stack,
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  Menu,
  Paper,
} from "@mantine/core";
import { openConfirmModal } from "@mantine/modals";
import { IconPlus, IconPencil, IconTrash, IconCloudDownload, IconTerminal2, IconCamera, IconAlertTriangle, IconTag } from "@tabler/icons-react";
import type { BlockDefData } from "../blocks/dataBlock";
import { getInferenceFor, useInferenceVersion } from "../inference/inferenceStore";
import { BlockEditorModal } from "./BlockEditorModal";
import { OpenApiImporterModal } from "./OpenApiImporterModal";
import { PasteCurlModal } from "../features/paste-curl/PasteCurlModal";
import { EmptyState } from "./EmptyState";
import { BlockFilterBar } from "./BlockFilterBar";
import { BlockTreeNodes } from "./BlockTreeNode";
import { useBlockFilter } from "../features/blocks/useBlockFilter";

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
  useInferenceVersion(); // re-render badges when capture happens

  const filter = useBlockFilter(localBlocks);
  const existingKinds = localBlocks.map((b) => b.kind);

  function renderBlockLeaf(block: BlockDefData) {
    const inf = getInferenceFor(block.kind);
    const hasInference = inf && inf.runs > 0;
    const hasDrift = (inf?.lastDrift?.length ?? 0) > 0;
    return (
      <Paper key={block.kind} withBorder p="sm">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={2}>
            <Group gap="xs" wrap="wrap">
              <Badge size="xs" color="teal">local</Badge>
              <Text fw={500}>{block.label}</Text>
              {hasInference && (hasDrift ? (
                <Badge
                  size="xs"
                  color="amber"
                  variant="light"
                  leftSection={<IconAlertTriangle size={10} />}
                >
                  drift
                </Badge>
              ) : (
                <Badge
                  size="xs"
                  color="violet"
                  variant="light"
                  leftSection={<IconCamera size={10} />}
                >
                  {inf!.runs}
                </Badge>
              ))}
              {(block.tags ?? []).map((tag) => (
                <Badge
                  key={tag}
                  size="xs"
                  color="gray"
                  variant="light"
                  leftSection={<IconTag size={10} />}
                  style={{ cursor: "pointer" }}
                  onClick={() => filter.toggleTag(tag)}
                  aria-label={`Filter by tag ${tag}`}
                >
                  {tag}
                </Badge>
              ))}
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
    );
  }

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
        <Group justify="space-between" wrap="nowrap">
          {/* Section uses the same small uppercase label as Project /
              Scenarios so it reads as a peer sub-section rather than a
              competing top-level heading. */}
          <Text size="xs" tt="uppercase" c="dimmed" fw={600}>API Blocks</Text>
          {/* Single "+ Add block" entry point — opens a menu with all
              creation paths. Matches the project sidebar's Import menu so
              users see a consistent "one trigger, many sources" pattern
              instead of three competing buttons. */}
          <Menu shadow="md" position="bottom-end" width={220}>
            <Menu.Target>
              <Button size="xs" leftSection={<IconPlus size={14} />}>
                Add block
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Create a block</Menu.Label>
              <Menu.Item leftSection={<IconPlus size={14} />} onClick={handleAddNew}>
                New API block
              </Menu.Item>
              <Menu.Item
                leftSection={<IconTerminal2 size={14} />}
                onClick={() => setPasteCurlOpen(true)}
              >
                Paste cURL command
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Import in bulk</Menu.Label>
              <Menu.Item
                leftSection={<IconCloudDownload size={14} />}
                onClick={() => setImporterOpen(true)}
              >
                OpenAPI spec
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
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
            <>
              <BlockFilterBar
                query={filter.query}
                onQueryChange={filter.setQuery}
                selectedTags={filter.selectedTags}
                onToggleTag={filter.toggleTag}
                groupingMode={filter.groupingMode}
                onGroupingModeChange={filter.setGroupingMode}
                hasActiveFilter={filter.hasActiveFilter}
                onClear={filter.clearFilters}
                matchCount={filter.matchCount}
                totalCount={localBlocks.length}
              />
              {filter.matchCount === 0 ? (
                <EmptyState
                  icon={<IconTerminal2 size={20} />}
                  title="No blocks match"
                  helper="Try a different search term or remove a tag filter."
                  primaryCta={{ label: "Clear filters", onClick: filter.clearFilters }}
                />
              ) : (
                <BlockTreeNodes
                  nodes={filter.tree}
                  renderLeaf={renderBlockLeaf}
                  isExpanded={filter.isExpanded}
                  onToggle={filter.toggleExpanded}
                />
              )}
            </>
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
