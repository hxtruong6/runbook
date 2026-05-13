// src/components/BlockEditorModal.tsx
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollArea,
  Stack,
  Group,
  Text,
  TextInput,
  Textarea,
  Select,
  SegmentedControl,
  Checkbox,
  Button,
  ActionIcon,
  Paper,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import type { BlockDefData } from "../blocks/dataBlock";

type JsonTemplateValue = string | number | boolean | null | JsonTemplateValue[] | { [key: string]: JsonTemplateValue };

type KVEntry = { key: string; value: string };

type InputDraft = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  fromContextKey: string;
  enumValues: string;
  placeholder: string;
};

type OutputDraft = {
  jsonPath: string;
  contextKey: string;
};

type Props = {
  opened: boolean;
  onClose: () => void;
  initial?: BlockDefData;
  existingKinds: string[];
  onSave: (block: BlockDefData) => void;
};

function makeEmptyInput(): InputDraft {
  return { name: "", label: "", type: "string", required: false, fromContextKey: "", enumValues: "", placeholder: "" };
}

function makeEmptyOutput(): OutputDraft {
  return { jsonPath: "", contextKey: "" };
}

function makeEmptyKV(): KVEntry {
  return { key: "", value: "" };
}

export function BlockEditorModal({ opened, onClose, initial, existingKinds, onSave }: Props) {
  const isEditing = initial !== undefined;

  const [kind, setKind] = useState("");
  const [label, setLabel] = useState("");
  const [auth, setAuth] = useState<string>("none");
  const [method, setMethod] = useState("GET");
  const [urlTemplate, setUrlTemplate] = useState("");
  const [headers, setHeaders] = useState<KVEntry[]>([]);
  const [query, setQuery] = useState<KVEntry[]>([]);
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [inputs, setInputs] = useState<InputDraft[]>([]);
  const [outputs, setOutputs] = useState<OutputDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    if (initial) {
      setKind(initial.kind);
      setLabel(initial.label);
      setAuth(initial.auth);
      setMethod(initial.request.method);
      setUrlTemplate(initial.request.urlTemplate);
      setHeaders(
        initial.request.headers
          ? Object.entries(initial.request.headers).map(([key, value]) => ({ key, value }))
          : []
      );
      setQuery(
        initial.request.query
          ? Object.entries(initial.request.query).map(([key, value]) => ({ key, value }))
          : []
      );
      setBodyTemplate(
        initial.request.bodyTemplate !== undefined
          ? JSON.stringify(initial.request.bodyTemplate, null, 2)
          : ""
      );
      setInputs(
        initial.inputs.map((inp) => ({
          name: inp.name,
          label: inp.label,
          type: inp.type,
          required: inp.required ?? false,
          fromContextKey: inp.fromContextKey ?? "",
          enumValues: inp.enumValues ? inp.enumValues.join(", ") : "",
          placeholder: inp.placeholder ?? "",
        }))
      );
      setOutputs(initial.outputs.map((o) => ({ jsonPath: o.jsonPath, contextKey: o.contextKey })));
    } else {
      setKind("");
      setLabel("");
      setAuth("none");
      setMethod("GET");
      setUrlTemplate("");
      setHeaders([]);
      setQuery([]);
      setBodyTemplate("");
      setInputs([]);
      setOutputs([]);
    }
    setError(null);
  }, [opened, initial]);

  function handleSave() {
    setError(null);

    if (!kind.trim()) { setError("Kind is required."); return; }
    if (!label.trim()) { setError("Label is required."); return; }
    if (!urlTemplate.trim()) { setError("URL template is required."); return; }

    if (!isEditing && existingKinds.includes(kind.trim())) {
      setError(`A block with kind "${kind.trim()}" already exists.`);
      return;
    }

    let parsedBody: JsonTemplateValue | undefined = undefined;
    if (bodyTemplate.trim()) {
      try {
        parsedBody = JSON.parse(bodyTemplate.trim()) as JsonTemplateValue;
      } catch {
        setError("Body template is not valid JSON.");
        return;
      }
    }

    const headersRecord: Record<string, string> = {};
    for (const { key, value } of headers) {
      if (key.trim()) headersRecord[key.trim()] = value;
    }

    const queryRecord: Record<string, string> = {};
    for (const { key, value } of query) {
      if (key.trim()) queryRecord[key.trim()] = value;
    }

    const blockDef: BlockDefData = {
      kind: kind.trim(),
      label: label.trim(),
      auth: auth as BlockDefData["auth"],
      inputs: inputs.map((inp) => ({
        name: inp.name,
        label: inp.label,
        type: inp.type as BlockDefData["inputs"][number]["type"],
        ...(inp.required ? { required: true } : {}),
        ...(inp.fromContextKey.trim() ? { fromContextKey: inp.fromContextKey.trim() } : {}),
        ...(inp.placeholder.trim() ? { placeholder: inp.placeholder.trim() } : {}),
        ...(inp.type === "enum" && inp.enumValues.trim()
          ? { enumValues: inp.enumValues.split(",").map((s) => s.trim()).filter(Boolean) }
          : {}),
      })),
      outputs: outputs.map((o) => ({ jsonPath: o.jsonPath, contextKey: o.contextKey })),
      request: {
        method: method as BlockDefData["request"]["method"],
        urlTemplate: urlTemplate.trim(),
        ...(Object.keys(headersRecord).length > 0 ? { headers: headersRecord } : {}),
        ...(Object.keys(queryRecord).length > 0 ? { query: queryRecord } : {}),
        ...(parsedBody !== undefined ? { bodyTemplate: parsedBody } : {}),
      },
    };

    onSave(blockDef);
    onClose();
  }

  function updateKV(
    list: KVEntry[],
    setList: (v: KVEntry[]) => void,
    idx: number,
    field: "key" | "value",
    val: string
  ) {
    const next = list.map((item, i) => (i === idx ? { ...item, [field]: val } : item));
    setList(next);
  }

  function removeKV(list: KVEntry[], setList: (v: KVEntry[]) => void, idx: number) {
    setList(list.filter((_, i) => i !== idx));
  }

  function updateInput(idx: number, patch: Partial<InputDraft>) {
    setInputs((all) => all.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  function removeInput(idx: number) {
    setInputs((all) => all.filter((_, i) => i !== idx));
  }

  function updateOutput(idx: number, patch: Partial<OutputDraft>) {
    setOutputs((all) => all.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  function removeOutput(idx: number) {
    setOutputs((all) => all.filter((_, i) => i !== idx));
  }

  const showBody = method === "POST" || method === "PUT";

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? `Edit block: ${initial?.kind}` : "New API Block"}
      size="xl"
    >
      <ScrollArea mah="70vh" offsetScrollbars>
      <Stack gap="md">
        {/* General */}
        <Text size="sm" fw={600} c="dimmed">General</Text>
        <Group grow>
          <TextInput
            label="Kind"
            value={kind}
            onChange={(e) => setKind(e.currentTarget.value)}
            disabled={isEditing}
            placeholder="my-api-block"
          />
          <TextInput
            label="Label"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
            placeholder="My API Block"
          />
        </Group>
        <Select
          label="Auth"
          value={auth}
          onChange={(v) => setAuth(v ?? "none")}
          data={[
            { value: "none", label: "None" },
            { value: "jwt", label: "JWT" },
            { value: "cookie-or-jwt", label: "Cookie or JWT" },
          ]}
          w={220}
        />

        {/* Request */}
        <Text size="sm" fw={600} c="dimmed">Request</Text>
        <Group align="flex-end">
          <div>
            <Text size="sm" mb={4}>Method</Text>
            <SegmentedControl
              value={method}
              onChange={setMethod}
              data={["GET", "POST", "PUT", "DELETE"]}
              size="xs"
            />
          </div>
          <TextInput
            label="URL Template"
            value={urlTemplate}
            onChange={(e) => setUrlTemplate(e.currentTarget.value)}
            placeholder="/api/v1/users/{{userId}}"
            style={{ flex: 1 }}
          />
        </Group>

        {/* Headers */}
        <Text size="sm" fw={600} c="dimmed">Headers</Text>
        <Stack gap="xs">
          {headers.map((h, i) => (
            <Group key={i} gap="xs">
              <TextInput
                placeholder="Header name"
                value={h.key}
                onChange={(e) => updateKV(headers, setHeaders, i, "key", e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <TextInput
                placeholder="Value"
                value={h.value}
                onChange={(e) => updateKV(headers, setHeaders, i, "value", e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <ActionIcon
                aria-label="Remove header"
                color="red"
                variant="subtle"
                onClick={() => removeKV(headers, setHeaders, i)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setHeaders((h) => [...h, makeEmptyKV()])}
            w="fit-content"
          >
            Add header
          </Button>
        </Stack>

        {/* Query Params */}
        <Text size="sm" fw={600} c="dimmed">Query Params</Text>
        <Stack gap="xs">
          {query.map((q, i) => (
            <Group key={i} gap="xs">
              <TextInput
                placeholder="Param name"
                value={q.key}
                onChange={(e) => updateKV(query, setQuery, i, "key", e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <TextInput
                placeholder="Value"
                value={q.value}
                onChange={(e) => updateKV(query, setQuery, i, "value", e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <ActionIcon
                aria-label="Remove query param"
                color="red"
                variant="subtle"
                onClick={() => removeKV(query, setQuery, i)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setQuery((q) => [...q, makeEmptyKV()])}
            w="fit-content"
          >
            Add query param
          </Button>
        </Stack>

        {/* Body Template */}
        {showBody && (
          <>
            <Text size="sm" fw={600} c="dimmed">Body Template</Text>
            <Textarea
              rows={6}
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.currentTarget.value)}
              placeholder={'{"key": "{{value}}"}'}
              styles={{ input: { fontFamily: "monospace" } }}
            />
          </>
        )}

        {/* Inputs */}
        <Text size="sm" fw={600} c="dimmed">Inputs</Text>
        <Stack gap="sm">
          {inputs.map((inp, i) => (
            <Paper key={i} withBorder p="sm">
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start">
                  <Group gap="xs" style={{ flex: 1 }}>
                    <TextInput
                      label="Name"
                      value={inp.name}
                      onChange={(e) => updateInput(i, { name: e.currentTarget.value })}
                      placeholder="fieldName"
                      style={{ flex: 1 }}
                    />
                    <TextInput
                      label="Label"
                      value={inp.label}
                      onChange={(e) => updateInput(i, { label: e.currentTarget.value })}
                      placeholder="Field Label"
                      style={{ flex: 1 }}
                    />
                    <Select
                      label="Type"
                      value={inp.type}
                      onChange={(v) => updateInput(i, { type: v ?? "string" })}
                      data={[
                        { value: "string", label: "string" },
                        { value: "password", label: "password" },
                        { value: "number", label: "number" },
                        { value: "enum", label: "enum" },
                        { value: "json", label: "json" },
                      ]}
                      w={120}
                    />
                    <Checkbox
                      label="Required"
                      checked={inp.required}
                      onChange={(e) => updateInput(i, { required: e.currentTarget.checked })}
                      mt={24}
                    />
                  </Group>
                  <ActionIcon
                    aria-label="Remove input"
                    color="red"
                    variant="subtle"
                    mt={24}
                    onClick={() => removeInput(i)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
                <Group gap="xs">
                  <TextInput
                    label="From context key"
                    value={inp.fromContextKey}
                    onChange={(e) => updateInput(i, { fromContextKey: e.currentTarget.value })}
                    placeholder="ctx.token"
                    style={{ flex: 1 }}
                  />
                  <TextInput
                    label="Placeholder"
                    value={inp.placeholder}
                    onChange={(e) => updateInput(i, { placeholder: e.currentTarget.value })}
                    placeholder="Enter value..."
                    style={{ flex: 1 }}
                  />
                </Group>
                {inp.type === "enum" && (
                  <TextInput
                    label="Enum values (comma-separated)"
                    value={inp.enumValues}
                    onChange={(e) => updateInput(i, { enumValues: e.currentTarget.value })}
                    placeholder="optionA, optionB, optionC"
                  />
                )}
              </Stack>
            </Paper>
          ))}
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setInputs((all) => [...all, makeEmptyInput()])}
            w="fit-content"
          >
            Add input
          </Button>
        </Stack>

        {/* Outputs */}
        <Text size="sm" fw={600} c="dimmed">Outputs</Text>
        <Stack gap="xs">
          {outputs.map((o, i) => (
            <Group key={i} gap="xs">
              <TextInput
                placeholder="data.token"
                value={o.jsonPath}
                onChange={(e) => updateOutput(i, { jsonPath: e.currentTarget.value })}
                style={{ flex: 1 }}
                label={i === 0 ? "JSON Path" : undefined}
              />
              <TextInput
                placeholder="ctx.authToken"
                value={o.contextKey}
                onChange={(e) => updateOutput(i, { contextKey: e.currentTarget.value })}
                style={{ flex: 1 }}
                label={i === 0 ? "Context Key" : undefined}
              />
              <ActionIcon
                aria-label="Remove output"
                color="red"
                variant="subtle"
                mt={i === 0 ? 24 : 0}
                onClick={() => removeOutput(i)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setOutputs((all) => [...all, makeEmptyOutput()])}
            w="fit-content"
          >
            Add output
          </Button>
        </Stack>

        {error && (
          <Text c="red" size="sm">{error}</Text>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </Group>
      </Stack>
      </ScrollArea>
    </Modal>
  );
}
