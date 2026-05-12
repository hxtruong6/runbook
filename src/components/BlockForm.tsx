// src/components/BlockForm.tsx
import {
  Badge,
  Group,
  JsonInput,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { BlockDef, FieldSpec, RuntimeContext } from "../blocks/types";

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
  const effective = override !== undefined && override !== "" ? override : ctxVal ?? "";
  const usingContext = (override === undefined || override === "") && ctxVal !== undefined;

  function update(value: string) {
    onChange({ ...overrides, [field.name]: value });
  }

  const label = usingContext ? (
    <Group gap={6}>
      {field.label}
      <Badge size="xs" variant="light" color="indigo">
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

  // default: string
  return (
    <TextInput
      label={label}
      placeholder={field.placeholder}
      value={String(effective)}
      onChange={(e) => update(e.currentTarget.value)}
    />
  );
}

export function BlockForm({ def, overrides, context, onChange }: Props) {
  if (def.inputs.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        No inputs.
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      {def.inputs.map((f) => (
        <Field key={f.name} field={f} overrides={overrides} context={context} onChange={onChange} />
      ))}
    </Stack>
  );
}
