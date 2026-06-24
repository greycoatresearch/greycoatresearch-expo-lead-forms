import { TURNSTILE_SITE_KEY } from "./config";

// Cloudflare Turnstile, tuned to stay out of the way of genuine visitors:
//   appearance: "interaction-only" — the widget stays hidden unless an
//     interactive challenge is genuinely required, so most visitors see nothing.
//   execution:  "render"           — the check runs on page load, so a suspicious
//     visitor who must solve an interactive challenge sees it up front instead of
//     being ambushed at submit. refresh-expired:"auto" keeps the token fresh
//     through a long form.
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
let currentToken = "";
let tokenSpent = false;
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
  const settle = (token: string | null, err?: Error) => {
    container.classList.remove("is-active");
    if (err) {
      currentToken = "";
      pending?.reject(err);
    } else if (token !== null) {
      currentToken = token;
      tokenSpent = false;
      pending?.resolve(token);
    }
    pending = null;
  };
  initPromise = (async () => {
    await apiReady();
    widgetId = window.turnstile!.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      action: "turnstile-spin-v1",
      appearance: "interaction-only",
      execution: "render",
      "refresh-expired": "auto",
      callback: (token) => settle(token),
      "error-callback": () => settle(null, new Error("Turnstile check failed")),
      "timeout-callback": () => settle(null, new Error("Turnstile timed out")),
      // refresh-expired:"auto" re-runs and fires callback() again with a fresh token.
      "expired-callback": () => {
        currentToken = "";
      },
      // Add spacing only while an interactive challenge is actually on screen
      // (the rare case); the container stays gap-free when invisible.
      "before-interactive-callback": () => container.classList.add("is-active"),
      "after-interactive-callback": () => container.classList.remove("is-active"),
    });
  })();
  return initPromise;
}

// Returns the token to attach to the form submission. With execution:"render" the
// challenge already ran on page load, so a token is usually waiting; if it's still
// solving (or refreshing after expiry) we wait for the callback. Resolves "" when
// Turnstile is disabled (no site key); rejects if the widget errors or times out
// so the submit handler surfaces the failure instead of POSTing a tokenless
// payload the backend would reject anyway.
export function getTurnstileToken(): Promise<string> {
  if (!TURNSTILE_SITE_KEY) return Promise.resolve("");
  return (async () => {
    if (initPromise) await initPromise;
    if (widgetId === null) return "";
    // A previous submit already used the last token (they're single-use). Reset
    // to fetch a fresh one; reset re-runs the (usually invisible) check.
    if (tokenSpent) {
      currentToken = "";
      tokenSpent = false;
      window.turnstile?.reset(widgetId);
    }
    const token = currentToken
      || (await new Promise<string>((resolve, reject) => {
        pending = { resolve, reject };
      }));
    tokenSpent = true;
    return token;
  })();
}
