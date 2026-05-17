// src/features/onboarding/telemetry.ts
// No-op telemetry helper.  Pushes structured events to window.__rb_events__ if
// the array is present (injected by analytics integrations); silently drops them
// otherwise so the app never hard-depends on a tracking layer.

declare global {
  interface Window {
    __rb_events__?: Array<Record<string, unknown>>
  }
}

export function trackEvent(event: Record<string, unknown>): void {
  try {
    if (Array.isArray(window.__rb_events__)) {
      window.__rb_events__.push(event)
    }
  } catch {
    // Silently ignore — telemetry must never crash the app.
  }
}
