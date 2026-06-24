// QR landing page — static routing tiles, no controller logic. Just styles.
import "../styles.css";
import posthog from "../posthog";

document.querySelectorAll<HTMLAnchorElement>(".lp-tile").forEach((tile) => {
  tile.addEventListener("click", () => {
    const href = tile.getAttribute("href") ?? "";
    posthog.capture("landing_tile_clicked", {
      tile_type: href.includes("b2c") ? "b2c" : "b2b",
    });
  });
});
