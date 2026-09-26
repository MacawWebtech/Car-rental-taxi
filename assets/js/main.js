/* ==========================================================================
   KAARVAN — main.js
   Global behaviour for every page: theme, language/RTL, header, reveal,
   counters, parallax, filters, sorting, validation, toasts, image fallback.
   Vanilla ES6+, no dependencies (Bootstrap bundle handles dropdown/offcanvas/modal).
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const THEME_KEY = 'mobility-theme';
  const LANG_KEY = 'mobility-lang';

  root.classList.add('js');

  /* ---------- 0. Preloader ---------- */
  const Preloader = {
    el: null,
    hidden: false,
    hide() {
      if (this.hidden || !this.el) return;
      this.hidden = true;
      this.el.classList.add('is-hidden');
      document.body.classList.remove('preloader-active');
      this.el.addEventListener('transitionend', () => { this.el && this.el.remove(); }, { once: true });
      // Fallback in case transitionend never fires (e.g. element hidden via display switch)
      setTimeout(() => { if (this.el) { this.el.remove(); this.el = null; } }, 700);
    },
    init() {
      this.el = $('#preloader');
      if (!this.el) return;
      document.body.classList.add('preloader-active');
      const done = () => this.hide();
      if (document.readyState === 'complete') {
        done();
      } else {
        window.addEventListener('load', done, { once: true });
      }
      // Safety net: never let a slow-loading asset block the page indefinitely
      setTimeout(done, 4000);
    }
  };
  Preloader.init();

  /* ---------- Storage helpers (never throw) ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  /* ---------- 1. Theme ---------- */
  const Theme = {
    current() { return root.getAttribute('data-bs-theme') || 'light'; },
    apply(t) {
      root.setAttribute('data-bs-theme', t);
      $$('.theme-toggle').forEach(b => {
        b.setAttribute('aria-pressed', String(t === 'dark'));
        b.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      });
      document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
    },
    init() {
      // head inline script already set the attribute to avoid a flash; sync buttons
      this.apply(this.current());
      $$('.theme-toggle').forEach(b => b.addEventListener('click', () => {
        const next = this.current() === 'dark' ? 'light' : 'dark';
        store.set(THEME_KEY, next);
        this.apply(next);
      }));
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', e => {
        if (!store.get(THEME_KEY)) this.apply(e.matches ? 'dark' : 'light');
      });
    }
  };

  /* ---------- 2. Language / RTL ---------- */
  const RTL_LANGS = ['ar', 'he'];
  const LANG_LABEL = { en: 'EN', ar: 'AR', he: 'HE', hi: 'HI', ta: 'TA' };
  const Lang = {
    apply(code) {
      root.setAttribute('lang', code);
      root.setAttribute('dir', RTL_LANGS.includes(code) ? 'rtl' : 'ltr');
      $$('[data-lang-current]').forEach(el => { el.textContent = LANG_LABEL[code] || code.toUpperCase(); });
      $$('[data-lang]').forEach(el => el.setAttribute('aria-current', String(el.dataset.lang === code)));
      Dir.sync();
    },
    init() {
      this.apply(store.get(LANG_KEY) || root.getAttribute('lang') || 'en');
      $$('[data-lang]').forEach(el => el.addEventListener('click', e => {
        e.preventDefault();
        store.set(LANG_KEY, el.dataset.lang);
        store.set(DIR_KEY, '');            // a language choice resets any manual direction
        this.apply(el.dataset.lang);
        toast(RTL_LANGS.includes(el.dataset.lang) ? 'Right-to-left layout enabled' : 'Language updated');
      }));
    }
  };

  /* ---------- 2b. Layout direction (LTR / RTL switch) ---------- */
  const DIR_KEY = 'mobility-dir';
  const Dir = {
    current() { return root.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr'; },
    sync() {
      const d = this.current();
      $$('.dir-switch').forEach(sw => {
        sw.dataset.active = d;
        $$('[data-dir]', sw).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dir === d)));
      });
    },
    apply(d) { root.setAttribute('dir', d); this.sync(); },
    init() {
      // Place the switch thumb without animating it on page load.
      $$('.dir-switch').forEach(sw => sw.classList.add('is-static'));
      const saved = store.get(DIR_KEY);
      if (saved === 'rtl' || saved === 'ltr') this.apply(saved); else this.sync();
      requestAnimationFrame(() => requestAnimationFrame(() => $$('.dir-switch').forEach(sw => sw.classList.remove('is-static'))));
      $$('.dir-switch [data-dir]').forEach(b => b.addEventListener('click', () => {
        const d = b.dataset.dir;
        if (d === this.current()) return;
        store.set(DIR_KEY, d);
        this.apply(d);
        toast(d === 'rtl' ? 'Right-to-left layout enabled' : 'Left-to-right layout enabled', d === 'rtl' ? 'bi-text-right' : 'bi-text-left');
      }));
    }
  };

  /* ---------- 3. Header ---------- */
  function initHeader() {
    const header = $('.site-header');
    const mobileBook = $('.mobile-book');
    if (!header && !mobileBook) return;
    let ticking = false;
    const onScroll = () => {
      const y = window.scrollY;
      header?.classList.toggle('is-scrolled', y > 24);
      mobileBook?.classList.toggle('is-visible', y > 480);
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
    onScroll();
  }

  /* ---------- 4. Scroll reveal + counters ---------- */
  function initReveal() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window) || reduceMotion) { items.forEach(i => i.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(i => io.observe(i));
  }

  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length) return;
    const fmt = (n, el) => {
      const dec = +(el.dataset.decimals || 0);
      return (el.dataset.prefix || '') + n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (el.dataset.suffix || '');
    };
    const run = el => {
      const target = parseFloat(el.dataset.count);
      if (reduceMotion) { el.textContent = fmt(target, el); return; }
      const dur = 1400; const t0 = performance.now();
      const step = t => {
        const p = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased, el);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
    }), { threshold: .4 });
    els.forEach(e => io.observe(e));
  }

  /* ---------- 5. Parallax (subtle, desktop only) ---------- */
  function initParallax() {
    const imgs = $$('[data-parallax]');
    if (!imgs.length || reduceMotion || window.innerWidth < 768 || root.classList.contains('motion-on')) return;
    const update = () => {
      imgs.forEach(img => {
        const r = img.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
        img.style.transform = `translate3d(0, ${(p * -40).toFixed(1)}px, 0)`;
      });
    };
    window.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    update();
  }

  /* ---------- 6. Filter tabs (fleet, blog, services) ---------- */
  function initFilters() {
    $$('[data-filter-group]').forEach(group => {
      const target = $(group.dataset.filterGroup);
      if (!target) return;
      const buttons = $$('[data-filter]', group);
      buttons.forEach(btn => btn.addEventListener('click', () => {
        buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        const f = btn.dataset.filter;
        let shown = 0;
        $$('[data-filter-item]', target).forEach(item => {
          const match = f === 'all' || item.dataset.filterItem.split(' ').includes(f);
          item.classList.toggle('is-hidden', !match);
          if (match) shown++;
        });
        const live = group.dataset.filterLive ? $(group.dataset.filterLive) : null;
        if (live) live.textContent = `${shown} ${shown === 1 ? 'result' : 'results'}`;
      }));
    });
  }

  /* ---------- 7. Fleet page: multi-filter + sort ---------- */
  function initFleetBrowser() {
    const form = $('#fleetFilters');
    const grid = $('#fleetGrid');
    if (!form || !grid) return;
    const count = $('#fleetCount');
    const sort = $('#fleetSort');
    const cards = $$('[data-vehicle]', grid);
    const empty = $('#fleetEmpty');

    const apply = () => {
      const data = new FormData(form);
      const types = data.getAll('type');
      const fuels = data.getAll('fuel');
      const trans = data.get('transmission') || 'any';
      const seats = +(data.get('seats') || 0);
      const maxPrice = +(data.get('price') || 99999);
      const rental = data.get('rental') || 'any';
      let visible = 0;
      cards.forEach(c => {
        const d = c.dataset;
        const ok = (!types.length || types.includes(d.type)) &&
          (!fuels.length || fuels.includes(d.fuel)) &&
          (trans === 'any' || d.transmission === trans) &&
          (+d.seats >= seats) && (+d.price <= maxPrice) &&
          (rental === 'any' || d.rental.split(' ').includes(rental));
        c.classList.toggle('is-hidden', !ok);
        if (ok) visible++;
      });
      if (count) count.textContent = visible;
      if (empty) empty.hidden = visible !== 0;
      const pv = $('#priceValue');
      if (pv) pv.textContent = '₹' + maxPrice.toLocaleString('en-IN');
    };
    const doSort = () => {
      const mode = sort?.value || 'recommended';
      const sorted = [...cards].sort((a, b) => {
        if (mode === 'price-asc') return a.dataset.price - b.dataset.price;
        if (mode === 'price-desc') return b.dataset.price - a.dataset.price;
        if (mode === 'popular') return b.dataset.trips - a.dataset.trips;
        return a.dataset.order - b.dataset.order;
      });
      sorted.forEach(c => grid.appendChild(c));
    };
    form.addEventListener('input', apply);
    form.addEventListener('reset', () => setTimeout(apply, 0));
    sort?.addEventListener('change', doSort);
    apply();
  }

  /* ---------- 8. Save vehicle (heart) ---------- */
  function initSave() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('.v-save');
      if (!btn) return;
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      toast(on ? 'Saved to your vehicles' : 'Removed from saved vehicles', on ? 'bi-heart-fill' : 'bi-heart');
    });
  }

  /* ---------- 9. Form validation (accessible) ---------- */
  const rules = {
    required: v => v.trim() !== '',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    phone: v => /^[+]?[\d\s-]{8,15}$/.test(v.trim()),
    password: v => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v),
    date: v => !v || !isNaN(new Date(v).getTime()),
    futureDate: v => { if (!v) return true; const d = new Date(v); d.setHours(23, 59, 59); return d >= new Date(); },
    location: v => v.trim().length >= 3
  };
  const messages = {
    required: 'This field is required.',
    email: 'Enter an email address like name@example.com.',
    phone: 'Enter a phone number with 8–15 digits.',
    password: 'Use at least 8 characters with a letter and a number.',
    date: 'Enter a valid date.',
    futureDate: 'Choose today or a later date.',
    location: 'Enter at least 3 characters for the location.',
    match: 'Passwords do not match.',
    checked: 'Please accept to continue.'
  };

  function errorEl(field) {
    let id = field.getAttribute('aria-describedby')?.split(' ').find(i => i.endsWith('-error'));
    let el = id && document.getElementById(id);
    if (!el) {
      id = (field.id || field.name || 'f' + Math.random().toString(36).slice(2)) + '-error';
      el = document.createElement('div');
      el.className = 'field-error';
      el.id = id;
      el.setAttribute('aria-live', 'polite');
      const host = field.closest('.field, .form-check, .mb-3, [class*="col"]') || field.parentElement;
      host.appendChild(el);
      const existing = field.getAttribute('aria-describedby');
      field.setAttribute('aria-describedby', existing ? existing + ' ' + id : id);
    }
    return el;
  }

  function validateField(field) {
    const v = field.type === 'checkbox' ? (field.checked ? 'on' : '') : (field.value || '');
    let msg = '';
    if (field.type === 'checkbox' && field.required && !field.checked) msg = messages.checked;
    else if (field.required && !rules.required(v)) msg = field.dataset.msgRequired || messages.required;
    else if (v) {
      const types = (field.dataset.validate || '').split(' ').filter(Boolean);
      if (field.type === 'email' && !types.includes('email')) types.push('email');
      if (field.type === 'tel' && !types.includes('phone')) types.push('phone');
      for (const t of types) { if (rules[t] && !rules[t](v)) { msg = messages[t]; break; } }
      if (!msg && field.dataset.match) {
        const other = document.querySelector(field.dataset.match);
        if (other && other.value !== v) msg = messages.match;
      }
    }
    const el = errorEl(field);
    el.textContent = msg;
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }

  function initValidation() {
    $$('form[data-validate-form]').forEach(form => {
      form.setAttribute('novalidate', '');
      const fields = () => $$('input, select, textarea', form).filter(f => !f.disabled && f.type !== 'hidden' && f.offsetParent !== null && (f.required || f.dataset.validate || f.type === 'email' || f.type === 'tel' || f.dataset.match));
      form.addEventListener('blur', e => { if (e.target.matches('input, select, textarea') && e.target.getAttribute('aria-invalid') !== null) validateField(e.target); }, true);
      form.addEventListener('input', e => { if (e.target.getAttribute('aria-invalid') === 'true') validateField(e.target); });
      form.addEventListener('submit', e => {
        e.preventDefault();
        const list = fields();
        const results = list.map(validateField);
        const firstBad = list[results.indexOf(false)];
        if (firstBad) { firstBad.focus(); return; }
        const btn = $('[type="submit"]', form);
        btn?.classList.add('is-loading');
        btn?.setAttribute('aria-busy', 'true');
        // Integration point: replace timeout with fetch() to Formspree / Netlify / your API.
        setTimeout(() => {
          btn?.classList.remove('is-loading');
          btn?.removeAttribute('aria-busy');
          toast(form.dataset.success || 'Sent. We will get back to you shortly.');
          if (form.dataset.redirect) window.location.href = form.dataset.redirect;
          else if (!form.hasAttribute('data-keep')) form.reset();
        }, 900);
      });
    });
    window.KaarvanValidate = { validateField };
  }

  /* ---------- 10. Password visibility + strength ---------- */
  function initPasswords() {
    $$('.pw-toggle').forEach(btn => btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('aria-controls'));
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.querySelector('i').className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
    }));
    $$('[data-pw-meter]').forEach(input => {
      const bar = document.querySelector(input.dataset.pwMeter + ' span');
      const label = document.querySelector(input.dataset.pwMeter + '-label');
      input.addEventListener('input', () => {
        const v = input.value;
        let s = 0;
        if (v.length >= 8) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
        const colors = ['#C0392B', '#C0392B', '#B7791F', '#2F8F5B', '#2F8F5B'];
        const names = ['Too short', 'Weak', 'Fair', 'Strong', 'Very strong'];
        if (bar) { bar.style.width = (s / 4 * 100) + '%'; bar.style.background = colors[s]; }
        if (label) label.textContent = v ? names[s] : '';
      });
    });
  }

  /* ---------- 11. Toasts ---------- */
  function toast(text, icon = 'bi-check-circle-fill') {
    let stack = $('.toast-stack');
    if (!stack) { stack = document.createElement('div'); stack.className = 'toast-stack'; stack.setAttribute('role', 'status'); stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
    const t = document.createElement('div');
    t.className = 'k-toast';
    t.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i><span></span>`;
    t.querySelector('span').textContent = text;
    stack.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 3200);
  }
  window.KaarvanToast = toast;

  /* ---------- 12. Image fallback (keeps layout intact if a remote image fails) ---------- */
  function initImageFallback() {
    const svg = alt => {
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A2E33"/><stop offset="1" stop-color="#15171A"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><path d="M180 330h440l-30-70c-8-18-26-30-46-30H300c-22 0-40 12-50 32z" fill="none" stroke="#D4A24C" stroke-width="6" stroke-linejoin="round"/><circle cx="290" cy="338" r="28" fill="#15171A" stroke="#D4A24C" stroke-width="6"/><circle cx="520" cy="338" r="28" fill="#15171A" stroke="#D4A24C" stroke-width="6"/></svg>`);
    };
    const fix = img => { if (img.dataset.fallbackDone) return; img.dataset.fallbackDone = '1'; img.src = svg(img.alt); img.srcset = ''; img.classList.add('img-fallback'); };
    $$('img').forEach(img => {
      if (img.complete && img.naturalWidth === 0 && img.src) fix(img);
      img.addEventListener('error', () => fix(img), { once: true });
    });
  }

  /* ---------- 13. Vehicle gallery ---------- */
  function initGallery() {
    const main = $('#galleryMain');
    if (!main) return;
    $$('.gallery-thumbs button').forEach(btn => btn.addEventListener('click', () => {
      $$('.gallery-thumbs button').forEach(b => b.setAttribute('aria-current', 'false'));
      btn.setAttribute('aria-current', 'true');
      main.style.opacity = '.3';
      setTimeout(() => { main.src = btn.dataset.full; main.alt = btn.querySelector('img').alt; main.style.opacity = '1'; }, 150);
    }));
  }

  /* ---------- 14. Search/filter lists (blog, locations, tables) ---------- */
  function initLiveSearch() {
    $$('[data-search]').forEach(input => {
      const scope = $(input.dataset.search);
      if (!scope) return;
      const empty = input.dataset.searchEmpty ? $(input.dataset.searchEmpty) : null;
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        let shown = 0;
        $$('[data-search-item]', scope).forEach(item => {
          const hit = !q || item.textContent.toLowerCase().includes(q);
          item.classList.toggle('is-hidden', !hit);
          item.style.display = hit ? '' : 'none';
          if (hit) shown++;
        });
        if (empty) empty.hidden = shown !== 0;
      });
    });
  }

  /* ---------- 15. Skeleton demo: [data-skeleton] swaps after load ---------- */
  function initSkeletons() {
    $$('[data-skeleton]').forEach(el => {
      const delay = +(el.dataset.skeleton || 700);
      setTimeout(() => {
        $$('.skeleton-content', el).forEach(s => s.remove());
        $$('.loaded-content', el).forEach(c => { c.hidden = false; });
        el.setAttribute('aria-busy', 'false');
      }, reduceMotion ? 0 : delay);
    });
  }

  /* ---------- 16. Countdown (coming soon) ---------- */
  function initCountdown() {
    const el = $('[data-countdown]');
    if (!el) return;
    const target = el.dataset.countdown ? new Date(el.dataset.countdown) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 12);
    const parts = { d: $('[data-cd="d"]', el), h: $('[data-cd="h"]', el), m: $('[data-cd="m"]', el), s: $('[data-cd="s"]', el) };
    const tick = () => {
      let diff = Math.max(0, target - Date.now()) / 1000;
      const d = Math.floor(diff / 86400); diff -= d * 86400;
      const h = Math.floor(diff / 3600); diff -= h * 3600;
      const m = Math.floor(diff / 60); const s = Math.floor(diff - m * 60);
      parts.d.textContent = String(d).padStart(2, '0');
      parts.h.textContent = String(h).padStart(2, '0');
      parts.m.textContent = String(m).padStart(2, '0');
      parts.s.textContent = String(s).padStart(2, '0');
    };
    tick(); setInterval(tick, 1000);
  }

  /* ---------- 17. Newsletter (Mailchimp / ConvertKit integration point) ---------- */
  function initNewsletter() {
    $$('form[data-newsletter]').forEach(f => {
      f.setAttribute('novalidate', '');
      f.addEventListener('submit', e => {
        e.preventDefault();
        const input = $('input[type="email"]', f);
        if (!rules.email(input.value)) { input.setAttribute('aria-invalid', 'true'); input.focus(); toast('Enter a valid email to subscribe', 'bi-exclamation-circle'); return; }
        input.setAttribute('aria-invalid', 'false');
        // POST to your provider's endpoint here (action attribute already set to a placeholder)
        toast('Subscribed. Watch your inbox for route deals.');
        f.reset();
      });
    });
  }

  /* ---------- 18. Year + active nav fallback ---------- */
  function initMisc() {
    $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
    $$('[data-toast]').forEach(el => el.addEventListener('click', () => toast(el.dataset.toast)));
    // Set sensible min dates on date inputs
    const today = new Date(); const iso = today.toISOString().slice(0, 10);
    $$('input[type="date"][data-min-today]').forEach(i => { i.min = iso; if (!i.value && i.dataset.defaultOffset !== undefined) { const d = new Date(); d.setDate(d.getDate() + (+i.dataset.defaultOffset)); i.value = d.toISOString().slice(0, 10); } });
  }

  document.addEventListener('DOMContentLoaded', () => {
    Theme.init(); Lang.init(); Dir.init(); initHeader(); initReveal(); initCounters(); initParallax();
    initFilters(); initFleetBrowser(); initSave(); initValidation(); initPasswords();
    initImageFallback(); initGallery(); initLiveSearch(); initSkeletons(); initCountdown();
    initNewsletter(); initMisc();
  });
})();
