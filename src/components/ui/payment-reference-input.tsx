import * as React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle, QrCode, FileText, Landmark, Banknote } from "lucide-react";

export interface PaymentReferenceInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  method: string; // "UPI" | "Cheque" | "Bank transfer" | "Cash" | string
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  showErrorText?: boolean;
}

export function validatePaymentReference(method: string, value: string): { isValid: boolean; error?: string } {
  const trimmed = (value || "").trim();
  const m = (method || "UPI").toLowerCase();

  if (!trimmed) {
    return { isValid: false, error: "Reference number is required." };
  }

  if (m.includes("upi")) {
    const rawDigits = trimmed.replace(/[^0-9]/g, "");
    if (rawDigits.length === 12) {
      return { isValid: true };
    }
    // Allow alphanumeric UPI transaction refs if >= 12 chars
    if (trimmed.length >= 12) {
      return { isValid: true };
    }
    return {
      isValid: false,
      error: `UPI Reference / UTR must be 12 digits (currently ${rawDigits.length}/12).`,
    };
  }

  if (m.includes("cheque")) {
    // Check if contains 6 digit cheque number
    const sixDigits = trimmed.match(/\b\d{6}\b/) || trimmed.replace(/[^0-9]/g, "");
    const digitCount = typeof sixDigits === "string" ? sixDigits.length : (sixDigits?.[0]?.length || 0);
    if (digitCount === 6 || /^\d{6}/.test(trimmed)) {
      return { isValid: true };
    }
    return {
      isValid: false,
      error: "Cheque number must be strictly 6 numeric digits (e.g. 000124).",
    };
  }

  if (m.includes("bank") || m.includes("transfer") || m.includes("neft") || m.includes("rtgs")) {
    if (trimmed.length >= 8 && trimmed.length <= 25) {
      return { isValid: true };
    }
    return {
      isValid: false,
      error: "Bank UTR / NEFT reference should be 8-22 alphanumeric characters.",
    };
  }

  if (m.includes("cash")) {
    if (trimmed.length >= 2) {
      return { isValid: true };
    }
    return {
      isValid: false,
      error: "Please enter a valid cash voucher or receipt reference.",
    };
  }

  return { isValid: true };
}

export const PaymentReferenceInput = React.forwardRef<HTMLInputElement, PaymentReferenceInputProps>(
  (
    {
      method,
      value,
      onChange,
      error,
      showErrorText = true,
      className,
      placeholder,
      ...props
    },
    ref
  ) => {
    const m = (method || "UPI").toLowerCase();
    const [chequeBank, setChequeBank] = React.useState<string>("");

    // Detect internal Cheque parts if already formatted as "Cheque #000124 (HDFC Bank)"
    React.useEffect(() => {
      if (m.includes("cheque") && value && value.includes("(") && value.includes(")")) {
        const bankMatch = value.match(/\((.*?)\)/);
        if (bankMatch && bankMatch[1]) {
          setChequeBank(bankMatch[1]);
        }
      }
    }, [m, value]);

    const { isValid, error: computedError } = validatePaymentReference(method, value);
    const activeError = error || (!isValid && value ? computedError : null);

    // Method-specific badges and icons
    let badgeText = "UTR / REF";
    let badgeIcon = <Landmark className="h-3 w-3 text-terracotta" />;
    let defaultPlaceholder = "e.g. UTR19827391823";

    if (m.includes("upi")) {
      badgeText = "UPI REF";
      badgeIcon = <QrCode className="h-3 w-3 text-emerald-600" />;
      defaultPlaceholder = "e.g. 4291 0293 8412 (12-digit Ref)";
    } else if (m.includes("cheque")) {
      badgeText = "CHEQUE";
      badgeIcon = <FileText className="h-3 w-3 text-blue-600" />;
      defaultPlaceholder = "e.g. 000124";
    } else if (m.includes("cash")) {
      badgeText = "CASH VCH";
      badgeIcon = <Banknote className="h-3 w-3 text-amber-600" />;
      defaultPlaceholder = "e.g. CR-8912";
    }

    // Handles UPI 4-4-4 spacing formatting
    const getDisplayValue = () => {
      if (!value) return "";
      if (m.includes("upi")) {
        const digits = value.replace(/[^0-9]/g, "");
        if (digits.length <= 12 && /^\d+$/.test(value.replace(/\s/g, ""))) {
          return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
        }
      }
      if (m.includes("cheque")) {
        // Extract 6 digits if formatted
        const sixDigits = value.replace(/[^0-9]/g, "").slice(0, 6);
        if (value.startsWith("Cheque #") || value.includes("(")) {
          return value;
        }
        return sixDigits;
      }
      return value;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      if (m.includes("upi")) {
        const digitsOnly = raw.replace(/[^0-9]/g, "").slice(0, 12);
        // If user is pasting an alphanumeric UPI ref like "UPI/42389/HDFC"
        if (/[a-zA-Z]/.test(raw)) {
          onChange(raw.trim());
        } else {
          onChange(digitsOnly);
        }
      } else if (m.includes("cheque")) {
        const digitsOnly = raw.replace(/[^0-9]/g, "").slice(0, 6);
        if (chequeBank) {
          onChange(`Cheque #${digitsOnly} (${chequeBank})`);
        } else {
          onChange(digitsOnly);
        }
      } else if (m.includes("cash")) {
        onChange(raw.toUpperCase());
      } else {
        // Bank transfer / NEFT / RTGS
        onChange(raw.toUpperCase().replace(/[^A-Z0-9/-]/g, ""));
      }
    };

    const handleBankNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const bankName = e.target.value;
      setChequeBank(bankName);
      const digits = value.replace(/[^0-9]/g, "").slice(0, 6);
      if (bankName.trim()) {
        onChange(`Cheque #${digits || "000000"} (${bankName.trim()})`);
      } else {
        onChange(digits);
      }
    };

    const rawDigits = value.replace(/[^0-9]/g, "");

    return (
      <div className="w-full space-y-1.5 min-w-0">
        <div className="flex gap-2 items-center">
          <div
            className={`relative flex items-center flex-1 rounded-xl border ${
              activeError
                ? "border-destructive focus-within:ring-destructive/30"
                : isValid && value
                ? "border-emerald-500/50 focus-within:ring-emerald-500/20"
                : "border-input"
            } bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all overflow-hidden`}
          >
            {/* Prefix Badge */}
            <div className="flex items-center gap-1 px-2.5 py-2 bg-muted/60 border-r border-input text-muted-foreground select-none pointer-events-none shrink-0">
              {badgeIcon}
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-foreground">
                {badgeText}
              </span>
            </div>

            {/* Input field */}
            <Input
              {...props}
              ref={ref}
              type="text"
              placeholder={placeholder || defaultPlaceholder}
              value={getDisplayValue()}
              onChange={handleInputChange}
              maxLength={m.includes("cheque") ? 35 : m.includes("upi") ? 14 : 30}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2.5 font-mono text-xs sm:text-[13px] tracking-wide placeholder:font-sans placeholder:tracking-normal h-9 bg-transparent w-full"
            />

            {/* Trailing Counter & Status Icon */}
            <div className="flex items-center gap-1.5 pr-2.5 shrink-0 pointer-events-none select-none">
              {m.includes("upi") && (
                <span
                  className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                    rawDigits.length === 12
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {rawDigits.length}/12
                </span>
              )}

              {m.includes("cheque") && (
                <span
                  className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                    rawDigits.slice(0, 6).length === 6
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {rawDigits.slice(0, 6).length}/6
                </span>
              )}

              {value && (
                <>
                  {isValid ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                </>
              )}
            </div>
          </div>

          {/* If Cheque, show complementary Issuing Bank field */}
          {m.includes("cheque") && (
            <div className="w-1/3 min-w-[130px]">
              <Input
                type="text"
                placeholder="Issuing Bank (e.g. HDFC)"
                value={chequeBank}
                onChange={handleBankNameChange}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          )}
        </div>

        {/* Real-time Validation Error / Hint */}
        {showErrorText && activeError && (
          <p className="text-[11px] font-medium text-destructive flex items-center gap-1 pt-0.5">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>{activeError}</span>
          </p>
        )}
      </div>
    );
  }
);

PaymentReferenceInput.displayName = "PaymentReferenceInput";
