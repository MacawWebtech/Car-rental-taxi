/* ==========================================================================
   KAARVAN — booking.js
   1) Hero booking widget: ARIA tabs, swap, passenger stepper, live fare estimate
   2) Multi-step booking page: Journey → Vehicle → Extras → Details → Payment
   Integration point: replace estimateFare() with your pricing / maps API
   (e.g. Google Distance Matrix) and submitBooking() with your booking API.
   ========================================================================== */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

  /* Rate card (demo values — mirror pricing.html) */
  const RATES = {
    economy:  { label: 'Economy',  base: 99,  km: 12, hour: 249, day: 1799 },
    sedan:    { label: 'Sedan',    base: 149, km: 16, hour: 349, day: 2499 },
    suv:      { label: 'SUV',      base: 199, km: 20, hour: 449, day: 3499 },
    luxury:   { label: 'Luxury',   base: 499, km: 38, hour: 1299, day: 8999 },
    van:      { label: 'Van',      base: 249, km: 24, hour: 549, day: 4499 },
    electric: { label: 'Electric', base: 129, km: 14, hour: 329, day: 2999 }
  };
  const GST = 0.05;

  /* Deterministic demo distance from the two strings, so the estimate feels real */
  function demoDistance(a, b) {
    if (!a || !b) return 0;
    const s = (a + '|' + b).toLowerCase();
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const airport = /airport|terminal|maa|blr|hyd|bom|del/.test(s);
    return airport ? 18 + (h % 22) : 6 + (h % 34);
  }

  function estimateFare({ mode, pickup, drop, vehicle = 'sedan', hours = 4, days = 1 }) {
    const r = RATES[vehicle] || RATES.sedan;
    if (mode === 'rental') { const sub = r.day * Math.max(1, days); return { total: sub * (1 + GST), meta: `${days} ${days > 1 ? 'days' : 'day'} · ${r.label} · incl. GST` }; }
    if (mode === 'hourly') { const sub = r.hour * hours; return { total: sub * (1 + GST), meta: `${hours} hrs · ${hours * 10} km included · ${r.label}` }; }
    const km = demoDistance(pickup, drop);
    if (!km) return null;
    const sub = r.base + km * r.km;
    const mins = Math.round(km * 2.4 + 6);
    return { total: sub * (1 + GST), km, mins, meta: `≈ ${km} km · ${mins} min · ${r.label} · incl. GST` };
  }
  window.KaarvanFare = { estimateFare, RATES };

  /* ---------- Tabs (WAI-ARIA pattern, arrow key support) ---------- */
  function initTabs(root) {
    const tabs = $$('[role="tab"]', root);
    const select = tab => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const pane = document.getElementById(t.getAttribute('aria-controls'));
        if (pane) pane.hidden = !on;
      });
      root.dispatchEvent(new CustomEvent('tabchange', { detail: tab.dataset.mode }));
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        const dir = document.documentElement.dir === 'rtl' ? -1 : 1;
        let n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + dir + tabs.length) % tabs.length];
        if (e.key === 'ArrowLeft') n = tabs[(i - dir + tabs.length) % tabs.length];
        if (e.key === 'Home') n = tabs[0];
        if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); n.focus(); select(n); }
      });
    });
  }

  /* ---------- Steppers ---------- */
  function initSteppers(scope = document) {
    $$('.stepper', scope).forEach(st => {
      const out = $('output', st); const input = $('input[type="hidden"]', st);
      const min = +(st.dataset.min || 1), max = +(st.dataset.max || 8);
      const set = v => { v = Math.min(max, Math.max(min, v)); out.textContent = v + (st.dataset.unit ? ' ' + st.dataset.unit : ''); if (input) { input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); } };
      $('[data-step="-1"]', st)?.addEventListener('click', () => set(+(input?.value || min) - 1));
      $('[data-step="1"]', st)?.addEventListener('click', () => set(+(input?.value || min) + 1));
    });
  }

  /* ---------- Hero widget ---------- */
  function initWidget() {
    $$('[data-booking-widget]').forEach(widget => {
      initTabs(widget);
      initSteppers(widget);
      const fareVal = $('[data-fare-value]', widget);
      const fareMeta = $('[data-fare-meta]', widget);
      const activeMode = () => $('[role="tab"][aria-selected="true"]', widget)?.dataset.mode || 'taxi';

      const recalc = () => {
        const mode = activeMode();
        const pane = $(`[data-pane="${mode}"]`, widget);
        if (!pane) return;
        const v = n => $(`[name="${n}"]`, pane)?.value || '';
        let est;
        if (mode === 'rental') {
          const a = new Date(v('pickupDate')), b = new Date(v('returnDate'));
          const days = isNaN(a) || isNaN(b) ? 1 : Math.max(1, Math.round((b - a) / 86400000));
          est = estimateFare({ mode, vehicle: v('vehicle'), days });
        } else if (mode === 'hourly') {
          est = estimateFare({ mode, vehicle: v('vehicle') || 'sedan', hours: +v('duration') || 4 });
        } else {
          est = estimateFare({ mode, pickup: v('pickup'), drop: v('drop'), vehicle: v('vehicle') });
        }
        if (est) { fareVal.textContent = inr(est.total); fareMeta.textContent = est.meta; }
        else { fareVal.textContent = '—'; fareMeta.textContent = 'Add pickup and drop-off to see your fare'; }
      };
      widget.addEventListener('input', recalc);
      widget.addEventListener('change', recalc);
      widget.addEventListener('tabchange', recalc);

      $$('.swap-btn', widget).forEach(btn => btn.addEventListener('click', () => {
        const pane = btn.closest('[data-pane]');
        const a = $('[data-route="from"]', pane), b = $('[data-route="to"]', pane);
        [a.value, b.value] = [b.value, a.value];
        recalc();
      }));

      $$('form', widget).forEach(form => form.addEventListener('submit', e => {
        e.preventDefault();
        const fields = $$('[required]', form);
        const ok = fields.map(f => window.KaarvanValidate ? window.KaarvanValidate.validateField(f) : !!f.value).every(Boolean);
        if (!ok) { fields.find(f => f.getAttribute('aria-invalid') === 'true')?.focus(); return; }
        const btn = $('[type="submit"]', form);
        btn.classList.add('is-loading');
        const params = new URLSearchParams(new FormData(form));
        params.set('mode', activeMode());
        // Integration point: call availability API, then redirect to results/booking
        setTimeout(() => { window.location.href = (form.getAttribute('action') || 'booking.html') + '?' + params.toString(); }, 700);
      }));
      recalc();
    });
  }

  /* ---------- Multi-step booking page ---------- */
  function initBookingFlow() {
    const flow = $('#bookingFlow');
    if (!flow) return;
    const steps = $$('.book-step', flow);
    const marks = $$('.progress-steps li');
    const back = $('#stepBack'), next = $('#stepNext');
    const live = $('#stepLive');
    let current = 0;

    // Prefill from query string (coming from hero widget)
    const qs = new URLSearchParams(location.search);
    ['pickup', 'drop', 'date', 'time'].forEach(k => { const el = flow.querySelector(`[name="${k}"]`); if (el && qs.get(k)) el.value = qs.get(k); });
    if (qs.get('vehicle')) { const r = flow.querySelector(`input[name="vehicleChoice"][data-type="${qs.get('vehicle')}"]`); if (r) r.checked = true; }
    initSteppers(flow);

    const S = id => document.getElementById(id);
    const summarise = () => {
      const f = new FormData(flow);
      const veh = flow.querySelector('input[name="vehicleChoice"]:checked');
      const type = veh?.dataset.type || 'sedan';
      const est = estimateFare({ mode: 'taxi', pickup: f.get('pickup') || '', drop: f.get('drop') || '', vehicle: type });
      const extras = $$('input[name="extras"]:checked', flow);
      const extrasTotal = extras.reduce((s, x) => s + +x.dataset.price, 0);
      const base = est ? est.total / (1 + GST) : 0;
      const tax = (base + extrasTotal) * GST;
      S('sumRoute').textContent = f.get('pickup') && f.get('drop') ? `${f.get('pickup')} → ${f.get('drop')}` : 'Add your route';
      S('sumWhen').textContent = f.get('date') ? `${f.get('date')}${f.get('time') ? ', ' + f.get('time') : ''}` : '—';
      S('sumVehicle').textContent = veh ? veh.dataset.name : '—';
      S('sumDistance').textContent = est ? `${est.km} km · ${est.mins} min` : '—';
      S('sumBase').textContent = est ? inr(base) : '—';
      S('sumExtras').textContent = extras.length ? inr(extrasTotal) : '₹0';
      S('sumTax').textContent = est ? inr(tax) : '—';
      S('sumTotal').textContent = est ? inr(base + extrasTotal + tax) : '—';
      $$('[data-vehicle-price]', flow).forEach(el => {
        const e2 = estimateFare({ mode: 'taxi', pickup: f.get('pickup') || 'City', drop: f.get('drop') || 'Airport', vehicle: el.dataset.vehiclePrice });
        el.textContent = e2 ? inr(e2.total) : '';
      });
    };

    const show = (i, initial = false) => {
      current = i;
      steps.forEach((s, n) => { s.hidden = n !== i; });
      marks.forEach((m, n) => {
        m.classList.toggle('is-done', n < i);
        m.classList.toggle('is-current', n === i);
        if (n === i) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current');
      });
      back.hidden = i === 0;
      next.querySelector('.btn-label').textContent = i === steps.length - 1 ? 'Confirm and pay' : 'Continue';
      live.textContent = `Step ${i + 1} of ${steps.length}: ${marks[i].textContent.trim()}`;
      if (!initial) {
        const h = $('h2', steps[i]); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
        flow.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
      summarise();
    };

    const validStep = () => {
      const fields = $$('input, select, textarea', steps[current]).filter(f => f.required || f.dataset.validate || f.type === 'email' || f.type === 'tel');
      if (current === 1 && !flow.querySelector('input[name="vehicleChoice"]:checked')) { window.KaarvanToast?.('Choose a vehicle to continue', 'bi-exclamation-circle'); return false; }
      const res = fields.map(f => window.KaarvanValidate.validateField(f));
      const bad = fields[res.indexOf(false)];
      if (bad) { bad.focus(); return false; }
      return true;
    };

    next.addEventListener('click', () => {
      if (!validStep()) return;
      if (current < steps.length - 1) { show(current + 1); return; }
      // Final submit — integration point: Stripe / PayPal / booking API
      next.classList.add('is-loading');
      setTimeout(() => {
        next.classList.remove('is-loading');
        const ref = 'KV-' + Math.floor(100000 + Math.random() * 900000);
        $('#confirmRef').textContent = ref;
        bootstrap.Modal.getOrCreateInstance('#confirmModal').show();
      }, 1200);
    });
    back.addEventListener('click', () => current > 0 && show(current - 1));
    flow.addEventListener('input', summarise);
    flow.addEventListener('change', summarise);

    // Payment method panes
    $$('input[name="payMethod"]', flow).forEach(r => r.addEventListener('change', () => {
      $$('[data-pay-pane]', flow).forEach(p => { p.hidden = p.dataset.payPane !== r.value; });
    }));
    show(0, true);
  }

  document.addEventListener('DOMContentLoaded', () => { initWidget(); initBookingFlow(); });
})();
