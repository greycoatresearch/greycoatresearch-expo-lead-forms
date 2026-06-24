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
const positionOther = qs<HTMLInputElement>("#positionOther");
const btOther = qs<HTMLInputElement>("#btOther");
const interestedOther = qs<HTMLInputElement>("#interestedOther");
const meetingDateField = qs<HTMLElement>("#meetingDateField");
const meetingDate = qs<HTMLInputElement>("#meetingDate");

const pills = setupPills(form, (key) => {
  toggleOther();
  renderBadges();
  if (key === "meeting" && meetingDateField) {
    meetingDateField.hidden = pills.choices.meeting !== "Yes";
    if (meetingDateField.hidden && meetingDate) meetingDate.value = "";
  }
  if (key === "businessType" || key === "interested") {
    const err = qs<HTMLElement>(`[data-error="${key}"]`);
    if (err) err.hidden = (pills.choices[key] as string[]).length > 0;
  }
  if (key === "position") {
    const err = qs<HTMLElement>('[data-error="position"]');
    if (err) err.hidden = !!pills.choices.position;
  }
});

function toggleOther() {
  if (positionOther) positionOther.hidden = pills.choices.position !== "Other";
  if (btOther) btOther.hidden = (pills.choices.businessType as string[]).indexOf("Other") === -1;
  if (interestedOther) {
    interestedOther.hidden = (pills.choices.interested as string[]).indexOf("Other") === -1;
  }
}

// ---- Live checks + section-completion badges ----
setupInputChecks(form, renderBadges);

function renderBadges() {
  const c = pills.choices;
  const done: Record<string, boolean> = {
    "1":
      validInput(qs<HTMLInputElement>("#name")!) &&
      validInput(qs<HTMLInputElement>("#company")!) &&
      !!c.position &&
      validInput(qs<HTMLInputElement>("#email")!),
    "2": (c.businessType as string[]).length > 0,
    "3": (c.interested as string[]).length > 0,
  };
  for (const n of Object.keys(done)) {
    qs(`[data-badge="${n}"]`)?.classList.toggle("badge--done", done[n]);
  }
}

// ---- Submit ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const c = pills.choices;
  const name = qs<HTMLInputElement>("#name")!;
  const company = qs<HTMLInputElement>("#company")!;
  const email = qs<HTMLInputElement>("#email")!;

  let ok = true;
  const required: Array<[HTMLInputElement, boolean]> = [
    [name, isFilled(name.value)],
    [company, isFilled(company.value)],
    [email, isEmail(email.value)],
  ];
  for (const [el, good] of required) {
    el.classList.toggle("is-invalid", !good);
    if (!good) ok = false;
  }

  qs<HTMLElement>('[data-error="position"]')!.hidden = !!c.position;
  if (!c.position) ok = false;

  qs<HTMLElement>('[data-error="businessType"]')!.hidden = (c.businessType as string[]).length > 0;
  if (!(c.businessType as string[]).length) ok = false;
  qs<HTMLElement>('[data-error="interested"]')!.hidden = (c.interested as string[]).length > 0;
  if (!(c.interested as string[]).length) ok = false;

  const phoneOk = isPhoneValid(phoneInput.value, country.getIso());
  phoneInput.classList.toggle("is-invalid", !phoneOk);
  if (!phoneOk) ok = false;

  if (!ok) {
    posthog.capture("b2b_form_validation_error");
    formError.textContent = "Please complete the required fields above.";
    formError.hidden = false;
    return;
  }
  formError.hidden = true;

  const cc = country.getCountry();
  const payload = {
    name: name.value.trim(),
    company: company.value.trim(),
    position:
      c.position === "Other" && positionOther?.value.trim()
        ? "Other: " + positionOther.value.trim()
        : (c.position as string),
    country: cc.name,
    countryCode: cc.iso,
    email: email.value.trim(),
    whatsapp: toE164(phoneInput.value, country.getIso()),
    businessType: withOther(c.businessType as string[], btOther),
    interestedIn: withOther(c.interested as string[], interestedOther),
    monthlyVolume: c.volume as string,
    followUp: c.meeting as string,
    meetingDate: meetingDate?.value ?? "",
  };

  const origText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  try {
    const turnstileToken = await getTurnstileToken();
    await submitLead("B2B", { ...payload, turnstileToken });
    posthog.identify(email.value.trim(), {
      email: email.value.trim(),
      name: name.value.trim(),
      company: company.value.trim(),
    });
    posthog.capture("b2b_lead_submitted", {
      business_types: payload.businessType,
      interested_in: payload.interestedIn,
      monthly_volume: payload.monthlyVolume,
      wants_meeting: payload.followUp === "Yes",
      country_code: payload.countryCode,
    });
    const first = name.value.trim().split(" ")[0] || "";
    const co = company.value.trim() || "your company";
    const meetingLine =
      c.meeting === "Yes" ? "We'll reach out to schedule your follow-up meeting. " : "";
    qs("#thanksTitle")!.textContent = `Thanks${first ? ", " + first : ""}`;
    qs("#thanksText")!.textContent =
      `We've received ${co}'s enquiry. ${meetingLine}Our partnerships team will follow up by email and WhatsApp.`;
    form.hidden = true;
    thanks.hidden = false;
    window.scrollTo(0, 0);
  } catch (err) {
    posthog.captureException(err);
    posthog.capture("b2b_form_submit_error");
    formError.textContent = "Couldn't submit — check your connection and try again.";
    formError.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = origText;
    console.error(err);
  }
});

qs<HTMLButtonElement>("#again")!.addEventListener("click", () => {
  posthog.reset();
  location.reload();
});

pills.render();
renderBadges();
