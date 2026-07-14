import { type InputHTMLAttributes, type ReactNode } from "react";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: ReactNode;
}

/** Label + input + optional error/hint, wired to the design tokens. */
export function Field({ label, error, hint, id, className, ...rest }: FieldProps) {
  return (
    <div className="dc-field">
      {label && (
        <label htmlFor={id}>
          {label}
        </label>
      )}
      <input id={id} className={["dc-input", className].filter(Boolean).join(" ")} {...rest} />
      {error ? (
        <div className="dc-field__error">{error}</div>
      ) : hint ? (
        <div className="dc-muted" style={{ fontSize: 12 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
