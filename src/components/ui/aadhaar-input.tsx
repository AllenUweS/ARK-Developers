import * as React from "react";
import { Input } from "@/components/ui/input";
import { sanitizeAadhaarNumber, isValidAadhaarNumber, getAadhaarValidationError } from "@/lib/formValidation";
import { CreditCard, Check, AlertCircle } from "lucide-react";

export interface AadhaarInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  showErrorText?: boolean;
  required?: boolean;
}

export const AadhaarInput = React.forwardRef<HTMLInputElement, AadhaarInputProps>(
  (
    {
      value,
      onChange,
      error,
      showErrorText = true,
      required = false,
      className,
      placeholder = "XXXX XXXX XXXX",
      ...props
    },
    ref
  ) => {
    const cleanAadhaar = sanitizeAadhaarNumber(value);
    const isValid = isValidAadhaarNumber(cleanAadhaar);
    const validationError = error || getAadhaarValidationError(cleanAadhaar, false);

    // Format with spaces every 4 digits: "XXXX XXXX XXXX"
    const formattedDisplay = cleanAadhaar.replace(/(\d{4})(?=\d)/g, "$1 ");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawInput = e.target.value;
      const stripped = sanitizeAadhaarNumber(rawInput);
      onChange(stripped);
    };

    return (
      <div className="w-full space-y-1 min-w-0">
        <div className="relative flex items-center rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all overflow-hidden w-full">
          {/* Badge */}
          <div className="flex items-center gap-1 px-2.5 py-2 bg-muted/60 border-r border-input text-muted-foreground select-none pointer-events-none shrink-0">
            <CreditCard className="h-3 w-3 text-terracotta" />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground">UIDAI</span>
          </div>

          <Input
            {...props}
            ref={ref}
            type="text"
            inputMode="numeric"
            pattern="[0-9 ]*"
            maxLength={14} // 12 digits + 2 spaces
            placeholder={placeholder}
            value={formattedDisplay}
            onChange={handleChange}
            className={`border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 h-9.5 font-mono text-xs sm:text-[13px] font-semibold min-w-0 flex-1 placeholder:font-sans placeholder:text-muted-foreground/60 ${
              className || ""
            }`}
          />

          {/* Real-time Status Badge */}
          <div className="pr-2 select-none shrink-0 pointer-events-none">
            {isValid ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <Check className="h-2.5 w-2.5" /> 12/12
              </span>
            ) : cleanAadhaar.length > 0 ? (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-mono">
                {cleanAadhaar.length}/12
              </span>
            ) : null}
          </div>
        </div>

        {showErrorText && validationError && (
          <p className="text-[11px] text-destructive font-medium leading-none px-0.5 flex items-center gap-1">
            <AlertCircle className="h-3 w-3 inline shrink-0" /> {validationError}
          </p>
        )}
      </div>
    );
  }
);

AadhaarInput.displayName = "AadhaarInput";
