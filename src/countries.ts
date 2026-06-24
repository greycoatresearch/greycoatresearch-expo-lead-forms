import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

export interface Country {
  iso: CountryCode;
  name: string;
  dial: string; // calling code without the leading '+'
  flag: string;
}

// Visitors most likely at a Singapore pet expo, pinned to the top of the country
// picker (host country first, then nearby Asia-Pacific). Edit freely — anything
// not listed here still appears under "All countries" and is searchable.
export const SUGGESTED_ISO: CountryCode[] = [
  "SG",
  "MY",
  "ID",
  "TH",
  "PH",
  "VN",
  "HK",
  "TW",
  "CN",
  "JP",
  "KR",
  "IN",
  "AU",
  "NZ",
];

export const DEFAULT_ISO: CountryCode = "SG";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

// ISO 3166-1 alpha-2 -> 🇸🇬 (two regional-indicator symbols).
function flagOf(iso: string): string {
  return iso.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function nameOf(iso: CountryCode): string | undefined {
  try {
    const n = regionNames.of(iso);
    // Intl echoes the code back when it has no localized name — treat as unknown.
    return n && n !== iso ? n : undefined;
  } catch {
    return undefined;
  }
}

// Every dialable country libphonenumber knows about, with an English name + flag.
export const COUNTRIES: Country[] = getCountries()
  .map((iso): Country | undefined => {
    const name = nameOf(iso);
    if (!name) return undefined;
    return { iso, name, dial: getCountryCallingCode(iso), flag: flagOf(iso) };
  })
  .filter((c): c is Country => c !== undefined);

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));

export function byIso(iso: string): Country | undefined {
  return BY_ISO.get(iso as CountryCode);
}

const suggestedSet = new Set<CountryCode>(SUGGESTED_ISO);

// Curated order, suggested first.
export const SUGGESTED: Country[] = SUGGESTED_ISO.map((iso) => BY_ISO.get(iso)).filter(
  (c): c is Country => c !== undefined,
);

// Everyone else, alphabetical.
export const OTHERS: Country[] = COUNTRIES.filter((c) => !suggestedSet.has(c.iso)).sort((a, b) =>
  a.name.localeCompare(b.name),
);

// "en-SG" -> "SG", "zh-Hant-TW" -> "TW", bare "en" -> undefined.
function regionFromLocale(tag: string): CountryCode | undefined {
  try {
    const region = new Intl.Locale(tag).region;
    return region ? (region.toUpperCase() as CountryCode) : undefined;
  } catch {
    const m = /[-_]([A-Za-z]{2})(?:[-_]|$)/.exec(tag);
    return m ? (m[1].toUpperCase() as CountryCode) : undefined;
  }
}

// Best-effort country guess from the browser — purely client-side, no network:
// the region subtag of the visitor's preferred languages. Returns a known country
// or undefined when there's no confident signal (e.g. a bare "en"). Used only to
// pin a suggestion to the top of the picker — never to override the SG default.
export function detectCountry(): CountryCode | undefined {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of langs) {
    const region = regionFromLocale(tag);
    if (region && BY_ISO.has(region)) return region;
  }
  return undefined;
}
