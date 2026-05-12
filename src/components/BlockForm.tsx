// src/components/BlockForm.tsx
import type { BlockDef, FieldSpec, RuntimeContext } from "../blocks/types";

type Props = {
  def: BlockDef;
  overrides: Record<string, unknown>;
  context: RuntimeContext;
  onChange: (overrides: Record<string, unknown>) => void;
};

function Field({ field, overrides, context, onChange }: { field: FieldSpec } & Omit<Props, "def">) {
  const override = overrides[field.name];
  const ctxVal = field.fromContextKey ? context[field.fromContextKey] : undefined;
  const effective = override !== undefined && override !== "" ? override : ctxVal ?? "";
  const usingContext = (override === undefined || override === "") && ctxVal !== undefined;

  function update(value: string) {
    onChange({ ...overrides, [field.name]: value });
  }

  return (
    <div className="field">
      <label>
        {field.label}
        {usingContext && <span className="chip">← context: {field.fromContextKey}</span>}
      </label>
      {field.type === "enum" ? (
        <select value={String(effective)} onChange={(e) => update(e.target.value)}>
          <option value="">— select —</option>
          {field.enumValues?.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "password" ? "password" : "text"}
          value={String(effective)}
          placeholder={field.placeholder}
          onChange={(e) => update(e.target.value)}
        />
      )}
    </div>
  );
}

export function BlockForm({ def, overrides, context, onChange }: Props) {
  if (def.inputs.length === 0) {
    return <p style={{ fontSize: 12, opacity: 0.6 }}>No inputs.</p>;
  }
  return (
    <div>
      {def.inputs.map((f) => (
        <Field key={f.name} field={f} overrides={overrides} context={context} onChange={onChange} />
      ))}
    </div>
  );
}
