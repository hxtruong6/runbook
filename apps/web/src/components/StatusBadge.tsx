import { Badge } from "@mantine/core";
import { motion } from "framer-motion";

export type RunStatus = "idle" | "running" | "ok" | "err" | "connected";

const STATUS_MAP: Record<RunStatus, { color: string; label: string; pulse: boolean }> = {
  idle:      { color: "gray",  label: "idle",      pulse: false },
  running:   { color: "amber", label: "running",   pulse: true  },
  ok:        { color: "sage",  label: "ok",        pulse: false },
  err:       { color: "coral", label: "err",       pulse: false },
  connected: { color: "sky",   label: "connected", pulse: false },
};

type Props = {
  status: RunStatus;
  /** Override the label (e.g. "passed" instead of "ok"). */
  label?: string;
  size?: "xs" | "sm" | "md";
};

/**
 * Run-lifecycle badge — leading dot, status-tinted, pulses while "running".
 * Mirrors the design-system StatusBadge primitive from the handoff kit.
 */
export function StatusBadge({ status, label, size = "sm" }: Props) {
  const m = STATUS_MAP[status];
  const dot = (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "currentColor",
        marginRight: 6,
        verticalAlign: "middle",
      }}
    />
  );
  const badge = (
    <Badge variant="light" color={m.color} size={size}>
      {dot}
      {label ?? m.label}
    </Badge>
  );
  if (!m.pulse) return badge;
  return (
    <motion.div
      animate={{ opacity: [1, 0.35, 1] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "inline-flex" }}
    >
      {badge}
    </motion.div>
  );
}
