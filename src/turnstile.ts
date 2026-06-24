import { TURNSTILE_SITE_KEY } from "./config";

// Cloudflare Turnstile, tuned to stay out of the way of genuine visitors:
//   appearance: "interaction-only" — the widget stays hidden unless an
//     interactive challenge is genuinely required, so most visitors see nothing.
//   execution:  "execute"          — the check is deferred until the visitor
//     submits, so nothing runs on page load and the token can't expire while a
//     long form is being filled.
// The token rides with the form submission to the Apps Script backend, which
// verifies it against Cloudflare siteverify and rejects on failure. siteverify is
// never called from the browser. See getTurnstileToken().

interface RenderOptions {
  sitekey: string;
  action?: string;
  appearance?: "always" | "execute" | "interaction-only";
  execution?: "render" | "execute";
  size?: "normal" | "flexible" | "compact";
  "refresh-expired"?: "auto" | "manual" | "never";
  callback?: (token: string) => void;
  "error-callback"?: (code?: string) => void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
  "before-interactive-callback"?: () => void;
  "after-interactive-callback"?: () => void;
}

interface TurnstileApi {
  render(container: string | HTMLElement, opts: RenderOptions): string;
  execute(widget: string | HTMLElement, opts?: RenderOptions): void;
  reset(widget?: string | HTMLElement): void;
  remove(widget?: string | HTMLElement): void;
  getResponse(widget?: string | HTMLElement): string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptReady: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;
let widgetId: string | null = null;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;

// The api.js is loaded by a <script> tag in the page; we just wait for the global
// to appear. Polling is Cloudflare's documented fallback when the script has no
// ?onload= callback. Times out so a missing/blocked script rejects (surfacing as
// a submit error) rather than hanging the submit forever.
function apiReady(): Promise<void> {
  if (scriptReady) return scriptReady;
  scriptReady = new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    let waited = 0;
    const iv = setInterval(() => {
      if (window.turnstile) {
        clearInterval(iv);
        resolve();
      } else if ((waited += 50) >= 10000) {
        clearInterval(iv);
        reject(new Error("Turnstile script did not load"));
      }
    }, 50);
  });
  return scriptReady;
}

// Renders the (hidden) widget. Safe to call once on page load; no-ops without a
// configured site key so the form still works in local dev.
export function initTurnstile(container: HTMLElement): Promise<void> {
  if (!TURNSTILE_SITE_KEY) return Promise.resolve();
  if (initPromise) return initPromise;
  const settle = (t: string | null, err?: Error) => {
    container.classList.remove("is-active");
    if (err) pending?.reject(err);
    else if (t !== null) pending?.resolve(t);
    pending = null;
  };
  initPromise = (async () => {
    await apiReady();
    widgetId = window.turnstile!.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      action: "turnstile-spin-v1",
      appearance: "interaction-only",
      execution: "execute",
      "refresh-expired": "auto",
      callback: (token) => settle(token),
      "error-callback": () => settle(null, new Error("Turnstile check failed")),
      "timeout-callback": () => settle(null, new Error("Turnstile timed out")),
      "expired-callback": () => {
        if (widgetId) window.turnstile?.reset(widgetId);
      },
      // Add spacing only while an interactive challenge is actually on screen
      // (the rare case); the container stays gap-free when invisible.
      "before-interactive-callback": () => container.classList.add("is-active"),
      "after-interactive-callback": () => container.classList.remove("is-active"),
    });
  })();
  return initPromise;
}

// Runs the (usually invisible) challenge and resolves with a fresh single-use
// token to attach to the form submission. Resolves "" when Turnstile is disabled
// (no site key). Rejects if the widget errors or times out, so the submit handler
// surfaces the failure rather than POSTing a tokenless payload the backend will
// reject anyway.
export function getTurnstileToken(): Promise<string> {
  if (!TURNSTILE_SITE_KEY) return Promise.resolve("");
  return (async () => {
    if (initPromise) await initPromise;
    const t = window.turnstile;
    if (!t || widgetId === null) return "";
    t.reset(widgetId);
    return new Promise<string>((resolve, reject) => {
      pending = { resolve, reject };
      t.execute(widgetId!);
    });
  })();
}
