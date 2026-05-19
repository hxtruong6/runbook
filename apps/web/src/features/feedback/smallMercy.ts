import { notifications } from "@mantine/notifications";

/**
 * "Small mercy" toast — fires at most once per session after a non-trivial
 * run finally passes end-to-end. Quiet, 1s autoClose, no blocking attention.
 *
 * Convention: trigger from a run-all completion handler when every block
 * passed and the scenario has 3 or more blocks. The single 🌿 toast is the
 * exception to the "no emoji in product chrome" rule.
 */
const SESSION_KEY = "rb_small_mercy_fired";

export function maybeShowSmallMercy(opts: { blockCount: number; allPassed: boolean }) {
  if (!opts.allPassed) return;
  if (opts.blockCount < 3) return;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    return;
  }
  notifications.show({
    message: "🌿 nice",
    autoClose: 1000,
    withCloseButton: false,
    color: "sage",
  });
}
