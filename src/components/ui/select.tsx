import * as React from "react";
import { cn } from "@/lib/utils";
import { inputClassName } from "@/components/ui/input";

// Select nativo com o mesmo acabamento do Input (UX-05). Nativo de propósito:
// no celular/tablet abre o seletor do sistema, que é o mais acessível.
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(inputClassName, className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";
