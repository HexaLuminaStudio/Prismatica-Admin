import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 whitespace-nowrap",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive/15 text-destructive hover:bg-destructive/20 dark:bg-destructive/25",
        outline: "border-border text-foreground bg-background",
        success:
          "border-transparent bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 dark:bg-emerald-500/20",
        warning:
          "border-transparent bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 dark:bg-amber-500/20",
        muted:
          "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
        subtle:
          "border-primary/10 bg-primary/10 text-primary hover:bg-primary/15",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };