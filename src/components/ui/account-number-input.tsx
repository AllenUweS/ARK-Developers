import * as React from "react";
import { Input } from "@/components/ui/input";
import { sanitizeAccountNumber, getAccountNumberValidationError, isValidAccountNumber } from "@/lib/formValidation";
import { Landmark } from "lucide-react";

export interface AccountNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
  showErrorText?: boolean;
}

export const AccountNumberInput = React.forwardRef<HTMLInputElement, AccountNumberInputProps>(
  ({ value, onChange, error, showErrorText = true, className, required, ...props }, ref) => {
    const cleanVal = sanitizeAccountNumber(value || "");
    const validationError =
      error ?? (cleanVal.length > 0 && cleanVal.length < 9 ? getAccountNumberValidationError(cleanVal, required) : null);
    const isValid = isValidAccountNumber(cleanVal);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const sanitized = sanitizeAccountNumber(e.target.value);
      onChange(sanitized);
    };

    return (
      <div className="w-full space-y-1">
        <div className="relative flex items-center rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/60 border-r border-input text-muted-foreground select-none pointer-events-none shrink-0">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">A/C</span>
          </div>

          <Input
            {...props}
            ref={ref}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={18}
            placeholder={props.placeholder || "9 to 18-digit account number"}
            value={cleanVal}
            onChange={handleChange}
            className={`border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 h-10 font-mono text-sm tracking-wider placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground/60 ${
              className || ""
            }`}
          />

          <div className="pr-3 text-[10px] font-mono text-muted-foreground select-none shrink-0">
            {isValid ? (
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">✓ {cleanVal.length}d</span>
            ) : cleanVal.length > 0 ? (
              <span className="text-amber-700 dark:text-amber-300 font-medium">{cleanVal.length}/9-18</span>
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

AccountNumberInput.displayName = "AccountNumberInput";
