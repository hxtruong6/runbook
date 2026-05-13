// src/components/EnvSwitcher.tsx
import { Select, Group, Badge, ActionIcon, Tooltip } from "@mantine/core";
import { useEnvironments } from "../environments/EnvironmentsStore";
import type { AuthConfig } from "../environments/types";

function authBadgeProps(auth: AuthConfig): { label: string; color: string } {
  switch (auth.kind) {
    case "bearer":
      return { label: "Bearer", color: "blue" };
    case "cookie":
      return { label: "Cookie", color: "teal" };
    case "apiKey":
      return { label: "API key", color: "grape" };
    case "basic":
      return { label: "Basic", color: "amber" };
    case "none":
      return { label: "None", color: "gray" };
  }
}

// Gear icon as inline SVG (no new dep)
function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const MANAGE_VALUE = "__manage__";

type Props = {
  onOpenEditor: () => void;
};

export function EnvSwitcher({ onOpenEditor }: Props) {
  const { state, dispatch, activeEnv } = useEnvironments();

  const selectData = [
    ...state.environments.map((e) => ({
      value: e.id,
      label: e.name,
    })),
    { value: MANAGE_VALUE, label: "Manage…" },
  ];

  function handleChange(val: string | null) {
    if (!val) return;
    if (val === MANAGE_VALUE) {
      onOpenEditor();
      return;
    }
    dispatch({ type: "SET_ACTIVE", id: val });
  }

  const badgeProps = activeEnv ? authBadgeProps(activeEnv.auth) : null;

  return (
    <Group gap={6} wrap="nowrap">
      <Select
        size="xs"
        data={selectData}
        value={state.activeId ?? null}
        onChange={handleChange}
        placeholder="No environment"
        w={160}
        comboboxProps={{ withinPortal: true }}
        styles={{ input: { fontWeight: 500 } }}
      />
      {badgeProps && (
        <Badge size="xs" color={badgeProps.color} variant="light" radius="sm">
          {badgeProps.label}
        </Badge>
      )}
      <Tooltip label="Manage environments" withArrow position="bottom">
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          onClick={onOpenEditor}
          aria-label="Manage environments"
        >
          <GearIcon />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
