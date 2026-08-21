import type { ComponentProps, ReactNode } from "react";

import { cn } from "~/lib/cn";

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </span>
      {children}
      {hint && !error ? (
        <span className="block text-xs text-zinc-500">{hint}</span>
      ) : null}
      {error ? (
        <span className="block text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "block h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900",
        "placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400",
        className,
      )}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn(
        "block h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900",
        "focus:border-zinc-900 focus:outline-none",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400",
        className,
      )}
    />
  );
}

export function ColorInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      type="color"
      className={cn(
        "h-10 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white p-1",
        "dark:border-zinc-700 dark:bg-zinc-900",
        className,
      )}
    />
  );
}
