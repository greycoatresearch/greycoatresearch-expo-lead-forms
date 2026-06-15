/* Greycoat Research — shared form logic */

// --- WhatsApp phone input (intl-tel-input) ---------------------------------
function initPhone(input) {
  const iti = window.intlTelInput(input, {
    initialCountry: 'auto',
    geoIpLookup: function (cb) {
      // Best-effort country auto-detect; falls back to SG (expo is in Singapore).
      fetch('https://ipapi.co/json')
        .then(function (r) { return r.json(); })
        .then(function (d) { cb(d && d.country_code ? d.country_code : 'sg'); })
        .catch(function () { cb('sg'); });
    },
    separateDialCode: true,
    preferredCountries: ['sg', 'my', 'id', 'th', 'ph', 'vn', 'jp', 'kr'],
    utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@23.0.12/build/js/utils.js'
  });
  return iti;
}

// --- helpers ----------------------------------------------------------------
function val(name) {
  const el = document.querySelector('[name="' + name + '"]');
  return el ? el.value.trim() : '';
}
function checkedValues(name) {
  return Array.from(document.querySelectorAll('[name="' + name + '"]:checked'))
    .map(function (el) {
      // "Other" rows carry their free-text value via data-other input
      if (el.value === '__other__') {
        const txt = document.querySelector('[data-other-for="' + name + '"]');
        const t = txt && txt.value.trim();
        return t ? 'Other: ' + t : '';
      }
      return el.value;
    })
    .filter(Boolean);
}
function markInvalid(el, bad) {
  if (el) el.classList.toggle('invalid', bad);
}

// --- submit -----------------------------------------------------------------
function submitLead(type, payload, btn, status) {
  btn.disabled = true;
  status.textContent = 'Submitting…';
  status.className = 'status';

  fetch(window.GREYCOAT_ENDPOINT, {
    method: 'POST',
    // text/plain avoids a CORS preflight against Apps Script.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ type: type }, payload))
  })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (res && res.ok) {
        showSuccess();
      } else {
        throw new Error((res && res.error) || 'Unknown error');
      }
    })
    .catch(function (err) {
      status.textContent = "Couldn't submit — check your connection and try again.";
      status.className = 'status err';
      btn.disabled = false;
      console.error(err);
    });
}

function showSuccess() {
  const form = document.getElementById('lead-form');
  const tmpl = document.getElementById('success-tmpl');
  form.replaceWith(tmpl.content.cloneNode(true));
}

// --- toggle active state from current path ----------------------------------
function markToggle() {
  const path = location.pathname.replace(/\/index\.html?$/, '/').toLowerCase();
  const isB2B = /b2b/.test(path);
  document.querySelectorAll('.toggle a').forEach(function (a) {
    const forB2B = /b2b/i.test(a.dataset.for);
    a.classList.toggle('active', forB2B === isB2B);
  });
}
document.addEventListener('DOMContentLoaded', markToggle);
