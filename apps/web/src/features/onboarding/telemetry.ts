// src/features/onboarding/telemetry.ts
// No-op telemetry — real provider can be wired in later.
// Respect opt-out via localStorage.rb_no_telemetry = '1'

declare global {
  interface Window {
    __rb_events__?: Array<{ event: string; props: Record<string, unknown>; ts: number }>;
  }
}

export function track(event: string, props: Record<string, unknown> = {}): void {
  try {
    if (localStorage.getItem("rb_no_telemetry") === "1") return;
  } catch {
    return;
  }

  const entry = { event, props, ts: Date.now() };
  console.warn("[runbook:telemetry]", entry);

  if (typeof window !== "undefined") {
    window.__rb_events__ = window.__rb_events__ ?? [];
    window.__rb_events__.push(entry);
  }
}

// Alternate name for callers that import `trackEvent` with a single object payload.
export function trackEvent(event: Record<string, unknown>): void {
  const { event: name, ...props } = event as { event?: string } & Record<string, unknown>;
  track(typeof name === "string" ? name : "event", props);
}
