import "tom-select/dist/css/tom-select.css";
import "../styles.css";
import posthog from "../posthog";
import { initCountryField } from "../country-field";
import { formatAsYouType, isPhoneValid, toE164 } from "../phone";
import {
  isEmail,
  isFilled,
  qs,
  setupInputChecks,
  setupPills,
  submitLead,
  validInput,
  withOther,
} from "../form-kit";
import { getTurnstileToken, initTurnstile } from "../turnstile";

const form = qs<HTMLFormElement>("#form")!;
const thanks = qs<HTMLElement>("#thanks")!;
const formError = qs<HTMLElement>("#formError")!;
const submitBtn = qs<HTMLButtonElement>("#submitBtn")!;

// Cloudflare Turnstile — rendered hidden; the (usually invisible) check runs on submit.
initTurnstile(qs<HTMLElement>("#turnstile")!);

// ---- Country + linked WhatsApp dial prefix ----
const country = initCountryField({
  select: qs<HTMLSelectElement>("#country")!,
  dialPrefixEl: qs("#dial-prefix")!,
});

// ---- Phone (optional; formatted as you type, validated only if filled) ----
const phoneInput = qs<HTMLInputElement>("#phone")!;
phoneInput.addEventListener("input", (e) => {
  const ev = e as InputEvent;
  if (!ev.inputType || !ev.inputType.startsWith("delete")) {
    phoneInput.value = formatAsYouType(phoneInput.value, country.getIso());
  }
  phoneInput.classList.remove("is-invalid");
});

// ---- Choice pills ----
const productOther = qs<HTMLInputElement>("#productOther");
const interestsOther = qs<HTMLInputElement>("#interestsOther");
const sourceOther = qs<HTMLInputElement>("#sourceOther");
const stageField = qs<HTMLElement>("#stageField");

const pills = setupPills(form, (key) => {
  if (key === "diagnosed") syncStageVisibility();
  toggleOther();
  renderBadges();
  if (key === "diagnosed" || key === "stage") {
    const err = qs<HTMLElement>(`[data-error="${key}"]`);
    if (err) err.hidden = !!pills.choices[key];
  }
});

// "What stage is your cat?" only applies once a diagnosis is confirmed ("Yes").
function syncStageVisibility() {
  const show = pills.choices.diagnosed === "Yes";
  if (stageField) stageField.hidden = !show;
  if (!show && pills.choices.stage) {
    pills.choices.stage = ""; // clear a stale stage when it no longer applies
    pills.render();
    const err = qs<HTMLElement>('[data-error="stage"]');
    if (err) err.hidden = true;
  }
}

function toggleOther() {
  if (productOther)
    productOther.hidden = (pills.choices.products as string[]).indexOf("Other") === -1;
  if (interestsOther) {
    interestsOther.hidden = (pills.choices.interests as string[]).indexOf("Other") === -1;
  }
  if (sourceOther) sourceOther.hidden = pills.choices.source !== "Other";
}

// ---- Live checks + section-completion badges ----
setupInputChecks(form, renderBadges);

function renderBadges() {
  const c = pills.choices;
  const done: Record<string, boolean> = {
    "1": validInput(qs<HTMLInputElement>("#name")!) && validInput(qs<HTMLInputElement>("#email")!),
    "2":
      validInput(qs<HTMLInputElement>("#catName")!) && validInput(qs<HTMLInputElement>("#catAge")!),
    "3": !!c.diagnosed && (c.diagnosed !== "Yes" || !!c.stage),
  };
  for (const n of Object.keys(done)) {
    qs(`[data-badge="${n}"]`)?.classList.toggle("badge--done", done[n]);
  }
}

// ---- Consent ----
const consent = qs<HTMLInputElement>("#consent")!;
const consentLabel = consent.closest(".consent") as HTMLElement;
consent.addEventListener("change", () => {
  if (consent.checked) consentLabel.classList.remove("is-invalid");
});

// ---- Submit ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const c = pills.choices;
  const name = qs<HTMLInputElement>("#name")!;
  const email = qs<HTMLInputElement>("#email")!;
  const catName = qs<HTMLInputElement>("#catName")!;
  const catAge = qs<HTMLInputElement>("#catAge")!;

  let ok = true;
  const required: Array<[HTMLInputElement, boolean]> = [
    [name, isFilled(name.value)],
    [email, isEmail(email.value)],
    [catName, isFilled(catName.value)],
    [catAge, isFilled(catAge.value)],
  ];
  for (const [el, good] of required) {
    el.classList.toggle("is-invalid", !good);
    if (!good) ok = false;
  }

  qs<HTMLElement>('[data-error="diagnosed"]')!.hidden = !!c.diagnosed;
  if (!c.diagnosed) ok = false;
  const stageOk = c.diagnosed !== "Yes" || !!c.stage; // stage required only when diagnosed = Yes
  qs<HTMLElement>('[data-error="stage"]')!.hidden = stageOk;
  if (!stageOk) ok = false;

  const phoneOk = isPhoneValid(phoneInput.value, country.getIso());
  phoneInput.classList.toggle("is-invalid", !phoneOk);
  if (!phoneOk) ok = false;

  consentLabel.classList.toggle("is-invalid", !consent.checked);
  if (!consent.checked) ok = false;

  if (!ok) {
    posthog.capture("b2c_form_validation_error");
    formError.textContent = "Please complete the required fields above.";
    formError.hidden = false;
    return;
  }
  formError.hidden = true;

  const cc = country.getCountry();
  const payload = {
    name: name.value.trim(),
    email: email.value.trim(),
    whatsapp: toE164(phoneInput.value, country.getIso()),
    country: cc.name,
    countryCode: cc.iso,
    catName: catName.value.trim(),
    catAge: catAge.value.trim(),
    diagnosed: c.diagnosed as string,
    stage: c.stage as string,
    source:
      c.source === "Other" && sourceOther?.value.trim()
        ? "Other: " + sourceOther.value.trim()
        : (c.source as string),
    currentProducts: withOther(c.products as string[], productOther),
    interests: withOther(c.interests as string[], interestsOther),
    message: qs<HTMLTextAreaElement>("#message")?.value.trim() ?? "",
  };

  const origText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  try {
    const turnstileToken = await getTurnstileToken();
    await submitLead("B2C", { ...payload, turnstileToken });
    posthog.identify(email.value.trim(), {
      email: email.value.trim(),
      name: name.value.trim(),
    });
    posthog.capture("b2c_lead_submitted", {
      diagnosed: payload.diagnosed,
      cat_stage: payload.stage,
      country_code: payload.countryCode,
      has_message: payload.message.length > 0,
    });
    const first = name.value.trim().split(" ")[0] || "";
    const cat = catName.value.trim() || "your cat";
    qs("#thanksText")!.textContent =
      `Thanks${first ? ", " + first : ""}. We've saved ${cat}'s details and our team will follow up.`;
    form.hidden = true;
    thanks.hidden = false;
    window.scrollTo(0, 0);
  } catch (err) {
    posthog.captureException(err);
    posthog.capture("b2c_form_submit_error");
    formError.textContent = "Couldn't submit — check your connection and try again.";
    formError.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
    console.error(err);
  }
});

// Booth flow: hand the phone to the next visitor — a full reload is the simplest
// guaranteed-clean reset (re-inits the country picker too).
qs<HTMLButtonElement>("#again")!.addEventListener("click", () => {
  posthog.reset();
  location.reload();
});

pills.render();
renderBadges();
