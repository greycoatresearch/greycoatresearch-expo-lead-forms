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

// --- searchable combobox (shadcn-style) -------------------------------------
// Builds a trigger button + searchable popover inside `root`, backed by a
// hidden <input> so the rest of the form can keep reading it via val(name).
function createCombobox(root, config) {
  var items = config.items || [];
  var placeholder = config.placeholder || 'Select…';

  root.classList.add('combobox');
  root.innerHTML =
    '<input type="hidden"' + (config.name ? ' name="' + config.name + '"' : '') + '>' +
    '<button type="button" class="combobox-trigger" aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="combobox-value is-placeholder">' + placeholder + '</span>' +
      '<svg class="combobox-caret" width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>' +
    '</button>' +
    '<div class="combobox-popover" hidden>' +
      '<div class="combobox-search">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M21 21l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '<input type="text" class="combobox-input" placeholder="' + (config.searchPlaceholder || 'Search…') + '" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">' +
      '</div>' +
      '<ul class="combobox-list" role="listbox"></ul>' +
      '<div class="combobox-empty" hidden>No results found.</div>' +
    '</div>';

  var hidden = root.querySelector('input[type=hidden]');
  var trigger = root.querySelector('.combobox-trigger');
  var valueEl = root.querySelector('.combobox-value');
  var popover = root.querySelector('.combobox-popover');
  var search = root.querySelector('.combobox-input');
  var list = root.querySelector('.combobox-list');
  var empty = root.querySelector('.combobox-empty');

  var visible = [];     // absolute item indices currently shown
  var activeVi = -1;    // index into `visible`

  var optionEls = items.map(function (item, i) {
    var li = document.createElement('li');
    li.className = 'combobox-option';
    li.setAttribute('role', 'option');
    li.dataset.index = i;
    li.innerHTML = '<span>' + item.label + '</span>' +
      '<svg class="combobox-check" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    list.appendChild(li);
    return li;
  });

  function onDocDown(e) { if (!root.contains(e.target)) close(); }

  function open() {
    if (!popover.hidden) return;
    popover.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    search.value = '';
    filter('');
    var sel = items.findIndex(function (it) { return it.value === hidden.value; });
    if (sel !== -1) { var vi = visible.indexOf(sel); if (vi !== -1) setActive(vi); }
    search.focus();
    document.addEventListener('mousedown', onDocDown, true);
  }
  function close() {
    if (popover.hidden) return;
    popover.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onDocDown, true);
  }

  function filter(q) {
    q = q.trim().toLowerCase();
    visible = [];
    items.forEach(function (item, i) {
      var hay = (item.search || item.label).toLowerCase();
      var match = !q || hay.indexOf(q) !== -1;
      optionEls[i].hidden = !match;
      if (match) visible.push(i);
    });
    empty.hidden = visible.length > 0;
    setActive(visible.length ? 0 : -1);
  }

  function setActive(vi) {
    if (activeVi >= 0 && visible[activeVi] != null) optionEls[visible[activeVi]].classList.remove('is-active');
    activeVi = vi;
    if (vi >= 0 && vi < visible.length) {
      var el = optionEls[visible[vi]];
      el.classList.add('is-active');
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  function commit(i, silent) {
    var item = items[i];
    hidden.value = item.value;
    valueEl.textContent = item.label;
    valueEl.classList.remove('is-placeholder');
    optionEls.forEach(function (el, j) { el.classList.toggle('is-selected', j === i); });
    root.classList.remove('invalid');
    if (!silent) { close(); trigger.focus(); if (config.onChange) config.onChange(item); }
  }

  trigger.addEventListener('click', function () { popover.hidden ? open() : close(); });
  search.addEventListener('input', function () { filter(search.value); });
  search.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeVi + 1, visible.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeVi - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (activeVi >= 0) commit(visible[activeVi]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus(); }
  });
  // Keep focus on the search field when clicking an option so it stays open.
  list.addEventListener('mousedown', function (e) { e.preventDefault(); });
  list.addEventListener('click', function (e) {
    var li = e.target.closest('.combobox-option');
    if (li) commit(parseInt(li.dataset.index, 10));
  });
  list.addEventListener('mousemove', function (e) {
    var li = e.target.closest('.combobox-option');
    if (li) { var vi = visible.indexOf(parseInt(li.dataset.index, 10)); if (vi !== -1) setActive(vi); }
  });

  return {
    element: root,
    getValue: function () { return hidden.value; },
    setValue: function (value, silent) {
      var i = items.findIndex(function (it) { return it.value === value; });
      if (i !== -1) commit(i, silent);
    },
    setInvalid: function (bad) { root.classList.toggle('invalid', bad); }
  };
}

// Country combobox populated from intl-tel-input data; auto-fills (only while
// still empty) to match the phone field's selected country.
function initCountryField(root, phoneIti, phoneInput) {
  var items = window.intlTelInput.getCountryData().map(function (c) {
    return { value: c.name, label: c.name, iso: c.iso2 };
  });
  var combo = createCombobox(root, {
    name: 'country',
    placeholder: 'Select your country',
    searchPlaceholder: 'Search country…',
    items: items
  });
  if (phoneInput) {
    phoneInput.addEventListener('countrychange', function () {
      if (combo.getValue()) return;
      var d = phoneIti.getSelectedCountryData();
      var match = items.find(function (it) { return it.iso === d.iso2; });
      if (match) combo.setValue(match.value, true);
    });
  }
  return combo;
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
