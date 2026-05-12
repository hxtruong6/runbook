// src/components/ContextPanel.tsx
import { useRuntimeContext } from "../context/ContextStore";

const REDACTED_KEYS = new Set(["password"]);

export function ContextPanel() {
  const { context, dispatch } = useRuntimeContext();
  const entries = Object.entries(context).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={() => dispatch({ type: "RESET" })}>Reset</button>
      </div>
      <table>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td className="key">{k}</td>
              <td>
                {REDACTED_KEYS.has(k) ? (
                  <span style={{ opacity: 0.5 }}>•••</span>
                ) : typeof v === "object" ? (
                  <code style={{ fontSize: 11 }}>{JSON.stringify(v).slice(0, 80)}</code>
                ) : (
                  <input
                    value={v === undefined || v === null ? "" : String(v)}
                    onChange={(e) =>
                      dispatch({ type: "SET_KEY", key: k, value: e.target.value })
                    }
                  />
                )}
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={2} style={{ opacity: 0.5, fontSize: 12 }}>Empty</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
