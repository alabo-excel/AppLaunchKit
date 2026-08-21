import { cn } from "~/lib/cn";

/**
 * Indeterminate activity indicator. Decorative: the surrounding region carries
 * the `role="status"` text that screen readers announce.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("alk-spin size-4 shrink-0", className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Indeterminate progress bar.
 *
 * A `<Form>` submission gives no byte-level progress — that needs XHR — so this
 * deliberately shows activity rather than a made-up percentage.
 */
export function ProgressBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700",
        className,
      )}
    >
      <div className="alk-progress-bar absolute inset-y-0 w-1/3 rounded-full bg-zinc-900 dark:bg-zinc-100" />
    </div>
  );
}
