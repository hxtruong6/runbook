// src/components/ResponseViewer.tsx
import { Alert, Code, ScrollArea, Text } from "@mantine/core";
import type { BlockRunResult } from "../blocks/types";

export function ResponseViewer({ result }: { result: BlockRunResult | null }) {
  if (!result) return null;

  const text =
    typeof result.response === "string"
      ? result.response
      : JSON.stringify(result.response, null, 2);
  const code = "httpStatus" in result ? result.httpStatus : "—";

  return (
    <div>
      <Text size="xs" c="dimmed" mt="xs">
        HTTP {code} · {result.elapsedMs}ms
      </Text>
      {result.status === "err" && result.error && (
        <Alert color="red" variant="light" mt="xs">
          <Text size="xs">{result.error}</Text>
        </Alert>
      )}
      <ScrollArea h={300} mt="xs">
        <Code
          block
          style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
        >
          {text}
        </Code>
      </ScrollArea>
    </div>
  );
}
