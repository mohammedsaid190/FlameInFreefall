/* ==========================================================
   FlameBot — retrieval + Chrome built-in AI (Gemini Nano)
   Rule 1: NASA question     -> answer from knowledge file + source
   Rule 2: general science   -> AI's own knowledge, labelled
   Rule 3: unrelated         -> polite redirect
   If the on-device AI is unavailable, keyword search still answers.
   ========================================================== */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const GREETING = "Hi! I'm FlameBot. How can I help you?";
  const REDIRECT = "I specialise in NASA fire-safety research. Ask me about that! 🔥🚀";
  const SHOWCASE = [
    "What should astronauts do first if a fire starts?",
    "Why is a flame round in space?",
    "Can fire burn without a visible flame?",
    "What was the biggest fire ever lit in space?",
    "Is fire more dangerous in space?",
    "Where are smoke detectors on the ISS?"
  ];

  /* ---------------- Knowledge file ---------------- */
  const STOP = new Set(("a an the is are was were be been being of in on at to for and or but what why how when where who whom which " +
    "does do did can could would should will shall it its this that these those i you me my we our your about with from by as into " +
    "than then there their they them if so not no yes please tell explain give us much many more most any some very just also " +
    "get got has have had there's what's whats it's").split(" "));
  const LOW = new Set(["fire", "flame", "space", "nasa", "astronaut", "iss", "station", "oxygen", "burn", "experiment"]);
  const SYN = { "o2": "oxygen", "o₂": "oxygen", "fires": "fire", "flames": "flame", "astronauts": "astronaut", "crew": "astronaut", "extinguished": "extinguish" };
  const stem = (w) => {
    w = SYN[w] || w;
    if (w.length > 4) w = w.replace(/(ing|edly|ed|es|s)$/, "");
    if (w.length > 4) w = w.replace(/e$/, "");
    return w;
  };
  const norm = (s) => " " + s.toLowerCase().replace(/o₂/g, "o2").replace(/[^a-z0-9%\-\s]/g, " ").replace(/\s+/g, " ").trim() + " ";
  const toks = (s) => norm(s).trim().split(" ").filter((w) => w && !STOP.has(w)).map(stem);

  const KB = [];
  EXPERIMENTS.forEach((x) => KB.push({
    kind: "xp", title: `${x.name}: ${x.full}`,
    context: `${x.name} (${x.full}, ${x.era}). Where: ${x.hardware}. Fuel: ${x.fuel}. Oxygen: ${x.oxygen}. Airflow: ${x.airflow}. Finding: ${x.finding} Why it matters for Moon/Mars: ${x.moon}`,
    answer: `${x.name} (${x.full}): ${x.finding} Why it matters: ${x.moon}`,
    kw: x.keywords.concat([x.name.toLowerCase()]), sources: x.sources
  }));
  QA.forEach((e) => KB.push({ kind: "qa", title: e.q, context: `Q: ${e.q} A: ${e.a}`, answer: e.a, kw: e.k, sources: e.s }));
  GLOSSARY.forEach((g) => KB.push({ kind: "gl", title: g.t, context: `${g.t}: ${g.d}`, answer: `${g.t}: ${g.d}`, kw: g.k.concat(["what is " + g.t.toLowerCase(), "define " + g.t.toLowerCase()]), sources: [SOURCES.glossary] }));
  KB.forEach((e) => {
    e.kwN = e.kw.map((k) => k.toLowerCase());
    e.kwT = new Set(e.kwN.flatMap(toks));
    e.titleT = new Set(toks(e.title));
    e.textT = new Set(toks(e.context));
  });

  // Is the question about our domain at all?
  const DOMAIN = /(fire|flam|burn|smok|oxygen|\bo2\b|combust|extingu|detector|alarm|ignit|soot|spacesuit|\bsuit|website|\bsite\b|flamebot|\bbot\b|\byou\b|meter|gauge|\bpsi\b|ntrs|\bdata|bass|saffire|\bflex|acme|\bcfi|cygnus|\bmir\b|apollo|kvant|microgravity|gravity|buoyan|diffus|rocket|propellant|nitrogen|monoxide|formaldehyde|\bcir\b|mdca|glovebox|\bvent|airflow|\bfans?\b|particle|aerosol|mist|firefighter|offline|internet|wi-?fi|extinction|habitat|rover|artemis)/i;
  const isDomain = (q) => DOMAIN.test(q) || /\bSAME(-R)?\b/.test(q);

  function retrieve(question, n = 3) {
    const qn = norm(question);
    const qt = toks(question);
    const scored = KB.map((e) => {
      let s = 0;
      for (const k of e.kwN) {
        if (qn.includes(" " + k + " ") || (k.includes(" ") && qn.includes(k))) s += k.includes(" ") ? 5 : 2.5;
      }
      for (const t of qt) {
        const w = LOW.has(t) ? .3 : 1;
        if (e.kwT.has(t)) s += 2 * w;
        else if (e.titleT.has(t)) s += 1.5 * w;
        else if (e.textT.has(t)) s += .5 * w;
      }
      if (e.kind === "qa") s *= 1.1; // prefer hand-written answers on ties
      return { e, s };
    }).sort((a, b) => b.s - a.s);
    return scored.slice(0, n).filter((r) => r.s > 0);
  }

  /* ---------------- Chrome built-in AI ---------------- */
  const LM = self.LanguageModel;
  const LM_OPTS = { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] };
  const SYSTEM = "You are FlameBot, a friendly assistant on a NASA Space Apps website about fire safety in microgravity. " +
    "Keep answers short: 2 to 4 sentences, plain English, no markdown, no lists. Never invent numbers, dates or experiment names.";
  let aiState = "none";   // none | downloadable | downloading | available
  let baseSession = null;

  const statusEl = $("#chatStatus");
  function setStatus(kind, text) {
    statusEl.className = "chat-status " + kind;
    statusEl.querySelector("span").textContent = text;
  }

  async function checkAI() {
    if (!LM || !LM.availability) { aiState = "none"; setStatus("offline", "Offline search mode"); return; }
    try {
      const a = await LM.availability(LM_OPTS);
      aiState = a === "readily" ? "available" : a;
      if (aiState === "available") setStatus("ai", "On-device AI ready · works offline");
      else if (aiState === "downloadable" || aiState === "downloading") setStatus("offline", "Search mode · AI will download on first question");
      else setStatus("offline", "Offline search mode");
    } catch { aiState = "none"; setStatus("offline", "Offline search mode"); }
  }

  async function getSession() {
    if (baseSession) return baseSession;
    if (aiState === "none" || aiState === "unavailable") return null;
    baseSession = await LM.create({
      ...LM_OPTS,
      initialPrompts: [{ role: "system", content: SYSTEM }],
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          const pct = Math.round((e.loaded > 1 ? e.loaded / (e.total || 1) : e.loaded) * 100);
          setStatus("offline", `Downloading AI… ${pct}%`);
        });
      }
    });
    aiState = "available";
    setStatus("ai", "On-device AI ready · works offline");
    return baseSession;
  }

  async function aiStream(prompt, onText) {
    const base = await getSession();
    if (!base) throw new Error("no-ai");
    const s = base.clone ? await base.clone() : base;
    try {
      let full = "";
      if (s.promptStreaming) {
        const stream = s.promptStreaming(prompt);
        for await (const chunk of stream) {
          full = full && chunk.startsWith(full) ? chunk : full + chunk; // handles cumulative or delta chunks
          onText(full);
        }
      } else {
        full = await s.prompt(prompt);
        onText(full);
      }
      return full.trim();
    } finally {
      if (s !== base && s.destroy) s.destroy();
    }
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  /* ---------------- Chat UI ---------------- */
  const fab = $("#chatFab"), chat = $("#chat"), body = $("#chatBody");
  const form = $("#chatForm"), input = $("#chatInput"), suggest = $("#chatSuggest");
  let greeted = false, busy = false;

  function openChat() {
    chat.classList.add("open"); chat.setAttribute("aria-hidden", "false");
    fab.classList.add("hide"); fab.setAttribute("aria-expanded", "true");
    if (!greeted) {
      greeted = true;
      addBot({ text: GREETING });
      renderSuggestions(SHOWCASE);
    }
    setTimeout(() => input.focus({ preventScroll: true }), 350);
  }
  function closeChat() {
    chat.classList.remove("open"); chat.setAttribute("aria-hidden", "true");
    fab.classList.remove("hide"); fab.setAttribute("aria-expanded", "false");
    fab.focus({ preventScroll: true });
  }
  fab.addEventListener("click", openChat);
  document.querySelectorAll("[data-open-chat]").forEach((b) => b.addEventListener("click", openChat));
  $("#chatClose").addEventListener("click", closeChat);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && chat.classList.contains("open")) closeChat(); });

  function renderSuggestions(list) {
    suggest.innerHTML = list.map((q, k) => `<button type="button" style="--k:${k}">${esc(q)}</button>`).join("");
  }
  suggest.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && !busy) ask(b.textContent);
  });

  const scrollDown = () => { body.scrollTop = body.scrollHeight; };

  function addUser(text) {
    const el = document.createElement("div");
    el.className = "msg user"; el.textContent = text;
    body.appendChild(el); scrollDown();
  }
  function addTyping() {
    const el = document.createElement("div");
    el.className = "msg bot typing"; el.innerHTML = "<i></i><i></i><i></i>";
    body.appendChild(el); scrollDown();
    return el;
  }
  function labelHTML(label) {
    if (label === "nasa") return `<span class="label nasa">From NASA research</span><br>`;
    if (label === "general") return `<span class="label general">General science info</span><br>`;
    if (label === "redirect") return `<span class="label redirect">Off topic</span><br>`;
    return "";
  }
  function sourcesHTML(sources, via) {
    let h = "";
    if (sources && sources.length) {
      const uniq = [...new Map(sources.map((s) => [s.url, s])).values()].slice(0, 2);
      h += `<div class="src">Source: ${uniq.map((s) => `<a href="${s.url}"${s.url.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${esc(s.label)}</a>`).join(" · ")}</div>`;
    }
    if (via) h += `<span class="via">${esc(via)}</span>`;
    return h;
  }
  function addBot({ text, label, sources, via }) {
    const el = document.createElement("div");
    el.className = "msg bot";
    el.innerHTML = labelHTML(label) + `<span class="txt">${esc(text)}</span>` + sourcesHTML(sources, via);
    body.appendChild(el); scrollDown();
    return el;
  }
  // Word-by-word reveal for answers from the offline search, so both modes feel alive.
  async function typeOut(el, text) {
    const span = el.querySelector(".txt");
    if (REDUCED) { span.textContent = text; return; }
    const words = text.split(" ");
    span.textContent = "";
    for (let i = 0; i < words.length; i++) {
      span.textContent += (i ? " " : "") + words[i];
      if (i % 3 === 0) scrollDown();
      await sleep(18);
    }
    scrollDown();
  }

  async function ask(question) {
    question = question.trim();
    if (!question || busy) return;
    busy = true; form.querySelector("button").disabled = true;
    addUser(question);
    input.value = "";
    const typing = addTyping();
    const minWait = sleep(REDUCED ? 0 : 550);

    const domain = isDomain(question);
    const hits = retrieve(question);
    const best = hits[0];
    const nasaMatch = best && best.s >= 4 && domain;
    const sources = nasaMatch ? hits.filter((h) => h.s >= best.s * .6).flatMap((h) => h.e.sources) : [];

    // Try the on-device AI first (also on the first question, which may trigger the model download)
    if (aiState !== "none" && aiState !== "unavailable") {
      try {
        let prompt, label;
        if (nasaMatch) {
          const ctx = hits.filter((h) => h.s >= best.s * .5).map((h) => "- " + h.e.context).join("\n");
          prompt = `Answer the question using ONLY these facts from NASA research. If the facts do not answer it, say "I don't know that from NASA's data yet."\n\nFacts:\n${ctx}\n\nQuestion: ${question}`;
          label = "nasa";
        } else {
          prompt = `Decide what kind of question this is.\n- If it is a science question (physics, chemistry, space, biology, etc.), answer it briefly in 2-3 sentences.\n- If it is NOT about science, reply with exactly one word: REDIRECT\n\nQuestion: ${question}`;
          label = "general";
        }
        await minWait;
        let el = null;
        const answer = await withTimeout(aiStream(prompt, (t) => {
          if (label === "general" && /^\s*R(E(D(I(R(E(C(T)?)?)?)?)?)?)?\s*$/i.test(t)) return; // don't flash "REDIRECT"
          if (!el) { typing.remove(); el = addBot({ text: "", label }); }
          el.querySelector(".txt").textContent = t.replace(/\*\*/g, "");
          scrollDown();
        }), 45000);

        if (label === "general" && /REDIRECT/i.test(answer)) {
          if (el) el.remove(); typing.remove();
          addBot({ text: REDIRECT, label: "redirect" });
        } else {
          if (!el) { typing.remove(); el = addBot({ text: answer, label }); }
          el.insertAdjacentHTML("beforeend", sourcesHTML(sources, label === "general" ? "Answered by on-device AI from general knowledge, not from NASA's data" : "Written by on-device AI from our NASA knowledge file"));
          scrollDown();
        }
        done();
        return;
      } catch (err) {
        console.warn("FlameBot AI unavailable, using offline search:", err);
        if (String(err && err.message) !== "timeout") { aiState = "none"; setStatus("offline", "Offline search mode"); }
      }
    }

    // Backup: keyword search over the knowledge file (always answers)
    await minWait;
    typing.remove();
    if (nasaMatch) {
      const el = addBot({ text: "", label: "nasa" });
      await typeOut(el, best.e.answer);
      el.insertAdjacentHTML("beforeend", sourcesHTML(best.e.sources, "Found by offline search in our NASA knowledge file"));
      const related = hits.slice(1).filter((h) => h.s >= 4 && h.e.kind === "qa").map((h) => h.e.title).slice(0, 2);
      renderSuggestions(related.length ? related.concat(SHOWCASE.filter((q) => !related.includes(q)).slice(0, 3)) : SHOWCASE);
    } else if (domain) {
      const el = addBot({ text: "" });
      await typeOut(el, "I don't know that one from NASA's data yet. I'd rather be honest than guess! Try one of these questions:");
      renderSuggestions(SHOWCASE);
    } else {
      addBot({ text: REDIRECT, label: "redirect" });
      renderSuggestions(SHOWCASE);
    }
    scrollDown();
    done();

    function done() { busy = false; form.querySelector("button").disabled = false; input.focus({ preventScroll: true }); }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });

  checkAI();

  // Expose for quick testing in the console: FlameBot.retrieve("why is a flame round")
  window.FlameBot = { retrieve, isDomain, ask };
})();
