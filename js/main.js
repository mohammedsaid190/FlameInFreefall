/* ==========================================================
   Flame in Freefall — page interactions & animation
   ========================================================== */
(() => {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FINE_POINTER = window.matchMedia("(pointer: fine)").matches;
  const EASE = "cubic-bezier(.22, 1, .36, 1)";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  document.body.classList.add("loading");

  /* ---------------- Loader ---------------- */
  function finishLoading() {
    const loader = $("#loader");
    loader.classList.add("done");
    document.body.classList.remove("loading");
    requestAnimationFrame(() => document.body.classList.add("ready"));
  }
  const minTime = REDUCED ? 0 : 900;
  const t0 = performance.now();
  window.addEventListener("load", () => setTimeout(finishLoading, Math.max(0, minTime - (performance.now() - t0))));
  setTimeout(() => { if (!document.body.classList.contains("ready")) finishLoading(); }, 3500);

  /* ---------------- Starfield ---------------- */
  const canvas = $("#stars");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, stars = [], shooting = null, mx = 0, my = 0, smx = 0, smy = 0;

  function initStars() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((W * H) / 2400);
    stars = Array.from({ length: count }, () => {
      const z = Math.random() ** 1.6 * .9 + .1;
      const tint = Math.random();
      return {
        x: Math.random() * W, y: Math.random() * H, z,
        r: Math.random() * 1.1 + .25,
        tw: Math.random() * Math.PI * 2, sp: .4 + Math.random() * 1.6,
        c: tint < .12 ? "180,225,255" : tint < .18 ? "255,214,170" : "235,240,255"
      };
    });
    if (REDUCED) drawStars(0);
  }

  function drawStars(time) {
    smx += (mx - smx) * .05; smy += (my - smy) * .05;
    const sy = window.scrollY;
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      let x = s.x - smx * s.z * 18;
      let y = s.y - sy * s.z * .12 - smy * s.z * 12;
      x = ((x % W) + W) % W; y = ((y % H) + H) % H;
      const a = (.35 + .65 * Math.abs(Math.sin(s.tw + time * .0007 * s.sp))) * (.35 + s.z * .65);
      ctx.fillStyle = `rgba(${s.c},${a})`;
      ctx.beginPath(); ctx.arc(x, y, s.r * (.6 + s.z * .7), 0, 6.2832); ctx.fill();
    }
    // Shooting star
    if (!shooting && Math.random() < .004) {
      const fromLeft = Math.random() < .5;
      shooting = { x: fromLeft ? Math.random() * W * .5 : W * .5 + Math.random() * W * .5, y: Math.random() * H * .4, vx: (fromLeft ? 1 : -1) * (7 + Math.random() * 5), vy: 3 + Math.random() * 2, life: 0 };
    }
    if (shooting) {
      const s = shooting; s.life++;
      s.x += s.vx; s.y += s.vy;
      const len = 14, alpha = Math.max(0, 1 - s.life / 70);
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * len, s.y - s.vy * len);
      g.addColorStop(0, `rgba(220,245,255,${alpha})`); g.addColorStop(1, "rgba(220,245,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * len, s.y - s.vy * len); ctx.stroke();
      if (alpha <= 0 || s.x < -200 || s.x > W + 200 || s.y > H + 200) shooting = null;
    }
    if (!REDUCED) requestAnimationFrame(drawStars);
  }
  initStars();
  if (!REDUCED) requestAnimationFrame(drawStars);
  let resizeT;
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { initStars(); positionIndicator(); layoutSegs(); }, 150); });

  /* ---------------- Hero orb: parallax + oxygen particles ---------------- */
  const orb = $("#orb");
  const o2Field = $("#o2Field");
  for (let i = 0; i < 26; i++) {
    const p = document.createElement("i");
    p.className = "o2";
    const size = orb.offsetWidth || 400;
    p.style.setProperty("--a", `${Math.random() * 360}deg`);
    p.style.setProperty("--r0", `${size * (.46 + Math.random() * .08)}px`);
    p.style.setProperty("--r1", `${size * .2}px`);
    p.style.setProperty("--t", `${3.5 + Math.random() * 3}s`);
    p.style.setProperty("--delay", `${-Math.random() * 6}s`);
    o2Field.appendChild(p);
  }
  window.addEventListener("pointermove", (e) => {
    mx = (e.clientX / W - .5) * 2; my = (e.clientY / H - .5) * 2;
    if (FINE_POINTER && !REDUCED) {
      orb.style.setProperty("--px", `${mx * -14}px`);
      orb.style.setProperty("--py", `${my * -14}px`);
    }
  }, { passive: true });

  /* ---------------- Nav: scroll state, progress, active link ---------------- */
  const nav = $("#nav");
  const progress = $("#progress");
  const navLinks = $$("#navLinks a");
  const indicator = $("#navIndicator");
  let lastY = window.scrollY, ticking = false;

  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle("scrolled", y > 30);
    const goingDown = y > lastY && y > 400 && !nav.classList.contains("open");
    nav.classList.toggle("hidden-up", goingDown);
    lastY = y;
    updateTimeline();
    ticking = false;
  }
  window.addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });

  function positionIndicator() {
    const active = $("#navLinks a.active");
    if (!active || window.innerWidth <= 920) { indicator.classList.remove("on"); return; }
    indicator.style.width = active.offsetWidth + "px";
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    indicator.classList.add("on");
  }
  const sectionIds = navLinks.map((a) => a.getAttribute("href").slice(1));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
      positionIndicator();
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sectionIds.forEach((id) => { const el = document.getElementById(id); if (el) spy.observe(el); });
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { navLinks.forEach((a) => a.classList.remove("active")); positionIndicator(); }
  }, { threshold: .5 }).observe($("#home"));

  $("#navToggle").addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    $("#navToggle").setAttribute("aria-expanded", open);
  });
  navLinks.forEach((a) => a.addEventListener("click", () => { nav.classList.remove("open"); $("#navToggle").setAttribute("aria-expanded", "false"); }));

  /* ---------------- Reveal on scroll ---------------- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      if (en.target.querySelector("[data-count]") || en.target.matches("[data-count]")) countUp(en.target);
      revealer.unobserve(en.target);
    });
  }, { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  const observeReveals = (root = document) => $$(".reveal:not(.in)", root).forEach((el) => revealer.observe(el));

  /* ---------------- Counters ---------------- */
  function countUp(root) {
    const els = root.matches("[data-count]") ? [root] : $$("[data-count]", root);
    els.forEach((el) => {
      const target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || "";
      if (REDUCED) { el.textContent = target + suffix; return; }
      const dur = 1800, start = performance.now();
      const step = (now) => {
        const t = clamp((now - start) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        el.textContent = Math.round(target * eased) + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* ---------------- Timeline progress ---------------- */
  const tlBox = $("#timeline"), tlProg = $("#timelineProgress");
  function updateTimeline() {
    const r = tlBox.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = clamp((vh * .6 - r.top) / r.height, 0, 1);
    tlProg.style.transform = `scaleY(${p})`;
  }

  /* ---------------- Magnetic buttons ---------------- */
  if (FINE_POINTER && !REDUCED) {
    $$(".magnetic").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * .18}px, ${y * .28}px)`;
      });
      btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
    });
  }

  /* ==========================================================
     Experiment cards
     ========================================================== */
  const grid = $("#xpGrid");
  const filtersEl = $("#filters");

  function cardHTML(x, i) {
    const g = GROUPS[x.group];
    const src = x.sources[0];
    return `
      <article class="xp-card reveal" data-group="${x.group}" data-id="${x.id}" style="--c:${g.color};--d:${(i % 3) * .08}s">
        <div class="xp-inner" tabindex="0" role="button" aria-expanded="false" aria-label="${esc(x.name)}: show details">
          <div class="xp-top"><span class="tag xp-tag">${esc(g.label)}</span><span class="xp-era">${esc(x.era)}</span></div>
          <h3 class="xp-name">${esc(x.name)}</h3>
          <p class="xp-full">${esc(x.full)}</p>
          <dl class="xp-specs">
            <div class="spec"><dt>Fuel</dt><dd>${esc(x.fuel)}</dd></div>
            <div class="spec"><dt>Oxygen</dt><dd>${esc(x.oxygen)}</dd></div>
            <div class="spec"><dt>Airflow</dt><dd>${esc(x.airflow)}</dd></div>
            <div class="spec"><dt>Where</dt><dd>${esc(x.hardware)}</dd></div>
          </dl>
          <p class="xp-finding">${esc(x.finding)}</p>
          <div class="xp-more"><div><div class="xp-more-inner">
            <div class="xp-moon"><h5>🌕 Why it matters for the Moon &amp; Mars</h5><p>${esc(x.moon)}</p></div>
          </div></div></div>
          <div class="xp-bottom">
            <a class="xp-source" href="${src.url}" target="_blank" rel="noopener">↗ ${esc(src.label)}</a>
            <span class="xp-toggle"><span class="plus">+</span><span class="tt">Moon &amp; Mars</span></span>
          </div>
        </div>
      </article>`;
  }
  grid.innerHTML = EXPERIMENTS.map(cardHTML).join("");

  const counts = EXPERIMENTS.reduce((m, x) => (m[x.group] = (m[x.group] || 0) + 1, m), {});
  filtersEl.innerHTML =
    `<button class="chip active" data-filter="all" role="tab" aria-selected="true">All <span class="count">${EXPERIMENTS.length}</span></button>` +
    Object.entries(GROUPS).map(([k, g]) => `<button class="chip" data-filter="${k}" role="tab" aria-selected="false"><i class="dot" style="background:${g.color};box-shadow:0 0 8px ${g.color}"></i>${g.label} <span class="count">${counts[k] || 0}</span></button>`).join("");

  // Expand / collapse
  function toggleCard(card) {
    const open = card.classList.toggle("open");
    const inner = card.querySelector(".xp-inner");
    inner.setAttribute("aria-expanded", open);
  }
  grid.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const card = e.target.closest(".xp-card");
    if (card) toggleCard(card);
  });
  grid.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("xp-inner")) {
      e.preventDefault(); toggleCard(e.target.closest(".xp-card"));
    }
  });

  // 3D tilt + spotlight
  if (FINE_POINTER && !REDUCED) {
    grid.addEventListener("pointermove", (e) => {
      const inner = e.target.closest(".xp-inner");
      if (!inner) return;
      const r = inner.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      inner.classList.add("tilting");
      inner.style.setProperty("--mx", `${px * 100}%`);
      inner.style.setProperty("--my", `${py * 100}%`);
      inner.style.setProperty("--ry", `${(px - .5) * 7}deg`);
      inner.style.setProperty("--rx", `${(.5 - py) * 7}deg`);
    });
    grid.addEventListener("pointerout", (e) => {
      const inner = e.target.closest(".xp-inner");
      if (!inner || inner.contains(e.relatedTarget)) return;
      inner.classList.remove("tilting");
      inner.style.setProperty("--rx", "0deg");
      inner.style.setProperty("--ry", "0deg");
    });
  }

  // Filter with FLIP animation
  let filtering = false;
  filtersEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn || filtering || btn.classList.contains("active")) return;
    filtering = true;
    $$("[data-filter]", filtersEl).forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-selected", b === btn); });
    const f = btn.dataset.filter;
    const cards = $$(".xp-card", grid);
    const match = (c) => f === "all" || c.dataset.group === f;
    const first = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
    const toHide = cards.filter((c) => !match(c) && !c.hidden);
    const toShow = cards.filter((c) => match(c) && c.hidden);

    if (!REDUCED && toHide.length) {
      await Promise.all(toHide.map((c) => c.animate(
        [{ opacity: 1, transform: "scale(1)", filter: "blur(0)" }, { opacity: 0, transform: "scale(.9)", filter: "blur(6px)" }],
        { duration: 260, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" }).finished));
    }
    toHide.forEach((c) => { c.hidden = true; c.getAnimations().forEach((a) => a.cancel()); });
    toShow.forEach((c) => { c.hidden = false; c.classList.add("in"); });

    if (!REDUCED) {
      let k = 0;
      cards.filter((c) => !c.hidden).forEach((c) => {
        const last = c.getBoundingClientRect();
        if (toShow.includes(c)) {
          c.animate([{ opacity: 0, transform: "translateY(24px) scale(.94)", filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }],
            { duration: 650, easing: EASE, delay: 60 * k++, fill: "backwards" });
        } else {
          const fr = first.get(c);
          const dx = fr.left - last.left, dy = fr.top - last.top;
          if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 650, easing: EASE });
        }
      });
    }
    setTimeout(() => { filtering = false; }, 300);
  });

  /* ==========================================================
     Comparison table
     ========================================================== */
  const tbody = $("#cmpBody");
  let sortKey = "relevance", sortDir = -1, focusSel = "all";

  function rowHTML(x) {
    const bars = Array.from({ length: 5 }, (_, k) => `<i class="${k < x.relevance ? "on" : ""}" style="--k:${k}"></i>`).join("");
    const tags = x.focus.map((f) => `<span class="tag ${FOCUS[f].tag}">${FOCUS[f].label}</span>`).join("");
    return `<tr data-id="${x.id}" data-focus="${x.focus.join(" ")}">
      <td class="name"><b>${esc(x.name)}</b><span>${esc(x.era)}</span></td>
      <td>${esc(x.fuelType)}</td>
      <td>${esc(x.hardwareShort)}</td>
      <td>${esc(x.oxygen)}</td>
      <td>${esc(x.airflow)}</td>
      <td class="result">${esc(x.result)}</td>
      <td><div class="focus-dots">${tags}</div></td>
      <td><div class="relev" title="${esc(x.relevanceWhy)}"><span class="relev-bar">${bars}</span><small>${x.relevance}/5</small></div></td>
    </tr>`;
  }
  tbody.innerHTML = EXPERIMENTS.map(rowHTML).join("");
  const rowById = new Map($$("tr", tbody).map((tr) => [tr.dataset.id, tr]));

  function sortRows(animate) {
    const rows = $$("tr", tbody);
    const first = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
    const sorted = [...EXPERIMENTS].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === "number") {
        if (!va && vb) return 1; if (va && !vb) return -1; // unknown values last
        return (va - vb) * sortDir || a.name.localeCompare(b.name);
      }
      return String(va).localeCompare(String(vb)) * sortDir;
    });
    sorted.forEach((x) => tbody.appendChild(rowById.get(x.id)));
    if (animate && !REDUCED) {
      rows.forEach((r) => {
        const dy = first.get(r) - r.getBoundingClientRect().top;
        if (dy) r.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 600, easing: EASE });
      });
    }
  }
  sortRows(false);
  $$("#cmpTable th[data-sort]").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.sort;
    sortDir = k === sortKey ? -sortDir : (["relevance", "oxygenNum", "airflowNum"].includes(k) ? -1 : 1);
    sortKey = k;
    $$("#cmpTable th").forEach((h) => h.classList.remove("sorted", "asc", "desc"));
    th.classList.add("sorted", sortDir === 1 ? "asc" : "desc");
    sortRows(true);
  }));
  $("#focusFilter").addEventListener("click", (e) => {
    const b = e.target.closest("[data-focus]");
    if (!b) return;
    focusSel = b.dataset.focus;
    $$("#focusFilter .chip").forEach((c) => c.classList.toggle("active", c === b));
    $$("tr", tbody).forEach((tr) => tr.classList.toggle("dimmed", focusSel !== "all" && !tr.dataset.focus.split(" ").includes(focusSel)));
  });

  /* ==========================================================
     Risk meter
     ========================================================== */
  const o2 = $("#o2"), flow = $("#flow");
  const state = { gravity: "moon", material: "cotton" };
  const PRESETS = {
    earth:   { o2: 21, flow: 5, gravity: "earth", material: "cotton" },
    iss:     { o2: 21, flow: 8, gravity: "micro", material: "cotton" },
    moon:    { o2: 30, flow: 8, gravity: "moon", material: "cotton" },
    fansoff: { o2: 30, flow: 0, gravity: "moon", material: "cotton" }
  };

  // Gauge ticks
  const ticks = $("#gaugeTicks");
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (1 - i / 10);
    const r1 = 84, r2 = i % 5 === 0 ? 74 : 78;
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", 120 + r1 * Math.cos(a)); l.setAttribute("y1", 120 - r1 * Math.sin(a));
    l.setAttribute("x2", 120 + r2 * Math.cos(a)); l.setAttribute("y2", 120 - r2 * Math.sin(a));
    ticks.appendChild(l);
  }

  function layoutSegs() {
    $$(".seg").forEach((seg) => {
      const active = $("button.active", seg), thumb = $(".seg-thumb", seg);
      if (!active) return;
      thumb.style.width = active.offsetWidth + "px";
      thumb.style.transform = `translateX(${active.offsetLeft}px)`;
    });
  }
  function setSeg(id, v) {
    state[id] = v;
    $$(`#${id} button`).forEach((b) => b.classList.toggle("active", b.dataset.v === v));
    layoutSegs();
  }
  ["gravity", "material"].forEach((id) => $(`#${id}`).addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    setSeg(id, b.dataset.v); clearPreset(); computeRisk();
  }));

  function paintRange(r) { r.style.setProperty("--p", ((r.value - r.min) / (r.max - r.min)) * 100 + "%"); }
  [o2, flow].forEach((r) => r.addEventListener("input", () => { clearPreset(); computeRisk(); }));
  function clearPreset() { $$("#presets .chip").forEach((c) => c.classList.remove("active")); }
  $("#presets").addEventListener("click", (e) => {
    const b = e.target.closest("[data-preset]"); if (!b) return;
    const p = PRESETS[b.dataset.preset];
    o2.value = p.o2; flow.value = p.flow; setSeg("gravity", p.gravity); setSeg("material", p.material);
    $$("#presets .chip").forEach((c) => c.classList.toggle("active", c === b));
    computeRisk();
  });

  let shownScore = 0, scoreAnim;
  function computeRisk() {
    paintRange(o2); paintRange(flow);
    const O = +o2.value, F = +flow.value, G = state.gravity, M = state.material;
    $("#o2Out").textContent = O + "%";
    $("#flowOut").textContent = F === 0 ? "Off" : F + " cm/s";

    const insights = [];
    // Oxygen
    const oF = clamp((O - 15) / 25, 0, 1);
    // Gravity: on Earth buoyancy feeds the flame even with fans off.
    const buoy = { earth: 1, mars: .55, moon: .35, micro: 0 }[G];
    const limit = G === "earth" ? 18 : 17; // BASS-II: 17% in microgravity vs 18% on Earth
    let flowF;
    if (F <= 1) flowF = .12 + buoy * .75;            // starved unless buoyancy supplies air
    else flowF = clamp(.45 + F / 14, 0, 1.15) * (1 - buoy * .15) + buoy * .25;
    flowF = clamp(flowF, .1, 1.2);
    const matF = { cotton: 1, pmma: .9, nomex: .5 }[M];
    const limitF = O < limit ? .25 : 1;
    let score = 100 * matF * (.18 + .82 * oF) * flowF * limitF;
    if (G !== "earth" && O >= limit && O <= 19) score *= 1.15; // flames hang on near the limit in low gravity
    score = Math.round(clamp(score, 2, 99));

    if (O >= 30) insights.push({ dir: "up", ico: "🫧", t: `${O}% oxygen is far richer than Earth's 21%. Moon habitats are planned at 30% or more, so materials ignite more easily.`, c: "Challenge brief" });
    else if (O > 21) insights.push({ dir: "up", ico: "🫧", t: `${O}% oxygen is above Earth's 21%, so materials burn more readily.`, c: "Challenge brief" });
    else if (O < limit) insights.push({ dir: "down", ico: "🧯", t: `Below ${limit}% oxygen, the BASS-II flames struggled to survive${G === "earth" ? " on Earth" : " even in microgravity"}.`, c: "BASS-II, NASA NTRS" });
    else insights.push({ dir: "flat", ico: "🌍", t: `${O}% oxygen is around Earth-normal air.`, c: "Challenge brief" });

    if (G !== "earth" && O >= 17 && O < 19) insights.push({ dir: "up", ico: "⚠️", t: "In low gravity, flames survived at 17% oxygen where Earth tests needed 18%. Earth tests can underestimate the risk.", c: "BASS-II, NASA NTRS" });

    if (F === 0 && G === "micro") insights.push({ dir: "down", ico: "🛑", t: "Fans off in orbit: with no airflow and no buoyancy, flames starve. BASS showed this puts fires out fast.", c: "BASS, NASA NTRS" });
    else if (F <= 1 && G !== "earth") insights.push({ dir: "down", ico: "🛑", t: "Fans off: BASS flames went out quickly without airflow. Weak Moon or Mars gravity still lets some hot gas rise, so the effect is smaller here.", c: "BASS, NASA NTRS (partial-gravity effect estimated)" });
    else if (F <= 1 && G === "earth") insights.push({ dir: "flat", ico: "🔥", t: "On Earth, turning fans off doesn't starve a fire, because buoyancy keeps pulling fresh air in.", c: "Basic combustion physics" });
    else if (F >= 10) insights.push({ dir: "up", ico: "💨", t: `Strong airflow (${F} cm/s) feeds the flame. In BASS, faster flow meant faster flame spread.`, c: "BASS, NASA NTRS" });
    else insights.push({ dir: "flat", ico: "💨", t: `Gentle airflow (${F} cm/s) supplies the oxygen a low-gravity flame needs.`, c: "BASS, NASA NTRS" });

    if (G === "moon" || G === "mars") insights.push({ dir: "flat", ico: G === "moon" ? "🌕" : "🔴", t: `NASA has no ${G === "moon" ? "Moon" : "Mars"}-gravity fire data yet. This estimate sits between the orbit and Earth results.`, c: "Challenge brief (LUCI, FM2 planned)" });

    if (M === "nomex") insights.push({ dir: "down", ico: "🧵", t: "Nomex is flame-resistant and was among the materials burned in Saffire-II.", c: "Saffire, NASA NTRS" });
    else if (M === "pmma") insights.push({ dir: "flat", ico: "🪟", t: "Acrylic (PMMA) window plastic was tested in Saffire-II.", c: "Saffire, NASA NTRS" });
    else insights.push({ dir: "up", ico: "👕", t: "Cotton-fiberglass fabric was the fuel in Saffire-I, the largest fire ever lit in space.", c: "Saffire, NASA NTRS" });

    // Paint gauge
    $("#gaugeFill").style.strokeDashoffset = 100 - score;
    $("#needle").style.transform = `rotate(${-90 + score * 1.8}deg)`;
    const level = score < 25 ? "low" : score < 50 ? "moderate" : score < 75 ? "high" : "severe";
    const lvl = $("#riskLevel");
    lvl.className = "risk-level " + level;
    lvl.textContent = level + " risk";

    // Animate number
    cancelAnimationFrame(scoreAnim);
    const from = shownScore, start = performance.now(), dur = REDUCED ? 1 : 900;
    const step = (now) => {
      const t = clamp((now - start) / dur, 0, 1), e = 1 - Math.pow(1 - t, 3);
      shownScore = Math.round(from + (score - from) * e);
      $("#riskScore").textContent = shownScore;
      if (t < 1) scoreAnim = requestAnimationFrame(step);
    };
    scoreAnim = requestAnimationFrame(step);

    // Insights (only re-render when content changes)
    const html = insights.map((x, k) => `<li class="insight ${x.dir}" style="--k:${k}"><span class="ico">${x.ico}</span><span>${esc(x.t)}<cite>Source: ${esc(x.c)}</cite></span></li>`).join("");
    const ul = $("#insights");
    if (ul.dataset.sig !== html) { ul.innerHTML = html; ul.dataset.sig = html; }
  }

  // Start the meter when it scrolls into view so the needle sweeps
  let meterStarted = false;
  new IntersectionObserver(([en], obs) => {
    if (en.isIntersecting && !meterStarted) { meterStarted = true; setTimeout(computeRisk, 350); obs.disconnect(); }
  }, { threshold: .35 }).observe($(".meter-out"));
  paintRange(o2); paintRange(flow);
  requestAnimationFrame(layoutSegs);

  /* ==========================================================
     Sources list
     ========================================================== */
  const seen = new Set();
  const list = Object.values(SOURCES).filter((s) => s.url.startsWith("http") && !seen.has(s.url) && seen.add(s.url));
  $("#sourceList").innerHTML = list.map((s) => {
    const host = new URL(s.url).hostname.replace(/^www\./, "");
    return `<li><a href="${s.url}" target="_blank" rel="noopener"><span>${esc(s.label)}</span><span>${esc(host)} ↗</span></a></li>`;
  }).join("");

  /* ---------------- Go ---------------- */
  observeReveals();
  onScroll();
  document.fonts && document.fonts.ready.then(() => { positionIndicator(); layoutSegs(); });
})();
