/*!
 * Kaarvan — dashboard.js
 * Lightweight, dependency-free SVG charts + app-shell behaviour for
 * /dashboard (admin) and /pages/user-dashboard.html.
 *
 * Charts are declared in HTML:
 *   <div class="chart" data-chart="line" data-labels="Jan,Feb,Mar"
 *        data-series='[{"name":"Revenue","values":[1,2,3]},{"name":"Target","values":[2,2,2],"alt":true}]'
 *        data-format="inr" aria-label="Revenue, last 6 months" role="img"></div>
 *   <div class="chart" data-chart="bar" ...same attributes...></div>
 *   <div class="donut-wrap" data-donut='[{"label":"Sedan","value":42}]'
 *        data-center="78%" data-sub="Utilised"></div>
 *
 * Range filters (reports / overview):
 *   <div class="seg" data-range-for="#chartA,#chartB">
 *     <button type="button" data-range="7d" aria-pressed="true">7 Days</button> ...
 *   </div>
 *
 * Swap in Chart.js / ApexCharts later by replacing renderChart() —
 * the data-* contract stays the same.
 */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const el = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  };

  const fmt = (v, type) => {
    if (type === 'inr') {
      if (v >= 1e7) return '₹' + (v / 1e7).toFixed(1) + 'Cr';
      if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + 'L';
      if (v >= 1e3) return '₹' + (v / 1e3).toFixed(0) + 'k';
      return '₹' + v;
    }
    if (type === 'pct') return v + '%';
    return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v);
  };
  const fmtFull = (v, type) =>
    type === 'inr' ? '₹' + Number(v).toLocaleString('en-IN') : type === 'pct' ? v + '%' : Number(v).toLocaleString('en-IN');

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const niceMax = (max) => {
    if (max <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const n = max / pow;
    const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => n <= x);
    return step * pow;
  };

  const parse = (str, fallback) => {
    try { return JSON.parse(str); } catch (e) { return fallback; }
  };

  /* ------------------------------------------------------------
   * Line + bar charts
   * ---------------------------------------------------------- */
  function renderChart(host) {
    const type = host.dataset.chart;
    const labels = (host.dataset.labels || '').split(',').map((s) => s.trim());
    const series = parse(host.dataset.series, []);
    const format = host.dataset.format || '';
    if (!series.length) return;

    host.innerHTML = '';
    host.style.direction = 'ltr';
    const W = Math.max(host.clientWidth, 280);
    const H = Math.max(host.clientHeight, 160);
    const pad = { t: 16, r: 12, b: 28, l: 48 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;

    const all = series.flatMap((s) => s.values);
    const max = niceMax(Math.max(...all) * 1.08);
    const y = (v) => pad.t + ih - (v / max) * ih;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });

    // grid + y axis
    for (let i = 0; i <= 4; i++) {
      const v = (max / 4) * i;
      const gy = y(v);
      svg.appendChild(el('line', { class: 'grid-line', x1: pad.l, x2: W - pad.r, y1: gy, y2: gy }));
      const t = el('text', { class: 'axis-text', x: pad.l - 8, y: gy + 4, 'text-anchor': 'end' });
      t.textContent = fmt(Math.round(v), format);
      svg.appendChild(t);
    }

    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.setAttribute('role', 'status');

    const showTip = (x, yy, html) => {
      tip.innerHTML = html;
      tip.style.left = x + 'px';
      tip.style.top = yy + 'px';
      tip.classList.add('show');
    };
    const hideTip = () => tip.classList.remove('show');

    const n = labels.length;
    // x labels — thin out on narrow widths
    const every = Math.ceil(n / Math.max(2, Math.floor(iw / 56)));

    if (type === 'bar') {
      const group = iw / n;
      const barW = Math.min(28, (group * 0.7) / series.length);
      labels.forEach((lab, i) => {
        const gx = pad.l + group * i + group / 2;
        if (i % every === 0) {
          const t = el('text', { class: 'axis-text', x: gx, y: H - 8, 'text-anchor': 'middle' });
          t.textContent = lab;
          svg.appendChild(t);
        }
        series.forEach((s, si) => {
          const v = s.values[i] || 0;
          const bx = gx - (barW * series.length) / 2 + si * barW + 1;
          const by = y(v);
          const h = pad.t + ih - by;
          const r = el('rect', {
            class: 'bar' + (s.alt ? ' alt' : ''),
            x: bx, width: Math.max(barW - 2, 2), rx: 2,
            y: reduced ? by : pad.t + ih, height: reduced ? h : 0,
          });
          r.addEventListener('mouseenter', () => showTip(bx + barW / 2, by, `${lab} · ${s.name}: ${fmtFull(v, format)}`));
          r.addEventListener('mouseleave', hideTip);
          svg.appendChild(r);
          if (!reduced) {
            requestAnimationFrame(() => {
              r.style.transition = 'y .6s cubic-bezier(.2,.7,.2,1), height .6s cubic-bezier(.2,.7,.2,1)';
              r.setAttribute('y', by);
              r.setAttribute('height', h);
            });
          }
        });
      });
    } else {
      const x = (i) => pad.l + (n === 1 ? iw / 2 : (iw / (n - 1)) * i);
      labels.forEach((lab, i) => {
        if (i % every !== 0 && i !== n - 1) return;
        const t = el('text', { class: 'axis-text', x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' });
        t.textContent = lab;
        svg.appendChild(t);
      });

      series.forEach((s) => {
        const pts = s.values.map((v, i) => [x(i), y(v)]);
        const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
        if (!s.alt) {
          svg.appendChild(el('path', { class: 'area-path', d: `${d} L${x(n - 1)} ${pad.t + ih} L${x(0)} ${pad.t + ih} Z` }));
        }
        const path = el('path', { class: 'line-path' + (s.alt ? ' alt' : ''), d });
        svg.appendChild(path);
        if (!reduced && !s.alt) {
          const len = path.getTotalLength ? 2000 : 0;
          path.style.strokeDasharray = len;
          path.style.strokeDashoffset = len;
          requestAnimationFrame(() => {
            path.style.transition = 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)';
            path.style.strokeDashoffset = 0;
          });
        }
      });

      // hover rail
      const rail = el('line', { class: 'grid-line', y1: pad.t, y2: pad.t + ih, x1: 0, x2: 0, 'stroke-dasharray': '3 3', visibility: 'hidden' });
      svg.appendChild(rail);
      const dot = el('circle', { class: 'dot', r: 5, cx: 0, cy: 0, visibility: 'hidden' });
      svg.appendChild(dot);
      const hit = el('rect', { x: pad.l, y: pad.t, width: iw, height: ih, fill: 'transparent' });
      hit.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * W;
        const i = Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1))));
        const cx = x(i);
        const cy = y(series[0].values[i]);
        rail.setAttribute('x1', cx); rail.setAttribute('x2', cx); rail.setAttribute('visibility', 'visible'); dot.setAttribute('visibility', 'visible');
        dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
        const rows = series.map((s) => `${s.name}: ${fmtFull(s.values[i], format)}`).join('<br>');
        showTip((cx / W) * rect.width, (cy / H) * rect.height, `<span style="opacity:.7">${labels[i]}</span><br>${rows}`);
      });
      hit.addEventListener('mouseleave', () => {
        hideTip();
        rail.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden');
      });
      svg.appendChild(hit);
    }

    host.appendChild(svg);
    host.appendChild(tip);

    // accessible data fallback (visually hidden table)
    const table = document.createElement('table');
    table.className = 'visually-hidden';
    table.innerHTML = `<caption>${host.getAttribute('aria-label') || 'Chart data'}</caption>
      <thead><tr><th scope="col">Label</th>${series.map((s) => `<th scope="col">${s.name}</th>`).join('')}</tr></thead>
      <tbody>${labels.map((l, i) => `<tr><th scope="row">${l}</th>${series.map((s) => `<td>${fmtFull(s.values[i], format)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    host.appendChild(table);
  }

  /* ------------------------------------------------------------
   * Donut
   * ---------------------------------------------------------- */
  function renderDonut(host) {
    const data = parse(host.dataset.donut, []);
    if (!data.length) return;
    const palette = [cssVar('--text') || '#15171A', cssVar('--k-amber') || '#D4A24C', cssVar('--k-steel') || '#8C9299', cssVar('--line-strong') || '#CFCAC0', '#6B7A5E', '#3D5A80'];
    const total = data.reduce((a, d) => a + d.value, 0);
    const R = 70, C = 2 * Math.PI * R;
    host.innerHTML = '';

    const svg = el('svg', { class: 'donut', viewBox: '0 0 180 180', role: 'img', 'aria-label': host.getAttribute('aria-label') || 'Distribution' });
    svg.appendChild(el('circle', { cx: 90, cy: 90, r: R, fill: 'none', stroke: cssVar('--surface-2') || '#eee', 'stroke-width': 18 }));
    let offset = 0;
    data.forEach((d, i) => {
      const len = (d.value / total) * C;
      const c = el('circle', {
        cx: 90, cy: 90, r: R, fill: 'none',
        stroke: d.color || palette[i % palette.length],
        'stroke-width': 18,
        'stroke-dasharray': reduced ? `${Math.max(len - 2, 0)} ${C}` : `0 ${C}`,
        'stroke-dashoffset': -offset,
        transform: 'rotate(-90 90 90)',
      });
      const tt = el('title');
      tt.textContent = `${d.label}: ${Math.round((d.value / total) * 100)}%`;
      c.appendChild(tt);
      svg.appendChild(c);
      if (!reduced) requestAnimationFrame(() => requestAnimationFrame(() => c.setAttribute('stroke-dasharray', `${Math.max(len - 2, 0)} ${C}`)));
      offset += len;
    });
    const t1 = el('text', { class: 'donut-center', x: 90, y: 92, 'text-anchor': 'middle' });
    t1.textContent = host.dataset.center || total;
    const t2 = el('text', { class: 'donut-sub', x: 90, y: 112, 'text-anchor': 'middle' });
    t2.textContent = host.dataset.sub || 'Total';
    svg.append(t1, t2);

    const legend = document.createElement('ul');
    legend.className = 'legend list-unstyled m-0 d-grid gap-2';
    legend.innerHTML = data.map((d, i) =>
      `<li><span><i style="background:${d.color || palette[i % palette.length]}"></i>${d.label} <strong class="ms-1" style="color:var(--text)">${Math.round((d.value / total) * 100)}%</strong></span></li>`
    ).join('');
    host.append(svg, legend);
  }

  const renderAll = () => {
    $$('[data-chart]').forEach(renderChart);
    $$('[data-donut]').forEach(renderDonut);
  };

  /* ------------------------------------------------------------
   * Range filters — regenerate demo data per range.
   * Replace generate() with a fetch to your analytics API:
   *   fetch(`/api/reports?range=${range}&metric=${host.id}`)
   * ---------------------------------------------------------- */
  const RANGE_LABELS = {
    today: ['6a', '8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'],
    '7d': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    '30d': Array.from({ length: 10 }, (_, i) => `${i * 3 + 1}`),
    '3m': ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
    '12m': ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  };
  const RANGE_SCALE = { today: 0.05, '7d': 0.25, '30d': 1, '3m': 3, '12m': 12, custom: 1 };

  function seeded(seed) {
    let s = seed;
    return () => (s = (s * 9301 + 49297) % 233280) / 233280;
  }

  function regenerate(host, range) {
    if (!host.dataset.baseSeries) host.dataset.baseSeries = host.dataset.series;
    const base = parse(host.dataset.baseSeries, []);
    const labels = RANGE_LABELS[range] || RANGE_LABELS['30d'];
    const scale = RANGE_SCALE[range] || 1;
    const rnd = seeded(labels.length * 97 + (host.id || '').length * 13);
    const series = base.map((s) => {
      const avg = s.values.reduce((a, b) => a + b, 0) / s.values.length;
      const per = (avg * scale * s.values.length) / labels.length;
      return { ...s, values: labels.map((_, i) => Math.round(per * (0.7 + rnd() * 0.5 + i * 0.015))) };
    });
    host.dataset.labels = labels.join(',');
    host.dataset.series = JSON.stringify(series);
    renderChart(host);
  }

  $$('[data-range-for]').forEach((seg) => {
    const targets = seg.dataset.rangeFor.split(',').map((s) => $(s.trim())).filter(Boolean);
    const custom = seg.dataset.customPanel ? $(seg.dataset.customPanel) : null;
    const status = seg.dataset.rangeStatus ? $(seg.dataset.rangeStatus) : null;
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-range]');
      if (!btn) return;
      $$('button[data-range]', seg).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      const range = btn.dataset.range;
      if (custom) custom.hidden = range !== 'custom';
      if (range === 'custom') return;
      targets.forEach((t) => regenerate(t, range));
      if (status) status.textContent = `Showing: ${btn.textContent.trim()}`;
    });
    if (custom) {
      const form = custom.matches('form') ? custom : $('form', custom);
      form && form.addEventListener('submit', (e) => {
        e.preventDefault();
        targets.forEach((t) => regenerate(t, 'custom'));
        const from = form.querySelector('[name=from]')?.value;
        const to = form.querySelector('[name=to]')?.value;
        if (status) status.textContent = `Showing: ${from || '…'} to ${to || '…'}`;
        window.KaarvanToast && window.KaarvanToast('Custom range applied', 'bi-calendar-check');
      });
    }
  });

  // Generic segmented controls (no chart binding) — just toggle pressed state
  $$('.seg:not([data-range-for])').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      $$('button', seg).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    });
  });

  /* ------------------------------------------------------------
   * Sidebar (mobile/tablet drawer)
   * ---------------------------------------------------------- */
  const shell = $('.app-shell');
  if (shell) {
    const side = $('.app-side', shell);
    const toggles = $$('.side-toggle');
    const overlay = $('.app-overlay', shell);
    let lastFocus = null;
    const setOpen = (open) => {
      shell.classList.toggle('side-open', open);
      toggles.forEach((t) => t.setAttribute('aria-expanded', String(open)));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) {
        lastFocus = document.activeElement;
        const first = side && side.querySelector('a, button');
        first && first.focus();
      } else if (lastFocus) {
        lastFocus.focus();
      }
    };
    toggles.forEach((t) => t.addEventListener('click', () => setOpen(!shell.classList.contains('side-open'))));
    overlay && overlay.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && shell.classList.contains('side-open')) setOpen(false);
    });
    window.matchMedia('(min-width: 1200px)').addEventListener('change', (m) => m.matches && setOpen(false));
  }

  /* ------------------------------------------------------------
   * Tables: select-all, row actions, filter bar
   * ---------------------------------------------------------- */
  $$('[data-select-all]').forEach((master) => {
    const table = master.closest('table');
    const boxes = () => $$('tbody input[type=checkbox]', table);
    const bulk = master.dataset.selectAll ? $(master.dataset.selectAll) : null;
    const sync = () => {
      const b = boxes();
      const n = b.filter((x) => x.checked).length;
      master.checked = n === b.length && n > 0;
      master.indeterminate = n > 0 && n < b.length;
      if (bulk) {
        bulk.hidden = n === 0;
        const c = bulk.querySelector('[data-selected-count]');
        if (c) c.textContent = n;
      }
    };
    master.addEventListener('change', () => { boxes().forEach((b) => (b.checked = master.checked)); sync(); });
    table.addEventListener('change', (e) => { if (e.target.matches('tbody input[type=checkbox]')) sync(); });
  });

  // Row actions: data-action="view|edit|cancel|assign|invoice|delete"
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const row = btn.closest('tr');
    const id = row ? (row.dataset.id || row.querySelector('td, th')?.textContent.trim()) : '';
    const action = btn.dataset.action;
    const messages = {
      view: ['Opening ' + id, 'bi-eye'],
      edit: ['Editing ' + id, 'bi-pencil'],
      cancel: [id + ' marked for cancellation', 'bi-x-circle'],
      assign: ['Driver assignment opened for ' + id, 'bi-person-check'],
      invoice: ['Invoice for ' + id + ' queued for download', 'bi-download'],
      delete: [id + ' removed', 'bi-trash3'],
    };
    if (action === 'delete' || action === 'cancel') {
      if (!window.confirm(`Are you sure? This will ${action} ${id}.`)) return;
      if (row && action === 'delete') {
        row.style.transition = 'opacity .25s';
        row.style.opacity = '0';
        setTimeout(() => row.remove(), 260);
      }
      if (row && action === 'cancel') {
        const badge = row.querySelector('[class*="status-"]');
        if (badge) { badge.className = 'status status-cancelled'; badge.textContent = 'Cancelled'; }
      }
    }
    if (btn.dataset.bsToggle) return; // let Bootstrap modals handle it
    const m = messages[action];
    if (m && window.KaarvanToast) window.KaarvanToast(m[0], m[1]);
  });

  // Filter bar: selects with data-col filter rows whose [data-col-*] match
  $$('[data-table-filter]').forEach((bar) => {
    const table = $(bar.dataset.tableFilter);
    if (!table) return;
    const count = bar.dataset.filterCount ? $(bar.dataset.filterCount) : null;
    const apply = () => {
      const filters = $$('select[data-col], input[data-col]', bar).map((f) => [f.dataset.col, f.value.trim().toLowerCase()]);
      let shown = 0;
      $$('tbody tr', table).forEach((tr) => {
        const ok = filters.every(([col, val]) => {
          if (!val || val === 'all') return true;
          if (col === 'q') return tr.textContent.toLowerCase().includes(val);
          return (tr.dataset[col] || '').toLowerCase() === val;
        });
        tr.hidden = !ok;
        if (ok) shown++;
      });
      if (count) count.textContent = shown;
    };
    bar.addEventListener('input', apply);
    bar.addEventListener('change', apply);
    bar.addEventListener('reset', () => setTimeout(apply, 0));
  });

  /* ------------------------------------------------------------
   * Messages: conversation switching + reply
   * ---------------------------------------------------------- */
  const inbox = $('[data-inbox]');
  if (inbox) {
    const convos = $$('.convo', inbox);
    const body = $('.chat-body', inbox);
    const head = $('.chat-head', inbox);
    const form = $('.chat-foot', inbox);
    const threads = window.KAARVAN_THREADS || {};

    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const loadThread = (btn) => {
      convos.forEach((c) => {
        c.setAttribute('aria-selected', String(c === btn));
        c.tabIndex = c === btn ? 0 : -1;
      });
      btn.classList.remove('unread');
      btn.querySelector('.unread-dot')?.remove();
      const id = btn.dataset.thread;
      const t = threads[id];
      if (head) {
        const name = btn.querySelector('strong')?.textContent || '';
        const img = btn.querySelector('img')?.getAttribute('src') || '';
        const meta = btn.dataset.meta || '';
        head.querySelector('[data-chat-name]') && (head.querySelector('[data-chat-name]').textContent = name);
        head.querySelector('[data-chat-meta]') && (head.querySelector('[data-chat-meta]').textContent = meta);
        const av = head.querySelector('img');
        if (av && img) av.src = img;
      }
      if (body && t) {
        body.innerHTML = `<div class="day-sep">Today</div>` +
          t.map((m) => `<div class="msg ${m.dir}">${esc(m.text)}<time>${m.time}</time></div>`).join('');
        body.scrollTop = body.scrollHeight;
      }
      const badge = $('[data-unread-total]');
      if (badge) badge.textContent = $$('.convo.unread', inbox).length;
    };

    convos.forEach((c) => c.addEventListener('click', () => loadThread(c)));
    // roving tabindex with arrow keys on the listbox
    inbox.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('convo')) return;
      const visible = convos.filter((c) => !c.hidden);
      const i = visible.indexOf(e.target);
      let next = null;
      if (e.key === 'ArrowDown') next = visible[i + 1];
      if (e.key === 'ArrowUp') next = visible[i - 1];
      if (next) { e.preventDefault(); next.focus(); loadThread(next); }
    });

    form && form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type=text], textarea');
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const node = document.createElement('div');
      node.className = 'msg out';
      node.innerHTML = `${esc(text)}<time>${now} · Sent</time>`;
      body.appendChild(node);
      body.scrollTop = body.scrollHeight;
      const active = convos.find((c) => c.getAttribute('aria-selected') === 'true');
      if (active) {
        const p = active.querySelector('p'); if (p) p.textContent = 'You: ' + text;
        const id = active.dataset.thread;
        (threads[id] = threads[id] || []).push({ dir: 'out', text, time: now });
      }
      input.value = '';
      // Integration point: POST to your messaging API / websocket here.
    });

    const attach = $('[data-attach]', inbox);
    const file = $('input[type=file]', inbox);
    attach && file && attach.addEventListener('click', () => file.click());
    file && file.addEventListener('change', () => {
      if (file.files.length && window.KaarvanToast) window.KaarvanToast(`${file.files[0].name} attached (placeholder)`, 'bi-paperclip');
    });

    const first = convos.find((c) => c.getAttribute('aria-selected') === 'true') || convos[0];
    first && loadThread(first);
  }

  /* ------------------------------------------------------------
   * Settings: scroll-spy nav + save bar
   * ---------------------------------------------------------- */
  const sNav = $('.settings-nav');
  if (sNav && 'IntersectionObserver' in window) {
    const links = $$('a[href^="#"]', sNav);
    const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          links.forEach((l) => { l.classList.remove('active'); l.removeAttribute('aria-current'); });
          const a = map.get(en.target.id);
          if (a) { a.classList.add('active'); a.setAttribute('aria-current', 'true'); }
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); s && io.observe(s); });
  }

  $$('form[data-settings-form]').forEach((form) => {
    const bar = $(form.dataset.settingsForm);
    form.addEventListener('input', () => bar && (bar.hidden = false));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      btn && btn.classList.add('is-loading');
      setTimeout(() => {
        btn && btn.classList.remove('is-loading');
        bar && (bar.hidden = true);
        window.KaarvanToast && window.KaarvanToast('Settings saved', 'bi-check2-circle');
      }, 700);
    });
  });

  // Brand colour preview in settings
  $$('input[type=color][data-preview]').forEach((inp) => {
    const target = $(inp.dataset.preview);
    const upd = () => target && (target.style.background = inp.value);
    inp.addEventListener('input', upd); upd();
  });

  // Invoice preview: fill modal from row data-*
  const invModal = $('#invoiceModal');
  if (invModal) {
    invModal.addEventListener('show.bs.modal', (e) => {
      const row = e.relatedTarget && e.relatedTarget.closest('tr');
      if (!row) return;
      ['txn', 'customer', 'booking', 'amount', 'method', 'date', 'status'].forEach((k) => {
        const slot = invModal.querySelector(`[data-inv="${k}"]`);
        if (slot && row.dataset[k]) slot.textContent = row.dataset[k];
      });
      const amt = parseFloat((row.dataset.amount || '0').replace(/[^\d.]/g, ''));
      const base = Math.round(amt / 1.05);
      const set = (k, v) => { const s = invModal.querySelector(`[data-inv="${k}"]`); if (s) s.textContent = '₹' + v.toLocaleString('en-IN'); };
      set('subtotal', base); set('tax', amt - base); set('total', amt);
    });
  }

  // Customer profile view: fill offcanvas from row
  const profile = $('#customerProfile');
  if (profile) {
    profile.addEventListener('show.bs.offcanvas', (e) => {
      const row = e.relatedTarget && e.relatedTarget.closest('tr');
      if (!row) return;
      Object.keys(row.dataset).forEach((k) => {
        const slot = profile.querySelector(`[data-p="${k}"]`);
        if (!slot) return;
        if (slot.tagName === 'IMG') slot.src = row.dataset[k]; else slot.textContent = row.dataset[k];
      });
    });
  }

  /* ------------------------------------------------------------
   * Render + theme/resize hooks
   * ---------------------------------------------------------- */
  renderAll();
  document.addEventListener('themechange', () => requestAnimationFrame(renderAll));
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderAll, 180); });

  window.KaarvanCharts = { render: renderAll, renderChart, renderDonut, regenerate };
})();
