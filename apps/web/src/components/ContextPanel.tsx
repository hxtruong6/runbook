// src/components/ContextPanel.tsx
import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Code,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCopy,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconVariable,
} from "@tabler/icons-react";
import { useRuntimeContext } from "../context/ContextStore";

const REDACTED_KEYS = new Set(["password"]);

function copyToClipboard(value: string, key: string) {
  navigator.clipboard.writeText(value).then(() => {
    notifications.show({ color: "green", message: `Copied "${key}"`, autoClose: 1500 });
  });
}

type ValueCellProps = {
  contextKey: string;
  value: unknown;
  onEdit: (val: string) => void;
};

function ValueCell({ contextKey, value: v, onEdit }: ValueCellProps) {
  const [revealed, setRevealed] = useState(false);

  if (REDACTED_KEYS.has(contextKey)) {
    return (
      <Group gap={4} wrap="nowrap">
        <Text size="xs" ff="monospace" c="dimmed" style={{ flex: 1 }}>
          {revealed ? String(v) : "•••••••••"}
        </Text>
        <ActionIcon
          size="xs"
          variant="subtle"
          aria-label={revealed ? "Hide value" : "Reveal value"}
          onClick={() => setRevealed((r) => !r)}
        >
          {revealed ? <IconEyeOff size={12} /> : <IconEye size={12} />}
        </ActionIcon>
      </Group>
    );
  }

  if (typeof v === "boolean") {
    return (
      <Tooltip label="Click to toggle" withArrow>
        <Badge
          size="sm"
          color={v ? "green" : "red"}
          variant="light"
          style={{ cursor: "pointer" }}
          onClick={() => onEdit(String(!v))}
        >
          {String(v)}
        </Badge>
      </Tooltip>
    );
  }

  if (typeof v === "object" && v !== null) {
    const raw = JSON.stringify(v);
    return (
      <Code style={{ fontSize: 11, wordBreak: "break-all" }}>
        {raw.length > 120 ? raw.slice(0, 120) + "…" : raw}
      </Code>
    );
  }

  const displayVal = v === undefined || v === null ? "" : String(v);
  const isNumber = typeof v === "number";

  return (
    <TextInput
      size="xs"
      variant="unstyled"
      value={displayVal}
      onChange={(e) => onEdit(e.currentTarget.value)}
      styles={{
        input: {
          fontFamily: "monospace",
          fontSize: 12,
          color: isNumber ? "var(--mantine-color-teal-7)" : undefined,
          padding: 0,
          minHeight: "unset",
          height: "auto",
        },
      }}
    />
  );
}

type EntryRowProps = {
  contextKey: string;
  value: unknown;
  onEdit: (val: string) => void;
  onDelete: () => void;
};

function EntryRow({ contextKey, value: v, onEdit, onDelete }: EntryRowProps) {
  const rawVal =
    typeof v === "object" && v !== null
      ? JSON.stringify(v)
      : v === undefined || v === null
      ? ""
      : String(v);

  const isSystemKey = contextKey === "socketSessionUuid";

  return (
    <Stack gap={2} style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", paddingBottom: 8 }}>
      <Group gap={4} justify="space-between" wrap="nowrap">
        <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Text
            size="xs"
            ff="monospace"
            c="dimmed"
            fw={500}
            style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={contextKey}
          >
            {contextKey}
          </Text>
          {isSystemKey && (
            <Text size="10px" c="dimmed" component="span">
              (system)
            </Text>
          )}
        </Group>
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
          {!REDACTED_KEYS.has(contextKey) && (
            <Tooltip label="Copy value" withArrow>
              <ActionIcon
                size="xs"
                variant="subtle"
                aria-label={`Copy ${contextKey}`}
                onClick={() => copyToClipboard(rawVal, contextKey)}
              >
                <IconCopy size={12} />
              </ActionIcon>
            </Tooltip>
          )}
          {!isSystemKey && (
            <Tooltip label="Delete key" withArrow>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                aria-label={`Delete ${contextKey}`}
                onClick={onDelete}
              >
                <IconTrash size={12} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
      {isSystemKey ? (
        <Text size="xs" c="dimmed" ff="monospace">{String(v)}</Text>
      ) : (
        <ValueCell contextKey={contextKey} value={v} onEdit={onEdit} />
      )}
    </Stack>
  );
}

type AddKeyFormProps = {
  existingKeys: Set<string>;
  onAdd: (key: string, value: string) => void;
  onCancel: () => void;
};

function AddKeyForm({ existingKeys, onAdd, onCancel }: AddKeyFormProps) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedKey = key.trim();
    if (!trimmedKey) { setError("Key is required."); return; }
    if (existingKeys.has(trimmedKey)) { setError("Key already exists."); return; }
    onAdd(trimmedKey, value);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={6}>
        <TextInput
          size="xs"
          placeholder="Key name"
          value={key}
          onChange={(e) => { setKey(e.currentTarget.value); setError(null); }}
          error={error}
          autoFocus
          styles={{ input: { fontFamily: "monospace" } }}
        />
        <TextInput
          size="xs"
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          styles={{ input: { fontFamily: "monospace" } }}
        />
        <Group gap={6}>
          <Button size="xs" type="submit" style={{ flex: 1 }}>Add</Button>
          <Button size="xs" variant="subtle" color="gray" onClick={onCancel} style={{ flex: 1 }}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function ContextPanel() {
  const { context, dispatch } = useRuntimeContext();
  const [search, setSearch] = useState("");
  const [addingKey, setAddingKey] = useState(false);

  const allEntries = Object.entries(context).sort(([a], [b]) => a.localeCompare(b));
  const filtered = search.trim()
    ? allEntries.filter(([k]) => k.toLowerCase().includes(search.toLowerCase()))
    : allEntries;

  const count = allEntries.length;

  function handleDelete(key: string) {
    dispatch({ type: "DELETE_KEY", key });
  }

  function handleAddKey(key: string, value: string) {
    dispatch({ type: "SET_KEY", key, value });
    setAddingKey(false);
  }

  return (
    <Stack gap="sm" style={{ height: "100%" }}>
      {/* Header */}
      <Group justify="space-between" align="center">
        <Group gap={6}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={600}>Context</Text>
          {count > 0 && (
            <Badge size="xs" variant="light" color="violet">{count}</Badge>
          )}
        </Group>
        <Tooltip label="Reset context" withArrow>
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            aria-label="Reset context"
            onClick={() => dispatch({ type: "RESET" })}
          >
            <IconRefresh size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Search — only show when there are entries to filter */}
      {count > 2 && (
        <TextInput
          size="xs"
          placeholder="Filter keys…"
          leftSection={<IconSearch size={12} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      )}

      {/* Entries */}
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        {allEntries.length === 0 ? (
          <Stack align="center" gap="xs" py="xl">
            <ThemeIcon size={36} radius="xl" variant="light" color="gray">
              <IconVariable size={18} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" ta="center">
              Context is empty. Run a block to populate it.
            </Text>
          </Stack>
        ) : filtered.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center" py="sm">
            No keys match "{search}"
          </Text>
        ) : (
          <Stack gap={8}>
            {filtered.map(([k, v]) => (
              <EntryRow
                key={k}
                contextKey={k}
                value={v}
                onEdit={(val) => dispatch({ type: "SET_KEY", key: k, value: val })}
                onDelete={() => handleDelete(k)}
              />
            ))}
          </Stack>
        )}
      </ScrollArea>

      {/* Add key */}
      {addingKey ? (
        <AddKeyForm
          existingKeys={new Set(allEntries.map(([k]) => k))}
          onAdd={handleAddKey}
          onCancel={() => setAddingKey(false)}
        />
      ) : (
        <Button
          size="xs"
          variant="subtle"
          color="gray"
          leftSection={<IconPlus size={12} />}
          onClick={() => setAddingKey(true)}
          style={{ alignSelf: "flex-start" }}
        >
          Add key
        </Button>
      )}
    </Stack>
  );
}
