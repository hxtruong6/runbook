// src/features/onboarding/Tour.tsx
// UX-D1 — Zero-friction landing.
//
// Responsibilities:
//  1. Detect first visit (no localStorage projects).
//  2. Auto-import the tour bundle on first visit.
//  3. 3-step tooltip walkthrough: env picker → run button → result / edit input.
//  4. Dismissible top-bar banner persisted in localStorage (key: rb_tour_banner_dismissed).
//  5. Emit `first_run_completed` telemetry once via track().

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Group,
  Paper,
  Text,
  Tooltip,
  useMantineTheme,
} from "@mantine/core";
import { useAuthStore } from "../../auth/authStore";
import { useReducedMotion } from "@mantine/hooks";
import {
  IconX,
  IconInfoCircle,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
} from "@tabler/icons-react";
import { ProjectBundleSchema, type ProjectBundle } from "../../projects/types";
import { loadState } from "../../projects/storage";
import { track } from "./telemetry";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BANNER_DISMISSED_KEY = "rb_tour_banner_dismissed";
const TOUR_COMPLETED_KEY = "rb_tour_completed";
const TOUR_LOADED_KEY = "rb_tour_loaded";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasSavedProjects(): boolean {
  try {
    const state = loadState();
    // A "real" project is any bundle that isn't the tour itself
    return state.bundles.some((b) => b.id !== "tour-bundle");
  } catch {
    return false;
  }
}

function isBannerDismissed(): boolean {
  try {
    return localStorage.getItem(BANNER_DISMISSED_KEY) === "1";
  } catch {
    return true; // fail closed
  }
}

function dismissBanner(): void {
  try {
    localStorage.setItem(BANNER_DISMISSED_KEY, "1");
  } catch {
    // ignore
  }
}

function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(TOUR_COMPLETED_KEY) === "1";
  } catch {
    return false;
  }
}

function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_COMPLETED_KEY, "1");
  } catch {
    // ignore
  }
}

function isTourLoaded(): boolean {
  try {
    return localStorage.getItem(TOUR_LOADED_KEY) === "1";
  } catch {
    return false;
  }
}

function markTourLoaded(): void {
  try {
    localStorage.setItem(TOUR_LOADED_KEY, "1");
  } catch {
    // ignore
  }
}

async function fetchTourBundle(): Promise<ProjectBundle | null> {
  try {
    const res = await fetch("/tour-bundle.json");
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const result = ProjectBundleSchema.safeParse(raw);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tour step definitions
// ---------------------------------------------------------------------------

export interface TourStep {
  /** Unique anchor id that the tooltip's target element should receive */
  anchorId: string;
  label: string;
  description: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    anchorId: "tour-anchor-env",
    label: "Step 1 of 3 — Pick this environment",
    description:
      'Select "JSONPlaceholder (no auth)" from the environment dropdown. No signup needed — calls go straight to a public API.',
  },
  {
    anchorId: "tour-anchor-run",
    label: "Step 2 of 3 — Click Run",
    description:
      "Hit the Run button (or ⌘ Enter) to execute the scenario. Watch each block fire and pass its output to the next.",
  },
  {
    anchorId: "tour-anchor-result",
    label: "Step 3 of 3 — View the result & edit",
    description:
      'See the live response below each block. Try changing the "User ID" input on block 1 to 2 and run again — notice the context propagates automatically.',
  },
];

// ---------------------------------------------------------------------------
// useTour hook — all tour state logic
// ---------------------------------------------------------------------------

export interface TourState {
  /** Whether the tour overlay is active */
  active: boolean;
  /** Current step index (0-based) */
  step: number;
  /** Whether the top-bar banner is visible */
  bannerVisible: boolean;
  /** Loading / error state for bundle fetch */
  loading: boolean;
  error: string | null;
  next: () => void;
  prev: () => void;
  dismiss: () => void;
  dismissBannerFn: () => void;
}

export function useTour(
  onBundleLoaded?: (bundle: ProjectBundle) => void
): TourState {
  const isReturningUser = hasSavedProjects();

  // Compute initial active state synchronously — avoids setState in effect
  const initialActive =
    !isReturningUser && isTourLoaded() && !isTourCompleted();

  const [active, setActive] = useState(initialActive);
  const [step, setStep] = useState(0);
  const isGuest = useAuthStore((s) => s.isGuest);
  const [bannerVisible, setBannerVisible] = useState(
    !isReturningUser && !isBannerDismissed()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Auto-load tour bundle on first visit (only when not already loaded)
  useEffect(() => {
    if (isReturningUser) return;
    if (isTourLoaded()) {
      // Already loaded in a previous session; active state was set synchronously above
      return;
    }
    if (loadedRef.current) return;
    loadedRef.current = true;

    setLoading(true);
    fetchTourBundle().then((bundle) => {
      setLoading(false);
      if (!bundle) {
        setError("Could not load tour bundle. You can still explore manually.");
        return;
      }
      markTourLoaded();
      onBundleLoaded?.(bundle);
      if (!isTourCompleted()) {
        setActive(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = useCallback(() => {
    setStep((s) => {
      const next = s + 1;
      if (next >= TOUR_STEPS.length) {
        // Tour complete
        setActive(false);
        markTourCompleted();
        track("first_run_completed", { steps: TOUR_STEPS.length });
        return s;
      }
      return next;
    });
  }, []);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const dismiss = useCallback(() => {
    setActive(false);
    markTourCompleted();
    track("tour_dismissed", { at_step: step });
  }, [step]);

  const dismissBannerFn = useCallback(() => {
    setBannerVisible(false);
    dismissBanner();
  }, []);

  return {
    active,
    step,
    bannerVisible: bannerVisible && isGuest,
    loading,
    error,
    next,
    prev,
    dismiss,
    dismissBannerFn,
  };
}

// ---------------------------------------------------------------------------
// TourBanner — dismissible top bar
// ---------------------------------------------------------------------------

export function TourBanner({ onDismiss, onSignUp }: { onDismiss: () => void; onSignUp: () => void }) {
  return (
    <Alert
      color="violet"
      variant="light"
      icon={<IconInfoCircle size={16} />}
      radius={0}
      style={{ borderBottom: "1px solid var(--mantine-color-violet-2)" }}
      styles={{ root: { padding: "var(--mantine-spacing-xs) var(--mantine-spacing-md)" } }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm">
          Trying Runbook — your data stays in this browser.{" "}
          <Anchor component="button" fw={600} onClick={onSignUp}>
            Create a free account
          </Anchor>{" "}
          to save &amp; sync.
        </Text>
        <ActionIcon
          size="md"
          variant="subtle"
          aria-label="Dismiss banner"
          onClick={onDismiss}
        >
          <IconX size={14} />
        </ActionIcon>
      </Group>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// TourTooltipOverlay — tooltip floating near the anchor element
// ---------------------------------------------------------------------------

interface TourTooltipOverlayProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
}

export function TourTooltipOverlay({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onDismiss,
}: TourTooltipOverlayProps) {
  const theme = useMantineTheme();
  const prefersReducedMotion = useReducedMotion();

  const isLast = stepIndex === totalSteps - 1;

  return (
    <Paper
      shadow="md"
      p="md"
      withBorder
      style={{
        position: "fixed",
        bottom: "var(--mantine-spacing-xl)",
        right: "var(--mantine-spacing-xl)",
        zIndex: 9999,
        maxWidth: 340,
        transition: prefersReducedMotion
          ? "none"
          : `opacity ${theme.other.motion.duration.base}ms ${theme.other.motion.easing.standard}`,
      }}
      role="dialog"
      aria-live="polite"
      aria-label={step.label}
    >
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" fw={600} tt="uppercase">
          {step.label}
        </Text>
        <ActionIcon
          size="md"
          variant="subtle"
          aria-label="Dismiss tour"
          onClick={onDismiss}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <IconX size={14} />
        </ActionIcon>
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        {step.description}
      </Text>

      <Group justify="space-between" wrap="nowrap">
        <Group gap={4}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <Box
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  i === stepIndex
                    ? "var(--mantine-color-violet-6)"
                    : "var(--mantine-color-gray-3)",
                transition: prefersReducedMotion
                  ? "none"
                  : `background ${theme.other.motion.duration.fast}ms`,
              }}
              aria-hidden
            />
          ))}
        </Group>

        <Group gap="xs" wrap="nowrap">
          {stepIndex > 0 && (
            <Button
              variant="default"
              size="xs"
              leftSection={<IconArrowLeft size={14} />}
              onClick={onPrev}
              style={{ minHeight: 44 }}
            >
              Back
            </Button>
          )}
          <Button
            size="xs"
            leftSection={
              isLast ? <IconCheck size={14} /> : <IconArrowRight size={14} />
            }
            onClick={onNext}
            style={{ minHeight: 44 }}
          >
            {isLast ? "Done" : "Next"}
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Tour — composed root component
// ---------------------------------------------------------------------------

interface TourProps {
  /** Called when the bundle has been fetched — caller should import it */
  onBundleLoaded?: (bundle: ProjectBundle) => void;
}

export function Tour({ onBundleLoaded }: TourProps) {
  const tour = useTour(onBundleLoaded);
  const logout = useAuthStore((s) => s.logout);

  return (
    <>
      {tour.bannerVisible && (
        <TourBanner onDismiss={tour.dismissBannerFn} onSignUp={logout} />
      )}

      {tour.error && (
        <Alert color="red" variant="light" m="md" icon={<IconInfoCircle size={16} />}>
          {tour.error}
        </Alert>
      )}

      {tour.active && (
        <TourTooltipOverlay
          step={TOUR_STEPS[tour.step]!}
          stepIndex={tour.step}
          totalSteps={TOUR_STEPS.length}
          onNext={tour.next}
          onPrev={tour.prev}
          onDismiss={tour.dismiss}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Anchor helper — wrap a child element to mark it as a tour target
// ---------------------------------------------------------------------------

export function TourAnchor({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip
      label={TOUR_STEPS.find((s) => s.anchorId === id)?.description ?? ""}
      position="bottom"
      withinPortal
      disabled={!TOUR_STEPS.some((s) => s.anchorId === id)}
    >
      <span id={id} style={{ display: "contents" }}>
        {children}
      </span>
    </Tooltip>
  );
}
