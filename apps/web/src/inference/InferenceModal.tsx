// Read-only viewer for the inferred schema + last example, per status family.
// Allows clearing the captured data for this block.
import { Badge, Button, Code, Group, Modal, Stack, Tabs, Text, ThemeIcon, Tooltip } from "@mantine/core";
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { clearInferenceFor, getInferenceFor, useInferenceVersion } from "./inferenceStore";

type Family = "2xx" | "4xx" | "5xx";

export function InferenceModal({
  kind,
  opened,
  onClose,
}: {
  kind: string;
  opened: boolean;
  onClose: () => void;
}) {
  useInferenceVersion();
  const inf = getInferenceFor(kind);

  if (!inf) return null;

  const families = Object.keys(inf.schemas ?? {}) as Family[];
  const defaultFamily = families[0] ?? "2xx";

  function handleClear() {
    clearInferenceFor(kind);
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text fw={600}>Inferred schema</Text>
          {/* Strip the auto-generated random suffix (e.g. "-mpa20x6x") so
              the title reads naturally; full kind is still in the badge below. */}
          <Text size="sm" c="dimmed" ff="monospace">
            {kind.replace(/-[a-z0-9]{6,}$/, "")}
          </Text>
        </Group>
      }
      size="lg"
    >
      <Stack gap="md">
        <Group gap="xs">
          <Tooltip label="Total runs of this block that contributed to schema inference" withArrow position="top">
            <Badge variant="light">{inf.runs} runs</Badge>
          </Tooltip>
          {inf.lastCapturedAt && (
            <Text size="xs" c="dimmed">
              last capture: {new Date(inf.lastCapturedAt).toLocaleString()}
            </Text>
          )}
        </Group>

        {inf.lastDrift && inf.lastDrift.length > 0 && (
          <Group gap="xs" align="flex-start">
            <ThemeIcon variant="light" color="amber" size={24} radius="sm">
              <IconAlertTriangle size={14} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text size="sm" fw={500}>
                Schema drift in last run
              </Text>
              {inf.lastDrift.map((d, i) => (
                <Text key={i} size="xs" c="dimmed">
                  <Code>{d.path}</Code> {d.before} → {d.after}
                </Text>
              ))}
            </Stack>
          </Group>
        )}

        <Tabs defaultValue={defaultFamily}>
          <Tabs.List>
            {families.map((f) => (
              <Tabs.Tab key={f} value={f}>
                {f}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {families.map((f) => {
            const schema = inf.schemas?.[f];
            const example = inf.examples?.[f];
            return (
              <Tabs.Panel key={f} value={f} pt="md">
                <Stack gap="sm">
                  <div>
                    <Text size="xs" fw={600} mb={4}>
                      Schema
                    </Text>
                    <Code block style={{ maxHeight: 240, overflow: "auto", fontSize: 12 }}>
                      {JSON.stringify(schema, null, 2)}
                    </Code>
                  </div>
                  <div>
                    <Text size="xs" fw={600} mb={4}>
                      Last captured response
                    </Text>
                    <Code block style={{ maxHeight: 240, overflow: "auto", fontSize: 12 }}>
                      {JSON.stringify(example, null, 2)}
                    </Code>
                  </div>
                </Stack>
              </Tabs.Panel>
            );
          })}
        </Tabs>

        <Group justify="flex-end">
          <Button
            variant="subtle"
            color="coral"
            leftSection={<IconTrash size={14} />}
            onClick={handleClear}
          >
            Clear captured data
          </Button>
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
