// src/features/palette/CommandPalette.tsx
import { useMemo } from "react";
import { useMantineColorScheme } from "@mantine/core";
import {
  Spotlight,
  SpotlightActionData,
  SpotlightActionGroupData,
} from "@mantine/spotlight";
import {
  IconClipboardList,
  IconTerminal2,
  IconFileImport,
  IconSun,
  IconMoon,
  IconLayout,
  IconPlayerPlay,
  IconKey,
} from "@tabler/icons-react";
import type { Scenario } from "../../scenarios/types";
import "@mantine/spotlight/styles.css";

// ─── Recents ──────────────────────────────────────────────────────────────────

const RECENTS_KEY = "rb_palette_recent";
const RECENTS_CAP = 8;

export type RecentEntry = {
  id: string;
  label: string;
  group: "scenario" | "env";
};

export function getRecents(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function pushRecent(entry: RecentEntry): void {
  const prev = getRecents().filter((r) => r.id !== entry.id);
  const next = [entry, ...prev].slice(0, RECENTS_CAP);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

// ─── Component ────────────────────────────────────────────────────────────────

type CommandPaletteProps = {
  scenarios: Scenario[];
  activeScenarioId: string | null;
  envKeys: string[];
  onSelectScenario: (id: string) => void;
  onRunScenario: (id: string) => void;
  onNavigateToBlocks: () => void;
};

export function CommandPalette({
  scenarios,
  activeScenarioId,
  envKeys,
  onSelectScenario,
  onRunScenario,
  onNavigateToBlocks,
}: CommandPaletteProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const actions = useMemo<(SpotlightActionGroupData | SpotlightActionData)[]>(() => {
    const recents = getRecents();

    // ── Recent items ──────────────────────────────────────────────────────────
    const recentItems: SpotlightActionData[] = recents
      .map((r): SpotlightActionData | null => {
        if (r.group === "scenario") {
          const s = scenarios.find((sc) => sc.id === r.id);
          if (!s) return null;
          return {
            id: `recent-scenario-${s.id}`,
            label: s.name,
            description: "Recent · Scenario",
            keywords: [s.name, "scenario", "recent"],
            leftSection: <IconClipboardList size={18} />,
            onClick: () => {
              pushRecent({ id: s.id, label: s.name, group: "scenario" });
              onSelectScenario(s.id);
            },
          };
        }
        if (r.group === "env") {
          return {
            id: `recent-env-${r.id}`,
            label: r.id,
            description: "Recent · Environment key",
            keywords: [r.id, "env", "recent"],
            leftSection: <IconKey size={18} />,
            onClick: () => {
              pushRecent({ id: r.id, label: r.id, group: "env" });
            },
          };
        }
        return null;
      })
      .filter((x): x is SpotlightActionData => x !== null);

    // ── Scenarios ─────────────────────────────────────────────────────────────
    const scenarioItems: SpotlightActionData[] = scenarios.map((s) => ({
      id: `scenario-${s.id}`,
      label: s.name,
      description: "Scenario",
      keywords: [s.name, "scenario", "jump"],
      leftSection: <IconClipboardList size={18} />,
      onClick: () => {
        pushRecent({ id: s.id, label: s.name, group: "scenario" });
        onSelectScenario(s.id);
      },
    }));

    // ── Env keys ──────────────────────────────────────────────────────────────
    const envItems: SpotlightActionData[] = envKeys.map((k) => ({
      id: `env-${k}`,
      label: k,
      description: "Environment key",
      keywords: [k, "env", "environment", "variable"],
      leftSection: <IconKey size={18} />,
      onClick: () => {
        pushRecent({ id: k, label: k, group: "env" });
      },
    }));

    // ── System actions ────────────────────────────────────────────────────────
    const lastScenarioId = activeScenarioId ?? scenarios[0]?.id;

    const systemItems: SpotlightActionData[] = [
      {
        id: "run-last-scenario",
        label: "Run last scenario",
        description: lastScenarioId
          ? `Run "${scenarios.find((s) => s.id === lastScenarioId)?.name ?? ""}"`
          : "No scenario active",
        keywords: ["run", "execute", "play", "scenario"],
        leftSection: <IconPlayerPlay size={18} />,
        onClick: () => {
          if (lastScenarioId) onRunScenario(lastScenarioId);
        },
      },
      {
        id: "paste-curl",
        label: "Paste curl…",
        description: "Import a request from a cURL command",
        keywords: ["curl", "import", "paste", "http", "request"],
        leftSection: <IconTerminal2 size={18} />,
        onClick: () => {
          onNavigateToBlocks();
        },
      },
      {
        id: "import-openapi",
        label: "Import OpenAPI…",
        description: "Import from an OpenAPI / Swagger spec",
        keywords: ["openapi", "swagger", "import", "spec"],
        leftSection: <IconFileImport size={18} />,
        onClick: () => {
          onNavigateToBlocks();
        },
      },
      {
        id: "toggle-color-scheme",
        label: "Toggle color scheme",
        description: colorScheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        keywords: ["theme", "dark", "light", "color", "scheme", "mode"],
        leftSection: colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />,
        onClick: () => {
          setColorScheme(colorScheme === "dark" ? "light" : "dark");
        },
      },
      {
        id: "open-demo",
        label: "Open demo page",
        description: "View the design system reference",
        keywords: ["demo", "design", "system", "reference", "components"],
        leftSection: <IconLayout size={18} />,
        onClick: () => {
          window.open("/demo.html", "_blank");
        },
      },
    ];

    const groups: (SpotlightActionGroupData | SpotlightActionData)[] = [];

    if (recentItems.length > 0) {
      groups.push({ group: "Recent", actions: recentItems });
    }

    if (scenarioItems.length > 0 || envItems.length > 0) {
      const jumpActions: SpotlightActionData[] = [];
      if (scenarioItems.length > 0) jumpActions.push(...scenarioItems);
      if (envItems.length > 0) jumpActions.push(...envItems);
      groups.push({ group: "Jump to", actions: jumpActions });
    }

    groups.push({ group: "Actions", actions: systemItems });

    return groups;
  }, [scenarios, activeScenarioId, envKeys, colorScheme, setColorScheme, onSelectScenario, onRunScenario, onNavigateToBlocks]);

  return (
    <Spotlight
      actions={actions}
      shortcut={["mod+K", "mod+P"]}
      nothingFound="No results found"
      highlightQuery
      searchProps={{
        placeholder: "Search scenarios, actions…",
      }}
    />
  );
}
