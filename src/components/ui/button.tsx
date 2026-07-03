import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-card hover:bg-primary-strong hover:text-white hover:shadow-soft",
        secondary: "bg-secondary text-secondary-foreground shadow-card hover:bg-secondary/90 hover:shadow-soft",
        success: "bg-success text-success-foreground shadow-card hover:bg-success/90 hover:shadow-soft",
        warning: "bg-warning text-warning-foreground shadow-card hover:bg-warning/90 hover:shadow-soft",
        destructive:
          "bg-destructive text-destructive-foreground shadow-card hover:bg-destructive/90 hover:shadow-soft",
        outline:
          "border border-input bg-card shadow-xs hover:border-primary/60 hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-11 px-5 py-2 [&_svg]:size-4",
        sm: "h-9 rounded-md px-3 [&_svg]:size-4",
        lg: "h-14 rounded-lg px-8 text-base [&_svg]:size-5",
        xl: "h-16 rounded-lg px-8 text-lg [&_svg]:size-6",
        icon: "h-11 w-11 [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Estado de carregamento: mostra um spinner inline no próprio botão e o
   * desabilita (nunca trava a tela). Opt-in e retrocompatível — não afeta
   * botões que já tratam o próprio spinner manualmente. Ignorado com asChild.
   */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
