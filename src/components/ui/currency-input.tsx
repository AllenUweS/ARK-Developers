import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatIndianCurrency, numberToIndianWords, parseIndianCurrency } from "@/lib/formValidation";
import { IndianRupee } from "lucide-react";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string | number | null | undefined;
  onChange: (rawNumericValue: string) => void;
  error?: string | null;
  showErrorText?: boolean;
  showWordsBadge?: boolean;
  prefix?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChange,
      error,
      showErrorText = true,
      showWordsBadge = true,
      prefix = "₹",
      className,
      placeholder = "e.g. 10,00,000",
      ...props
    },
    ref
  ) => {
    const rawVal = value !== null && value !== undefined ? String(value) : "";
    const cleanDigits = rawVal.replace(/[^0-9.]/g, "");
    const formattedDisplay = formatIndianCurrency(cleanDigits);
    const numericAmount = parseIndianCurrency(cleanDigits);
    const wordsLabel = showWordsBadge && numericAmount >= 1000 ? numberToIndianWords(numericAmount) : null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawInput = e.target.value;
      const stripped = rawInput.replace(/[^0-9.]/g, "");
      // Prevent multiple dots
      const parts = stripped.split(".");
      const cleanString = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : stripped;
      onChange(cleanString);
    };

    return (
      <div className="w-full space-y-1">
        <div className="relative flex items-center rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all overflow-hidden">
          {/* Currency Prefix Badge */}
          <div className="flex items-center gap-1 px-3 py-2 bg-muted/60 border-r border-input text-muted-foreground select-none pointer-events-none shrink-0">
            <span className="text-xs font-extrabold text-foreground tracking-tight">{prefix}</span>
          </div>

          {/* Amount Field with live Indian commas */}
          <Input
            {...props}
            ref={ref}
            type="text"
            inputMode="numeric"
            pattern="[0-9,.]*"
            placeholder={placeholder}
            value={formattedDisplay}
            onChange={handleChange}
            className={`border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-3 h-10 font-mono text-sm font-semibold tracking-wide placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground/60 ${
              className || ""
            }`}
          />

          {/* Live Indian Denomination Chip (e.g. 10 L, 1.5 Cr) */}
          {wordsLabel && (
            <div className="pr-3 select-none shrink-0 pointer-events-none">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-terracotta/10 text-terracotta border border-terracotta/20 font-mono">
                {wordsLabel}
              </span>
            </div>
          )}
        </div>

        {showErrorText && error && (
          <p className="text-[11px] text-destructive font-medium leading-none px-0.5">{error}</p>
        )}
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
