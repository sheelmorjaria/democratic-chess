import { type ReactNode } from "react";

export interface CardProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove inner padding (e.g. when the body is itself padded). */
  flush?: boolean;
  /** HTML id, useful for form labels / anchors. */
  id?: string;
}

/** Surface panel — the basic container for grouped content. */
export function Card({ title, children, className = "", flush, id }: CardProps) {
  const cls = ["dc-card", flush ? "dc-card--flush" : "", className].filter(Boolean).join(" ");
  return (
    <section id={id} className={cls}>
      {title && <h2 className="dc-card__title">{title}</h2>}
      {children}
    </section>
  );
}
