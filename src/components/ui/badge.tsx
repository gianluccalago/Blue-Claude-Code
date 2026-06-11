import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-200",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-secondary",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-transparent bg-success/10 text-success",
        warning: "border-transparent bg-warning/20 text-warning-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        /* "purple" é o selo semântico de ENFERMAGEM (alias do token nursing) */
        purple: "border-transparent bg-nursing/10 text-nursing",
        outline: "text-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
