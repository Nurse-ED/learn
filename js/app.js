/* NurseEd — static e-learning app (GitHub Pages + Supabase). No build step. */
(() => {
"use strict";
const cfg = window.APP_CONFIG;
const $app = document.getElementById("app");
const configured = !cfg.SUPABASE_URL.includes("YOUR-PROJECT");
const sb = configured ? supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

/* ---------- state ---------- */
const S = { user: null, me: null, profiles: [], courses: [], modules: [], lessons: [], enrolls: [],
  progress: [], assessments: [], attempts: [], counts: {}, filter: "All", q: "", quiz: null, authMode: "login", openMod: {} };

/* ---------- utils ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const P = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 12l2 2 4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5 7-5s7 1.5 7 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2.5.5 4 2 4 5"/>',
  flame: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z"/>',
  chev: '<path d="M9 6l6 6-6 6"/>', back: '<path d="M15 6l-6 6 6 6"/>',
  play: '<polygon points="6 4 20 12 6 20"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  cards: '<rect x="3" y="6" width="14" height="12" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v10"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  out: '<path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 17l5-5-5-5M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M5 12l5 5 9-10"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5"/>',
};
const icon = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;
const TYPE = { video: ["play", "Video"], pdf: ["file", "PDF"], ppt: ["slides", "PowerPoint"], text: ["text", "Reading"], flashcards: ["cards", "Flash cards"], pamphlet: ["image", "Pamphlet"], image: ["image", "Image"], link: ["link", "Link"] };
const toast = (m) => { const t = document.getElementById("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600); };
const tint = (i) => "t" + (Math.abs(i) % 5);
const hash = s => [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0);
const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "";
const fmtDate = d => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const initials = n => (n || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const isAdmin = () => S.me && S.me.role === "admin";
const go = h => { location.hash = h; };
const fail = e => { console.error(e); toast(e.message || "Something went wrong"); };

function md(t) {
  return esc(t).split(/\n{2,}/).map(p => {
    if (/^#{1,3} /.test(p)) return `<h3>${p.replace(/^#+ /, "")}</h3>`;
    if (/^- /.test(p)) return "<ul>" + p.split("\n").map(l => `<li>${l.replace(/^- /, "")}</li>`).join("") + "</ul>";
    return "<p>" + p.replace(/\n/g, "<br>") + "</p>";
  }).join("").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}
function embed(url, type) {
  url = safeUrl(url); if (!url) return `<div class="empty">No file attached.</div>`;
  let m;
  if ((m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/)))
    return `<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Video" allowfullscreen loading="lazy"></iframe></div>`;
  if ((m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)))
    return `<div class="vid"><iframe src="https://drive.google.com/file/d/${m[1]}/preview" allowfullscreen loading="lazy"></iframe></div>`;
  if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)))
    return `<div class="vid"><iframe src="https://player.vimeo.com/video/${m[1]}" allowfullscreen loading="lazy"></iframe></div>`;
  if ((m = url.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/)))
    return `<div class="vid"><iframe src="https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false" title="Slides" allowfullscreen loading="lazy"></iframe></div>`;
  if (type === "ppt" || /\.(pptx?|pps|ppsx)(\?|$)/i.test(url))
    return `<div class="vid"><iframe src="https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}" title="Presentation" allowfullscreen loading="lazy"></iframe></div><a class="btn ghost block" style="margin-top:10px" href="${esc(url)}" download target="_blank" rel="noopener">${icon("upload", 16)} Download presentation</a><p class="meta" style="margin-top:8px;text-align:center">If the slides don't load, use the download button.</p>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return `<video class="plain" controls playsinline src="${esc(url)}"></video>`;
  if (type === "pdf" || /\.pdf(\?|$)/i.test(url))
    return `<div class="pdfv" data-pdf="${esc(url)}"><div class="empty"><div class="spinner" style="margin:0 auto 10px"></div>Loading PDF…</div></div><a class="btn ghost block" style="margin-top:10px" href="${esc(url)}" target="_blank" rel="noopener">${icon("file", 16)} Open PDF in new tab</a>`;
  if (type === "image" || type === "pamphlet" || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url))
    return `<img class="full" src="${esc(url)}" alt=""><a class="btn ghost block" style="margin-top:10px" href="${esc(url)}" target="_blank" rel="noopener">Open full size</a>`;
  return `<a class="btn block" href="${esc(url)}" target="_blank" rel="noopener">${icon("link")} Open resource</a>`;
}

/* ---------- PDF viewer: draws the pages inside the app (phones can't show PDFs in an iframe) ---------- */
let pdfLib;
function loadPdfJs() {
  return pdfLib ||= new Promise((ok, no) => {
    const sc = document.createElement("script"); sc.src = "js/vendor/pdf.min.js?v=1";
    sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "js/vendor/pdf.worker.min.js?v=1"; ok(window.pdfjsLib); };
    sc.onerror = () => no(new Error("Could not load the PDF viewer")); document.head.appendChild(sc);
  });
}
async function renderPdf(box) {
  const url = box.dataset.pdf;
  try {
    const lib = await loadPdfJs(), pdf = await lib.getDocument({ url }).promise;
    box.innerHTML = `<div class="meta" style="text-align:center;margin-bottom:8px">${pdf.numPages} page${pdf.numPages > 1 ? "s" : ""} · scroll to read</div><div class="pages"></div>`;
    const holder = box.querySelector(".pages"), first = await pdf.getPage(1), v1 = first.getViewport({ scale: 1 });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); draw(+e.target.dataset.n, e.target); } }), { rootMargin: "800px 0px" });
    async function draw(n, el) {
      const pg = n === 1 ? first : await pdf.getPage(n), vp = pg.getViewport({ scale: 1 });
      const scale = (el.clientWidth || box.clientWidth) / vp.width, dpr = Math.min(window.devicePixelRatio || 1, 2), cv = document.createElement("canvas");
      cv.width = Math.floor(vp.width * scale * dpr); cv.height = Math.floor(vp.height * scale * dpr);
      el.style.aspectRatio = `${vp.width} / ${vp.height}`; el.innerHTML = ""; el.appendChild(cv);
      await pg.render({ canvasContext: cv.getContext("2d"), viewport: pg.getViewport({ scale: scale * dpr }) }).promise;
    }
    for (let n = 1; n <= pdf.numPages; n++) {
      const d = document.createElement("div"); d.className = "pg"; d.dataset.n = n; d.style.aspectRatio = `${v1.width} / ${v1.height}`; d.setAttribute("aria-label", `Page ${n}`);
      holder.appendChild(d); io.observe(d);
    }
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="empty">⚠️ Couldn't show this PDF here.<br>Use the <b>Open PDF in new tab</b> button below.</div>`;
  }
}

/* ---------- data ---------- */
async function fetchAll(table, order, asc = true) {
  let out = [], from = 0;
  for (;;) {
    let q = sb.from(table).select("*").range(from, from + 999);
    if (order) q = q.order(order, { ascending: asc });
    const { data, error } = await q; if (error) throw error;
    out = out.concat(data); if (data.length < 1000) break; from += 1000;
  }
  return out;
}
async function loadAll() {
  const [profiles, courses, modules, lessons, enrolls, progress, assessments, attempts, counts] = await Promise.all([
    fetchAll("profiles", "created_at"), fetchAll("courses", "created_at"), fetchAll("modules", "position"),
    fetchAll("lessons", "position"), fetchAll("enrollments"), fetchAll("lesson_progress"),
    fetchAll("assessments", "created_at"), fetchAll("attempts", "created_at", false), fetchAll("assessment_counts"),
  ]);
  Object.assign(S, { profiles, courses, modules, lessons, enrolls, progress, assessments, attempts });
  S.counts = Object.fromEntries(counts.map(c => [c.assessment_id, c.n]));
  S.me = profiles.find(p => p.id === S.user.id);
}
const modsOf = cid => S.modules.filter(m => m.course_id === cid).sort((a, b) => a.position - b.position);
const lessonsOfMod = mid => S.lessons.filter(l => l.module_id === mid).sort((a, b) => a.position - b.position);
const ordered = cid => modsOf(cid).flatMap(m => lessonsOfMod(m.id));
const doneSet = uid => new Set(S.progress.filter(p => p.user_id === uid).map(p => p.lesson_id));
function cprog(uid, cid) {
  const ls = ordered(cid), d = doneSet(uid); const done = ls.filter(l => d.has(l.id)).length;
  return { done, total: ls.length, pct: ls.length ? Math.round(done * 100 / ls.length) : 0 };
}
const enrolledIds = uid => S.enrolls.filter(e => e.user_id === uid).map(e => e.course_id);
const isEnrolled = cid => enrolledIds(S.user.id).includes(cid);
const courseDone = (uid, cid) => { const p = cprog(uid, cid); return p.total === 0 || p.done === p.total; };   // assessments unlock at 100%
const nextLesson = (uid, cid) => { const d = doneSet(uid); return ordered(cid).find(l => !d.has(l.id)); };
const bestAttempt = (uid, aid) => S.attempts.filter(a => a.user_id === uid && a.assessment_id === aid).sort((a, b) => b.score / (b.total || 1) - a.score / (a.total || 1))[0];
const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`; };
function streak(uid) {
  const days = new Set([...S.progress.filter(p => p.user_id === uid).map(p => p.completed_at), ...S.attempts.filter(a => a.user_id === uid).map(a => a.created_at)].map(dayKey));
  let n = 0; const d = new Date(); if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); } return n;
}
function userStats(uid) {
  const att = S.attempts.filter(a => a.user_id === uid);
  const avg = att.length ? Math.round(att.reduce((s, a) => s + a.score * 100 / (a.total || 1), 0) / att.length) : null;
  return { courses: enrolledIds(uid).length, lessons: S.progress.filter(p => p.user_id === uid).length, streak: streak(uid), avg, attempts: att.length };
}

/* ---------- layout ---------- */
function shell(inner, { nav = true, wide = false } = {}) {
  const tabs = isAdmin()
    ? [["#/admin", "grid", "Overview"], ["#/admin/students", "users", "Students"], ["#/admin/courses", "book", "Courses"], ["#/admin/tests", "clip", "Tests"]]
    : [["#/home", "home", "Home"], ["#/courses", "book", "Courses"], ["#/assess", "clip", "Tests"], ["#/profile", "user", "Profile"]];
  const cur = location.hash || "#/home";
  const on = t => (t === "#/admin" ? cur === "#/admin" : cur.startsWith(t) || (t === "#/courses" && /^#\/(course|learn)/.test(cur)) || (t === "#/assess" && cur.startsWith("#/quiz")));
  $app.innerHTML = `<div class="shell ${wide ? "wide" : ""}">${inner}</div>` + (nav ? `<nav class="nav" aria-label="Main"><div>${tabs.map(t => `<a href="${t[0]}" class="${on(t[0]) ? "on" : ""}" ${on(t[0]) ? 'aria-current="page"' : ""}>${icon(t[1], 22)}${t[2]}</a>`).join("")}</div></nav>` : "");
  window.scrollTo(0, 0);
}
const top = (title, { back, right = "", sub = "" } = {}) => `<div class="topbar">${back ? `<a class="back" href="${back}" aria-label="Back">${icon("back")}</a>` : ""}<div class="grow"><h1 class="ellipsis">${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div>${right}</div>`;
const bar = pct => `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>`;
const empty = (e, t) => `<div class="empty"><div class="e">${e}</div>${t}</div>`;

/* modal */
function modal(title, body, onSubmit, { submit = "Save", onOpen } = {}) {
  closeModal();
  const el = document.createElement("div"); el.className = "modal"; el.id = "modal";
  el.innerHTML = `<form class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><div class="err" hidden></div>${body}<div class="row" style="margin-top:6px"><button type="button" class="btn ghost grow" data-x>Cancel</button><button class="btn grow">${submit}</button></div></form>`;
  document.body.appendChild(el);
  el.addEventListener("click", e => { if (e.target === el || e.target.hasAttribute("data-x")) closeModal(); });
  const f = el.querySelector("form");
  f.addEventListener("submit", async e => {
    e.preventDefault(); const btn = f.querySelector(".btn:not(.ghost)"); btn.disabled = true;
    try { await onSubmit(new FormData(f), f); closeModal(); }
    catch (er) { const x = f.querySelector(".err"); x.hidden = false; x.textContent = er.message || String(er); btn.disabled = false; }
  });
  onOpen && onOpen(f);
  const first = f.querySelector("input,textarea,select"); first && first.focus();
}
const closeModal = () => document.getElementById("modal")?.remove();
const field = (label, input, hint = "", cls = "") => `<label class="field ${cls}"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ""}</label>`;

/* ---------- AUTH ---------- */
function viewAuth() {
  const signup = S.authMode === "signup";
  $app.innerHTML = `<div class="auth">
    <div class="brand"><div class="logo">${icon("cap", 28)}</div><div><b>${esc(cfg.APP_NAME)}</b><span class="sub">${esc(cfg.TAGLINE)}</span></div></div>
    <h1>${signup ? "Create your <em>account</em>" : "Welcome <em>back</em> 👋"}</h1>
    <p class="sub">${signup ? "Join your course in under a minute." : "Log in to continue learning."}</p>
    ${configured ? "" : `<div class="note"><b>Setup needed:</b> add your Supabase URL and key in <code>js/config.js</code> (see README).</div>`}
    <div class="err" id="autherr" hidden></div>
    <form id="authform">
      ${signup ? field("Full name", `<input type="text" name="name" required autocomplete="name" placeholder="e.g. Priya Sharma">`) : ""}
      ${signup ? field("Username", `<input type="text" name="username" required pattern="[a-zA-Z0-9_.]{3,20}" autocapitalize="none" autocomplete="username" placeholder="priya.s">`, "3–20 letters, numbers, . or _") : ""}
      ${signup ? field("Email", `<input type="email" name="email" required autocomplete="email" placeholder="you@example.com">`) : field("Username or email", `<input type="text" name="id" required autocapitalize="none" autocomplete="username">`)}
      ${field("Password", `<input type="password" name="password" required minlength="6" autocomplete="${signup ? "new-password" : "current-password"}">`, signup ? "At least 6 characters." : "")}
      ${signup ? `<div class="note">🔒 Your course administrator can see your password so they can help if you forget it. <b>Don't reuse a password from your email, bank or social media.</b></div>` : ""}
      <button class="btn block" id="authbtn">${signup ? "Create account" : "Log in"}</button>
    </form>
    <p class="switch">${signup ? "Already have an account?" : "New here?"} <button id="swap">${signup ? "Log in" : "Create account"}</button></p>
  </div>`;
  document.getElementById("swap").onclick = () => { S.authMode = signup ? "login" : "signup"; viewAuth(); };
  document.getElementById("authform").onsubmit = async e => {
    e.preventDefault(); if (!configured) return toast("Add your Supabase keys in js/config.js first");
    const f = Object.fromEntries(new FormData(e.target)), btn = document.getElementById("authbtn"), box = document.getElementById("autherr");
    btn.disabled = true; box.hidden = true;
    try {
      if (signup) {
        const username = f.username.toLowerCase();
        const { data: free, error: ue } = await sb.rpc("username_available", { u: username });
        if (ue) throw new Error("Database not ready: " + ue.message + " (Run supabase/schema.sql and check js/config.js)");
        if (free === false) throw new Error("That username is taken. Try another.");
        const { data, error } = await sb.auth.signUp({ email: f.email.trim(), password: f.password, options: { data: { username, full_name: f.name.trim() } } });
        if (error) throw error;
        if (!data.session) throw new Error("Account created, but email confirmation is still ON in Supabase. Ask your admin to turn it off (see README), then log in.");
        await sb.from("profiles").update({ password_plain: f.password }).eq("id", data.user.id);
      } else {
        let email = f.id.trim();
        if (!email.includes("@")) {
          const { data, error: le } = await sb.rpc("email_for_username", { u: email });
          if (le) throw new Error("Database not ready: " + le.message);
          if (!data) throw new Error("No account found with that username.");
          email = data;
        }
        const { error } = await sb.auth.signInWithPassword({ email, password: f.password });
        if (error) throw new Error("Wrong username/email or password.");
      }
    } catch (er) { box.hidden = false; box.textContent = er.message; btn.disabled = false; }
  };
}

/* ---------- STUDENT: HOME ---------- */
function viewHome() {
  const uid = S.user.id, st = userStats(uid), ids = enrolledIds(uid);
  const mine = ids.map(id => S.courses.find(c => c.id === id)).filter(Boolean);
  const cont = mine.map(c => ({ c, p: cprog(uid, c.id), n: nextLesson(uid, c.id) })).find(x => x.n);
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const k = dayKey(d);
    return { l: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2), n: S.progress.filter(p => p.user_id === uid && dayKey(p.completed_at) === k).length }; });
  const max = Math.max(3, ...week.map(w => w.n));
  const goals = mine.map(c => goalInfo(uid, c)).filter(g => g.goal > 0);
  const todo = nextAssessment(uid);
  shell(`
    ${top(`Hello, ${esc((S.me.full_name || S.me.username).split(" ")[0])}! 👋`, { sub: "What do you want to learn today?", right: `<span class="pill" title="Day streak">${icon("flame", 18)} ${st.streak}</span>` })}
    ${cont ? `<div class="hero"><div class="lbl">Pick up where you left off</div><div class="big">${esc(cont.c.title)}</div>
      <div class="lbl" style="text-align:right;max-width:80%">${cont.p.pct}%</div>${bar(cont.p.pct)}
      <a class="btn white sm" style="margin-top:14px" href="#/learn/${cont.n.id}">Continue learning ${icon("chev", 16)}</a><div class="emoji">${esc(cont.c.emoji)}</div></div>`
    : `<div class="hero"><div class="lbl">Get started</div><div class="big">${mine.length ? "You've finished every lesson! 🎉" : "Pick your first course"}</div><a class="btn white sm" href="#/courses">Browse courses ${icon("chev", 16)}</a><div class="emoji">🩺</div></div>`}
    <div class="sec"><h2>My Courses</h2><a href="#/courses">View All</a></div>
    <div class="stack">${mine.length ? mine.slice(0, 4).map(c => courseRow(c, uid)).join("") : empty("📚", "You haven't enrolled in any course yet.<br><a href='#/courses'>Find a course</a>")}</div>
    <div class="sec"><h2>Today's Goals</h2><span class="meta">${goals.filter(g => g.met).length} / ${goals.length} done</span></div>
    <div class="stack">${goals.length ? goals.map(goalRow).join("") : `<div class="card meta">${mine.length ? "No daily goal set for your courses." : "Enroll in a course to get daily goals."}</div>`}</div>
    ${todo ? `<div class="sec"><h2>Next Assessment</h2><a href="#/assess">All tests</a></div>${assessRow(todo, uid)}` : ""}
    <div class="sec"><h2>Your Progress</h2></div>
    <div class="stats"><div class="stat"><b>${st.lessons}</b><small>Lessons</small></div><div class="stat"><b>${st.courses}</b><small>Courses</small></div><div class="stat"><b>${st.avg ?? "–"}${st.avg != null ? "%" : ""}</b><small>Avg score</small></div></div>
    <div class="card" style="margin-top:10px"><b>This week</b><div class="week">${week.map(w => `<div><i class="${w.n ? "" : "zero"}" style="height:${w.n ? Math.max(12, w.n / max * 100) : 4}%"></i>${w.l}</div>`).join("")}</div></div>`);
}
function goalInfo(uid, c) {
  const p = cprog(uid, c.id), k = dayKey(new Date());
  const doneToday = S.progress.filter(x => x.user_id === uid && x.course_id === c.id && dayKey(x.completed_at) === k).length;
  const goal = Math.min(c.daily_goal ?? 3, doneToday + (p.total - p.done));   // can't ask for more lessons than remain
  const days = c.target_date ? Math.ceil((new Date(c.target_date + "T23:59:59") - new Date()) / 864e5) : null;
  return { c, goal, doneToday, met: doneToday >= goal, finished: p.total > 0 && p.done === p.total, days };
}
function goalRow(g) {
  const due = g.finished ? `<span class="chip green">Course complete</span>` : g.days == null ? "" : g.days < 0 ? `<span class="chip red">Past due date</span>` : `<span class="chip ${g.days <= 3 ? "yellow" : ""}">${g.days === 0 ? "Due today" : g.days + " days left"}</span>`;
  return `<a class="item" href="#/course/${g.c.id}"><div class="tile sm t0">🎯</div><div class="grow"><b class="ellipsis">${esc(g.c.title)}</b><small>${g.goal ? `Complete ${g.goal} lesson${g.goal > 1 ? "s" : ""} today · ${Math.min(g.doneToday, g.goal)}/${g.goal}` : "Nothing left to do today 🎉"}</small>${bar(g.goal ? Math.min(100, Math.round(g.doneToday * 100 / g.goal)) : 100)}</div>${g.met && g.goal ? "🎁" : due}</a>`;
}
function courseRow(c, uid) {
  const p = cprog(uid, c.id);
  return `<a class="item" href="#/course/${c.id}"><div class="tile ${tint(hash(c.id))}">${esc(c.emoji)}</div><div class="grow"><b class="ellipsis">${esc(c.title)}</b><small>${p.pct}% completed · ${p.done}/${p.total} lessons</small>${bar(p.pct)}</div><span class="chev">${icon("chev")}</span></a>`;
}

/* ---------- STUDENT: COURSES ---------- */
function viewCourses() {
  const uid = S.user.id, cats = ["All", "My courses", ...new Set(S.courses.map(c => c.category))];
  const q = S.q.toLowerCase();
  const list = S.courses.filter(c => (S.filter === "All" || (S.filter === "My courses" ? isEnrolled(c.id) : c.category === S.filter)) && (c.title + c.description).toLowerCase().includes(q));
  shell(`${top("Courses", { sub: `${S.courses.length} available` })}
    <div class="search"><span aria-hidden="true">${icon("search", 18)}</span><input type="text" id="q" placeholder="Search courses" value="${esc(S.q)}" aria-label="Search courses"></div>
    <div class="chips">${cats.map(c => `<button class="${S.filter === c ? "on" : ""}" data-f="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div class="stack" style="margin-top:14px" id="clist">${listCourses(list, uid)}</div>`);
  document.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { S.filter = b.dataset.f; viewCourses(); });
  document.getElementById("q").oninput = e => { S.q = e.target.value; const l = S.courses.filter(c => (S.filter === "All" || (S.filter === "My courses" ? isEnrolled(c.id) : c.category === S.filter)) && (c.title + c.description).toLowerCase().includes(S.q.toLowerCase())); document.getElementById("clist").innerHTML = listCourses(l, uid); };
}
function listCourses(list, uid) {
  if (!list.length) return empty("🔍", "No courses found.");
  return list.map(c => {
    const en = isEnrolled(c.id), p = cprog(uid, c.id), n = ordered(c.id).length;
    return `<a class="item" href="#/course/${c.id}"><div class="tile ${tint(hash(c.id))}">${esc(c.emoji)}</div><div class="grow"><b class="ellipsis">${esc(c.title)}</b><small>${esc(c.category)} · ${n} lessons</small>${en ? bar(p.pct) : ""}</div>${en ? `<span class="chip green">${p.pct}%</span>` : `<span class="chip">Enroll</span>`}</a>`;
  }).join("");
}

function viewCourse(id) {
  const c = S.courses.find(x => x.id === id); if (!c) return go("#/courses");
  const uid = S.user.id, en = isEnrolled(id), p = cprog(uid, id), ls = ordered(id), d = doneSet(uid), nx = nextLesson(uid, id);
  const mins = ls.reduce((s, l) => s + (l.minutes || 0), 0), asm = S.assessments.filter(a => a.course_id === id && courseDone(uid, id));
  shell(`${top("Course", { back: "#/courses" })}
    <div class="hero"><div class="lbl">${esc(c.category)}</div><div class="big">${esc(c.title)}</div><div class="lbl">${modsOf(id).length} modules · ${ls.length} lessons · ~${mins} min</div>${en ? bar(p.pct) : ""}<div class="emoji">${esc(c.emoji)}</div></div>
    <p style="margin:16px 2px">${esc(c.description)}</p>
    ${c.daily_goal || c.target_date ? `<div class="card row" style="margin-bottom:14px"><div class="tile sm t0">🎯</div><div class="grow"><b>Course goal</b><div class="meta">${c.daily_goal ? `${c.daily_goal} lesson${c.daily_goal > 1 ? "s" : ""} per day` : ""}${c.daily_goal && c.target_date ? " · " : ""}${c.target_date ? `finish by ${fmtDate(c.target_date + "T00:00:00")}` : ""}</div></div></div>` : ""}
    ${!ls.length ? empty("🚧", "Lessons are coming soon.") : en
      ? `<a class="btn block" href="#/learn/${(nx || ls[0]).id}">${p.done === 0 ? "Start course" : nx ? "Continue course" : "Review course"} ${icon("chev", 18)}</a>`
      : `<button class="btn block" data-enroll="${id}">Enroll &amp; start course</button>`}
    <div class="sec"><h2>Course content</h2><span class="meta">${p.done}/${p.total} lessons done</span></div>
    <div id="mods"></div>
    ${asm.length ? `<div class="sec"><h2>Assessments</h2></div><div class="stack">${asm.map(a => assessRow(a, uid)).join("")}</div>` : ""}`);
  document.querySelector("[data-enroll]")?.addEventListener("click", async () => { await enroll(id); go("#/learn/" + ls[0].id); });
  const drawMods = () => {
    const mods = modsOf(id), open = mods.find(m => m.id === S.openMod[id]);
    document.getElementById("mods").innerHTML = mods.length ? `
      <div class="mods" role="tablist" aria-label="Modules">${mods.map((m, n) => {
        const lm = lessonsOfMod(m.id), dn = lm.filter(l => d.has(l.id)).length, all = lm.length > 0 && dn === lm.length;
        return `<button class="mod ${open?.id === m.id ? "on" : ""} ${all ? "done" : ""}" role="tab" aria-selected="${open?.id === m.id}" data-mod="${m.id}" title="${esc(m.title)}" aria-label="${esc(m.title)}, ${dn} of ${lm.length} lessons done">
          <span class="mn">${all ? icon("check", 14) : n + 1}</span><span class="mt">${esc(m.title)}</span><span class="mp">${dn}/${lm.length}</span></button>`;
      }).join("")}</div>
      ${open ? `<div class="card" style="margin-top:14px"><b>${esc(open.title)}</b><div class="stack" style="margin-top:10px">${lessonsOfMod(open.id).map(l => {
        const t = TYPE[l.type] || TYPE.text, ok = d.has(l.id);
        return `<a class="item" style="box-shadow:none" href="#/learn/${l.id}"><div class="tile sm ${ok ? "t2" : "t0"}">${icon(ok ? "check" : t[0], 18)}</div><div class="grow"><b class="ellipsis">${esc(l.title)}</b><small>${t[1]} · ${l.minutes} min</small></div><span class="chev">${icon("chev")}</span></a>`;
      }).join("") || `<span class="meta">No lessons in this module yet.</span>`}</div></div>` : `<p class="meta" style="text-align:center;margin-top:12px">Tap a module to see its lessons</p>`}`
      : empty("🧱", "Modules are coming soon.");
    document.querySelectorAll("[data-mod]").forEach(b => b.onclick = () => { S.openMod[id] = S.openMod[id] === b.dataset.mod ? null : b.dataset.mod; drawMods(); });
  };
  drawMods();
}
async function enroll(cid) {
  if (isEnrolled(cid)) return;
  const { error } = await sb.from("enrollments").insert({ user_id: S.user.id, course_id: cid });
  if (error) return fail(error);
  S.enrolls.push({ user_id: S.user.id, course_id: cid }); toast("Enrolled! 🎉");
}

/* ---------- STUDENT: LESSON ---------- */
let flashIdx = 0;
function viewLesson(id) {
  const l = S.lessons.find(x => x.id === id); if (!l) return go("#/courses");
  const c = S.courses.find(x => x.id === l.course_id), uid = S.user.id, ls = ordered(c.id), i = ls.findIndex(x => x.id === id);
  const done = doneSet(uid).has(id), t = TYPE[l.type] || TYPE.text, nx = ls[i + 1];
  if (!isEnrolled(c.id)) enroll(c.id);
  S.openMod[c.id] = l.module_id;
  flashIdx = 0;
  let body = "";
  if (l.type === "text") body = `<div class="prose">${md(l.body || "")}</div>`;
  else if (l.type === "flashcards") body = `<div id="fc"></div>`;
  else body = embed(l.url, l.type) + (l.body ? `<div class="prose" style="margin-top:12px">${md(l.body)}</div>` : "");
  shell(`${top(esc(l.title), { back: "#/course/" + c.id, sub: `${t[1]} · ${l.minutes} min · Lesson ${i + 1} of ${ls.length}` })}
    ${bar(Math.round((i + 1) * 100 / ls.length))}<div style="margin-top:14px">${body}</div>
    <div class="row" style="margin-top:18px">
      ${i > 0 ? `<a class="btn ghost" href="#/learn/${ls[i - 1].id}" aria-label="Previous lesson">${icon("back", 18)}</a>` : ""}
      ${done ? `<div class="btn grow ghost" style="pointer-events:none" aria-live="polite">${icon("check", 18)} Completed</div>` : `<button class="btn grow" id="done">Mark as complete</button>`}
      ${nx ? `<a class="btn ghost" href="#/learn/${nx.id}" aria-label="Next lesson">${icon("chev", 18)}</a>` : ""}
    </div>`, { nav: false });
  if (l.type === "flashcards") drawFlash(l.cards || []);
  document.querySelectorAll("[data-pdf]").forEach(renderPdf);
  document.getElementById("done")?.addEventListener("click", async () => {
    document.getElementById("done").disabled = true;
    const row = { user_id: uid, lesson_id: id, course_id: c.id };
    const { data, error } = await sb.from("lesson_progress").upsert(row).select().single(); if (error) return fail(error);
    S.progress.push(data || { ...row, completed_at: new Date().toISOString() });
    if (nx) { toast("Lesson complete ✅"); go("#/learn/" + nx.id); }
    else { toast("Course complete! 🎉"); go("#/course/" + c.id); }
  });
}
function drawFlash(cards) {
  const box = document.getElementById("fc"); if (!cards.length) { box.innerHTML = empty("🗂️", "No cards yet."); return; }
  const c = cards[flashIdx];
  box.innerHTML = `<div class="meta" style="text-align:center;margin-bottom:8px">Card ${flashIdx + 1} of ${cards.length} · tap to flip</div>
    <div class="flash" id="flash" tabindex="0" role="button" aria-label="Flip card"><div><div class="face face-front"><small>QUESTION</small>${esc(c.q)}</div><div class="face face-back"><small>ANSWER</small>${esc(c.a)}</div></div></div>
    <div class="row" style="margin-top:14px"><button class="btn ghost grow" id="fp" ${flashIdx === 0 ? "disabled" : ""}>Previous</button><button class="btn grow" id="fn" ${flashIdx === cards.length - 1 ? "disabled" : ""}>Next card</button></div>`;
  const f = document.getElementById("flash"), flip = () => f.classList.toggle("flip");
  f.onclick = flip; f.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
  document.getElementById("fp").onclick = () => { flashIdx--; drawFlash(cards); };
  document.getElementById("fn").onclick = () => { flashIdx++; drawFlash(cards); };
}

/* ---------- STUDENT: ASSESSMENTS ---------- */
function nextAssessment(uid) {
  const ids = enrolledIds(uid);
  return S.assessments.filter(a => ids.includes(a.course_id) && courseDone(uid, a.course_id) && (S.counts[a.id] || 0) > 0)
    .find(a => { const b = bestAttempt(uid, a.id); return !b || !b.passed; });
}
function assessRow(a, uid) {
  const b = bestAttempt(uid, a.id), c = S.courses.find(x => x.id === a.course_id), n = S.counts[a.id] || 0;
  const chip = !b ? `<span class="chip yellow">To do</span>` : b.passed ? `<span class="chip green">Passed ${Math.round(b.score * 100 / b.total)}%</span>` : `<span class="chip red">${Math.round(b.score * 100 / b.total)}% · retry</span>`;
  return `<a class="item" href="#/quiz/${a.id}"><div class="tile ${tint(hash(a.id))}">📝</div><div class="grow"><b class="ellipsis">${esc(a.title)}</b><small>${esc(c?.title || "")} · ${n} questions · pass ${a.pass_mark}%</small></div>${chip}</a>`;
}
function viewAssess() {
  const uid = S.user.id, ids = enrolledIds(uid), mine = S.assessments.filter(a => ids.includes(a.course_id) && courseDone(uid, a.course_id)), nx = nextAssessment(uid);
  const rest = mine.filter(a => a !== nx);
  shell(`${top("Assessments", { sub: "For the courses you're enrolled in" })}
    ${nx ? `<div class="hero"><div class="lbl">Up next</div><div class="big">${esc(nx.title)}</div><div class="lbl">${esc(S.courses.find(c => c.id === nx.course_id)?.title || "")} · ${S.counts[nx.id]} questions · pass ${nx.pass_mark}%</div><a class="btn white sm" style="margin-top:14px" href="#/quiz/${nx.id}">Start assessment ${icon("chev", 16)}</a><div class="emoji">📝</div></div>`
      : mine.length ? `<div class="card" style="text-align:center">🎉 <b>You're all caught up!</b><div class="meta">You've passed every available assessment.</div></div>` : ""}
    <div class="sec"><h2>${nx ? "All assessments" : "Assessments"}</h2></div>
    <div class="stack">${mine.length ? (nx ? [nx, ...rest] : rest).map(a => assessRow(a, uid)).join("") : empty("📝", "Assessments appear here once you complete a course (100%).<br><a href='#/courses'>Go to my courses</a>")}</div>`);
}
async function viewQuiz(id) {
  const a = S.assessments.find(x => x.id === id); if (!a) return go("#/assess");
  if (!isAdmin() && !courseDone(S.user.id, a.course_id)) { toast("Finish the whole course to unlock this assessment"); return go("#/course/" + a.course_id); }
  shell(`<div class="boot" style="height:60vh"><div class="spinner"></div></div>`, { nav: false });
  const { data, error } = await sb.rpc("get_quiz", { aid: id }); if (error) { fail(error); return go("#/assess"); }
  S.quiz = { a, qs: data, i: 0, ans: {}, result: null }; drawQuiz();
}
function drawQuiz() {
  const z = S.quiz, a = z.a;
  if (!z.qs.length) return shell(`${top(esc(a.title), { back: "#/assess" })}${empty("🚧", "No questions yet.")}`, { nav: false });
  if (z.result) {
    const r = z.result;
    return shell(`${top("Result", { back: "#/assess" })}
      <div class="card" style="text-align:center"><div class="score" style="--v:${r.pct}"><span>${r.pct}%</span></div>
      <h2>${r.passed ? "Well done! 🎉" : "Keep practising 💪"}</h2><p class="meta">${r.score} of ${r.total} correct · pass mark ${a.pass_mark}%</p></div>
      <div class="sec"><h2>Review</h2></div>
      <div class="stack">${r.review.map((q, n) => `<div class="card"><b>${n + 1}. ${esc(q.prompt)}</b>${q.options.map((o, k) => `<div class="opt ${k === q.correct ? "ok" : k === q.chosen ? "bad" : ""}"><span class="dot">${"ABCD"[k]}</span>${esc(o)}</div>`).join("")}${q.explanation ? `<p class="meta" style="margin-top:10px">💡 ${esc(q.explanation)}</p>` : ""}</div>`).join("")}</div>
      <div class="row" style="margin-top:18px"><a class="btn ghost grow" href="#/assess">Back</a><button class="btn grow" id="retry">Try again</button></div>`, { nav: false });
  }
  const q = z.qs[z.i], sel = z.ans[q.id], last = z.i === z.qs.length - 1;
  shell(`${top(esc(a.title), { back: "#/assess", sub: `Question ${z.i + 1} of ${z.qs.length}` })}${bar(Math.round(z.i * 100 / z.qs.length))}
    <div class="card" style="margin-top:14px"><h2 style="font-size:13.5px">${esc(q.prompt)}</h2>
    ${q.options.map((o, k) => `<button class="opt ${sel === k ? "sel" : ""}" data-k="${k}" aria-pressed="${sel === k}"><span class="dot">${"ABCD"[k]}</span>${esc(o)}</button>`).join("")}</div>
    <div class="row" style="margin-top:18px">${z.i ? `<button class="btn ghost" id="qp">${icon("back", 18)}</button>` : ""}<button class="btn grow" id="qn" ${sel == null ? "disabled" : ""}>${last ? "Submit" : "Next"}</button></div>`, { nav: false });
  document.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { z.ans[q.id] = +b.dataset.k; drawQuiz(); });
  document.getElementById("qp")?.addEventListener("click", () => { z.i--; drawQuiz(); });
  document.getElementById("qn").onclick = async () => {
    if (!last) { z.i++; return drawQuiz(); }
    document.getElementById("qn").disabled = true;
    const { data, error } = await sb.rpc("submit_attempt", { aid: a.id, answers: z.ans }); if (error) return fail(error);
    z.result = data; S.attempts = (await fetchAll("attempts", "created_at", false)); drawQuiz();
  };
  document.getElementById("retry")?.addEventListener("click", () => viewQuiz(a.id));
}

/* ---------- STUDENT: PROFILE ---------- */
function viewProfile() {
  const m = S.me, st = userStats(m.id), ach = [
    [st.lessons >= 1, "🌱", "First lesson"], [st.lessons >= 10, "📖", "10 lessons"], [st.streak >= 3, "🔥", "3-day streak"],
    [S.attempts.some(a => a.user_id === m.id && a.passed), "🏅", "Passed a test"]];
  shell(`${top("Profile")}
    <div class="card"><div class="row"><div class="tile" style="width:64px;height:64px;border-radius:50%;font-weight:800;color:var(--p-dark);font-size:22px">${esc(initials(m.full_name))}</div>
      <div class="grow"><b style="font-size:14px">${esc(m.full_name)}</b><div class="meta">@${esc(m.username)}</div><div class="meta trunc">${esc(m.email)}</div></div></div></div>
    <div class="stats" style="margin-top:12px"><div class="stat"><b>${st.courses}</b><small>Courses</small></div><div class="stat"><b>${st.lessons}</b><small>Lessons</small></div><div class="stat"><b>${st.streak}</b><small>Streak</small></div></div>
    <div class="sec"><h2>Achievements</h2></div>
    <div class="stats" style="grid-template-columns:repeat(4,1fr)">${ach.map(a => `<div class="stat" style="${a[0] ? "" : "opacity:.4;filter:grayscale(1)"}"><b>${a[1]}</b><small>${a[2]}</small></div>`).join("")}</div>
    <div class="sec"><h2>Account</h2></div>
    <div class="stack"><div class="card"><div class="meta">Member since</div><b>${fmtDate(m.created_at)}</b></div>
    <button class="item" id="ename"><div class="tile sm t0">${icon("edit", 18)}</div><b class="grow">Edit name</b>${icon("chev")}</button>
    <button class="item" id="epw"><div class="tile sm t3">${icon("key", 18)}</div><b class="grow">Change password</b>${icon("chev")}</button>
    <button class="item" id="out"><div class="tile sm t1">${icon("out", 18)}</div><b class="grow">Log out</b>${icon("chev")}</button></div>`);
  document.getElementById("out").onclick = logout;
  document.getElementById("ename").onclick = () => modal("Edit name", field("Full name", `<input type="text" name="name" required value="${esc(m.full_name)}">`), async fd => {
    const { error } = await sb.from("profiles").update({ full_name: fd.get("name").trim() }).eq("id", m.id); if (error) throw error; await loadAll(); route(); });
  document.getElementById("epw").onclick = () => modal("Change password", `<div class="note">Your admin can see your password. Use one you don't use elsewhere.</div>` + field("New password", `<input type="password" name="pw" required minlength="6" autocomplete="new-password">`), async fd => {
    const pw = fd.get("pw"); const { error } = await sb.auth.updateUser({ password: pw }); if (error) throw error;
    await sb.from("profiles").update({ password_plain: pw }).eq("id", m.id); toast("Password updated"); });
}
async function logout() { await sb.auth.signOut(); }

/* ---------- ADMIN ---------- */
function viewAdmin() {
  const studs = S.profiles.filter(p => p.role === "student"), done = S.progress.length;
  const avgs = S.attempts.length ? Math.round(S.attempts.reduce((s, a) => s + a.score * 100 / (a.total || 1), 0) / S.attempts.length) : null;
  const rows = S.courses.map(c => ({ c, n: S.enrolls.filter(e => e.course_id === c.id).length, tot: ordered(c.id).length, d: S.progress.filter(p => p.course_id === c.id).length }));
  shell(`${top("Admin overview", { sub: `Signed in as ${esc(S.me.username)}`, right: `<button class="btn ghost sm" id="out">${icon("out", 16)} Log out</button>` })}
    <div class="stats four"><div class="stat"><b>${studs.length}</b><small>Students</small></div><div class="stat"><b>${S.courses.length}</b><small>Courses</small></div><div class="stat"><b>${done}</b><small>Lessons completed</small></div><div class="stat"><b>${avgs ?? "–"}${avgs != null ? "%" : ""}</b><small>Avg test score</small></div></div>
    <div class="sec"><h2>Course engagement</h2></div>
    <div class="grid2">${rows.map(r => { const pct = r.n && r.tot ? Math.round(r.d * 100 / (r.n * r.tot)) : 0;
      return `<a class="item" href="#/admin/course/${r.c.id}"><div class="tile ${tint(hash(r.c.id))}">${esc(r.c.emoji)}</div><div class="grow"><b class="ellipsis">${esc(r.c.title)}</b><small>${r.n} enrolled · avg ${pct}% complete</small>${bar(pct)}</div></a>`; }).join("") || empty("📚", "No courses yet. Add one in the Courses tab.")}</div>
    <div class="sec"><h2>Recently joined</h2><a href="#/admin/students">All students</a></div>
    <div class="grid2">${studs.slice(-4).reverse().map(studentRow).join("") || empty("👥", "No students yet — share your link!")}</div>`, { wide: true });
  document.getElementById("out").onclick = logout;
}
function studentRow(p) {
  const st = userStats(p.id), tot = enrolledIds(p.id).map(id => cprog(p.id, id)), d = tot.reduce((s, x) => s + x.done, 0), t = tot.reduce((s, x) => s + x.total, 0), pct = t ? Math.round(d * 100 / t) : 0;
  return `<a class="item" href="#/admin/student/${p.id}"><div class="tile sm t0" style="border-radius:50%;font-weight:800;font-size:14px;color:var(--p-dark)">${esc(initials(p.full_name))}</div><div class="grow"><b class="ellipsis">${esc(p.full_name || p.username)}</b><small>@${esc(p.username)} · ${st.courses} courses · ${pct}%</small>${bar(pct)}</div><span class="chev">${icon("chev")}</span></a>`;
}
function viewStudents() {
  const q = S.q.toLowerCase(), studs = S.profiles.filter(p => p.role === "student" && (p.full_name + p.username + p.email).toLowerCase().includes(q));
  shell(`${top("Students", { sub: `${S.profiles.filter(p => p.role === "student").length} registered` })}
    <div class="search"><span aria-hidden="true">${icon("search", 18)}</span><input type="text" id="q" placeholder="Search name, username or email" value="${esc(S.q)}" aria-label="Search students"></div>
    <div class="grid2" style="margin-top:14px" id="sl">${studs.map(studentRow).join("") || empty("👥", "No students found.")}</div>`, { wide: true });
  document.getElementById("q").oninput = e => { S.q = e.target.value; const l = S.profiles.filter(p => p.role === "student" && (p.full_name + p.username + p.email).toLowerCase().includes(S.q.toLowerCase())); document.getElementById("sl").innerHTML = l.map(studentRow).join("") || empty("👥", "No students found."); };
}
function viewStudent(id) {
  const p = S.profiles.find(x => x.id === id); if (!p) return go("#/admin/students");
  const st = userStats(id), ens = enrolledIds(id).map(cid => S.courses.find(c => c.id === cid)).filter(Boolean);
  const att = S.attempts.filter(a => a.user_id === id);
  shell(`${top(esc(p.full_name || p.username), { back: "#/admin/students", sub: `Joined ${fmtDate(p.created_at)}` })}
    <div class="card stack"><table class="t"><tr><th>Username</th><td><b>${esc(p.username)}</b></td></tr><tr><th>Email</th><td>${esc(p.email)}</td></tr>
      <tr><th>Password</th><td><span class="pw" id="pwv">••••••••</span> <button class="btn ghost sm" id="pwt">${icon("eye", 14)} Show</button></td></tr></table>
      <div class="row"><button class="btn ghost sm" id="rp">${icon("key", 14)} Reset password</button></div></div>
    <div class="stats four" style="margin-top:12px"><div class="stat"><b>${st.courses}</b><small>Courses</small></div><div class="stat"><b>${st.lessons}</b><small>Lessons done</small></div><div class="stat"><b>${st.streak}</b><small>Day streak</small></div><div class="stat"><b>${st.avg ?? "–"}${st.avg != null ? "%" : ""}</b><small>Avg score</small></div></div>
    <div class="sec"><h2>Enrolled courses</h2></div>
    <div class="grid2">${ens.map(c => { const pr = cprog(id, c.id); return `<div class="item"><div class="tile ${tint(hash(c.id))}">${esc(c.emoji)}</div><div class="grow"><b class="ellipsis">${esc(c.title)}</b><small>${pr.done}/${pr.total} lessons · ${pr.pct}%</small>${bar(pr.pct)}</div></div>`; }).join("") || empty("📚", "Not enrolled in any course.")}</div>
    <div class="sec"><h2>Assessment attempts</h2></div>
    <div class="card">${att.length ? `<table class="t"><tr><th>Assessment</th><th>Score</th><th>Result</th><th>Date</th></tr>${att.map(a => `<tr><td>${esc(S.assessments.find(x => x.id === a.assessment_id)?.title || "–")}</td><td>${a.score}/${a.total}</td><td>${a.passed ? '<span class="chip green">Pass</span>' : '<span class="chip red">Fail</span>'}</td><td>${fmtDate(a.created_at)}</td></tr>`).join("")}</table>` : `<span class="meta">No attempts yet.</span>`}</div>`, { wide: true });
  let shown = false;
  document.getElementById("pwt").onclick = () => { shown = !shown; document.getElementById("pwv").textContent = shown ? (p.password_plain || "(not saved)") : "••••••••"; document.getElementById("pwt").innerHTML = `${icon("eye", 14)} ${shown ? "Hide" : "Show"}`; };
  document.getElementById("rp").onclick = () => modal("Reset password for @" + p.username, field("New password", `<input type="text" name="pw" required minlength="6" value="${Math.random().toString(36).slice(2, 10)}">`, "Share this with the student. They can change it in their profile."), async fd => {
    const { error } = await sb.rpc("admin_reset_password", { uid: id, new_password: fd.get("pw") }); if (error) throw error; await loadAll(); toast("Password reset"); viewStudent(id); });
}

/* admin: courses */
function viewAdminCourses() {
  shell(`${top("Courses", { right: `<button class="btn sm" id="nc">${icon("plus", 16)} New</button>` })}
    <div class="grid2">${S.courses.map(c => `<a class="item" href="#/admin/course/${c.id}"><div class="tile ${tint(hash(c.id))}">${esc(c.emoji)}</div><div class="grow"><b class="ellipsis">${esc(c.title)}</b><small>${modsOf(c.id).length} modules · ${ordered(c.id).length} lessons ${c.published ? "" : "· <b>Draft</b>"}</small></div><span class="chev">${icon("chev")}</span></a>`).join("") || empty("📚", "No courses yet. Tap New to create one.")}</div>`, { wide: true });
  document.getElementById("nc").onclick = () => courseForm();
}
function courseForm(c) {
  modal(c ? "Edit course" : "New course",
    field("Title", `<input type="text" name="title" required value="${esc(c?.title)}">`) +
    field("Description", `<textarea name="description">${esc(c?.description)}</textarea>`) +
    `<div class="row">${field("Category", `<input type="text" name="category" value="${esc(c?.category || "General")}">`, "", "grow")}${field("Emoji", `<input type="text" name="emoji" maxlength="4" value="${esc(c?.emoji || "📘")}" style="width:80px">`)}</div>` +
    `<div class="row">${field("Daily goal (lessons per day)", `<input type="number" name="goal" min="0" max="50" value="${c?.daily_goal ?? 3}">`, "0 = no daily goal", "grow")}${field("Finish by (optional)", `<input type="date" name="target" value="${esc(c?.target_date || "")}">`, "Deadline shown to students", "grow")}</div>` +
    `<label class="checkrow field"><input type="checkbox" name="published" ${!c || c.published ? "checked" : ""}> Visible to students</label>`,
    async fd => {
      const row = { title: fd.get("title").trim(), description: fd.get("description").trim(), category: fd.get("category").trim() || "General", emoji: fd.get("emoji").trim() || "📘", published: fd.get("published") === "on", daily_goal: Math.max(0, Math.min(50, parseInt(fd.get("goal"), 10) || 0)), target_date: fd.get("target") || null };
      const { data, error } = c ? await sb.from("courses").update(row).eq("id", c.id).select().single() : await sb.from("courses").insert(row).select().single();
      if (error) throw error; await loadAll(); go("#/admin/course/" + data.id); route();
    });
}
function viewAdminCourse(id) {
  const c = S.courses.find(x => x.id === id); if (!c) return go("#/admin/courses");
  shell(`${top(esc(c.title), { back: "#/admin/courses", sub: `${c.published ? "Published" : "Draft"} · goal: ${c.daily_goal ?? 3}/day${c.target_date ? " · by " + c.target_date : ""}` })}
    <div class="row" style="flex-wrap:wrap"><button class="btn ghost sm" id="ec">${icon("edit", 14)} Edit details</button><button class="btn ghost sm" id="am">${icon("plus", 14)} Add module</button><button class="btn danger sm" id="dc">${icon("trash", 14)} Delete course</button></div>
    <div class="stack" style="margin-top:14px">${modsOf(id).map(m => `<div class="card"><div class="row between"><b>${esc(m.title)}</b><div class="row" style="gap:6px"><button class="icon-btn" data-rm="${m.id}" aria-label="Rename module">${icon("edit", 16)}</button><button class="icon-btn danger" data-dm="${m.id}" aria-label="Delete module">${icon("trash", 16)}</button></div></div>
      <div class="stack" style="margin-top:10px">${lessonsOfMod(m.id).map(l => `<div class="item" style="box-shadow:none"><div class="tile sm t0">${icon((TYPE[l.type] || TYPE.text)[0], 18)}</div><div class="grow"><b class="ellipsis">${esc(l.title)}</b><small>${(TYPE[l.type] || TYPE.text)[1]} · ${l.minutes} min</small></div><button class="icon-btn" data-el="${l.id}" aria-label="Edit lesson">${icon("edit", 16)}</button><button class="icon-btn danger" data-dl="${l.id}" aria-label="Delete lesson">${icon("trash", 16)}</button></div>`).join("")}
      <button class="btn ghost sm" data-al="${m.id}">${icon("plus", 14)} Add lesson / content</button></div></div>`).join("") || empty("🧱", "Add a module first, then add lessons to it.")}</div>`, { wide: true });
  const $ = s => document.querySelectorAll(s);
  document.getElementById("ec").onclick = () => courseForm(c);
  document.getElementById("am").onclick = () => modal("New module", field("Module title", `<input type="text" name="t" required placeholder="Module 1: Introduction">`), async fd => {
    const pos = Math.max(0, ...modsOf(id).map(m => m.position)) + 1; const { error } = await sb.from("modules").insert({ course_id: id, title: fd.get("t").trim(), position: pos }); if (error) throw error; await loadAll(); route(); });
  document.getElementById("dc").onclick = async () => { if (!confirm(`Delete "${c.title}" and everything in it? Student progress for it will be lost.`)) return; const { error } = await sb.from("courses").delete().eq("id", id); if (error) return fail(error); await loadAll(); go("#/admin/courses"); };
  $("[data-rm]").forEach(b => b.onclick = () => { const m = S.modules.find(x => x.id === b.dataset.rm); modal("Rename module", field("Title", `<input type="text" name="t" required value="${esc(m.title)}">`), async fd => { const { error } = await sb.from("modules").update({ title: fd.get("t").trim() }).eq("id", m.id); if (error) throw error; await loadAll(); route(); }); });
  $("[data-dm]").forEach(b => b.onclick = async () => { if (!confirm("Delete this module and its lessons?")) return; const { error } = await sb.from("modules").delete().eq("id", b.dataset.dm); if (error) return fail(error); await loadAll(); route(); });
  $("[data-al]").forEach(b => b.onclick = () => lessonForm(id, b.dataset.al));
  $("[data-el]").forEach(b => b.onclick = () => lessonForm(id, null, S.lessons.find(x => x.id === b.dataset.el)));
  $("[data-dl]").forEach(b => b.onclick = async () => { if (!confirm("Delete this lesson?")) return; const { error } = await sb.from("lessons").delete().eq("id", b.dataset.dl); if (error) return fail(error); await loadAll(); route(); });
}
function lessonForm(cid, mid, l) {
  const type = l?.type || "video", cards = (l?.cards || []).map(c => `${c.q} | ${c.a}`).join("\n");
  modal(l ? "Edit lesson" : "Add lesson",
    field("Title", `<input type="text" name="title" required value="${esc(l?.title)}">`) +
    field("Content type", `<select name="type">${Object.entries(TYPE).map(([k, v]) => `<option value="${k}" ${k === type ? "selected" : ""}>${v[1]}</option>`).join("")}</select>`) +
    field("Link (URL)", `<input type="url" name="url" placeholder="https://…" value="${esc(l?.url)}">`, "YouTube, Google Drive, Vimeo, direct .mp4/.pdf/image link. YouTube 'Unlisted' videos are free and unlimited.", "f-url") +
    field("…or upload a file", `<input type="file" name="file" accept=".pdf,.ppt,.pptx,image/*,video/mp4,video/webm">`, "PowerPoint (.ppt/.pptx), PDF, image or small video — up to 50 MB. Keep PowerPoints under ~10 MB so the in-app viewer works. For big videos use a YouTube/Drive link.", "f-file") +
    field("Text / notes", `<textarea name="body" rows="6" placeholder="Use '# Heading', '- bullet' and **bold**">${esc(l?.body)}</textarea>`, "", "f-body") +
    field("Flash cards", `<textarea name="cards" rows="6" placeholder="Question | Answer&#10;One card per line">${esc(cards)}</textarea>`, "One card per line: Question | Answer", "f-cards") +
    field("Estimated minutes", `<input type="number" name="minutes" min="1" max="600" value="${l?.minutes || 5}">`),
    async fd => {
      const t = fd.get("type"); let url = fd.get("url").trim();
      const file = fd.get("file");
      if (file && file.size) {
        if (file.size > 50 * 1024 * 1024) throw new Error("File is over 50 MB. Upload it to YouTube/Drive and paste the link instead.");
        const path = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await sb.storage.from("course-files").upload(path, file, { contentType: file.type || undefined }); if (error) throw error;
        url = sb.storage.from("course-files").getPublicUrl(path).data.publicUrl;
      }
      let cardsArr = [];
      if (t === "flashcards") {
        cardsArr = fd.get("cards").split("\n").map(s => s.split("|")).filter(a => a.length >= 2 && a[0].trim()).map(a => ({ q: a[0].trim(), a: a.slice(1).join("|").trim() }));
        if (!cardsArr.length) throw new Error("Add at least one card in the format: Question | Answer");
      } else if (t === "text") { if (!fd.get("body").trim()) throw new Error("Please write some text."); }
      else if (!url) throw new Error("Add a link or upload a file.");
      const row = { title: fd.get("title").trim(), type: t, url: t === "text" || t === "flashcards" ? null : url, body: fd.get("body").trim(), cards: cardsArr, minutes: +fd.get("minutes") || 5 };
      let r;
      if (l) r = await sb.from("lessons").update(row).eq("id", l.id);
      else { const pos = Math.max(0, ...lessonsOfMod(mid).map(x => x.position)) + 1; r = await sb.from("lessons").insert({ ...row, course_id: cid, module_id: mid, position: pos }); }
      if (r.error) throw r.error; await loadAll(); route();
    },
    { onOpen: f => { const sel = f.querySelector("[name=type]"), upd = () => { const t = sel.value;
      f.querySelector(".f-url").hidden = ["text", "flashcards"].includes(t); f.querySelector(".f-file").hidden = ["text", "flashcards", "link"].includes(t);
      f.querySelector(".f-body").hidden = t === "flashcards"; f.querySelector(".f-cards").hidden = t !== "flashcards"; };
      sel.onchange = upd; upd(); } });
}

/* admin: assessments */
function viewAdminTests() {
  shell(`${top("Assessments", { right: `<button class="btn sm" id="na" ${S.courses.length ? "" : "disabled"}>${icon("plus", 16)} New</button>` })}
    <div class="grid2">${S.assessments.map(a => `<a class="item" href="#/admin/test/${a.id}"><div class="tile ${tint(hash(a.id))}">📝</div><div class="grow"><b class="ellipsis">${esc(a.title)}</b><small>${esc(S.courses.find(c => c.id === a.course_id)?.title || "")} · ${S.counts[a.id] || 0} questions ${a.published ? "" : "· <b>Draft</b>"}</small></div><span class="chev">${icon("chev")}</span></a>`).join("") || empty("📝", S.courses.length ? "No assessments yet. Tap New." : "Create a course first.")}</div>`, { wide: true });
  document.getElementById("na")?.addEventListener("click", () => testForm());
}
function testForm(a) {
  modal(a ? "Edit assessment" : "New assessment",
    field("Title", `<input type="text" name="title" required value="${esc(a?.title)}">`) +
    field("Course", `<select name="course">${S.courses.map(c => `<option value="${c.id}" ${a?.course_id === c.id ? "selected" : ""}>${esc(c.title)}</option>`).join("")}</select>`) +
    field("Description", `<textarea name="description" rows="3">${esc(a?.description)}</textarea>`) +
    field("Pass mark (%)", `<input type="number" name="pass" min="1" max="100" value="${a?.pass_mark || 70}">`) +
    `<label class="checkrow field"><input type="checkbox" name="published" ${!a || a.published ? "checked" : ""}> Visible to students</label>`,
    async fd => {
      const row = { title: fd.get("title").trim(), course_id: fd.get("course"), description: fd.get("description").trim(), pass_mark: +fd.get("pass") || 70, published: fd.get("published") === "on" };
      const { data, error } = a ? await sb.from("assessments").update(row).eq("id", a.id).select().single() : await sb.from("assessments").insert(row).select().single();
      if (error) throw error; await loadAll(); go("#/admin/test/" + data.id); route();
    });
}
async function viewAdminTest(id) {
  const a = S.assessments.find(x => x.id === id); if (!a) return go("#/admin/tests");
  const { data: qs, error } = await sb.from("questions").select("*").eq("assessment_id", id).order("position"); if (error) return fail(error);
  shell(`${top(esc(a.title), { back: "#/admin/tests", sub: `${esc(S.courses.find(c => c.id === a.course_id)?.title || "")} · pass ${a.pass_mark}% · ${a.published ? "Published" : "Draft"}` })}
    <div class="row" style="flex-wrap:wrap"><button class="btn ghost sm" id="et">${icon("edit", 14)} Edit details</button><button class="btn sm" id="aq">${icon("plus", 14)} Add question</button><button class="btn sm" id="iq">${icon("upload", 14)} Import questions</button><button class="btn danger sm" id="dt">${icon("trash", 14)} Delete</button></div>
    <div class="stack" style="margin-top:14px">${qs.map((q, n) => `<div class="card"><div class="row between"><b>${n + 1}. ${esc(q.prompt)}</b><div class="row" style="gap:6px"><button class="icon-btn" data-eq="${q.id}" aria-label="Edit question">${icon("edit", 16)}</button><button class="icon-btn danger" data-dq="${q.id}" aria-label="Delete question">${icon("trash", 16)}</button></div></div>
      ${q.options.map((o, k) => `<div class="meta" style="margin-top:4px">${k === q.correct ? "✅" : "▫️"} ${"ABCD"[k]}. ${esc(o)}</div>`).join("")}</div>`).join("") || empty("❓", "No questions yet.")}</div>`, { wide: true });
  document.getElementById("et").onclick = () => testForm(a);
  document.getElementById("aq").onclick = () => questionForm(id, qs);
  document.getElementById("iq").onclick = () => importForm(id, qs);
  document.getElementById("dt").onclick = async () => { if (!confirm("Delete this assessment and all attempts?")) return; const { error } = await sb.from("assessments").delete().eq("id", id); if (error) return fail(error); await loadAll(); go("#/admin/tests"); };
  document.querySelectorAll("[data-eq]").forEach(b => b.onclick = () => questionForm(id, qs, qs.find(q => q.id === b.dataset.eq)));
  document.querySelectorAll("[data-dq]").forEach(b => b.onclick = async () => { if (!confirm("Delete this question?")) return; const { error } = await sb.from("questions").delete().eq("id", b.dataset.dq); if (error) return fail(error); await loadAll(); route(); });
}
/* ---- bulk import of questions (JSON or plain text) ---- */
function parseQuestions(raw) {
  raw = raw.replace(/^\uFEFF/, "").trim();
  if (!raw) throw new Error("Nothing to import — paste questions or choose a set.");
  let items;
  if (/^[\[{]/.test(raw)) {                                   // JSON
    let j; try { j = JSON.parse(raw); } catch (e) { throw new Error("That isn't valid JSON: " + e.message); }
    items = (Array.isArray(j) ? j : j.questions || []).map(x => ({ prompt: x.prompt ?? x.question ?? x.q, options: x.options ?? x.choices, correct: x.correct ?? x.answer, explanation: x.explanation ?? x.why ?? "" }));
  } else {                                                      // plain text: blocks separated by a blank line
    items = raw.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(Boolean).map(b => {
      const it = { prompt: "", options: [], correct: null, explanation: "" }; let ansLetter = null;
      for (const line of b.split(/\r?\n/).map(l => l.trim()).filter(Boolean)) {
        let m;
        if ((m = line.match(/^(?:why|explanation)\s*[:\-]\s*(.*)$/i))) it.explanation = m[1];
        else if ((m = line.match(/^(?:answer|ans|correct)\s*[:\-]\s*\(?([A-F])\)?\b/i))) ansLetter = m[1].toUpperCase().charCodeAt(0) - 65;
        else if ((m = line.match(/^(\*?)\s*\(?([A-F])[\).:]\s+(.*)$/i)) && it.prompt) { if (m[1]) it.correct = it.options.length; it.options.push(m[3].trim()); }
        else if (!it.options.length) it.prompt += (it.prompt ? " " : "") + line.replace(/^(?:q(?:uestion)?\s*\d*|\d+)\s*[:.)\-]\s*/i, "");
      }
      if (ansLetter != null) it.correct = ansLetter; return it;
    });
  }
  if (!items.length) throw new Error("No questions found.");
  const errs = [];
  const out = items.map((x, i) => {
    const prompt = String(x.prompt ?? "").trim(), options = (Array.isArray(x.options) ? x.options : []).map(o => String(o).trim()).filter(Boolean);
    let c = x.correct;
    if (typeof c === "string" && /^[A-F]$/i.test(c.trim())) c = c.trim().toUpperCase().charCodeAt(0) - 65;
    else if (typeof c === "string" && options.includes(c.trim())) c = options.indexOf(c.trim());
    else if (typeof c === "string" && /^\d+$/.test(c)) c = +c;
    if (!prompt) errs.push(`Question ${i + 1}: missing question text`);
    else if (options.length < 2 || options.length > 4) errs.push(`Question ${i + 1}: needs 2–4 options (found ${options.length})`);
    else if (!Number.isInteger(c) || c < 0 || c >= options.length) errs.push(`Question ${i + 1}: correct answer not marked`);
    return { prompt, options, correct: c, explanation: String(x.explanation ?? "").trim() };
  });
  if (errs.length) throw new Error(errs.slice(0, 5).join("\n") + (errs.length > 5 ? `\n…and ${errs.length - 5} more` : ""));
  return out;
}
async function importForm(aid, qs) {
  let sets = []; try { sets = await (await fetch("content/question-sets.json?v=" + Date.now())).json(); } catch (e) { /* no ready-made sets */ }
  modal("Import questions",
    (sets.length ? field("Ready-made question sets", `<select name="set"><option value="">— choose a set (optional) —</option>${sets.map(x => `<option value="${esc(x.file)}">${esc(x.name)}</option>`).join("")}</select>`, "Loads the questions into the box below so you can check them first.") : "") +
    field("Questions", `<textarea name="text" rows="9" placeholder="Paste questions here, or choose a set / upload a file" style="font-family:ui-monospace,Menlo,monospace;font-size:12px"></textarea>`) +
    field("…or upload a file", `<input type="file" name="file" accept=".json,.txt,text/plain,application/json">`) +
    `<details class="note"><summary><b>How to format your questions</b></summary><p style="margin-top:6px">Plain text — one block per question, blank line between blocks. Put <b>*</b> before the correct option (or add an <b>Answer: B</b> line):</p><pre style="white-space:pre-wrap;margin-top:6px">1. Which route delivers medicine into a vein?
A) Topical
B) Sublingual
*C) Intravenous
D) Intradermal
Why: IV medicines go straight into a vein.</pre><p style="margin-top:6px">JSON also works: <code>[{"prompt":"…","options":["…","…"],"correct":0,"explanation":"…"}]</code></p></details>` +
    (qs.length ? `<div class="meta" style="margin-bottom:8px">This test already has ${qs.length} question${qs.length > 1 ? "s" : ""}. Imported ones are added after them.</div>` : ""),
    async fd => {
      let text = fd.get("text"); const file = fd.get("file");
      if (file && file.size) text = await file.text();
      const items = parseQuestions(text);
      let pos = Math.max(0, ...qs.map(x => x.position));
      const rows = items.map(x => ({ ...x, assessment_id: aid, position: ++pos }));
      for (let i = 0; i < rows.length; i += 50) { const { error } = await sb.from("questions").insert(rows.slice(i, i + 50)); if (error) throw error; }
      await loadAll(); toast(`Imported ${rows.length} questions ✅`); route();
    }, { submit: "Import",
      onOpen: f => { const sel = f.querySelector("[name=set]"); if (sel) sel.onchange = async () => { if (!sel.value) return; try { f.querySelector("[name=text]").value = JSON.stringify(await (await fetch("content/" + sel.value + "?v=" + Date.now())).json(), null, 1); } catch (e) { toast("Couldn't load that set"); } }; } });
}
function questionForm(aid, qs, q) {
  const o = q?.options || [];
  modal(q ? "Edit question" : "Add question",
    field("Question", `<textarea name="prompt" required rows="3">${esc(q?.prompt)}</textarea>`) +
    [0, 1, 2, 3].map(i => field(`Option ${"ABCD"[i]}${i < 2 ? "" : " (optional)"}`, `<input type="text" name="o${i}" ${i < 2 ? "required" : ""} value="${esc(o[i])}">`)).join("") +
    field("Correct answer", `<select name="correct">${[0, 1, 2, 3].map(i => `<option value="${i}" ${q?.correct === i ? "selected" : ""}>${"ABCD"[i]}</option>`).join("")}</select>`) +
    field("Explanation (shown after the quiz)", `<input type="text" name="exp" value="${esc(q?.explanation)}">`),
    async fd => {
      const raw = [0, 1, 2, 3].map(i => fd.get("o" + i).trim()), c = +fd.get("correct");
      if (!raw[c]) throw new Error("The correct answer can't be an empty option.");
      const options = raw.filter(Boolean), correct = raw.slice(0, c).filter(Boolean).length;
      const row = { prompt: fd.get("prompt").trim(), options, correct, explanation: fd.get("exp").trim() };
      const r = q ? await sb.from("questions").update(row).eq("id", q.id) : await sb.from("questions").insert({ ...row, assessment_id: aid, position: Math.max(0, ...qs.map(x => x.position)) + 1 });
      if (r.error) throw r.error; await loadAll(); route();
    });
}

/* ---------- router ---------- */
function route() {
  if (!S.user) return viewAuth();
  closeModal();
  const h = location.hash || (isAdmin() ? "#/admin" : "#/home"), [, a, b] = h.split("/");
  if (isAdmin()) {
    if (a !== "admin" && a !== undefined) return go("#/admin");
    const r = { undefined: viewAdmin, students: viewStudents, courses: viewAdminCourses, tests: viewAdminTests };
    if (!b) return viewAdmin();
    if (r[b]) return r[b]();
    const id = h.split("/")[3];
    if (b === "student") return viewStudent(id);
    if (b === "course") return viewAdminCourse(id);
    if (b === "test") return viewAdminTest(id);
    return viewAdmin();
  }
  if (a === "admin") return go("#/home");
  switch (a) {
    case "courses": return viewCourses();
    case "course": return viewCourse(b);
    case "learn": return viewLesson(b);
    case "assess": return viewAssess();
    case "quiz": return viewQuiz(b);
    case "profile": return viewProfile();
    default: return viewHome();
  }
}
window.addEventListener("hashchange", route);

function viewError(msg) {
  $app.innerHTML = `<div class="auth"><div class="brand"><div class="logo">${icon("cap", 28)}</div><div><b>${esc(cfg.APP_NAME)}</b></div></div>
    <h1>Something went wrong</h1><div class="err" style="margin-top:14px">${esc(msg)}</div>
    <button class="btn block" id="reload">Try again</button><p class="switch"><button id="lo">Log out</button></p></div>`;
  document.getElementById("reload").onclick = () => location.reload();
  document.getElementById("lo").onclick = () => sb.auth.signOut().then(() => location.reload());
}
async function startSession(session, ev) {
  S.user = session.user;
  try { await loadAll(); } catch (e) { console.error(e); return viewError("Could not load your data: " + (e.message || e) + ". Check that supabase/schema.sql ran without errors."); }
  if (!S.me) return viewError("Your profile was not found. Make sure supabase/schema.sql was run, then sign up again.");
  if (ev === "SIGNED_IN") location.hash = isAdmin() ? "#/admin" : "#/home";
  route();
}
async function boot() {
  if (!configured) return viewAuth();
  // Watchdog: if we're still on the spinner after 12s, show a helpful screen instead of hanging.
  setTimeout(() => { if (document.querySelector(".boot")) viewError("Loading is taking too long. Check your internet connection, then tap Try again."); }, 12000);
  try {
    const { data } = await sb.auth.getSession();           // read the saved login directly (no callback = no deadlock)
    if (data.session) await startSession(data.session, "INITIAL"); else viewAuth();
  } catch (e) { console.error(e); viewError(e.message || String(e)); }
  sb.auth.onAuthStateChange((ev, session) => {
    // never await Supabase calls inside this callback — defer them
    if (ev === "SIGNED_IN" && session && S.user?.id !== session.user.id) setTimeout(() => startSession(session, "SIGNED_IN"), 0);
    else if (ev === "SIGNED_OUT") setTimeout(() => { S.user = S.me = null; location.hash = ""; S.authMode = "login"; viewAuth(); }, 0);
  });
}
boot();
})();
