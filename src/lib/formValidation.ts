/**
 * Enterprise Form Validation & Sanitization Suite
 * Standardizes validation for Phone, Bank Account, IFSC, PAN, Aadhaar, Email, and Numeric inputs.
 */

// ----------------------------------------------------------------------
// 1. PHONE NUMBER (Strict 10-Digit Indian Mobile Number)
// ----------------------------------------------------------------------

/**
 * Sanitizes phone input:
 * - Strips all non-digit characters.
 * - Strips leading country code 91 if 12 digits entered (e.g. 919876543210 -> 9876543210).
 * - Strips leading 0 if 11 digits entered (e.g. 09876543210 -> 9876543210).
 * - Caps at exactly 10 digits.
 */
export function sanitizePhoneInput(input: string | null | undefined): string {
  if (!input) return "";
  let digits = String(input).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/**
 * Checks if phone is a valid 10-digit mobile number starting with 6, 7, 8, or 9.
 */
export function isValid10DigitPhone(input: string | null | undefined): boolean {
  const digits = sanitizePhoneInput(input);
  return /^[6-9]\d{9}$/.test(digits);
}

/**
 * Returns a human-friendly validation error or null if valid.
 */
export function getPhoneValidationError(input: string | null | undefined, required = true): string | null {
  if (!input || input.trim() === "") {
    return required ? "Mobile number is required." : null;
  }
  const digits = sanitizePhoneInput(input);
  if (digits.length === 0) {
    return "Please enter a valid mobile number.";
  }
  if (!/^[6-9]/.test(digits)) {
    return "Mobile number must start with 6, 7, 8, or 9.";
  }
  if (digits.length < 10) {
    return `Mobile number must be 10 digits (${digits.length}/10 entered).`;
  }
  return null;
}

export function toE164Phone(input: string | null | undefined): string {
  const digits = sanitizePhoneInput(input);
  return digits ? `+91${digits}` : "";
}

export function fromE164Phone(input: string | null | undefined): string {
  return sanitizePhoneInput(input);
}

// ----------------------------------------------------------------------
// 2. BANK ACCOUNT NUMBER (9 to 18 Digits)
// ----------------------------------------------------------------------

/**
 * Sanitizes bank account number:
 * - Strips all non-digit characters.
 * - Limits to maximum 18 digits.
 */
export function sanitizeAccountNumber(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).replace(/\D/g, "").slice(0, 18);
}

/**
 * Validates bank account number (must be between 9 and 18 digits).
 */
export function isValidAccountNumber(input: string | null | undefined): boolean {
  const digits = sanitizeAccountNumber(input);
  return /^\d{9,18}$/.test(digits);
}

export function getAccountNumberValidationError(input: string | null | undefined, required = true): string | null {
  if (!input || input.trim() === "") {
    return required ? "Bank account number is required." : null;
  }
  const digits = sanitizeAccountNumber(input);
  if (digits.length < 9) {
    return `Account number is too short (${digits.length} digits, minimum 9 required).`;
  }
  if (digits.length > 18) {
    return "Account number cannot exceed 18 digits.";
  }
  return null;
}

// ----------------------------------------------------------------------
// 3. IFSC CODE (11 Characters: 4 Letters, '0', 6 Alphanumeric)
// ----------------------------------------------------------------------

/**
 * Sanitizes IFSC code:
 * - Converts to uppercase.
 * - Strips non-alphanumeric characters.
 * - Caps at 11 characters.
 */
export function sanitizeIfscCode(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
}

/**
 * Checks standard Indian IFSC code format (e.g. HDFC0001234, SBIN0000456).
 */
export function isValidIfscCode(input: string | null | undefined): boolean {
  const ifsc = sanitizeIfscCode(input);
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
}

export function getIfscValidationError(input: string | null | undefined, required = true): string | null {
  if (!input || input.trim() === "") {
    return required ? "IFSC Code is required." : null;
  }
  const ifsc = sanitizeIfscCode(input);
  if (ifsc.length < 11) {
    return `IFSC code must be 11 characters (${ifsc.length}/11 entered).`;
  }
  if (!/^[A-Z]{4}/.test(ifsc)) {
    return "First 4 characters of IFSC must be alphabetic bank code.";
  }
  if (ifsc[4] !== "0") {
    return "5th character of IFSC must be '0'.";
  }
  if (!isValidIfscCode(ifsc)) {
    return "Invalid IFSC format (e.g. HDFC0001234).";
  }
  return null;
}

// ----------------------------------------------------------------------
// 4. PAN NUMBER (10 Characters: 5 Letters, 4 Digits, 1 Letter)
// ----------------------------------------------------------------------

export function sanitizePanNumber(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function isValidPanNumber(input: string | null | undefined): boolean {
  const pan = sanitizePanNumber(input);
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
}

export function getPanValidationError(input: string | null | undefined, required = false): string | null {
  if (!input || input.trim() === "") {
    return required ? "PAN number is required." : null;
  }
  const pan = sanitizePanNumber(input);
  if (pan.length < 10) {
    return `PAN must be 10 characters (${pan.length}/10 entered).`;
  }
  if (!isValidPanNumber(pan)) {
    return "Invalid PAN format (expected e.g. ABCDE1234F).";
  }
  return null;
}

// ----------------------------------------------------------------------
// 5. AADHAAR NUMBER (12 Digits)
// ----------------------------------------------------------------------

export function sanitizeAadhaarNumber(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).replace(/\D/g, "").slice(0, 12);
}

export function isValidAadhaarNumber(input: string | null | undefined): boolean {
  const aadhaar = sanitizeAadhaarNumber(input);
  return /^\d{12}$/.test(aadhaar);
}

export function getAadhaarValidationError(input: string | null | undefined, required = false): string | null {
  if (!input || input.trim() === "") {
    return required ? "Aadhaar number is required." : null;
  }
  const aadhaar = sanitizeAadhaarNumber(input);
  if (aadhaar.length < 12) {
    return `Aadhaar must be 12 digits (${aadhaar.length}/12 entered).`;
  }
  return null;
}

// ----------------------------------------------------------------------
// 6. EMAIL ADDRESS
// ----------------------------------------------------------------------

export function isValidEmail(input: string | null | undefined): boolean {
  if (!input || input.trim() === "") return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input.trim());
}

export function getEmailValidationError(input: string | null | undefined, required = false): string | null {
  if (!input || input.trim() === "") {
    return required ? "Email address is required." : null;
  }
  if (!isValidEmail(input)) {
    return "Please enter a valid email address (e.g. name@domain.com).";
  }
  return null;
}

// ----------------------------------------------------------------------
// 7. NUMERIC & INDIAN CURRENCY ENFORCEMENT
// ----------------------------------------------------------------------

export function sanitizePositiveNumber(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  const num = typeof input === "number" ? input : parseFloat(String(input).replace(/,/g, ""));
  return isNaN(num) || num < 0 ? 0 : num;
}

export function sanitizePercentage(input: string | number | null | undefined): number {
  const num = sanitizePositiveNumber(input);
  return Math.min(100, Math.max(0, num));
}

/**
 * Formats a raw number string or number into Indian Currency format (e.g. 1000000 -> 10,00,000).
 */
export function formatIndianCurrency(input: string | number | null | undefined): string {
  if (input === null || input === undefined || input === "") return "";
  const str = String(input);
  const cleanDigits = str.replace(/[^0-9.]/g, "");
  if (!cleanDigits) return "";

  // Split into integer and decimal parts
  const parts = cleanDigits.split(".");
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? `.${parts[1].slice(0, 2)}` : "";

  if (!integerPart) return decimalPart ? `0${decimalPart}` : "";

  const num = parseInt(integerPart, 10);
  if (isNaN(num)) return "";

  return `${num.toLocaleString("en-IN")}${decimalPart}`;
}

/**
 * Strips formatting/commas and returns pure integer/float number.
 */
export function parseIndianCurrency(input: string | number | null | undefined): number {
  return sanitizePositiveNumber(input);
}

/**
 * Converts numeric amount to human-readable Indian denomination (e.g. 50,000 -> "50 Thousand", 10,00,000 -> "10 Lakhs", 1,50,00,000 -> "1.5 Crores").
 */
export function numberToIndianWords(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return "";
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    const lk = amount / 100000;
    return `${lk % 1 === 0 ? lk.toFixed(0) : lk.toFixed(2)} L`;
  }
  if (amount >= 1000) {
    const k = amount / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

