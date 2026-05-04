import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-border/80 placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full rounded-[1.5rem] border bg-background/82 px-4 py-3 text-base shadow-xs transition-[color,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-primary/40 focus-visible:bg-card focus-visible:shadow-sm md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
