import * as React from "react";
import { Input } from "@/components/ui/input";
import { sanitizePhoneInput, getPhoneValidationError } from "@/lib/phoneValidation";
import { Phone } from "lucide-react";

export interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
  showErrorText?: boolean;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, error, showErrorText = true, className, ...props }, ref) => {
    const cleanVal = sanitizePhoneInput(value || "");
    const validationError = error ?? (cleanVal.length > 0 && cleanVal.length < 10 ? getPhoneValidationError(cleanVal) : null);
    const hasError = Boolean(validationError);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const sanitized = sanitizePhoneInput(e.target.value);
      onChange(sanitized);
    };

    return (
      <div className="w-full space-y-1">
        <div className="relative flex items-center rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all overflow-hidden">
          {/* Static +91 Country Code Badge */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/60 border-r border-input text-muted-foreground select-none pointer-events-none shrink-0">
            <span className="text-xs font-bold text-foreground tracking-tight">🇮🇳 +91</span>
          </div>

          {/* 10-Digit Phone Input Field */}
          <Input
            {...props}
            ref={ref}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            placeholder={props.placeholder || "98765 43210"}
            value={cleanVal}
            onChange={handleChange}
            className={`border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 h-10 font-mono text-sm tracking-wider placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground/60 ${className || ""}`}
          />

          {/* 10-digit Completion Indicator */}
          <div className="pr-3 text-[10px] font-mono text-muted-foreground select-none shrink-0">
            {cleanVal.length === 10 ? (
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">✓ 10/10</span>
            ) : cleanVal.length > 0 ? (
              <span className="text-amber-700 dark:text-amber-300">{cleanVal.length}/10</span>
            ) : null}
          </div>
        </div>

        {showErrorText && validationError && (
          <p className="text-[11px] text-destructive font-medium leading-none px-0.5">
            {validationError}
          </p>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = "PhoneInput";
