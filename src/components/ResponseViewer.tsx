// src/components/ResponseViewer.tsx
import type { BlockRunResult } from "../blocks/types";

export function ResponseViewer({ result }: { result: BlockRunResult | null }) {
  if (!result) return null;
  const text =
    typeof result.response === "string"
      ? result.response
      : JSON.stringify(result.response, null, 2);
  const code = "httpStatus" in result ? result.httpStatus : "—";
  const note = result.status === "err" ? ` — ${result.error}` : "";
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
        HTTP {code} · {result.elapsedMs}ms{note}
      </div>
      <pre className="response">{text}</pre>
    </div>
  );
}
