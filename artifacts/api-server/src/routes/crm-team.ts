import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { CRM_HTML } from "../data/crm-html";
import { CRM_TEAM_UI_JS } from "../data/crm-team-client";

// SALES TEAM CRM. The Leads and Scripts tabs on /crmpage, plus a team page at /api/crm-team where the sales partners log in with their name
// and the team password. Leads are the Instagram and TikTok follower lists already inside the CRM page. Every status and note is saved here,
// so the whole team sees the same list and nobody messages the same person twice.

const router: IRouter = Router();

// slug is the same name used on the sign up links (www.thecybersuite.com/signup?ref=slug), so each person's leads are tracked.
export const TEAM = [
  { slug: "deanos", name: "Dean" },
  { slug: "isabella", name: "Isabella Gregory" },
  { slug: "leah", name: "Leah Wood" },
];
const STATUSES = ["New", "Messaged", "Replied", "Call booked", "Signed", "Not relevant"];
const PER_PAGE = 50;

// The team password lives in the CRM_TEAM_PASSWORD variable on Railway. If it is not set yet, the agreed starting password is used.
const teamPassword = () => (process.env.CRM_TEAM_PASSWORD || "botox").trim().toLowerCase();
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

type Who = { name: string; admin: boolean };

function whoIs(req: Request): Who | null {
  const appPassword = (process.env.APP_PASSWORD || "").trim().toLowerCase();
  const sentApp = String(req.header("x-app-password") ?? "").trim().toLowerCase();
  if (appPassword && sentApp && sentApp === appPassword) return { name: "Vanessa", admin: true };
  const slug = String(req.header("x-team-name") ?? "").trim().toLowerCase();
  const pw = String(req.header("x-team-password") ?? "").trim().toLowerCase();
  const member = TEAM.find((m) => m.slug === slug);
  if (member && pw && pw === teamPassword()) return { name: member.name, admin: false };
  return null;
}

function requireAny(req: Request, res: Response, next: NextFunction) {
  const who = whoIs(req);
  if (!who) { res.status(401).json({ error: "Unauthorized" }); return; }
  (req as Request & { who?: Who }).who = who;
  next();
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const who = whoIs(req);
  if (!who || !who.admin) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crm_team_leads (
        source TEXT NOT NULL,
        handle TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'New',
        owner TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (source, handle)
      )
    `);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

// The follower lists are inside the CRM page's own data block. Read them once.
type Lead = { source: "instagram" | "tiktok"; handle: string };
let leadCache: Lead[] | null = null;
function allLeads(): Lead[] {
  if (leadCache) return leadCache;
  const i = CRM_HTML.indexOf("const DATA = ");
  const j = CRM_HTML.indexOf("\n", i);
  const data = JSON.parse(CRM_HTML.slice(i + 13, j).replace(/;\s*$/, "")) as { followers?: string[]; ttFollowers?: string[] };
  const seen = new Set<string>();
  const out: Lead[] = [];
  const add = (source: Lead["source"], list: string[] | undefined) => {
    for (const raw of list ?? []) {
      const handle = String(raw).trim().toLowerCase().replace(/^@/, "");
      const key = source + "|" + handle;
      if (!handle || seen.has(key)) continue;
      seen.add(key);
      out.push({ source, handle });
    }
  };
  add("instagram", data.followers);
  add("tiktok", data.ttFollowers);
  leadCache = out;
  return out;
}

type Row = { source: string; handle: string; status: string; owner: string; note: string; updated_at: Date };

router.post("/crm-team/login", (req: Request, res: Response) => {
  const slug = str(req.body?.slug, 40).toLowerCase();
  const pw = str(req.body?.password, 80).toLowerCase();
  const member = TEAM.find((m) => m.slug === slug);
  if (member && pw && pw === teamPassword()) { res.json({ ok: true, name: member.name, slug: member.slug }); return; }
  res.status(401).json({ ok: false, error: "That name and password do not match." });
});

router.get("/crm-team/leads", requireAny, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const source = str(req.query.source, 12);
    const status = str(req.query.status, 20);
    const q = str(req.query.q, 60).toLowerCase().replace(/^@/, "");
    const page = Math.max(0, parseInt(String(req.query.page ?? "0"), 10) || 0);

    const saved = await db.execute(sql`SELECT source, handle, status, owner, note, updated_at FROM crm_team_leads`);
    const byKey = new Map<string, Row>();
    for (const r of saved.rows as Row[]) byKey.set(r.source + "|" + r.handle, r);

    const counts: Record<string, number> = {};
    for (const s of STATUSES) counts[s] = 0;
    const rows: Array<{ source: string; handle: string; status: string; owner: string; note: string; updated: Date | null }> = [];
    for (const l of allLeads()) {
      if (source === "instagram" || source === "tiktok") { if (l.source !== source) continue; }
      if (q && !l.handle.includes(q)) continue;
      const r = byKey.get(l.source + "|" + l.handle);
      const st = r?.status ?? "New";
      counts[st] = (counts[st] ?? 0) + 1;
      if (STATUSES.includes(status) && st !== status) continue;
      rows.push({ source: l.source, handle: l.handle, status: st, owner: r?.owner ?? "", note: r?.note ?? "", updated: r?.updated_at ?? null });
    }
    res.json({ total: rows.length, page, perPage: PER_PAGE, counts, rows: rows.slice(page * PER_PAGE, (page + 1) * PER_PAGE) });
  } catch (err) {
    req.log?.error({ err }, "crm team leads failed");
    res.status(500).json({ error: "Could not load the leads" });
  }
});

router.put("/crm-team/leads/:source/:handle", requireAny, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const who = (req as Request & { who?: Who }).who as Who;
    const source = str(req.params.source, 12);
    const handle = str(req.params.handle, 80).toLowerCase().replace(/^@/, "");
    if ((source !== "instagram" && source !== "tiktok") || !handle) { res.status(400).json({ error: "Unknown lead" }); return; }
    const hasStatus = typeof req.body?.status === "string";
    const hasNote = typeof req.body?.note === "string";
    const status = hasStatus ? str(req.body.status, 20) : "";
    if (hasStatus && !STATUSES.includes(status)) { res.status(400).json({ error: "Unknown status" }); return; }
    const note = hasNote ? str(req.body.note, 500) : "";
    await db.execute(sql`
      INSERT INTO crm_team_leads (source, handle, status, owner, note, updated_at)
      VALUES (${source}, ${handle}, ${hasStatus ? status : "New"}, ${who.name}, ${note}, now())
      ON CONFLICT (source, handle) DO UPDATE SET
        status = ${hasStatus ? sql`EXCLUDED.status` : sql`crm_team_leads.status`},
        note = ${hasNote ? sql`EXCLUDED.note` : sql`crm_team_leads.note`},
        owner = EXCLUDED.owner,
        updated_at = now()
    `);
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "crm team save failed");
    res.status(500).json({ error: "Could not save" });
  }
});

router.get("/crm-team/summary", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const rows = await db.execute(sql`SELECT owner, status, COUNT(*)::int AS n FROM crm_team_leads GROUP BY owner, status`);
    const tally = (name: string, statuses: string[]) =>
      (rows.rows as Array<{ owner: string; status: string; n: number }>)
        .filter((r) => r.owner === name && statuses.includes(r.status)).reduce((a, r) => a + r.n, 0);
    const origin = `${req.header("x-forwarded-proto") || req.protocol}://${req.header("x-forwarded-host") || req.get("host")}`;
    res.json({
      origin,
      signupBase: "https://www.thecybersuite.com/signup?ref=",
      team: TEAM.map((m) => ({
        slug: m.slug, name: m.name,
        messaged: tally(m.name, ["Messaged", "Replied", "Call booked", "Signed"]),
        replied: tally(m.name, ["Replied", "Call booked", "Signed"]),
        booked: tally(m.name, ["Call booked", "Signed"]),
        signed: tally(m.name, ["Signed"]),
      })),
    });
  } catch {
    res.status(500).json({ error: "Could not load the team" });
  }
});

// The team page. Same look as the CRM, but only Leads and Scripts. Nothing else from the CRM is in it.
router.get("/crm-team", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(TEAM_PAGE);
});

const TEAM_PAGE = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sales Team CRM</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root { color-scheme: light; --pink: #e6007e; --pink-soft: #fbd9ec; --ink: #000; --line: #e4e4e4; --grey: #6b6b6b; }
* { box-sizing: border-box; }
body { margin: 0; font-family: 'League Spartan', -apple-system, 'Segoe UI', Arial, sans-serif; background: #fff; color: var(--ink); }
.app { max-width: 1100px; margin: 0 auto; padding: 24px 20px 60px; }
h1 { font-size: 44px; line-height: 1; margin: 0; font-weight: 900; }
.subtitle { color: var(--grey); font-size: 15px; margin: 6px 0 18px; font-weight: 500; }
.divider { height: 6px; background: var(--pink); border-radius: 3px; margin-bottom: 20px; }
nav.tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; border-bottom: 2px solid var(--ink); padding-bottom: 12px; }
nav.tabs button { background: #fff; color: var(--ink); border: 2px solid var(--ink); padding: 9px 16px; border-radius: 10px; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }
nav.tabs button.active { background: var(--ink); color: var(--pink); }
.card { background: #fff; border: 2px solid var(--ink); border-radius: 14px; padding: 20px 22px; margin-bottom: 20px; }
.card h2 { font-size: 22px; margin: 0 0 4px; font-weight: 900; }
.card .hint { font-size: 14px; color: var(--grey); margin: 0 0 14px; font-weight: 500; }
.form-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: end; margin-bottom: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; min-width: 140px; flex: 1; }
input, select, textarea { font-family: inherit; padding: 10px 12px; border-radius: 10px; border: 2px solid var(--ink); background: #fff; color: var(--ink); font-size: 14px; font-weight: 500; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--pink); }
button { font-family: inherit; border: none; border-radius: 10px; padding: 10px 18px; font-weight: 800; font-size: 14px; cursor: pointer; }
.btn-primary { background: var(--pink); color: #000; }
.btn-ghost { background: var(--ink); color: var(--pink); }
.btn-ghost:disabled { opacity: .35; cursor: default; }
.btn-copy { background: var(--pink); color: #000; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; padding: 9px 10px; font-weight: 800; border-bottom: 2px solid var(--ink); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
td { padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: middle; }
a.profile-link { color: var(--pink); text-decoration: underline; font-weight: 800; font-size: 14px; }
.empty-note { color: var(--grey); font-size: 14px; font-style: italic; padding: 6px 0; }
.list-toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
.list-toolbar input[type=text] { flex: 1; min-width: 180px; }
.pager { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 13px; color: var(--grey); }
.pager button { padding: 6px 12px; font-size: 13px; }
.dm-card { border: 2px solid var(--ink); border-radius: 12px; padding: 16px; margin-bottom: 12px; background: #fff; }
.dm-title { font-weight: 900; font-size: 16px; color: var(--pink); margin-bottom: 4px; }
.dm-body { font-size: 14px; line-height: 1.55; margin-bottom: 10px; white-space: pre-wrap; }
.toast { position: fixed; top: 18px; right: 18px; background: var(--ink); border: 2px solid var(--pink); color: var(--pink); padding: 12px 20px; border-radius: 10px; font-weight: 800; font-size: 14px; opacity: 0; transition: opacity .3s; pointer-events: none; z-index: 999; }
.toast.show { opacity: 1; }
.login { max-width: 420px; margin: 40px auto; }
.err { color: #b00020; font-weight: 700; font-size: 14px; min-height: 20px; }
.who { font-size: 14px; font-weight: 700; display: flex; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.who button { padding: 6px 12px; font-size: 13px; }
</style>
</head>
<body>
<div class="app">
  <h1>Sales Team CRM</h1>
  <p class="subtitle">Social Media Sister leads, scripts and your own sign up link</p>
  <div class="divider"></div>
  <div id="login" class="card login">
    <h2>Log in</h2>
    <p class="hint">Choose your name and enter the team password.</p>
    <div class="form-row"><label class="field">Your name<select id="lg-name">${TEAM.map((m) => `<option value="${m.slug}">${m.name}</option>`).join("")}</select></label></div>
    <div class="form-row"><label class="field">Password<input type="password" id="lg-pw" autocomplete="current-password"></label></div>
    <div class="err" id="lg-err"></div>
    <button class="btn-primary" id="lg-go">Log in</button>
  </div>
  <div id="main" style="display:none;">
    <div class="who"><span id="who-name"></span><button class="btn-ghost" id="logout">Log out</button></div>
    <nav class="tabs"><button id="t-leads" class="active">Leads</button><button id="t-scripts">Scripts</button></nav>
    <div id="p-leads"></div>
    <div id="p-scripts" style="display:none;"></div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>${CRM_TEAM_UI_JS}</script>
<script>
(function () {
  var KEY = "crm-team-login";
  function $(id) { return document.getElementById(id); }
  function saved() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function startUp(slug, name, pw) {
    CT.cfg.api = "/api";
    CT.cfg.myName = name; CT.cfg.ref = slug;
    CT.cfg.headers = function () { return { "x-team-name": slug, "x-team-password": pw }; };
    $("login").style.display = "none"; $("main").style.display = "block";
    $("who-name").textContent = "Logged in as " + name;
    var st = document.createElement("style"); st.textContent = CT.css; document.head.appendChild(st);
    CT.leads($("p-leads")); CT.scripts($("p-scripts"));
  }
  function show(tab) {
    $("p-leads").style.display = tab === "leads" ? "block" : "none";
    $("p-scripts").style.display = tab === "scripts" ? "block" : "none";
    $("t-leads").className = tab === "leads" ? "active" : ""; $("t-scripts").className = tab === "scripts" ? "active" : "";
  }
  $("t-leads").onclick = function () { show("leads"); };
  $("t-scripts").onclick = function () { show("scripts"); };
  $("logout").onclick = function () { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };
  var who = (new URLSearchParams(location.search).get("who") || "").toLowerCase();
  if (who) { var o = $("lg-name").querySelector('option[value="' + who + '"]'); if (o) $("lg-name").value = who; }
  function login() {
    var slug = $("lg-name").value, pw = $("lg-pw").value;
    fetch("/api/crm-team/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: slug, password: pw }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        if (!x.ok) { $("lg-err").textContent = x.d.error || "That did not work."; return; }
        try { localStorage.setItem(KEY, JSON.stringify({ slug: slug, name: x.d.name, pw: pw })); } catch (e) {}
        startUp(slug, x.d.name, pw);
      }, function () { $("lg-err").textContent = "Could not reach the server. Please try again."; });
  }
  $("lg-go").onclick = login;
  $("lg-pw").onkeydown = function (e) { if (e.key === "Enter") login(); };
  var s = saved();
  if (s && s.slug && (!who || who === s.slug)) startUp(s.slug, s.name, s.pw);
})();
</script>
</body>
</html>`;

export default router;
