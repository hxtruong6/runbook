// Banner shown under a block's run result when inference captured something.
// Click "View schema" → opens the InferenceModal with diff + apply UX.
import { useState } from "react";
import { Alert, Badge, Button, Group, Text } from "@mantine/core";
import { IconCamera, IconAlertTriangle } from "@tabler/icons-react";
import { InferenceModal } from "./InferenceModal";
import { getInferenceFor } from "./inferenceStore";

export function InferenceBanner({ kind, runVersion }: { kind: string; runVersion: number }) {
  const [open, setOpen] = useState(false);
  // runVersion forces a re-read after each run.
  void runVersion;
  const inf = getInferenceFor(kind);
  if (!inf || inf.runs === 0) return null;

  const families = Object.keys(inf.schemas ?? {});
  const hasDrift = (inf.lastDrift?.length ?? 0) > 0;

  return (
    <>
      <Alert
        mt="xs"
        color={hasDrift ? "amber" : "violet"}
        variant="light"
        icon={hasDrift ? <IconAlertTriangle size={16} /> : <IconCamera size={16} />}
      >
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <div style={{ minWidth: 0 }}>
            <Text size="sm" fw={500}>
              {hasDrift ? "Schema drift detected" : "Response schema captured"}
            </Text>
            <Group gap={6} mt={2}>
              <Text size="xs" c="dimmed">
                {inf.runs} run{inf.runs === 1 ? "" : "s"} · families:
              </Text>
              {families.map((f) => (
                <Badge key={f} size="xs" variant="light" color={f === "2xx" ? "green" : "red"}>
                  {f}
                </Badge>
              ))}
            </Group>
          </div>
          <Button size="xs" variant="default" onClick={() => setOpen(true)}>
            View schema
          </Button>
        </Group>
      </Alert>
      <InferenceModal kind={kind} opened={open} onClose={() => setOpen(false)} />
    </>
  );
}
