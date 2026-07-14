export function Spinner({ label = "Loading" }: { label?: string }) {
  return <span className="dc-spinner" role="status" aria-label={label} />;
}
