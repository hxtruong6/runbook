// src/components/BlockDefsPanel.tsx
import { useMemo, useState } from "react";
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
import { MethodBadge } from "./MethodBadge";
import { BlockFilterBar } from "./BlockFilterBar";
import { BlockTreeNodes } from "./BlockTreeNode";
import { useBlockFilter } from "../features/blocks/useBlockFilter";

type Props = {
  localBlocks: BlockDefData[];
  /**
   * Blocks coming from the active project's bundle (e.g. a sidebar OpenAPI
   * import). Rendered read-only — edit/delete only mutate `localBlocks`.
   * They share the same registry so scenarios can reference their `kind`.
   */
  bundleBlocks?: BlockDefData[];
  onAdd: (block: BlockDefData) => void;
  onUpdate: (block: BlockDefData) => void;
  onDelete: (kind: string) => void;
};

type BlockCardProps = {
  block: BlockDefData;
  isBundle: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleTag: (tag: string) => void;
};

function BlockCard({ block, isBundle, onEdit, onDelete, onToggleTag }: BlockCardProps) {
  const [hovered, setHovered] = useState(false);
  const inf = getInferenceFor(block.kind);
  const hasInference = inf && inf.runs > 0;
  const hasDrift = (inf?.lastDrift?.length ?? 0) > 0;

  return (
    <Paper
      withBorder
      px="xs"
      py={5}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Group justify="space-between" wrap="nowrap" gap={4}>
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Group gap={4} wrap="nowrap" align="center">
            <Badge size="xs" color={isBundle ? "indigo" : "teal"} style={{ flexShrink: 0 }}>
              {isBundle ? "bundle" : "local"}
            </Badge>
            <Text size="xs" fw={600} truncate style={{ flex: 1 }}>{block.label}</Text>
            {hasInference && (hasDrift ? (
              <Badge size="xs" color="amber" variant="light" leftSection={<IconAlertTriangle size={10} />} style={{ flexShrink: 0 }}>
                drift
              </Badge>
            ) : (
              <Badge size="xs" color="indigo" variant="light" leftSection={<IconCamera size={10} />} style={{ flexShrink: 0 }}>
                {inf!.runs}
              </Badge>
            ))}
          </Group>
          <Group gap={4} wrap="nowrap" align="center">
            <MethodBadge method={block.request.method} />
            <Text size="xs" c="dimmed" ff="monospace" truncate>
              {block.request.urlTemplate}
            </Text>
            {(block.tags ?? []).map((tag) => (
              <Badge
                key={tag}
                size="xs"
                color="gray"
                variant="light"
                leftSection={<IconTag size={10} />}
                style={{ cursor: "pointer", flexShrink: 0 }}
                onClick={() => onToggleTag(tag)}
                aria-label={`Filter by tag ${tag}`}
              >
                {tag}
              </Badge>
            ))}
          </Group>
        </Stack>
        <Group
          gap={2}
          wrap="nowrap"
          style={{ flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 120ms' }}
        >
          <ActionIcon aria-label={`Edit ${block.label}`} variant="subtle" size="xs" onClick={onEdit}>
            <IconPencil size={12} />
          </ActionIcon>
          {!isBundle && (
            <ActionIcon aria-label={`Delete ${block.label}`} variant="subtle" color="coral" size="xs" onClick={onDelete}>
              <IconTrash size={12} />
            </ActionIcon>
          )}
        </Group>
      </Group>
    </Paper>
  );
}

export function BlockDefsPanel({ localBlocks, bundleBlocks = [], onAdd, onUpdate, onDelete }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BlockDefData | undefined>(undefined);
  const [importerOpen, setImporterOpen] = useState(false);
  const [pasteCurlOpen, setPasteCurlOpen] = useState(false);
  useInferenceVersion(); // re-render badges when capture happens

  // Show bundle + local blocks together. A local block with the same kind
  // takes precedence (the user overrode an imported block).
  const localKinds = new Set(localBlocks.map((b) => b.kind));
  const combinedBlocks = useMemo(
    () => [
      ...localBlocks,
      ...bundleBlocks.filter((b) => !localKinds.has(b.kind)),
    ],
    // localKinds derives from localBlocks; safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localBlocks, bundleBlocks],
  );

  const filter = useBlockFilter(combinedBlocks);
  const existingKinds = localBlocks.map((b) => b.kind);
  const bundleKinds = new Set(bundleBlocks.map((b) => b.kind));

  function renderBlockLeaf(block: BlockDefData) {
    const isBundle = bundleKinds.has(block.kind) && !localKinds.has(block.kind);
    return (
      <BlockCard
        key={block.kind}
        block={block}
        isBundle={isBundle}
        onEdit={() => handleEdit(block)}
        onDelete={() => handleDelete(block.kind, block.label)}
        onToggleTag={filter.toggleTag}
      />
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
      confirmProps: { color: "coral" },
      onConfirm: () => onDelete(kind),
    });
  }

  return (
    <>
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text size="xs" tt="uppercase" c="dimmed" fw={600}>API Blocks</Text>
          <Menu shadow="md" position="bottom-end" width={200}>
            <Menu.Target>
              <Button size="xs" leftSection={<IconPlus size={12} />} px="sm">
                Add block
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Add a single block</Menu.Label>
              <Menu.Item leftSection={<IconPlus size={14} />} onClick={handleAddNew}>
                New API block (blank form)
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

        <Stack gap={6}>
          <Group gap={4} justify="space-between">
            <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Blocks</Text>
            <Group gap={6}>
              {localBlocks.length > 0 && (
                <Badge size="xs" variant="light" color="teal">
                  {localBlocks.length} local
                </Badge>
              )}
              {bundleBlocks.length > 0 && (
                <Badge size="xs" variant="light" color="indigo">
                  {bundleBlocks.length} bundle
                </Badge>
              )}
            </Group>
          </Group>
          {combinedBlocks.length === 0 ? (
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
                totalCount={combinedBlocks.length}
              />
              {filter.matchCount === 0 ? (
                <EmptyState
                  icon={<IconTerminal2 size={20} />}
                  title="No blocks match"
                  helper="Try a different search term or remove a tag filter."
                  primaryCta={{ label: "Clear filters", onClick: filter.clearFilters }}
                />
              ) : (
                <div style={{ overflowY: 'auto', maxHeight: '45vh' }}>
                  <BlockTreeNodes
                    nodes={filter.tree}
                    renderLeaf={renderBlockLeaf}
                    isExpanded={filter.isExpanded}
                    onToggle={filter.toggleExpanded}
                  />
                </div>
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
