import type { ReactNode } from "react";

const ENV_TOKENS = new Set(["baseUrl", "host", "token", "apiKey", "traceId"]);

type Props = {
  url?: string;
  /** Optional size override; defaults to 13px to match the design-system promoted URL row. */
  fontSize?: number | string;
};

/**
 * Renders `{{ baseUrl }}/users/:id` with environment / captured-context
 * tokens highlighted inline. Env-supplied tokens get a teal tint; everything
 * else (captured by an upstream block) gets an indigo tint. Mirrors the
 * design-system `renderTokenizedUrl` from the handoff BlockCard.
 */
export function TokenizedUrl({ url, fontSize = 13 }: Props) {
  if (!url) return null;
  const parts: ReactNode[] = [];
  const tokenRe = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let i = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(url)) !== null) {
    if (m.index > i) {
      parts.push(<span key={`t${key++}`}>{url.slice(i, m.index)}</span>);
    }
    const name = m[1];
    const isEnv = ENV_TOKENS.has(name);
    parts.push(
      <span
        key={`tok${key++}`}
        title={isEnv ? "From active environment" : "From captured context"}
        style={{
          background: isEnv ? "var(--mantine-color-teal-1)" : "var(--mantine-color-indigo-1)",
          color: isEnv ? "var(--mantine-color-teal-8)" : "var(--mantine-color-indigo-8)",
          borderRadius: 4,
          padding: "0 4px",
          margin: "0 1px",
        }}
      >{`{{ ${name} }}`}</span>,
    );
    i = m.index + m[0].length;
  }
  if (i < url.length) parts.push(<span key={`tail${key}`}>{url.slice(i)}</span>);
  return (
    <code style={{ fontFamily: "var(--mantine-font-family-monospace)", fontSize, wordBreak: "break-all" }}>
      {parts}
    </code>
  );
}
