import { Button, Menu } from "@mantine/core";
import { IconCaretDownFilled, IconPlayerPlay, IconPlayerSkipForward } from "@tabler/icons-react";

type Props = {
  /** Whether a run is in flight; disables the primary tap to prevent double-fire. */
  running?: boolean;
  /** Disable everything (e.g. nothing to run). */
  disabled?: boolean;
  /** Optional size; defaults to "xs" to fit BlockCard row density. */
  size?: "xs" | "sm";
  /** Primary action (Enter behavior in the handoff). */
  onRun: () => void;
  /** Run this block + every block after it. */
  onRunFromHere?: () => void;
  /** Stub for the design-system "Run with overrides" affordance — open a modal, etc. */
  onRunWithOverrides?: () => void;
};

/**
 * Split Run button — primary "Run" + caret menu for run-mode variants.
 * Mirrors the design-system SplitRunButton from the handoff BlockCard.
 *
 * One filled primary action per BlockCard; the caret keeps secondary
 * run modes within reach without spawning a second filled button.
 */
export function SplitRunButton({ running, disabled, size = "xs", onRun, onRunFromHere, onRunWithOverrides }: Props) {
  return (
    <Button.Group>
      <Button
        size={size}
        loading={running}
        disabled={disabled}
        onClick={onRun}
        leftSection={<IconPlayerPlay size={12} />}
        aria-label="Run this block"
      >
        Run
      </Button>
      <Menu position="bottom-end" withinPortal shadow="md" width={220}>
        <Menu.Target>
          <Button
            size={size}
            disabled={disabled}
            px={6}
            aria-label="Run options"
          >
            <IconCaretDownFilled size={10} />
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconPlayerPlay size={14} />} onClick={onRun}>
            Run only this
          </Menu.Item>
          {onRunFromHere && (
            <Menu.Item leftSection={<IconPlayerSkipForward size={14} />} onClick={onRunFromHere}>
              Run from here
            </Menu.Item>
          )}
          {onRunWithOverrides && (
            <Menu.Item onClick={onRunWithOverrides} disabled>
              Run with overrides…
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
    </Button.Group>
  );
}
