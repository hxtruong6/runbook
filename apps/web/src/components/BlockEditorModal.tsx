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
  Button,
  ActionIcon,
  Alert,
} from "@mantine/core";
import { IconPlus, IconTrash, IconAlertCircle } from "@tabler/icons-react";
import type { BlockDefData } from "../blocks/dataBlock";
import { parsePathTokens, parseQueryEntries, parseBodyTokens } from "../blocks/urlTemplate";

type JsonTemplateValue =
  | string
  | number
  | boolean
  | null
  | JsonTemplateValue[]
  | { [key: string]: JsonTemplateValue };

type KVEntry = { id: string; key: string; value: string };

type InputDraft = {
  name: string;
  label: string;
  type: string;
  required: boolean;
  fromContextKey: string;
  enumValues: string;
  placeholder: string;
  location: "path" | "query" | "body";
};

type OutputDraft = {
  id: string;
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

function makeEmptyOutput(): OutputDraft {
  return { id: crypto.randomUUID(), jsonPath: "", contextKey: "" };
}

function makeEmptyKV(): KVEntry {
  return { id: crypto.randomUUID(), key: "", value: "" };
}

function syncInputs(
  urlTemplate: string,
  bodyTemplateStr: string,
  prevInputs: InputDraft[]
): InputDraft[] {
  const pathTokens = parsePathTokens(urlTemplate);
  const queryTokens = parseQueryEntries(urlTemplate).map((e) => e.token);

  let bodyTokens: string[] = [];
  if (bodyTemplateStr.trim()) {
    try {
      bodyTokens = parseBodyTokens(JSON.parse(bodyTemplateStr));
    } catch {
      bodyTokens = prevInputs
        .filter((i) => i.location === "body")
        .map((i) => i.name);
    }
  }

  const seen = new Set<string>();
  const desired: Array<{ name: string; location: "path" | "query" | "body" }> = [];

  for (const t of pathTokens) {
    if (!seen.has(t)) { seen.add(t); desired.push({ name: t, location: "path" }); }
  }
  for (const t of queryTokens) {
    if (!seen.has(t)) { seen.add(t); desired.push({ name: t, location: "query" }); }
  }
  for (const t of bodyTokens) {
    if (!seen.has(t)) { seen.add(t); desired.push({ name: t, location: "body" }); }
  }

  return desired.map(({ name, location }) => {
    const existing = prevInputs.find((i) => i.name === name);
    return existing
      ? { ...existing, location }
      : {
          name,
          label: name,
          type: "string",
          required: false,
          fromContextKey: "",
          enumValues: "",
          placeholder: "",
          location,
        };
  });
}

function ParamRow({
  inp,
  onUpdate,
}: {
  inp: InputDraft;
  onUpdate: (patch: Partial<InputDraft>) => void;
}) {
  return (
    <Group gap="xs" align="flex-end">
      <Text size="xs" c="dimmed" ff="monospace" w={160} pb="xs">
        {`{{${inp.name}}}`}
      </Text>
      <TextInput
        label="Label"
        value={inp.label}
        onChange={(e) => onUpdate({ label: e.currentTarget.value })}
        style={{ flex: 1 }}
      />
      <Select
        label="Type"
        value={inp.type}
        onChange={(v) => onUpdate({ type: v ?? "string" })}
        data={["string", "password", "number", "enum", "json"]}
        w={120}
      />
      <TextInput
        label="From context"
        value={inp.fromContextKey}
        onChange={(e) => onUpdate({ fromContextKey: e.currentTarget.value })}
        style={{ flex: 1 }}
      />
      {inp.type === "enum" && (
        <TextInput
          label="Enum values (comma-separated)"
          value={inp.enumValues}
          onChange={(e) => onUpdate({ enumValues: e.currentTarget.value })}
          style={{ flex: 2 }}
        />
      )}
    </Group>
  );
}

function ParamSection({
  title,
  inputs,
  onUpdate,
}: {
  title: string;
  inputs: InputDraft[];
  onUpdate: (name: string, patch: Partial<InputDraft>) => void;
}) {
  if (inputs.length === 0) return null;
  return (
    <Stack gap="xs">
      <Text size="xs" fw={600} c="dimmed">
        {title}
      </Text>
      {inputs.map((inp) => (
        <ParamRow key={inp.name} inp={inp} onUpdate={(patch) => onUpdate(inp.name, patch)} />
      ))}
    </Stack>
  );
}

export function BlockEditorModal({
  opened,
  onClose,
  initial,
  existingKinds,
  onSave,
}: Props) {
  const isEditing = initial !== undefined;

  const [kind, setKind] = useState("");
  const [label, setLabel] = useState("");
  const [auth, setAuth] = useState<string>("none");
  const [method, setMethod] = useState("GET");
  const [urlTemplate, setUrlTemplate] = useState("");
  const [headers, setHeaders] = useState<KVEntry[]>([]);
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [inputs, setInputs] = useState<InputDraft[]>([]);
  const [outputs, setOutputs] = useState<OutputDraft[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    if (initial) {
      let mergedUrl = initial.request.urlTemplate;
      if (initial.request.query && Object.keys(initial.request.query).length > 0) {
        const queryStr = Object.entries(initial.request.query)
          .map(([k, v]) => `${encodeURIComponent(k)}=${v}`)
          .join("&");
        const sep = mergedUrl.includes("?") ? "&" : "?";
        mergedUrl = mergedUrl + sep + queryStr;
      }

      const bodyStr =
        initial.request.bodyTemplate !== undefined
          ? JSON.stringify(initial.request.bodyTemplate, null, 2)
          : "";

      const seedInputs: InputDraft[] = initial.inputs.map((inp) => ({
        name: inp.name,
        label: inp.label,
        type: inp.type,
        required: inp.required ?? false,
        fromContextKey: inp.fromContextKey ?? "",
        enumValues: inp.enumValues ? inp.enumValues.join(", ") : "",
        placeholder: inp.placeholder ?? "",
        location: (["path", "query", "body"] as const).includes(inp.location as "path" | "query" | "body")
          ? (inp.location as "path" | "query" | "body")
          : "body",
      }));

      setKind(initial.kind);
      setLabel(initial.label);
      setAuth(initial.auth);
      setMethod(initial.request.method);
      setUrlTemplate(mergedUrl);
      setHeaders(
        initial.request.headers
          ? Object.entries(initial.request.headers).map(([key, value]) => ({ id: crypto.randomUUID(), key, value }))
          : []
      );
      setBodyTemplate(bodyStr);
      setInputs(syncInputs(mergedUrl, bodyStr, seedInputs));
      setOutputs(initial.outputs.map((o) => ({ id: crypto.randomUUID(), jsonPath: o.jsonPath, contextKey: o.contextKey })));
    } else {
      setKind("");
      setLabel("");
      setAuth("none");
      setMethod("GET");
      setUrlTemplate("");
      setHeaders([]);
      setBodyTemplate("");
      setInputs([]);
      setOutputs([]);
    }
    setError(null);
  }, [opened, initial]);

  function handleUrlChange(v: string) {
    setUrlTemplate(v);
    setInputs((prev) => syncInputs(v, bodyTemplate, prev));
  }

  function handleBodyChange(v: string) {
    setBodyTemplate(v);
    setInputs((prev) => syncInputs(urlTemplate, v, prev));
  }

  function handleMethodChange(v: string) {
    setMethod(v);
    if (v !== "POST" && v !== "PUT") {
      setInputs((prev) => prev.filter((i) => i.location !== "body"));
    }
  }

  function updateInput(name: string, patch: Partial<InputDraft>) {
    setInputs((all) => all.map((i) => (i.name === name ? { ...i, ...patch } : i)));
  }

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

    const blockDef: BlockDefData = {
      kind: kind.trim(),
      label: label.trim(),
      auth: auth as BlockDefData["auth"],
      inputs: inputs.map((inp) => ({
        name: inp.name,
        label: inp.label,
        type: inp.type as BlockDefData["inputs"][number]["type"],
        location: inp.location,
        ...(inp.required ? { required: true } : {}),
        ...(inp.fromContextKey.trim() ? { fromContextKey: inp.fromContextKey.trim() } : {}),
        ...(inp.placeholder.trim() ? { placeholder: inp.placeholder.trim() } : {}),
        ...(inp.type === "enum" && inp.enumValues.trim()
          ? {
              enumValues: inp.enumValues
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
      })),
      outputs: outputs.map((o) => ({ jsonPath: o.jsonPath, contextKey: o.contextKey })),
      request: {
        method: method as BlockDefData["request"]["method"],
        urlTemplate: urlTemplate.trim(),
        ...(Object.keys(headersRecord).length > 0 ? { headers: headersRecord } : {}),
        ...(parsedBody !== undefined ? { bodyTemplate: parsedBody } : {}),
      },
    };

    try {
      onSave(blockDef);
      onClose();
    } catch {
      setError("Failed to save block.");
    }
  }

  function updateKV(
    setList: React.Dispatch<React.SetStateAction<KVEntry[]>>,
    id: string,
    field: "key" | "value",
    val: string
  ) {
    setList((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: val } : item)));
  }

  function removeKV(setList: React.Dispatch<React.SetStateAction<KVEntry[]>>, id: string) {
    setList((prev) => prev.filter((item) => item.id !== id));
  }

  function updateOutput(id: string, patch: Partial<OutputDraft>) {
    setOutputs((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeOutput(id: string) {
    setOutputs((prev) => prev.filter((item) => item.id !== id));
  }

  const showBody = method === "POST" || method === "PUT";
  const pathInputs = inputs.filter((i) => i.location === "path");
  const queryInputs = inputs.filter((i) => i.location === "query");
  const bodyInputs = inputs.filter((i) => i.location === "body");

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? `Edit block: ${initial?.kind}` : "New API Block"}
      size="xl"
    >
      <ScrollArea mah="70vh" offsetScrollbars>
        <Stack gap="md">
          <Text size="sm" fw={600} c="dimmed">
            General
          </Text>
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

          <Text size="sm" fw={600} c="dimmed">
            Request
          </Text>
          <Group align="flex-end" gap="xs">
            <div>
              <Text size="sm" mb="xs">
                Method
              </Text>
              <SegmentedControl
                value={method}
                onChange={handleMethodChange}
                data={["GET", "POST", "PUT", "DELETE"]}
                size="xs"
              />
            </div>
            <TextInput
              label="URL"
              value={urlTemplate}
              onChange={(e) => handleUrlChange(e.currentTarget.value)}
              placeholder="/api/v1/users/{{userId}}?sort={{sort}}"
              style={{ flex: 1 }}
              description="Use {{tokenName}} for path params; ?key={{token}} for query params"
            />
          </Group>

          <ParamSection title="Path Params" inputs={pathInputs} onUpdate={updateInput} />
          <ParamSection title="Query Params" inputs={queryInputs} onUpdate={updateInput} />

          <Text size="sm" fw={600} c="dimmed">
            Headers
          </Text>
          <Stack gap="xs">
            {headers.map((h) => (
              <Group key={h.id} gap="xs">
                <TextInput
                  placeholder="Header name"
                  value={h.key}
                  onChange={(e) =>
                    updateKV(setHeaders, h.id, "key", e.currentTarget.value)
                  }
                  style={{ flex: 1 }}
                />
                <TextInput
                  placeholder="Value or {{token}}"
                  value={h.value}
                  onChange={(e) =>
                    updateKV(setHeaders, h.id, "value", e.currentTarget.value)
                  }
                  style={{ flex: 1 }}
                />
                <ActionIcon
                  aria-label="Remove header"
                  color="red"
                  variant="subtle"
                  onClick={() => removeKV(setHeaders, h.id)}
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

          {showBody && (
            <>
              <Text size="sm" fw={600} c="dimmed">
                Body
              </Text>
              <Textarea
                rows={5}
                value={bodyTemplate}
                onChange={(e) => handleBodyChange(e.currentTarget.value)}
                placeholder={'{\n  "key": "{{value}}"\n}'}
                styles={{ input: { fontFamily: "monospace" } }}
                description="Use {{tokenName}} for dynamic values"
              />
              <ParamSection title="Body Params" inputs={bodyInputs} onUpdate={updateInput} />
            </>
          )}

          <Text size="sm" fw={600} c="dimmed">
            Outputs
          </Text>
          <Stack gap="xs">
            {outputs.map((o) => (
              <Group key={o.id} gap="xs">
                <TextInput
                  placeholder="data.token"
                  value={o.jsonPath}
                  onChange={(e) => updateOutput(o.id, { jsonPath: e.currentTarget.value })}
                  style={{ flex: 1 }}
                  label={outputs[0]?.id === o.id ? "JSON Path" : undefined}
                />
                <TextInput
                  placeholder="ctx.authToken"
                  value={o.contextKey}
                  onChange={(e) => updateOutput(o.id, { contextKey: e.currentTarget.value })}
                  style={{ flex: 1 }}
                  label={outputs[0]?.id === o.id ? "Context Key" : undefined}
                />
                <ActionIcon
                  aria-label="Remove output"
                  color="red"
                  variant="subtle"
                  mt={outputs[0]?.id === o.id ? "lg" : undefined}
                  onClick={() => removeOutput(o.id)}
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
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {error}
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </ScrollArea>
    </Modal>
  );
}
