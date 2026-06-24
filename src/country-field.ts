import TomSelect from "tom-select";
import type { CountryCode } from "libphonenumber-js";
import { byIso, DEFAULT_ISO, detectCountry, OTHERS, SUGGESTED, type Country } from "./countries";

export interface CountryField {
  getIso: () => CountryCode;
  getCountry: () => Country;
  setInvalid: (bad: boolean) => void;
}

interface InitOpts {
  select: HTMLSelectElement;
  // Read-only "+65" chip next to the phone input; updated when the country changes.
  dialPrefixEl: HTMLElement;
  onChange?: (c: Country) => void;
}

// A searchable country combobox (Tom Select) over a native <select>. The country
// drives the WhatsApp dial code, shown as a read-only prefix (no separate picker).
export function initCountryField({ select, dialPrefixEl, onChange }: InitOpts): CountryField {
  // Pin the visitor's likely country (from browser language) to the top of the
  // suggested list. SG stays the default selection (the expo venue).
  const detected = detectCountry();
  const pinned = detected && detected !== SUGGESTED[0]?.iso ? byIso(detected) : undefined;
  const suggested = pinned ? [pinned, ...SUGGESTED.filter((c) => c.iso !== pinned.iso)] : SUGGESTED;
  const others = pinned ? OTHERS.filter((c) => c.iso !== pinned.iso) : OTHERS;

  const groups = [
    { label: "Suggested", items: suggested },
    { label: "All countries", items: others },
  ];

  select.innerHTML = "";
  for (const g of groups) {
    const og = document.createElement("optgroup");
    og.label = g.label;
    for (const c of g.items) {
      const o = document.createElement("option");
      o.value = c.iso;
      o.textContent = `${c.name} +${c.dial}`; // search haystack (name + dial)
      og.appendChild(o);
    }
    select.appendChild(og);
  }
  select.value = DEFAULT_ISO;

  let current = byIso(DEFAULT_ISO) as Country;

  const ts = new TomSelect(select, {
    maxOptions: null, // render all ~240 countries, not just the first 50
    hideSelected: false,
    searchField: ["text"],
    render: {
      option: (data: { value: string; text: string }, escape: (s: string) => string) => {
        const c = byIso(data.value);
        if (!c) return `<div>${escape(data.text)}</div>`;
        return `<div class="cc-opt"><span class="cc-flag">${c.flag}</span><span class="cc-name">${escape(c.name)}</span><span class="cc-dial">+${escape(c.dial)}</span></div>`;
      },
      item: (data: { value: string; text: string }, escape: (s: string) => string) => {
        const c = byIso(data.value);
        if (!c) return `<div>${escape(data.text)}</div>`;
        return `<div class="cc-item"><span class="cc-flag">${c.flag}</span><span class="cc-name">${escape(c.name)}</span></div>`;
      },
      optgroup_header: (data: { label: string }, escape: (s: string) => string) =>
        `<div class="cc-group">${escape(data.label)}</div>`,
    },
    onChange: (value: string) => {
      const c = byIso(value);
      if (!c) return;
      current = c;
      dialPrefixEl.textContent = "+" + c.dial;
      setInvalid(false);
      onChange?.(c);
    },
  });

  const wrapper = () => ts.wrapper as HTMLElement;

  function setInvalid(bad: boolean) {
    wrapper().classList.toggle("is-invalid", bad);
  }

  dialPrefixEl.textContent = "+" + current.dial;

  return {
    getIso: () => current.iso,
    getCountry: () => current,
    setInvalid,
  };
}
