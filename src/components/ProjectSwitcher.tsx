// src/components/ProjectSwitcher.tsx
import { useRef } from "react";
import { Button, Group, Select, Stack, Text } from "@mantine/core";
import { openConfirmModal } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useProjects } from "../projects/ProjectsStore";
import { downloadBundle, readBundleFile } from "../projects/exportImport";

export function ProjectSwitcher() {
  const { state, dispatch, activeProject, activeVersion } = useProjects();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectOptions = state.bundles.map((b) => ({ value: b.id, label: b.name }));

  const versionOptions = activeProject
    ? activeProject.versions.map((v) => ({ value: v.version, label: v.version }))
    : [];

  const activeVersionValue = activeVersion?.version ?? null;

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const bundle = await readBundleFile(file);
      dispatch({ type: "UPSERT_BUNDLE", payload: bundle });
      dispatch({ type: "SET_ACTIVE_PROJECT", payload: bundle.id });
    } catch (err) {
      notifications.show({
        color: "red",
        title: "Invalid bundle",
        message: (err as Error).message,
      });
    }
    e.target.value = "";
  }

  function handleDelete() {
    if (!activeProject) return;
    openConfirmModal({
      title: "Remove project",
      children: (
        <Text size="sm">
          Remove project &ldquo;{activeProject.name}&rdquo; from the local list?
        </Text>
      ),
      labels: { confirm: "Remove", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => {
        dispatch({ type: "DELETE_BUNDLE", payload: activeProject.id });
      },
    });
  }

  return (
    <Stack gap={6}>
      <Text size="xs" tt="uppercase" c="dimmed" fw={600}>
        Project
      </Text>

      <Select
        size="xs"
        data={projectOptions}
        value={state.activeProjectId ?? null}
        onChange={(val) => dispatch({ type: "SET_ACTIVE_PROJECT", payload: val })}
        placeholder={projectOptions.length === 0 ? "No projects loaded" : "Select project"}
        disabled={projectOptions.length === 0}
        comboboxProps={{ withinPortal: true }}
        styles={{ input: { fontWeight: 500 } }}
      />

      <Select
        size="xs"
        data={versionOptions}
        value={activeVersionValue}
        onChange={(val) => {
          if (val && activeProject) {
            dispatch({
              type: "SET_ACTIVE_VERSION",
              payload: { projectId: activeProject.id, version: val },
            });
          }
        }}
        placeholder="No version"
        disabled={!activeProject}
        comboboxProps={{ withinPortal: true }}
      />

      <Group gap="xs">
        <Button
          size="xs"
          variant="default"
          onClick={() => fileInputRef.current?.click()}
        >
          Import
        </Button>
        <Button
          size="xs"
          variant="default"
          disabled={!activeProject}
          onClick={() => activeProject && downloadBundle(activeProject)}
        >
          Export
        </Button>
        <Button
          size="xs"
          variant="subtle"
          color="red"
          disabled={!activeProject}
          onClick={handleDelete}
        >
          Delete
        </Button>
      </Group>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={handleImport}
      />
    </Stack>
  );
}
