import { Button, Group, Popover, Select, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import type { EdgeCondition } from "../graph/types";

type Props = {
  condition?: EdgeCondition;
  onSave: (condition: EdgeCondition | undefined) => void;
  children: React.ReactNode;
};

const OPERATORS: { value: EdgeCondition["operator"]; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "contains", label: "contains" },
];

export function EdgeConditionPopover({ condition, onSave, children }: Props) {
  const [opened, setOpened] = useState(false);
  const [jsonPath, setJsonPath] = useState(condition?.jsonPath ?? "");
  const [operator, setOperator] = useState<EdgeCondition["operator"]>(condition?.operator ?? "eq");
  const [value, setValue] = useState(String(condition?.value ?? ""));

  function handleSave() {
    if (jsonPath.trim()) {
      onSave({ jsonPath: jsonPath.trim(), operator, value });
    } else {
      onSave(undefined);
    }
    setOpened(false);
  }

  function handleClear() {
    onSave(undefined);
    setOpened(false);
  }

  return (
    <Popover opened={opened} onChange={setOpened} withArrow shadow="md">
      <Popover.Target>
        <span onClick={() => setOpened((o) => !o)} style={{ cursor: "pointer" }}>
          {children}
        </span>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" w={280}>
          <TextInput
            label="JSON path"
            placeholder="data.status"
            size="xs"
            value={jsonPath}
            onChange={(e) => setJsonPath(e.currentTarget.value)}
          />
          <Select
            label="Operator"
            size="xs"
            value={operator}
            onChange={(v) => setOperator(v as EdgeCondition["operator"])}
            data={OPERATORS}
          />
          <TextInput
            label="Value"
            size="xs"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" size="xs" onClick={handleClear}>Clear</Button>
            <Button size="xs" onClick={handleSave}>Save</Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
