import { GREYCOAT_ENDPOINT } from "./config";

export const qs = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T | null;

export const qsa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll(sel)) as T[];

export const isEmail = (v: string) => /\S+@\S+/.test(v);
export const isFilled = (v: string) => v.trim().length > 0;

export function validInput(el: HTMLInputElement): boolean {
  return el.type === "email" ? isEmail(el.value) : isFilled(el.value);
}

// ---- Choice pills (single = radio-like, multi = checkbox-like) -------------
export type Choices = Record<string, string | string[]>;

export interface PillsController {
  choices: Choices;
  render: () => void;
}

const CHECK_SVG =
  '<svg class="pill__check" width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function setupPills(root: ParentNode, onChange: (key: string) => void): PillsController {
  const choices: Choices = {};

  qsa<HTMLElement>(".pills", root).forEach((group) => {
    const key = group.dataset.group as string;
    const mode = group.dataset.mode as string; // 'single' | 'multi'
    const exclusive = group.dataset.exclusive; // e.g. 'None' — clears the rest
    choices[key] = mode === "single" ? "" : [];

    (group.dataset.options as string).split("|").forEach((label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pill";
      const mark = mode === "multi" ? `<span class="pill__mark">${CHECK_SVG}</span>` : "";
      b.innerHTML = mark + '<span class="pill__label"></span>';
      (b.querySelector(".pill__label") as HTMLElement).textContent = label; // decodes &lt; etc.
      b.addEventListener("click", () => {
        if (mode === "single") {
          choices[key] = choices[key] === label ? "" : label;
        } else {
          let arr = choices[key] as string[];
          if (exclusive && label === exclusive) {
            choices[key] = arr.indexOf(exclusive) > -1 ? [] : [exclusive];
          } else {
            arr = arr.filter((x) => x !== exclusive);
            const i = arr.indexOf(label);
            if (i > -1) arr.splice(i, 1);
            else arr.push(label);
            choices[key] = arr;
          }
        }
        render();
        onChange(key);
      });
      group.appendChild(b);
    });
  });

  function render() {
    qsa<HTMLElement>(".pills", root).forEach((group) => {
      const key = group.dataset.group as string;
      const mode = group.dataset.mode as string;
      const val = choices[key];
      qsa<HTMLButtonElement>(".pill", group).forEach((b) => {
        const label = (b.querySelector(".pill__label") as HTMLElement).textContent ?? "";
        const on = mode === "single" ? val === label : (val as string[]).indexOf(label) > -1;
        b.classList.toggle("is-selected", on);
      });
    });
  }

  return { choices, render };
}

// ---- Live valid-field checks (green tick) ----------------------------------
export function setupInputChecks(root: ParentNode, onChange: () => void) {
  qsa<HTMLElement>(".input-wrap[data-check]", root).forEach((w) => {
    const input = w.querySelector(".input") as HTMLInputElement;
    input.addEventListener("input", () => {
      w.classList.toggle("is-valid", validInput(input));
      input.classList.remove("is-invalid");
      onChange();
    });
  });
}

// ---- "Other" free-text merge -----------------------------------------------
// Replaces the bare "Other" choice with "Other: <text>" when a value was typed.
export function withOther(arr: string[], otherInput: HTMLInputElement | null): string[] {
  const t = otherInput?.value.trim();
  if (!t) return arr;
  return arr.map((x) => (x === "Other" ? "Other: " + t : x));
}

// ---- Submit ----------------------------------------------------------------
// POSTs to the Apps Script web app. text/plain avoids a CORS preflight; the
// script replies { ok: true } or { ok: false, error }.
export async function submitLead(type: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(GREYCOAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ type, ...payload }),
  });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!data || !data.ok) throw new Error(data?.error || "Submission failed");
}
