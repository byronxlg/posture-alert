import { useId, type CSSProperties, type ReactNode } from "react";

/** An iOS-style switch. Put it inside a <label> row so the whole row toggles it. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" aria-hidden="true" />
    </button>
  );
}

/** Segmented control: native radios, so arrow keys and screen readers work as they should. */
export function Segmented<T extends number>({
  label, options, value, onChange,
}: { label: string; options: readonly { label: string; value: T }[]; value: T | null; onChange: (v: T) => void }) {
  const name = useId();
  const i = options.findIndex((o) => o.value === value);
  return (
    <div
      className={`seg${i < 0 ? " seg-none" : ""}`}
      role="radiogroup"
      aria-label={label}
      style={{ "--n": options.length, "--i": Math.max(i, 0) } as CSSProperties}
    >
      {options.map((o) => (
        <label key={o.value} className="seg-opt">
          <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

/** A row of a grouped list: label on the left, control on the right. */
export function Row({ label, detail, children, htmlFor }: { label: ReactNode; detail?: ReactNode; children?: ReactNode; htmlFor?: string }) {
  return (
    <label className="row" htmlFor={htmlFor}>
      <span className="row-label">{label}</span>
      {detail !== undefined && <span className="row-detail">{detail}</span>}
      {children}
    </label>
  );
}

/** Content that appears in answer to a simple setting; it slides open rather than popping in. */
export function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <div className="reveal"><div className="reveal-inner">{children}</div></div>;
}

export function Group({ title, footnote, children }: { title?: string; footnote?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section className="group" aria-labelledby={title ? id : undefined}>
      {title && <h3 className="group-title" id={id}>{title}</h3>}
      <div className="group-body">{children}</div>
      {footnote && <p className="group-foot">{footnote}</p>}
    </section>
  );
}
