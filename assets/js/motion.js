/* ==========================================================================
   KAARVAN — motion.js
   Scroll experience layer: smooth scroll (Lenis), scroll-linked animation
   (GSAP + ScrollTrigger), sticky nav states, progress, back-to-top,
   cursor, magnetic buttons and card tilt.

   Loaded with `defer` after gsap, ScrollTrigger and Lenis. If GSAP is missing
   (CDN blocked) the page keeps its original behaviour — nothing is hidden.

   Device tiers
   - reduced motion : progress bar + back-to-top only, no smooth scroll
   - small / touch  : native scroll, time-based reveals, no parallax/pin/tilt
   - desktop        : everything
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const clearPending = () => root.classList.remove('motion-pending');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = mqReduce.matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4 || saveData;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  if (!hasGSAP || reduce) {
    clearPending();
    // Progress bar + back-to-top still work without GSAP.
    document.addEventListener('DOMContentLoaded', () => { initProgressAndTop(null); });
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  root.classList.add('motion-on');

  const isRTL = () => root.dir === 'rtl';
  const dirX = () => (isRTL() ? -1 : 1);
  const wide = () => window.innerWidth >= 992;
  const EASE = 'expo.out';
  let lenis = null;

  /* ---------------------------------------------------------------
     1. Smooth scroll — desktop with a real mouse/trackpad only.
        Touch devices keep native momentum scrolling (smoother there).
  ---------------------------------------------------------------- */
  function initSmoothScroll() {
    if (!finePointer || lowPower || typeof window.Lenis === 'undefined') {
      // No Lenis: keep in-page anchors smooth with the native API
      // (CSS scroll-behavior is off while the motion layer runs).
      document.addEventListener('click', e => {
        const a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a || a.hasAttribute('data-bs-toggle') || a.getAttribute('role') === 'tab') return;
        const id = a.getAttribute('href');
        const target = id.length > 1 && document.getElementById(decodeURIComponent(id.slice(1)));
        if (!target) return;
        e.preventDefault();
        const header = $('.site-header');
        const top = target.getBoundingClientRect().top + window.scrollY - ((header ? header.offsetHeight : 0) + 12);
        window.scrollTo({ top, behavior: 'smooth' });
        history.pushState(null, '', id);
      });
      return;
    }
    lenis = new window.Lenis({
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 1,
      prevent: node => !!(node && node.closest && node.closest('.offcanvas, .modal, .dropdown-menu, [data-lenis-prevent], .table-wrap, .h-slider'))
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    // Freeze page scroll while Bootstrap overlays are open.
    ['offcanvas', 'modal'].forEach(kind => {
      document.addEventListener(`show.bs.${kind}`, () => lenis.stop());
      document.addEventListener(`hidden.bs.${kind}`, () => lenis.start());
    });

    // In-page anchors glide instead of jump.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.hasAttribute('data-bs-toggle') || a.getAttribute('role') === 'tab') return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.getElementById(decodeURIComponent(id.slice(1)));
      if (!target) return;
      e.preventDefault();
      const header = $('.site-header');
      lenis.scrollTo(target, { offset: -((header ? header.offsetHeight : 0) + 12), duration: 1.4 });
      history.pushState(null, '', id);
    });
  }

  /* ---------------------------------------------------------------
     2. Text splitting — words wrapped in masks, keeps <br>, <em>, links.
  ---------------------------------------------------------------- */
  function splitWords(el) {
    if (!el || el.dataset.split) return [];
    el.dataset.split = '1';
    const words = [];
    const walk = node => {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          if (parts.every(p => !p.trim())) return;
          const frag = document.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (!p.trim()) { frag.appendChild(document.createTextNode(p)); return; }
            const line = document.createElement('span');
            line.className = 'm-line';
            const w = document.createElement('span');
            w.className = 'm-word';
            w.textContent = p;
            line.appendChild(w);
            frag.appendChild(line);
            words.push(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR' && child.tagName !== 'svg') {
          walk(child);
        }
      });
    };
    walk(el);
    return words;
  }

  /* ---------------------------------------------------------------
     3. Reveal-once registry: plays when an element enters; anything the
        user has already scrolled past (deep link, refresh mid-page)
        is completed instantly so nothing stays hidden.
  ---------------------------------------------------------------- */
  const pending = new Set();
  function onceIn(el, tl, start = 'top 86%') {
    tl.pause();
    const item = { el, tl };
    pending.add(item);
    ScrollTrigger.create({
      trigger: el, start, once: true,
      onEnter: () => { pending.delete(item); tl.play(); }
    });
    return tl;
  }
  function sweepPassed() {
    pending.forEach(item => {
      if (item.el.getBoundingClientRect().bottom < 0) { item.tl.progress(1); pending.delete(item); }
    });
  }

  /* ---------------------------------------------------------------
     4. Heroes — load timeline + scroll-linked depth.
  ---------------------------------------------------------------- */
  function initHero() {
    const hero = $('.hero');
    if (hero) {
      const h1 = $('h1', hero);
      const words = splitWords(h1);
      const eyebrow = $('.eyebrow', hero);
      const lead = $('.lead', hero);
      const ctas = h1 ? h1.parentElement.querySelector('.d-flex.gap-2') : null;
      const proof = $$('.hero-proof > div', hero);
      const visual = $('.hero-visual', hero);
      const img = visual ? $(':scope > img', visual) : null;
      const badge = visual ? $('.hero-badge', visual) : null;
      let frame = null;
      if (img) {
        frame = document.createElement('div');
        frame.className = 'm-frame';
        img.replaceWith(frame);
        frame.appendChild(img);
      }

      const tl = gsap.timeline({ defaults: { ease: EASE }, delay: .1 });
      if (frame) {
        tl.fromTo(frame, { clipPath: 'inset(12% 0% 12% 30% round 14px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 14px)', duration: 1.7, ease: 'expo.inOut', clearProps: 'clipPath' }, 0);
        tl.fromTo(img, { scale: 1.4 }, { scale: 1.16, duration: 2.2 }, 0);
      }
      if (eyebrow) tl.fromTo(eyebrow, { opacity: 0, x: -24 * dirX() }, { opacity: 1, x: 0, duration: 1.2 }, .15);
      if (words.length) tl.fromTo(words, { yPercent: 115, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.4, stagger: .07 }, .2);
      if (lead) tl.fromTo(lead, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1.3 }, .55);
      if (ctas) tl.fromTo(ctas.children, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.1, stagger: .08 }, .7);
      if (proof.length) tl.fromTo(proof, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.1, stagger: .09 }, .85);
      if (badge) tl.fromTo(badge, { opacity: 0, y: 40, scale: .94 }, { opacity: 1, y: 0, scale: 1, duration: 1.3 }, 1.0);

      if (wide()) {
        const text = h1 ? h1.parentElement : null;
        const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
        // Background layer (photo inside its frame) — slowest.
        if (img) gsap.to(img, { yPercent: 6, ease: 'none', scrollTrigger: st });
        // Frame — mid speed.
        if (visual) gsap.to(visual, { y: -40, ease: 'none', scrollTrigger: st });
        // Foreground badge — fastest, slight sideways drift.
        if (badge) gsap.to(badge, { y: -140, x: -18 * dirX(), ease: 'none', scrollTrigger: st });
        // Text drifts up and softens as the hero leaves.
        if (text) gsap.to(text, { y: -70, opacity: .25, ease: 'none', scrollTrigger: { ...st, start: 'top top' } });
        // Whole hero recedes slightly.
        gsap.to($('.container-xl', hero), { scale: .94, transformOrigin: '50% 0%', ease: 'none', scrollTrigger: st });
      }
    }

    // Inner page heroes (about, services, contact…)
    $$('.page-hero').forEach(ph => {
      const h1 = $('h1', ph);
      const words = splitWords(h1);
      const bits = $$('.breadcrumb, .lead, .eyebrow', ph);
      const bg = $('img.bg', ph);
      const tl = gsap.timeline({ defaults: { ease: EASE }, delay: .05 });
      if (bg) tl.fromTo(bg, { scale: 1.35 }, { scale: 1.2, duration: 2.4 }, 0);
      if (words.length) tl.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 1.3, stagger: .055 }, .1);
      if (bits.length) tl.fromTo(bits, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.2, stagger: .1 }, .35);

      if (wide()) {
        const st = { trigger: ph, start: 'top top', end: 'bottom top', scrub: true };
        if (bg) gsap.to(bg, { yPercent: 8, ease: 'none', scrollTrigger: st });
        gsap.to($('.container-xl', ph), { y: -60, opacity: .35, scale: .97, transformOrigin: '0% 0%', ease: 'none', scrollTrigger: st });
      }
    });

    // Editorial hero (home-2)
    const h2h = $('.h2-hero');
    if (h2h) {
      const h1 = $('h1', h2h);
      const words = splitWords(h1);
      const bits = $$('.eyebrow, .lead', h2h);
      const frame = $('.hero-img', h2h);
      const img = frame ? $('img', frame) : null;
      const tl = gsap.timeline({ defaults: { ease: EASE }, delay: .05 });
      if (words.length) tl.fromTo(words, { yPercent: 115 }, { yPercent: 0, duration: 1.3, stagger: .05 }, .05);
      if (bits.length) tl.fromTo(bits, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, stagger: .1 }, .3);
      if (frame) tl.fromTo(frame, { clipPath: 'inset(18% 10% 0% 10% round 14px 14px 0 0)' }, { clipPath: 'inset(0% 0% 0% 0% round 14px 14px 0 0)', duration: 1.8, ease: 'expo.inOut', clearProps: 'clipPath' }, .2);
      if (img) tl.fromTo(img, { scale: 1.36 }, { scale: 1.18, duration: 2.2 }, .2);
      if (wide() && img) {
        gsap.to(img, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true } });
      }
    }
    clearPending();
  }

  /* ---------------------------------------------------------------
     5. Headings — word-by-word, once. Selected large type also moves
        with scroll.
  ---------------------------------------------------------------- */
  function initHeadings() {
    const sel = '.section-head h2, .immersive h2, .app-cta h2, .footer-cta h2, main .section h2[style*="font-size"], .split-copy h2';
    $$(sel).forEach(h => {
      if (h.closest('.hero, .page-hero, .h2-hero')) return;
      const words = splitWords(h);
      if (!words.length) return;
      const tl = gsap.timeline().fromTo(words, { yPercent: 118, rotate: 3 },
        { yPercent: 0, rotate: 0, duration: 1.25, ease: EASE, stagger: .045 });
      onceIn(h, tl, 'top 88%');

      // The paragraph/link that follows a heading lands a beat later.
      const head = h.closest('.section-head');
      if (head) {
        const extras = $$(':scope > p, :scope > div > p, :scope > .link-arrow, :scope > div > .eyebrow, :scope > .eyebrow', head).filter(x => x !== h);
        if (extras.length) onceIn(head, gsap.timeline().fromTo(extras, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, ease: EASE, stagger: .08, delay: .25 }), 'top 88%');
      }
    });

    if (!wide()) return;
    // Scroll-linked large type: footer headline slides against the scroll.
    const fcta = $('.footer-cta h2');
    if (fcta) gsap.fromTo(fcta, { x: 60 * dirX() }, { x: 0, ease: 'none', scrollTrigger: { trigger: fcta, start: 'top bottom', end: 'top 45%', scrub: 1 } });
    // Eyebrow rules drift sideways — small decorative movement.
    $$('main .section .eyebrow').forEach(e => {
      gsap.fromTo(e, { x: -16 * dirX() }, { x: 12 * dirX(), ease: 'none', scrollTrigger: { trigger: e, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* ---------------------------------------------------------------
     6. Media — clip-path reveals, zoom in, scale down on exit,
        inner parallax, horizontal drift.
  ---------------------------------------------------------------- */
  function initMedia() {
    const frames = $$('.split-media, .svc-img, .gallery-main, .location-card.tall');
    frames.forEach((frame, i) => {
      const img = $('img', frame);
      if (!img) return;
      const parallax = frame.matches('.split-media') && wide();
      frame.classList.add('m-clip');
      const radius = getComputedStyle(frame).borderRadius || '14px';
      const fromClip = i % 2 ? `inset(0% 0% 100% 0% round ${radius})` : `inset(100% 0% 0% 0% round ${radius})`;
      const tl = gsap.timeline({ defaults: { ease: 'expo.inOut' } })
        .fromTo(frame, { clipPath: fromClip }, { clipPath: `inset(0% 0% 0% 0% round ${radius})`, duration: 1.5, clearProps: 'clipPath' })
        .fromTo(img, { scale: 1.3 }, parallax ? { scale: 1.15, duration: 2, ease: EASE } : { scale: 1, duration: 2, ease: EASE, clearProps: 'transform' }, 0);
      onceIn(frame, tl, 'top 85%');

      if (!wide()) return;
      // Leaving the viewport: the whole frame eases back slightly.
      gsap.fromTo(frame, { scale: 1 }, { scale: .95, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: frame, start: 'bottom 55%', end: 'bottom top', scrub: true } });
    });

    // Large split image: the photo inside moves slower than the page.
    if (wide()) {
      $$('.split-media img').forEach(img => {
        gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none',
          scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }

    // Location cards: image drifts sideways inside the card while scrolling.
    $$('.location-card:not(.tall)').forEach((card, i) => {
      const img = $('img', card);
      if (!img || !wide()) return;
      const wrap = document.createElement('div');
      wrap.className = 'm-drift';
      img.replaceWith(wrap);
      wrap.appendChild(img);
      const dir = (i % 2 ? -1 : 1) * dirX();
      gsap.fromTo(wrap, { xPercent: -4 * dir, scale: 1.12 }, { xPercent: 4 * dir, scale: 1.12, ease: 'none',
        scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // Immersive band: no pinning (a pin adds a block of extra scroll space
    // under the section). Depth comes from layers moving at different speeds.
    $$('.immersive').forEach(sec => {
      const bg = $('img.bg', sec);
      const copy = $('.container-xl', sec);
      const list = $$('ul li', sec);
      const btn = $('.btn', sec);
      const para = $('p', sec);
      // Copy steps in once the band is well into view.
      const tl = gsap.timeline();
      if (para) tl.fromTo(para, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1.1, ease: EASE }, 0);
      if (list.length) tl.fromTo(list, { opacity: 0, x: -30 * dirX() }, { opacity: 1, x: 0, duration: 1, ease: EASE, stagger: .1 }, .15);
      if (btn) tl.fromTo(btn, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1, ease: EASE }, .45);
      onceIn(sec, tl, 'top 70%');
      if (!wide()) return;
      const st = { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true };
      // Background photo: slowest layer, settles from a slight zoom.
      if (bg) gsap.fromTo(bg, { scale: 1.2, yPercent: -6 }, { scale: 1, yPercent: 6, ease: 'none', scrollTrigger: st });
      // Copy: foreground layer, drifts against the photo.
      if (copy) gsap.fromTo(copy, { y: 60 }, { y: -40, ease: 'none', scrollTrigger: st });
      // The band opens from a soft clip as it rises into view.
      gsap.fromTo(sec, { clipPath: 'inset(0% 3% 0% 3% round 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top 25%', scrub: true } });
    });

    // App CTA phone floats faster than its section (foreground layer).
    const phone = $('.app-cta .phone');
    if (phone && wide()) {
      gsap.fromTo(phone, { y: 90, rotate: -4 * dirX() }, { y: -60, rotate: 2 * dirX(), ease: 'none',
        scrollTrigger: { trigger: phone.closest('.app-cta'), start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* ---------------------------------------------------------------
     7. Cards — staggered entrance with depth, not a flat fade.
  ---------------------------------------------------------------- */
  function initCards() {
    const sel = '.service-card, .vehicle-card, .pricing-card, .testimonial-card, .location-card:not(.tall), .team-card, .feature-item';
    const cards = $$(sel).filter(c => !c.closest('.hero, .immersive') && !(wide() && c.matches('.feature-item') && c.closest('.section-dark')));
    if (!cards.length) return;
    const desktop = wide();
    const from = desktop
      ? { opacity: 0, y: 90, rotateX: -12, scale: .94, transformOrigin: '50% 100%' }
      : { opacity: 0, y: 40 };
    gsap.set(cards, from);
    cards.forEach(c => c.classList.add('m-anim'));
    cards.forEach(c => c.parentElement && c.parentElement.classList.add('m-tilt-host'));

    const reveal = batch => gsap.to(batch, {
      opacity: 1, y: 0, rotateX: 0, scale: 1,
      duration: desktop ? 1.3 : 1, ease: EASE, stagger: { each: .1, from: 'start' },
      overwrite: true, clearProps: 'transform,opacity',
      onStart() { batch.forEach(b => { b.dataset.mIn = '1'; }); },
      onComplete() { batch.forEach(b => b.classList.remove('m-anim')); }
    });
    ScrollTrigger.batch(cards, { start: 'top 90%', onEnter: reveal, onEnterBack: reveal, interval: .12, batchMax: 4 });

    // Safety: after any refresh (filters, language switch), show cards that
    // are already above the fold or were revealed while hidden.
    ScrollTrigger.addEventListener('refresh', () => {
      const vh = window.innerHeight;
      cards.forEach(c => {
        if (c.dataset.mIn) return;
        const r = c.getBoundingClientRect();
        if (r.height && r.top < vh * .9) { c.dataset.mIn = '1'; gsap.to(c, { opacity: 1, y: 0, rotateX: 0, scale: 1, duration: .8, ease: EASE, clearProps: 'transform,opacity', onComplete() { c.classList.remove('m-anim'); } }); }
      });
    });

    // Anything else still using the old .reveal hook (text blocks, columns)
    const loose = $$('.reveal').filter(el => !el.querySelector(sel) && !el.closest('.immersive') && !el.matches(sel));
    loose.forEach(el => {
      const media = el.querySelector('.split-media, .phone');
      const kids = media ? [] : Array.from(el.children).filter(k => !k.matches('h2[data-split]'));
      const targets = kids.length > 1 ? kids : [el];
      onceIn(el, gsap.timeline().fromTo(targets, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.3, ease: EASE, stagger: .09 }), 'top 88%');
    });
  }

  /* ---------------------------------------------------------------
     8. Sections — layered depth. The content block of each section
        arrives slightly slower than the page (text vs. media speeds).
  ---------------------------------------------------------------- */
  function initSections() {
    if (!wide()) return;
    $$('main > section.section, main > .section').forEach(sec => {
      if (sec.matches('.immersive')) return;
      const inner = $(':scope > .container-xl', sec);
      if (!inner) return;
      gsap.fromTo(inner, { y: 70 }, { y: 0, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top 35%', scrub: 1.2 } });
    });

    // Sticky "why" section: heading stays pinned, the active promise lights up.
    $$('.section-dark').forEach(sec => {
      const items = $$('.feature-item', sec);
      const col = $('.row > .col-lg-4', sec);
      if (items.length < 3 || !col) return;
      sec.classList.add('m-why');
      col.classList.add('m-why-sticky');
      items.forEach(it => {
        ScrollTrigger.create({
          trigger: it, start: 'top 62%', end: 'bottom 38%',
          toggleClass: { targets: it, className: 'is-active' }
        });
      });
    });
  }

  /* ---------------------------------------------------------------
     9. Header nav indicator slides between links.
  ---------------------------------------------------------------- */
  function initNav() {
    // The scrolled state of the header is handled by main.js (paint-only, no
    // height change, no hide-on-scroll) so the sticky header stays put.

    const nav = $('.site-header .navbar-nav');
    if (!nav) return;
    const bar = document.createElement('span');
    bar.className = 'nav-indicator';
    bar.setAttribute('aria-hidden', 'true');
    nav.appendChild(bar);
    nav.classList.add('has-indicator');
    const links = $$(':scope > .nav-item > .nav-link', nav);
    const active = () => links.find(l => l.classList.contains('active'));
    const moveTo = link => {
      if (!link || !link.offsetWidth) { bar.style.opacity = '0'; return; }
      const nr = nav.getBoundingClientRect();
      const lr = link.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(link).paddingLeft) || 0;
      const w = Math.max(lr.width - pad * 2, 8);
      bar.style.transform = `translate3d(${lr.left - nr.left + pad}px,0,0) scaleX(${w})`;
      bar.style.opacity = '1';
    };
    links.forEach(l => {
      l.addEventListener('mouseenter', () => { nav.classList.add('is-hovering'); moveTo(l); });
      l.addEventListener('focus', () => moveTo(l));
    });
    nav.addEventListener('mouseleave', () => { nav.classList.remove('is-hovering'); moveTo(active()); });
    const place = () => moveTo(active());
    requestAnimationFrame(place);
    window.addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  }

  /* ---------------------------------------------------------------
     10. Progress bar + back-to-top (also used without GSAP).
  ---------------------------------------------------------------- */
  function initProgressAndTop(scroller) {
    if (!document.body || $('.to-top')) return;
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="ring-bg" cx="26" cy="26" r="24" fill="none" stroke-width="2"/><circle class="ring" cx="26" cy="26" r="24" fill="none" stroke-width="2" stroke-dasharray="150.8" stroke-dashoffset="150.8"/></svg><i class="bi bi-arrow-up" aria-hidden="true"></i>';
    document.body.appendChild(btn);
    const ring = btn.querySelector('.ring');

    btn.addEventListener('click', () => {
      if (scroller) scroller.scrollTo(0, { duration: 1.6 });
      else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      const skip = $('.site-header a, .site-header button');
      if (skip) skip.focus({ preventScroll: true });
    });

    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      bar.style.transform = `scaleX(${p})`;
      ring.style.strokeDashoffset = String(150.8 * (1 - p));
      btn.classList.toggle('is-visible', window.scrollY > 600);
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ---------------------------------------------------------------
     11. Pointer effects — desktop + fine pointer only.
  ---------------------------------------------------------------- */
  function initPointer() {
    if (!finePointer || !wide() || lowPower) return;

    // Cursor follower
    const ring = document.createElement('div');
    ring.className = 'm-cursor';
    const dot = document.createElement('div');
    dot.className = 'm-cursor-dot';
    document.body.append(ring, dot);
    const rx = gsap.quickTo(ring, 'x', { duration: .55, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: .55, ease: 'power3' });
    const dx = gsap.quickTo(dot, 'x', { duration: .12, ease: 'power3' });
    const dy = gsap.quickTo(dot, 'y', { duration: .12, ease: 'power3' });
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
      ring.classList.add('is-on'); dot.classList.add('is-on');
      const t = e.target;
      const text = t.closest && t.closest('input, textarea, select, [contenteditable]');
      const media = t.closest && t.closest('.location-card, .vehicle-media, .split-media, .svc-img, .gallery-main');
      const link = t.closest && t.closest('a, button, [role="tab"], label, summary');
      ring.classList.toggle('is-text', !!text);
      dot.classList.toggle('is-hidden', !!text || !!media);
      ring.classList.toggle('is-media', !!media && !text);
      ring.classList.toggle('is-link', !!link && !media && !text);
    }, { passive: true });
    document.addEventListener('mouseleave', () => { ring.classList.remove('is-on'); dot.classList.remove('is-on'); });

    // Magnetic buttons (large CTAs only — not every button)
    $$('.btn-lg, .store-btn, .footer-cta .btn').forEach(btn => {
      btn.classList.add('is-magnetic');
      const mx = gsap.quickTo(btn, 'x', { duration: .6, ease: 'power3' });
      const my = gsap.quickTo(btn, 'y', { duration: .6, ease: 'power3' });
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * .28);
        my((e.clientY - (r.top + r.height / 2)) * .38);
      });
      btn.addEventListener('pointerleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: .9, ease: 'elastic.out(1, .45)', overwrite: true });
      });
    });

    // 3D tilt on cards
    $$('.vehicle-card, .service-card, .pricing-card, .location-card').forEach(card => {
      let rect = null;
      const rX = gsap.quickTo(card, 'rotationX', { duration: .7, ease: 'power3' });
      const rY = gsap.quickTo(card, 'rotationY', { duration: .7, ease: 'power3' });
      const lift = gsap.quickTo(card, 'y', { duration: .7, ease: 'power3' });
      card.addEventListener('pointerenter', () => {
        if (card.classList.contains('m-anim')) return;
        rect = card.getBoundingClientRect();
        card.classList.add('is-tilting');
        lift(-6);
      });
      card.addEventListener('pointermove', e => {
        if (!rect) return;
        const px = (e.clientX - rect.left) / rect.width - .5;
        const py = (e.clientY - rect.top) / rect.height - .5;
        rY(px * 7); rX(-py * 7);
      });
      card.addEventListener('pointerleave', () => {
        rect = null;
        gsap.to(card, { rotationX: 0, rotationY: 0, y: 0, duration: .9, ease: 'power3.out', overwrite: true,
          onComplete() { card.classList.remove('is-tilting'); gsap.set(card, { clearProps: 'transform' }); } });
      });
    });
  }

  /* ---------------------------------------------------------------
     12. Keep ScrollTrigger honest when the page height changes
         (images loading, fleet filters, booking steps, language switch).
  ---------------------------------------------------------------- */
  function initRefresh() {
    let t = null;
    let lastH = document.body.scrollHeight;
    const schedule = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 220); };
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        const h = document.body.scrollHeight;
        if (Math.abs(h - lastH) > 40) { lastH = h; schedule(); }
      }).observe(document.body);
    }
    window.addEventListener('load', () => ScrollTrigger.refresh());
    new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['dir'] });
    ScrollTrigger.addEventListener('refresh', sweepPassed);
    mqReduce.addEventListener && mqReduce.addEventListener('change', () => location.reload());
  }

  /* ---------------------------------------------------------------
     Boot
  ---------------------------------------------------------------- */
  const boot = () => {
    try {
      initSmoothScroll();
      initNav();
      initHero();
      initHeadings();
      initMedia();
      initCards();
      initSections();
      initProgressAndTop(lenis);
      initPointer();
      initRefresh();
      ScrollTrigger.refresh();
      sweepPassed();
    } catch (err) {
      // Never leave the page half-hidden.
      console.error('[motion]', err);
      clearPending();
      root.classList.remove('motion-on');
      gsap.set('.m-word, .service-card, .vehicle-card, .pricing-card, .testimonial-card, .location-card, .team-card, .feature-item, .reveal, .reveal > *', { clearProps: 'all' });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
