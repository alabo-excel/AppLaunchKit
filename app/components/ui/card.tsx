import type { ComponentProps } from "react";

import { cn } from "~/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "min-w-0 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "border-b border-zinc-200 px-5 py-4 dark:border-zinc-800",
        className,
      )}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      {...props}
      className={cn(
        "text-sm font-semibold text-zinc-900 dark:text-zinc-100",
        className,
      )}
    />
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("p-5", className)} />;
}
