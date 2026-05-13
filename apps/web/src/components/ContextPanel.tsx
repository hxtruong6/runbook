// src/components/ContextPanel.tsx
import { Button, Code, Table, Text, TextInput } from "@mantine/core";
import { useRuntimeContext } from "../context/ContextStore";

const REDACTED_KEYS = new Set(["password"]);

export function ContextPanel() {
  const { context, dispatch } = useRuntimeContext();
  const entries = Object.entries(context).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <Button
        variant="default"
        size="xs"
        mb="sm"
        onClick={() => dispatch({ type: "RESET" })}
      >
        Reset
      </Button>
      {entries.length === 0 ? (
        <Text size="xs" c="dimmed">
          Empty
        </Text>
      ) : (
        <Table withRowBorders={false} verticalSpacing={2}>
          <Table.Tbody>
            {entries.map(([k, v]) => (
              <Table.Tr key={k}>
                <Table.Td fw={500} c="dimmed" w="40%" style={{ wordBreak: "break-all", verticalAlign: "top" }}>
                  {k}
                </Table.Td>
                <Table.Td>
                  {REDACTED_KEYS.has(k) ? (
                    <Text c="dimmed">•••</Text>
                  ) : typeof v === "object" ? (
                    <Code>{JSON.stringify(v).slice(0, 80)}</Code>
                  ) : (
                    <TextInput
                      size="xs"
                      variant="unstyled"
                      value={v === undefined || v === null ? "" : String(v)}
                      onChange={(e) =>
                        dispatch({ type: "SET_KEY", key: k, value: e.currentTarget.value })
                      }
                    />
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </div>
  );
}
