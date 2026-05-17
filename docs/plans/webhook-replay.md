# Plan — Webhook replay

**Goal:** Let users test their inbound-webhook endpoints by replaying real
payloads. Today they need ngrok + waiting for the third party (PayMongo,
Stripe, etc.) to actually trigger an event — slow and unreliable.

Motivating case in cworld-be: `paymongo-webhook.controller.ts` — currently
zero way to test signature verification + state transitions without staging
PayMongo events.

## Two halves

1. **Capture** — record a real webhook hitting any URL Runbook can reach.
2. **Replay** — re-POST it from Runbook later, into local or staging.

For v1 we focus on **Replay** (capture comes from manual paste or an existing
log file). Capture-via-tunnel is v2.

## File layout

```
packages/shared/src/
├─ webhook/                              NEW
│  ├─ index.ts                           Barrel
│  ├─ types.ts                           WebhookPayload (headers, body, ts, label)
│  ├─ signing.ts                         Re-sign Stripe / PayMongo / GitHub on replay
│  │                                     (so HMAC headers stay valid)
│  └─ replay.ts                          replayWebhook(payload, targetUrl, opts) → result
│
└─ runtime/
   └─ types.ts                           CHANGE: BlockKind add 'webhook-replay'

packages/shared/tests/
└─ webhook/
   ├─ signing.test.ts                    Fixtures: stripe sig, paymongo sig, github sig
   └─ replay.test.ts                     Mock fetcher, assert headers + body sent

apps/web/src/
├─ pages/
│  └─ WebhooksPage.tsx                   NEW: full-page UI under /webhooks
│                                              left: saved payload list
│                                              right: payload viewer + replay form
│
├─ features/
│  └─ webhooks/
│     ├─ webhookStore.ts                 NEW: persist payloads in localStorage
│     │                                        shape: { id, label, headers, body, capturedAt, source }
│     ├─ WebhookPayloadEditor.tsx        NEW: edit headers + body before replay
│     ├─ WebhookReplayForm.tsx           NEW: target URL, signing secret, replay button
│     └─ webhookSignerSelector.ts        NEW: detect signature scheme from headers
│
└─ components/
   └─ AppShell                           CHANGE: add /webhooks to nav

apps/marketing/src/pages/
└─ webhooks.astro                        (Optional) marketing page

docs/
└─ webhooks.md                           NEW
```

## Bundle integration

Webhooks are **not stored in the bundle** by default (they're often PII-heavy).
They live in localStorage. A user can optionally "Pin to bundle" a sanitized
payload as a `webhook-replay` block — then it becomes a runnable scenario step.

The `webhook-replay` block kind lives alongside HTTP and grpc:

```ts
{
  kind: 'webhook-replay',
  label: 'PayMongo: payment.paid',
  payloadRef: 'wh_payment_paid_v1',     // key in bundle.docs[]
  targetUrlTemplate: '{{baseUrl}}/api/webhooks/paymongo',
  signing: { kind: 'paymongo', secretInputName: 'paymongoWebhookSecret' },
}
```

Re-signing on replay is the **key trick**: HMACs in the original captured
payload are stale; we recompute using the user's signing secret so the
endpoint's verifier accepts it.

## Capture sources (v1)

Three ways a user gets a payload into Runbook:

1. **Paste raw HTTP** — like the existing curl paste flow. Parse method,
   headers, body. Most common in practice.
2. **Drop a `.har` file** — re-use the (future) HAR import. Skip for v1.
3. **Local tunnel** — `rb webhook listen --port 5555` spins up an HTTP server
   that captures every POST and writes it as a payload. **v2**.

For v1, ship paste only. The "Listen" mode is genuinely valuable but adds a
moving piece (CLI proc, port choice, ngrok docs). Don't gate the feature on it.

## Signature schemes supported on day one

| Service | Header | Algorithm | Notes |
|---|---|---|---|
| Stripe | `Stripe-Signature` | HMAC-SHA256, t+v1 format | Timestamp must be fresh — we set `t` to now. |
| PayMongo | `Paymongo-Signature` | HMAC-SHA256, t+te+li | Same shape, different headers |
| GitHub | `X-Hub-Signature-256` | HMAC-SHA256, prefix `sha256=` | Simpler |
| Generic HMAC | configurable header name + algo | — | Escape hatch |

Per-service: ~30 lines each. Use existing `crypto.subtle` in the browser.

## UX

```
/webhooks page

┌─ Saved payloads ──────┬─ payment.paid (PayMongo) ─────────────────┐
│ ▸ payment.paid (3)    │ Captured: 2026-04-12 14:21                │
│ ▸ payment.failed (1)  │ Source: Pasted by Aidan                   │
│ ▸ subscription.*  (8) │                                            │
│                       │ Headers:                                   │
│   + Add payload       │   Content-Type: application/json           │
│                       │   Paymongo-Signature: t=...,te=...         │
│                       │                                            │
│                       │ Body:                                      │
│                       │   { "data": { ... } }                      │
│                       │                                            │
│                       │ ┌─ Replay to ─────────────────────────┐    │
│                       │ │ Target: http://localhost:3000/...   │    │
│                       │ │ Signing secret: ••••••••••          │    │
│                       │ │ ☑ Re-sign before send               │    │
│                       │ │ ☑ Bump timestamp to now             │    │
│                       │ │                                      │    │
│                       │ │ Last result: 200 in 42ms ✓          │    │
│                       │ │              [Replay]    [Pin]      │    │
│                       │ └──────────────────────────────────────┘    │
└───────────────────────┴────────────────────────────────────────────┘
```

## Implementation order (2 PRs)

1. **PR A — shared `webhook/signing.ts` + tests** (~1 day)
   No UI. Just the re-signers and replay function. Verifiable against fixture
   secrets from public Stripe/GitHub docs.

2. **PR B — /webhooks page + paste flow + replay** (~2 days)
   Wire signing into the UI. localStorage persistence. Pin-to-bundle stub
   (writes the block kind but full block UI lives in a follow-up).

## Acceptance criteria

- [ ] User can paste a raw PayMongo webhook request, replay it against
      `http://localhost:3000/...`, and see a 200 from their endpoint.
- [ ] Re-signed Stripe payload verifies in a real Stripe SDK test (use the
      published test secret in fixtures).
- [ ] Payloads survive a page refresh (localStorage).
- [ ] Sensitive headers redacted in the payload list preview but kept in full
      when the user opens the payload.
- [ ] Pin-to-bundle creates a `webhook-replay` block with the right kind +
      docs[] reference, even if the block doesn't yet render in scenarios.
