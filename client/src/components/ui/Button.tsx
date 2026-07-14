"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "dc-btn--primary",
  secondary: "dc-btn--secondary",
  ghost: "dc-btn--ghost",
  danger: "dc-btn--danger",
};

/** Styled button. For links, render `<Link className="dc-btn …">` directly. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", block, className = "", children, type, ...rest },
  ref,
) {
  const cls = [
    "dc-btn",
    VARIANT_CLASS[variant],
    size === "sm" ? "dc-btn--sm" : "",
    block ? "dc-btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type ?? "button"} className={cls} {...rest}>
      {children}
    </button>
  );
});
