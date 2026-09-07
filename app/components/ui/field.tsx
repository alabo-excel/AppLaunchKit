import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";

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
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div className={cn("block space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </label>
      {isValidElement(children) ? cloneElement(children as ReactElement<ComponentProps<"input">>, {
        id,
        "aria-describedby": hint || error ? descriptionId : undefined,
        "aria-invalid": error ? true : undefined,
      }) : children}
      {hint && !error ? (
        <span id={descriptionId} className="block text-xs text-zinc-500">{hint}</span>
      ) : null}
      {error ? (
        <span className="block text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "block h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base sm:text-sm text-zinc-900",
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
        "block h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base sm:text-sm text-zinc-900",
        "focus:border-zinc-900 focus:outline-none",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400",
        className,
      )}
    />
  );
}

export function ColorInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <div className={cn("flex h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-2.5 dark:border-zinc-700 dark:bg-zinc-900", className)}>
      <input
        {...props}
        type="color"
        className="color-swatch size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border-0 bg-transparent p-0"
      />
      <span aria-hidden="true" className="pointer-events-none font-mono text-xs uppercase tracking-tight text-zinc-600 dark:text-zinc-300">
        {String(props.value ?? props.defaultValue ?? "#000000")}
      </span>
    </div>
  );
}
