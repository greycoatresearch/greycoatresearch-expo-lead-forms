import posthog from "posthog-js";

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  defaults: "2026-05-30",
});

export default posthog;
