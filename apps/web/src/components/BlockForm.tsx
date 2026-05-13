// src/components/BlockForm.tsx
import {
  Badge,
  Group,
  JsonInput,
  NumberInput,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { BlockDef, FieldSpec, RuntimeContext } from "../blocks/types";
import { previewUrl } from "../blocks/urlTemplate";

type Props = {
  def: BlockDef;
  overrides: Record<string, unknown>;
  context: RuntimeContext;
  onChange: (overrides: Record<string, unknown>) => void;
};

function Field({
  field,
  overrides,
  context,
  onChange,
}: { field: FieldSpec } & Omit<Props, "def">) {
  const override = overrides[field.name];
  const ctxVal = field.fromContextKey ? context[field.fromContextKey] : undefined;
  // Only inherit context when the user has never set an override (undefined).
  // An empty string override means the user explicitly cleared the field.
  const effective = override !== undefined ? override : ctxVal ?? "";
  const usingContext = override === undefined && ctxVal !== undefined;

  function update(value: string) {
    onChange({ ...overrides, [field.name]: value });
  }

  const label = usingContext ? (
    <Group gap={6}>
      {field.label}
      <Badge size="xs" variant="light" color="violet">
        ← context: {field.fromContextKey}
      </Badge>
    </Group>
  ) : (
    field.label
  );

  if (field.type === "enum") {
    return (
      <Select
        label={label}
        placeholder={field.placeholder ?? "— select —"}
        value={String(effective)}
        onChange={(v) => update(v ?? "")}
        data={field.enumValues ? [...field.enumValues] : []}
        allowDeselect={false}
      />
    );
  }

  if (field.type === "password") {
    return (
      <PasswordInput
        label={label}
        placeholder={field.placeholder}
        value={String(effective)}
        onChange={(e) => update(e.currentTarget.value)}
      />
    );
  }

  if (field.type === "number") {
    return (
      <NumberInput
        label={label}
        placeholder={field.placeholder}
        value={effective === "" ? "" : Number(effective)}
        onChange={(v) => update(v === "" ? "" : String(v))}
      />
    );
  }

  if (field.type === "json") {
    return (
      <JsonInput
        label={label}
        placeholder={field.placeholder}
        value={String(effective)}
        onChange={(v) => update(v)}
        autosize
        minRows={3}
        formatOnBlur
      />
    );
  }

  return (
    <TextInput
      label={label}
      placeholder={field.placeholder}
      value={String(effective)}
      onChange={(e) => update(e.currentTarget.value)}
    />
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text size="xs" fw={600} c="dimmed" mt="xs">
      {children}
    </Text>
  );
}

export function BlockForm({ def, overrides, context, onChange }: Props) {
  const hasLocations = def.inputs.some((f) => f.location);
  const allValues = { ...(context as Record<string, unknown>), ...overrides };

  const urlPreview = (() => {
    if (def.urlTemplate) return previewUrl(def.urlTemplate, allValues);
    try {
      const built = def.build(allValues);
      return built.url ?? null;
    } catch {
      return null;
    }
  })();

  const urlMethod = (() => {
    if (def.method) return def.method;
    try {
      return def.build(allValues).method ?? null;
    } catch {
      return null;
    }
  })();

  if (def.inputs.length === 0 && !urlPreview) {
    return (
      <Text size="xs" c="dimmed">
        No inputs.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {urlPreview && (
        <Paper withBorder p="xs">
          <Group gap="xs" wrap="nowrap">
            {urlMethod && (
              <Badge variant="light" color="violet" size="sm">
                {urlMethod}
              </Badge>
            )}
            <Text size="xs" ff="monospace" c="dimmed" style={{ wordBreak: "break-all" }}>
              {urlPreview}
            </Text>
          </Group>
        </Paper>
      )}

      {!hasLocations &&
        def.inputs.map((f) => (
          <Field
            key={f.name}
            field={f}
            overrides={overrides}
            context={context}
            onChange={onChange}
          />
        ))}

      {hasLocations && (() => {
        const pathFields = def.inputs.filter((f) => f.location === "path");
        const queryFields = def.inputs.filter((f) => f.location === "query");
        const bodyFields = def.inputs.filter((f) => f.location === "body");
        const otherFields = def.inputs.filter(
          (f) => !f.location || f.location === "header"
        );

        return (
          <>
            {pathFields.length > 0 && (
              <>
                <SectionLabel>Path Params</SectionLabel>
                {pathFields.map((f) => (
                  <Field
                    key={f.name}
                    field={f}
                    overrides={overrides}
                    context={context}
                    onChange={onChange}
                  />
                ))}
              </>
            )}
            {queryFields.length > 0 && (
              <>
                <SectionLabel>Query Params</SectionLabel>
                {queryFields.map((f) => (
                  <Field
                    key={f.name}
                    field={f}
                    overrides={overrides}
                    context={context}
                    onChange={onChange}
                  />
                ))}
              </>
            )}
            {bodyFields.length > 0 && (
              <>
                <SectionLabel>Body</SectionLabel>
                {bodyFields.map((f) => (
                  <Field
                    key={f.name}
                    field={f}
                    overrides={overrides}
                    context={context}
                    onChange={onChange}
                  />
                ))}
              </>
            )}
            {otherFields.map((f) => (
              <Field
                key={f.name}
                field={f}
                overrides={overrides}
                context={context}
                onChange={onChange}
              />
            ))}
          </>
        );
      })()}
    </Stack>
  );
}
