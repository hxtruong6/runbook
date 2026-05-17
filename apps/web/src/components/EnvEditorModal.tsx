// src/components/EnvEditorModal.tsx
import { useRef, useState, useEffect } from "react";
import {
  Modal,
  Group,
  Stack,
  Text,
  Title,
  Button,
  TextInput,
  PasswordInput,
  SegmentedControl,
  ActionIcon,
  Divider,
  Paper,
  ScrollArea,
  Box,
  Badge,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { useEnvironments } from "../environments/EnvironmentsStore";
import { EnvironmentSchema, type Environment, type AuthConfig } from "../environments/types";
import { downloadEnvironment, readEnvironmentFile } from "../environments/exportImport";
import { EmptyState } from "./EmptyState";
import { IconServer } from "@tabler/icons-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

const AUTH_KINDS: { label: string; value: string }[] = [
  { label: "None", value: "none" },
  { label: "Bearer", value: "bearer" },
  { label: "Cookie", value: "cookie" },
  { label: "API key", value: "apiKey" },
  { label: "Basic", value: "basic" },
];

type AuthKind = AuthConfig["kind"];

function makeDefaultAuth(kind: AuthKind): AuthConfig {
  switch (kind) {
    case "bearer":
      return { kind: "bearer", token: "" };
    case "cookie":
      return { kind: "cookie", token: "" };
    case "apiKey":
      return { kind: "apiKey", in: "header", name: "", value: "" };
    case "basic":
      return { kind: "basic", username: "", password: "" };
    case "none":
    default:
      return { kind: "none" };
  }
}

function makeDraftEnv(): Environment {
  return {
    id: crypto.randomUUID(),
    name: "",
    baseUrl: "",
    auth: { kind: "none" },
    headers: {},
    createdAt: new Date().toISOString(),
  };
}

// ─── Header row editor ────────────────────────────────────────────────────────

type HeadersEditorProps = {
  headers: Record<string, string>;
  onChange: (h: Record<string, string>) => void;
};

function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
  // Work as ordered pairs
  const pairs = Object.entries(headers);

  function updateKey(idx: number, newKey: string) {
    const next = pairs.map(([k, v], i) => (i === idx ? [newKey, v] : [k, v]) as [string, string]);
    onChange(Object.fromEntries(next));
  }

  function updateValue(idx: number, newVal: string) {
    const next = pairs.map(([k, v], i) => (i === idx ? [k, newVal] : [k, v]) as [string, string]);
    onChange(Object.fromEntries(next));
  }

  function removeRow(idx: number) {
    const next = pairs.filter((_, i) => i !== idx);
    onChange(Object.fromEntries(next));
  }

  function addRow() {
    onChange({ ...headers, "": "" });
  }

  return (
    <Stack gap={6}>
      {pairs.map(([k, v], idx) => (
        <Group key={idx} gap={6} wrap="nowrap">
          <TextInput
            size="xs"
            placeholder="Header name"
            value={k}
            onChange={(e) => updateKey(idx, e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <TextInput
            size="xs"
            placeholder="Value"
            value={v}
            onChange={(e) => updateValue(idx, e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeRow(idx)}>
            <TrashIcon />
          </ActionIcon>
        </Group>
      ))}
      <Button
        size="xs"
        variant="subtle"
        color="gray"
        leftSection={<PlusIcon />}
        onClick={addRow}
        style={{ alignSelf: "flex-start" }}
      >
        Add header
      </Button>
    </Stack>
  );
}

// ─── Auth fields ──────────────────────────────────────────────────────────────

type AuthFieldsProps = {
  auth: AuthConfig;
  onChange: (a: AuthConfig) => void;
};

function AuthFields({ auth, onChange }: AuthFieldsProps) {
  switch (auth.kind) {
    case "bearer":
      return (
        <PasswordInput
          label="Token"
          size="xs"
          value={auth.token}
          onChange={(e) => onChange({ ...auth, token: e.currentTarget.value })}
        />
      );
    case "cookie":
      return (
        <PasswordInput
          label="Fallback bearer token (optional)"
          size="xs"
          value={auth.token ?? ""}
          onChange={(e) => onChange({ ...auth, token: e.currentTarget.value })}
        />
      );
    case "apiKey":
      return (
        <Stack gap={8}>
          <Stack gap={4}>
            <Text size="xs" fw={500} c="dimmed" style={{ lineHeight: 1.4 }}>In</Text>
            <SegmentedControl
              size="xs"
              value={auth.in}
              onChange={(v) => onChange({ ...auth, in: v as "header" | "query" })}
              data={[
                { label: "Header", value: "header" },
                { label: "Query", value: "query" },
              ]}
            />
          </Stack>
          <TextInput
            label="Name"
            size="xs"
            placeholder="X-API-Key"
            value={auth.name}
            onChange={(e) => onChange({ ...auth, name: e.currentTarget.value })}
          />
          <PasswordInput
            label="Value"
            size="xs"
            value={auth.value}
            onChange={(e) => onChange({ ...auth, value: e.currentTarget.value })}
          />
        </Stack>
      );
    case "basic":
      return (
        <Stack gap={8}>
          <TextInput
            label="Username"
            size="xs"
            value={auth.username}
            onChange={(e) => onChange({ ...auth, username: e.currentTarget.value })}
          />
          <PasswordInput
            label="Password"
            size="xs"
            value={auth.password}
            onChange={(e) => onChange({ ...auth, password: e.currentTarget.value })}
          />
        </Stack>
      );
    case "none":
    default:
      return null;
  }
}

// ─── Env badge ────────────────────────────────────────────────────────────────

function envAuthBadge(auth: AuthConfig) {
  const map: Record<AuthKind, { label: string; color: string }> = {
    bearer: { label: "Bearer", color: "blue" },
    cookie: { label: "Cookie", color: "teal" },
    apiKey: { label: "API key", color: "grape" },
    basic: { label: "Basic", color: "amber" },
    none: { label: "None", color: "gray" },
  };
  return map[auth.kind];
}

// ─── Main modal ───────────────────────────────────────────────────────────────

type Props = {
  opened: boolean;
  onClose: () => void;
};

export function EnvEditorModal({ opened, onClose }: Props) {
  const { state, dispatch } = useEnvironments();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Environment | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // When modal opens or env list changes, default-select the first env
  useEffect(() => {
    if (!opened) return;
    if (state.environments.length > 0) {
      const id = selectedId && state.environments.find((e) => e.id === selectedId)
        ? selectedId
        : state.environments[0].id;
      setSelectedId(id);
      setDraft({ ...state.environments.find((e) => e.id === id)! });
    } else {
      setSelectedId(null);
      setDraft(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, state.environments]);

  // When user picks an env in the list, reset draft
  function selectEnv(id: string) {
    setSelectedId(id);
    const env = state.environments.find((e) => e.id === id);
    if (env) setDraft({ ...env });
  }

  function handleNew() {
    const newEnv = makeDraftEnv();
    // Don't dispatch yet — just set as current draft
    setSelectedId(newEnv.id);
    setDraft(newEnv);
  }

  function handleSave() {
    if (!draft) return;
    const result = EnvironmentSchema.safeParse(draft);
    if (!result.success) {
      const msg = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      notifications.show({ color: "red", title: "Validation error", message: msg });
      return;
    }
    dispatch({ type: "UPSERT", env: result.data });
    notifications.show({ color: "green", title: "Saved", message: `"${draft.name}" saved.` });
  }

  function handleDelete() {
    if (!draft) return;
    const envName = draft.name;
    const envId = draft.id;
    modals.openConfirmModal({
      title: "Delete environment",
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{envName}</strong>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        dispatch({ type: "DELETE", id: envId });
        setSelectedId(null);
        setDraft(null);
      },
    });
  }

  function handleExport() {
    if (!draft) return;
    downloadEnvironment(draft);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const env = await readEnvironmentFile(file);
      const withNewId: Environment = { ...env, id: crypto.randomUUID() };
      dispatch({ type: "UPSERT", env: withNewId });
      setSelectedId(withNewId.id);
      setDraft({ ...withNewId });
      notifications.show({ color: "green", title: "Imported", message: `"${withNewId.name}" imported.` });
    } catch (err) {
      notifications.show({ color: "red", title: "Import failed", message: (err as Error).message });
    }
    e.target.value = "";
  }

  // Is the draft an existing (already-persisted) env?
  const isExisting = draft ? state.environments.some((e) => e.id === draft.id) : false;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={5} fw={600}>Environments</Title>}
      size="xl"
      padding="md"
    >
      <Group align="flex-start" gap="md" wrap="nowrap" style={{ minHeight: 420 }}>
        {/* ─── Left: env list ─────────────────────────────────────── */}
        <Stack gap={6} style={{ width: 200, flexShrink: 0 }}>
          <Button
            size="xs"
            variant="light"
            leftSection={<PlusIcon />}
            onClick={handleNew}
            fullWidth
          >
            New environment
          </Button>

          <Divider />

          <ScrollArea style={{ maxHeight: 360 }}>
            <Stack gap={4}>
              {state.environments.map((env) => {
                const badge = envAuthBadge(env.auth);
                const isSelected = env.id === selectedId;
                return (
                  <Paper
                    key={env.id}
                    p="xs"
                    withBorder
                    shadow={isSelected ? "sm" : "xs"}
                    style={{
                      cursor: "pointer",
                      backgroundColor: isSelected ? "var(--mantine-color-violet-0)" : undefined,
                      borderColor: isSelected ? "var(--mantine-color-violet-3)" : undefined,
                    }}
                    onClick={() => selectEnv(env.id)}
                  >
                    <Stack gap={2}>
                      <Text size="xs" fw={500} lineClamp={1}>{env.name}</Text>
                      <Badge size="xs" color={badge.color} variant="light" radius="sm">
                        {badge.label}
                      </Badge>
                    </Stack>
                  </Paper>
                );
              })}
              {state.environments.length === 0 && (
                <EmptyState
                  icon={<IconServer size={20} />}
                  title="No environments"
                  helper="Create an environment to set a base URL and auth strategy for your runs."
                  primaryCta={{ label: "New environment", onClick: handleNew }}
                />
              )}
            </Stack>
          </ScrollArea>
        </Stack>

        {/* ─── Right: form ─────────────────────────────────────────── */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          {draft ? (
            <Stack gap={12}>
              <TextInput
                label="Name"
                size="xs"
                required
                placeholder="e.g. Production, Staging"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })}
              />
              <TextInput
                label="Base URL"
                size="xs"
                required
                placeholder="https://api.example.com"
                value={draft.baseUrl}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.currentTarget.value })}
              />

              <Stack gap={4}>
                <Text size="xs" fw={500} c="dimmed" style={{ lineHeight: 1.4 }}>Auth strategy</Text>
                <SegmentedControl
                  size="xs"
                  value={draft.auth.kind}
                  onChange={(v) => setDraft({ ...draft, auth: makeDefaultAuth(v as AuthKind) })}
                  data={AUTH_KINDS}
                />
              </Stack>

              <AuthFields
                auth={draft.auth}
                onChange={(a) => setDraft({ ...draft, auth: a })}
              />

              <Divider label="Custom headers" labelPosition="left" />

              <HeadersEditor
                headers={draft.headers}
                onChange={(h) => setDraft({ ...draft, headers: h })}
              />

              <Divider />

              <Group gap={8} justify="space-between">
                <Group gap={8}>
                  {isExisting && (
                    <Button size="xs" color="red" variant="light" onClick={handleDelete}>
                      Delete
                    </Button>
                  )}
                  <Button size="xs" variant="subtle" color="gray" onClick={handleExport} disabled={!isExisting}>
                    Export
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={() => importRef.current?.click()}
                  >
                    Import
                  </Button>
                  <input
                    ref={importRef}
                    type="file"
                    accept="application/json"
                    hidden
                    onChange={handleImport}
                  />
                </Group>
                <Button size="xs" onClick={handleSave}>
                  Save
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack align="center" justify="center" style={{ height: 300 }}>
              <Text size="sm" c="dimmed">Select or create an environment</Text>
            </Stack>
          )}
        </Box>
      </Group>
    </Modal>
  );
}
