import * as React from "react";
import { cn } from "@/lib/cn";

/** A small outlined label chip, e.g. the robot type. */
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-sm border border-border px-2 py-0.5 text-xs font-medium leading-none text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
