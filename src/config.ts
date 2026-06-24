// Lead submissions POST here. This is the deployed Google Apps Script web-app
// (/exec) endpoint backing the booth's Google Sheet. It is a public client-side
// URL (not a secret).
export const GREYCOAT_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzU3qHkXBpPDPVXV7MeKtlcFjdoCmxr0ZNeVRLMqFHzti942BM5-xXrEsYqiXPnFLLYZw/exec";

// Cloudflare Turnstile public site key (not a secret). The widget is configured
// to stay invisible for genuine visitors (see turnstile.ts); the token rides with
// the form submission and is verified server-side by the Apps Script backend
// against the matching SECRET, which never reaches the browser.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY;
