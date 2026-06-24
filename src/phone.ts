import { AsYouType, isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

// Format the national-format phone field as the user types, for the selected
// country (e.g. "91234567" -> "9123 4567" for SG).
export function formatAsYouType(value: string, iso: CountryCode): string {
  return new AsYouType(iso).input(value);
}

// WhatsApp is optional: an empty value is "valid". A filled value must parse to a
// valid number for the selected country.
export function isPhoneValid(value: string, iso: CountryCode): boolean {
  if (!value.trim()) return true;
  try {
    return isValidPhoneNumber(value, iso);
  } catch {
    return false;
  }
}

// E.164 ("+6591234567") for the payload, or "" when empty / unparseable.
export function toE164(value: string, iso: CountryCode): string {
  if (!value.trim()) return "";
  try {
    return parsePhoneNumber(value, iso).number;
  } catch {
    return "";
  }
}
