/**
 * Utility for phone number formatting and strict 10-digit validation rules.
 */

/**
 * Sanitizes phone input:
 * - Strips all non-digit characters.
 * - If country code +91 or 91 was entered (12 digits starting with 91), strips 91.
 * - If leading 0 was entered (11 digits starting with 0), strips 0.
 * - Caps final length at 10 digits.
 */
export function sanitizePhoneInput(input: string): string {
  if (!input) return "";
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/**
 * Checks if phone number is a valid 10-digit mobile number.
 * Validates strictly that length is 10 digits and starts with 6, 7, 8, or 9.
 */
export function isValid10DigitPhone(input: string): boolean {
  const digits = sanitizePhoneInput(input);
  return /^[6-9]\d{9}$/.test(digits);
}

/**
 * Returns an error message string if the phone number is invalid, or null if valid.
 */
export function getPhoneValidationError(input: string): string | null {
  if (!input || input.trim() === "") {
    return "Phone number is required.";
  }
  const digits = sanitizePhoneInput(input);
  if (digits.length === 0) {
    return "Please enter a valid phone number.";
  }
  if (!/^[6-9]/.test(digits)) {
    return "Mobile number must start with 6, 7, 8, or 9.";
  }
  if (digits.length < 10) {
    return `Mobile number must be 10 digits (${digits.length}/10 entered).`;
  }
  return null;
}

/**
 * Attaches +91 to 10-digit number internally for database storage, WhatsApp API, or messaging.
 */
export function toE164Phone(input: string): string {
  const digits = sanitizePhoneInput(input);
  return digits ? `+91${digits}` : "";
}

/**
 * Strips +91 prefix when reading from DB so UI displays only the clean 10-digit number.
 */
export function fromE164Phone(input: string): string {
  return sanitizePhoneInput(input);
}


