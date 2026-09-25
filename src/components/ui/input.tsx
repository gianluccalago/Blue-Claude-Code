import * as React from "react";
import { cn } from "@/lib/utils";

// Campo de texto padrão do app (UX-05: uma só fonte para as classes de input).
// Altura 44px = alvo de toque confortável no tablet; anel de foco no token --ring.
export const inputClassName =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClassName, className)} {...props} />
));
Input.displayName = "Input";
