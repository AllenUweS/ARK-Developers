import * as React from "react";
import { Input } from "@/components/ui/input";
import { sanitizeIfscCode, getIfscValidationError, isValidIfscCode } from "@/lib/formValidation";
import { ShieldCheck } from "lucide-react";

export interface IfscInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
  showErrorText?: boolean;
}

export const IfscInput = React.forwardRef<HTMLInputElement, IfscInputProps>(
  ({ value, onChange, error, showErrorText = true, className, required, ...props }, ref) => {
    const cleanVal = sanitizeIfscCode(value || "");
    const validationError =
      error ?? (cleanVal.length > 0 && cleanVal.length < 11 ? getIfscValidationError(cleanVal, required) : null);
    const isValid = isValidIfscCode(cleanVal);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const sanitized = sanitizeIfscCode(e.target.value);
      onChange(sanitized);
    };

    return (
      <div className="w-full space-y-1">
        <div className="relative flex items-center rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/60 border-r border-input text-muted-foreground select-none pointer-events-none shrink-0">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">IFSC</span>
          </div>

          <Input
            {...props}
            ref={ref}
            type="text"
            maxLength={11}
            placeholder={props.placeholder || "HDFC0001234"}
            value={cleanVal}
            onChange={handleChange}
            className={`border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 h-10 font-mono text-sm uppercase tracking-wider placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground/60 ${
              className || ""
            }`}
          />

          <div className="pr-3 text-[10px] font-mono text-muted-foreground select-none shrink-0">
            {isValid ? (
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">✓ Valid</span>
            ) : cleanVal.length > 0 ? (
              <span className="text-amber-700 dark:text-amber-300 font-medium">{cleanVal.length}/11</span>
            ) : null}
          </div>
        </div>

        {showErrorText && validationError && (
          <p className="text-[11px] text-destructive font-medium leading-none px-0.5">{validationError}</p>
        )}
      </div>
    );
  }
);

IfscInput.displayName = "IfscInput";
