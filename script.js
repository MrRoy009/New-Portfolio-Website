/* KAI MORROW — midnight city drive */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- IST clock + NSE session status ---------- */
  const clockEl = $("#clock"), mktEl = $("#mkt"), clockWrap = $(".clock");
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const partsFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const tick = () => {
    const now = new Date();
    clockEl.textContent = fmt.format(now);
    const p = Object.fromEntries(partsFmt.formatToParts(now).map((x) => [x.type, x.value]));
    const mins = +p.hour * 60 + +p.minute;
    // Regular session only; exchange holidays are not accounted for.
    const open = !["Sat", "Sun"].includes(p.weekday) && mins >= 555 && mins < 930;
    clockWrap.classList.toggle("open", open);
    mktEl.textContent = open ? "NSE OPEN" : "NSE CLOSED";
  };
  tick();
  setInterval(tick, 1000);

  /* ---------- Sentiment dot field ---------- */
  const dotsEl = $("#sentiment-dots");
  if (dotsEl) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 96; i++) {
      const d = document.createElement("i");
      if (Math.random() < 0.42) d.className = "neg";
      d.style.animationDelay = `${(Math.random() * 2.6).toFixed(2)}s`;
      frag.appendChild(d);
    }
    dotsEl.appendChild(frag);
  }

  /* ---------- Live GitHub repos (static list in HTML is the fallback) ---------- */
  const depBody = $("#dep-body");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  fetch("https://api.github.com/users/MrRoy009/repos?per_page=100&sort=updated")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((repos) => {
      const list = repos.filter((r) => !r.fork && r.name.toLowerCase() !== "mrroy009");
      if (!list.length) return;
      depBody.innerHTML = list.map((r) => {
        const lang = r.language === "Jupyter Notebook" ? "Jupyter" : r.language || "—";
        return `<a class="dep-row" role="row" href="${esc(r.html_url)}" target="_blank" rel="noopener"><span role="cell">${esc(r.name)}</span><span role="cell">${esc(lang)}</span><span role="cell">${esc(r.pushed_at.slice(0, 10))}</span><span role="cell">${r.stargazers_count}</span></a>`;
      }).join("");
      const live = $("#repos-live");
      live.textContent = "● LIVE FROM GITHUB";
      live.classList.add("live-ok");
      $("#stat-repos").dataset.count = list.length;
    })
    .catch(() => {});

  /* ---------- Scroll state (shared) ---------- */
  let lastY = scrollY;
  let velocity = 0;      // smoothed px/frame
  let distance = 0;      // total px travelled

  /* ---------- Rain ---------- */
  const canvas = $("#rain");
  const ctx = canvas.getContext("2d");
  let W, H, DPR, drops = [], ripples = [];
  const COLORS = ["rgba(180,230,255,", "rgba(25,240,255,", "rgba(255,43,214,", "rgba(255,255,255,"];

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 1.5);
    W = canvas.width = innerWidth * DPR;
    H = canvas.height = innerHeight * DPR;
    const count = Math.round((innerWidth * innerHeight) / 4200);
    drops = Array.from({ length: count }, () => makeDrop(true));
  }
  function makeDrop(anywhere) {
    const z = Math.random(); // depth: 0 far, 1 near
    return {
      x: Math.random() * W * 1.2 - W * 0.1,
      y: anywhere ? Math.random() * H : -Math.random() * H * 0.3,
      len: (10 + z * 26) * DPR,
      v: (7 + z * 14) * DPR,
      a: 0.08 + z * 0.32,
      w: (0.6 + z * 0.9) * DPR,
      c: COLORS[(Math.random() * (Math.random() < 0.7 ? 1 : COLORS.length)) | 0],
    };
  }
  const WIND = 0.18;
  function drawRain() {
    ctx.clearRect(0, 0, W, H);
    const boost = 1 + Math.min(Math.abs(velocity) / 12, 2.2);
    for (const d of drops) {
      const len = d.len * boost;
      ctx.strokeStyle = d.c + d.a + ")";
      ctx.lineWidth = d.w;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - len * WIND, d.y + len);
      ctx.stroke();
      d.y += d.v * boost;
      d.x -= d.v * boost * WIND;
      if (d.y > H) {
        if (Math.random() < 0.08) ripples.push({ x: d.x, y: H * (0.72 + Math.random() * 0.28), r: 0, a: 0.5, c: d.c });
        Object.assign(d, makeDrop(false));
      }
    }
    // puddle ripples on the "street"
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      ctx.strokeStyle = r.c + r.a + ")";
      ctx.lineWidth = DPR;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      r.r += 0.9 * DPR;
      r.a -= 0.012;
      if (r.a <= 0) ripples.splice(i, 1);
    }
  }

  /* ---------- HUD ---------- */
  const speedEl = $("#speed"), odoEl = $("#odo"), laneEl = $("#lane-fill");
  let shownSpeed = 0;
  const nav = $(".nav");

  /* ---------- Horizontal drive ---------- */
  const drive = $("#work"), track = $("#track"), idxEl = $("#bb-index");
  const road = $(".road span");
  const billboards = $$(".billboard");
  const isWide = () => innerWidth > 860;

  function updateDrive() {
    if (!isWide()) { track.style.transform = ""; return; }
    const rect = drive.getBoundingClientRect();
    const total = rect.height - innerHeight;
    const p = clamp(-rect.top / total, 0, 1);
    const max = track.scrollWidth - innerWidth;
    const x = -p * max;
    track.style.transform = `translate3d(${x}px,0,0)`;
    road.style.setProperty("--road", `${(x * 1.6) % 140}px`);
    const i = clamp(Math.round(p * (billboards.length - 1)) + 1, 1, billboards.length);
    idxEl.textContent = String(i).padStart(2, "0");
    // subtle perspective swing as boards pass the "windshield"
    billboards.forEach((b) => {
      if (b.matches(":hover")) return;
      const r = b.getBoundingClientRect();
      const off = (r.left + r.width / 2 - innerWidth / 2) / innerWidth;
      b.querySelector(".frame").style.setProperty("--ry", `${clamp(-off * 18, -14, 14)}deg`);
    });
  }

  /* ---------- Route map ---------- */
  const stationsEl = $("#stations"), routeLine = $(".route-line"), routeFill = $("#route-fill");
  const stations = $$(".station");
  function placeRouteLine() {
    routeLine.style.setProperty("--line-top", `${stationsEl.offsetTop}px`);
  }
  function updateRoute() {
    const r = stationsEl.getBoundingClientRect();
    const p = clamp((innerHeight * 0.85 - r.top) / (innerHeight * 0.55), 0, 1);
    routeFill.style.width = `${p * 100}%`;
    const fillX = routeLine.getBoundingClientRect().left + routeLine.offsetWidth * p;
    stations.forEach((s) => s.classList.toggle("lit", s.getBoundingClientRect().left <= fillX && p > 0.02));
  }

  /* ---------- Main loop ---------- */
  function frame() {
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    distance += Math.abs(dy);
    velocity += (dy - velocity) * 0.12;

    const target = clamp(Math.abs(velocity) * 4.2, 0, 288);
    shownSpeed += (target - shownSpeed) * 0.08;
    speedEl.textContent = String(Math.round(shownSpeed)).padStart(3, "0");
    odoEl.textContent = (distance / 2400).toFixed(1);
    const docP = y / Math.max(1, document.documentElement.scrollHeight - innerHeight);
    laneEl.style.width = `${docP * 100}%`;
    nav.classList.toggle("scrolled", y > 40);

    updateDrive();
    updateRoute();
    if (!reduce) drawRain();
    requestAnimationFrame(frame);
  }

  /* ---------- Billboard tilt ---------- */
  billboards.forEach((b) => {
    const f = b.querySelector(".frame");
    b.addEventListener("pointermove", (e) => {
      const r = f.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      f.style.setProperty("--ry", `${px * 10}deg`);
      f.style.setProperty("--rx", `${-py * 8}deg`);
    });
    b.addEventListener("pointerleave", () => f.style.setProperty("--rx", "0deg"));
  });

  /* ---------- Split-flap departure board ---------- */
  const flaps = $$(".flap");
  if (!reduce) {
    setInterval(() => {
      const f = flaps[(Math.random() * flaps.length) | 0];
      const words = f.dataset.words.split("|");
      const next = words[(words.indexOf(f.textContent) + 1) % words.length];
      f.classList.remove("flip");
      void f.offsetWidth;
      f.classList.add("flip");
      setTimeout(() => (f.textContent = next), 170);
    }, 1800);
  }

  /* ---------- Reveals + counters ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      const num = e.target.querySelector("[data-count]");
      if (num) countUp(num);
      io.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal").forEach((el) => io.observe(el));

  function countUp(el) {
    const end = +el.dataset.count;
    if (reduce) { el.textContent = end; return; }
    const t0 = performance.now(), dur = 1400;
    const step = (t) => {
      const k = clamp((t - t0) / dur, 0, 1);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Boot ---------- */
  addEventListener("resize", () => { resize(); placeRouteLine(); });
  addEventListener("load", placeRouteLine);
  resize();
  placeRouteLine();
  requestAnimationFrame(frame);
})();
