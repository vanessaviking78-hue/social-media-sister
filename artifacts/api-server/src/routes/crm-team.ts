import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { CRM_HTML } from "../data/crm-html";
import { CRM_TEAM_UI_JS } from "../data/crm-team-client";

// SALES TEAM CRM. The All leads, Scripts and Sales Team tabs on /crmpage, plus the team portal at /api/crm-team where the sales partners
// log in with their name and password. Each person is handed 50 new leads a day from the lists for their own businesses, ticks off what
// they have done, gets one follow up reminder per lead, and has a Call booked tab. Everything is saved here so the whole team stays in step.

const router: IRouter = Router();

type ListId = "sms" | "hammered" | "freehold";
const LISTS: ListId[] = ["sms", "hammered", "freehold"];

// slug is the same name used on the sign up links (www.thecybersuite.com/signup?ref=slug), so each person's leads are tracked.
export const TEAM: Array<{ slug: string; name: string; lists: ListId[] }> = [
  { slug: "deanos", name: "Dean", lists: ["hammered", "freehold"] },
  { slug: "isabella", name: "Isabella Gregory", lists: ["sms", "hammered"] },
  { slug: "leah", name: "Leah Wood", lists: ["sms", "hammered"] },
  { slug: "kelly", name: "Kelly Harvey", lists: ["sms", "hammered"] },
  { slug: "rachel", name: "Rachel Dermaluxe", lists: ["sms", "hammered"] },
  { slug: "rob", name: "Rob Wormald", lists: ["sms", "hammered", "freehold"] },
  { slug: "vanessa", name: "Vanessa Wormald", lists: ["sms", "hammered", "freehold"] },
  { slug: "scott", name: "Scott", lists: ["freehold"] },
];
// Rob and Vanessa share their own password. Everyone else uses their name followed by botox.
const OWN_PASSWORDS: Record<string, string> = { rob: "bonzo", vanessa: "bonzo" };
const STATUSES = ["New", "Messaged", "Followed up", "Replied", "Call booked", "Signed", "Not relevant"];
const PER_PAGE = 50;
const PER_DAY = 50;
const SITE = "https://www.thecybersuite.com";

// Each person's password is their name in lower case followed by botox (for example isabellabotox). The ending can be changed
// with the CRM_TEAM_SUFFIX variable on Railway.
const suffix = () => (process.env.CRM_TEAM_SUFFIX || "botox").trim().toLowerCase();
const passwordFor = (slug: string) => OWN_PASSWORDS[slug] ?? slug + suffix();
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
function addWorkingDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}

type Who = { name: string; slug: string; admin: boolean; lists: ListId[] };

function whoIs(req: Request): Who | null {
  const appPassword = (process.env.APP_PASSWORD || "").trim().toLowerCase();
  const sentApp = String(req.header("x-app-password") ?? "").trim().toLowerCase();
  if (appPassword && sentApp && sentApp === appPassword) return { name: "Vanessa", slug: "", admin: true, lists: LISTS };
  const slug = String(req.header("x-team-name") ?? "").trim().toLowerCase();
  const pw = String(req.header("x-team-password") ?? "").trim().toLowerCase();
  const member = TEAM.find((m) => m.slug === slug);
  if (member && pw && pw === passwordFor(member.slug)) return { name: member.name, slug: member.slug, admin: false, lists: member.lists };
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
  (req as Request & { who?: Who }).who = who;
  next();
}

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
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
    await db.execute(sql`ALTER TABLE crm_team_leads ADD COLUMN IF NOT EXISTS list TEXT NOT NULL DEFAULT 'sms'`);
    await db.execute(sql`ALTER TABLE crm_team_leads ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT ''`);
    await db.execute(sql`ALTER TABLE crm_team_leads ADD COLUMN IF NOT EXISTS assigned_on DATE`);
    await db.execute(sql`ALTER TABLE crm_team_leads ADD COLUMN IF NOT EXISTS assigned_pos INTEGER NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE crm_team_leads ADD COLUMN IF NOT EXISTS messaged_on DATE`);
    await db.execute(sql`ALTER TABLE crm_team_leads ADD COLUMN IF NOT EXISTS followup_due DATE`);
    await db.execute(sql`ALTER TABLE crm_team_leads ADD COLUMN IF NOT EXISTS followed_up BOOLEAN NOT NULL DEFAULT FALSE`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crm_team_extra (
        list TEXT NOT NULL,
        source TEXT NOT NULL,
        handle TEXT NOT NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (source, handle)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crm_team_clicks (
        id BIGSERIAL PRIMARY KEY,
        slug TEXT NOT NULL,
        target TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crm_team_topup (
        slug TEXT NOT NULL,
        day DATE NOT NULL,
        PRIMARY KEY (slug, day)
      )
    `);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

// The Social Media Sister lists are the follower lists inside the CRM page's own data block. Hammered and Freehold leads are added with Add leads.
type Lead = { list: ListId; source: "instagram" | "tiktok"; handle: string };
let staticLeads: Lead[] | null = null;
function smsLeads(): Lead[] {
  if (staticLeads) return staticLeads;
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
      out.push({ list: "sms", source, handle });
    }
  };
  add("instagram", data.followers);
  add("tiktok", data.ttFollowers);
  staticLeads = out;
  return out;
}
let extraCache: Lead[] | null = null;
async function extraLeads(): Promise<Lead[]> {
  if (extraCache) return extraCache;
  const r = await db.execute(sql`SELECT list, source, handle FROM crm_team_extra ORDER BY added_at, handle`);
  extraCache = (r.rows as Array<{ list: ListId; source: "instagram" | "tiktok"; handle: string }>).map((x) => ({ list: x.list, source: x.source, handle: x.handle }));
  return extraCache;
}
async function allLeads(): Promise<Lead[]> {
  await ensureTables();
  const base = smsLeads();
  const seen = new Set(base.map((l) => l.source + "|" + l.handle));
  const out = base.slice();
  for (const l of await extraLeads()) {
    if (!seen.has(l.source + "|" + l.handle)) out.push(l);
  }
  return out;
}

type Row = {
  source: string; handle: string; status: string; owner: string; note: string; updated_at: Date; list: string;
  assigned_to: string; assigned_on: string | null; messaged_on: string | null; followup_due: string | null; followed_up: boolean;
};
const dateOnly = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);

// The Xmas photoshoot and free sample links go through /api/go so every open is counted against the person who sent it.
const linksFor = (slug: string) => ({
  m12: `${SITE}/api/go/12m/${slug}`,
  m6: `${SITE}/api/go/6m/${slug}`,
  m3: `${SITE}/api/go/3m/${slug}`,
  club: `${SITE}/api/go/club/${slug}`,
  xmas: `${SITE}/api/go/xmas/${slug}`,
  sample: `${SITE}/api/go/sample/${slug}`,
  sms: `${SITE}/signup?ref=${slug}`,
  hammered: `${SITE}/hammeredfreebies?ref=${slug}`,
  freehold: `${SITE}/freeholdfreebies?ref=${slug}`,
});

// Every offer link goes through here so each open is counted against the person who sent it. The package links open the Black Friday page
// with the person and offer in its ?src= tag, so they also show up on the /linkstats page.
function goTarget(target: string, slug: string, name: string): string | null {
  switch (target) {
    case "xmas": return `${SITE}/xmasshoot?ref=${slug}`;
    case "sample": return `${SITE}/premiumfreebies?ref=${slug}`;
    case "12m": return `${SITE}/blackfriday26?src=${slug}-12m`;
    case "6m": return `${SITE}/blackfriday26?src=${slug}-6m`;
    case "club": return `${SITE}/blackfriday26?src=${slug}-club`;
    case "3m": return `${SITE}/blackfriday26?src=${slug}-3m`;
    default: return null;
  }
}
router.get("/go/:target/:slug", async (req: Request, res: Response) => {
  const target = String(req.params.target);
  const slug = String(req.params.slug ?? "").toLowerCase();
  const member = TEAM.find((m) => m.slug === slug);
  const dest = goTarget(target, member ? slug : "direct", member ? member.name : "the team");
  if (!dest) { res.status(404).send("Not found"); return; }
  if (member) {
    try { await ensureTables(); await db.execute(sql`INSERT INTO crm_team_clicks (slug, target) VALUES (${slug}, ${target})`); } catch { /* a missed count must never stop the link working */ }
  }
  res.redirect(302, dest);
});

router.post("/crm-team/login", (req: Request, res: Response) => {
  const slug = str(req.body?.slug, 40).toLowerCase();
  const pw = str(req.body?.password, 80).toLowerCase();
  const member = TEAM.find((m) => m.slug === slug);
  if (member && pw && pw === passwordFor(member.slug)) { res.json({ ok: true, name: member.name, slug: member.slug, lists: member.lists }); return; }
  res.status(401).json({ ok: false, error: "That name and password do not match." });
});

// Hands out today's 50 leads. Once a day, on the person's first visit, their pile is topped back up to 50 new people.
async function topUp(m: { slug: string; name: string; lists: ListId[] }): Promise<void> {
  const today = todayStr();
  const claim = await db.execute(sql`INSERT INTO crm_team_topup (slug, day) VALUES (${m.slug}, ${today}::date) ON CONFLICT DO NOTHING RETURNING slug`);
  if (claim.rows.length === 0) return;
  const have = await db.execute(sql`SELECT COUNT(*)::int AS n FROM crm_team_leads WHERE assigned_to = ${m.slug} AND status = 'New'`);
  const need = Math.max(0, PER_DAY - Number((have.rows[0] as { n: number }).n));
  if (need === 0) return;
  const taken = new Set<string>();
  const saved = await db.execute(sql`SELECT source, handle FROM crm_team_leads`);
  for (const r of saved.rows as Array<{ source: string; handle: string }>) taken.add(r.source + "|" + r.handle);
  const pool = (await allLeads()).filter((l) => m.lists.includes(l.list) && !taken.has(l.source + "|" + l.handle));
  const buckets = m.lists.map((id) => pool.filter((l) => l.list === id));
  const idx = buckets.map(() => 0);
  const picked: Lead[] = [];
  while (picked.length < need) {
    let moved = false;
    for (let b = 0; b < buckets.length && picked.length < need; b++) {
      if (idx[b] < buckets[b].length) { picked.push(buckets[b][idx[b]++]); moved = true; }
    }
    if (!moved) break;
  }
  if (picked.length === 0) return;
  const values = picked.map((l, i) => sql`(${l.source}, ${l.handle}, 'New', '', '', now(), ${l.list}, ${m.slug}, ${today}::date, ${i})`);
  await db.execute(sql`
    INSERT INTO crm_team_leads (source, handle, status, owner, note, updated_at, list, assigned_to, assigned_on, assigned_pos)
    VALUES ${sql.join(values, sql`, `)}
    ON CONFLICT (source, handle) DO NOTHING
  `);
}

router.get("/crm-team/day", requireAny, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const who = (req as Request & { who?: Who }).who as Who;
    const slug = who.admin ? str(req.query.as, 40).toLowerCase() : who.slug;
    const member = TEAM.find((m) => m.slug === slug);
    if (!member) { res.status(400).json({ error: "Choose a team member" }); return; }
    await topUp(member);
    const today = todayStr();
    const r = await db.execute(sql`
      SELECT source, handle, status, note, list, assigned_on, messaged_on, followup_due, followed_up
      FROM crm_team_leads
      WHERE assigned_to = ${member.slug} AND status IN ('New', 'Messaged', 'Replied', 'Call booked', 'Signed')
      ORDER BY assigned_on, assigned_pos, handle`);
    const rows = (r.rows as Row[]).map((x) => ({
      source: x.source, handle: x.handle, status: x.status, note: x.note, list: x.list,
      followupDue: dateOnly(x.followup_due), followedUp: x.followed_up,
    }));
    const m = await db.execute(sql`SELECT COUNT(*)::int AS n FROM crm_team_leads WHERE assigned_to = ${member.slug} AND messaged_on = ${today}::date`);
    const all = await allLeads();
    const emptyLists = member.lists.filter((l) => !all.some((x) => x.list === l));
    let linkBookings: unknown[] = [];
    try {
      const lb = await db.execute(sql`
        SELECT l.lead, l.clinic, l.contact, l.stage, l.created_at AS created
        FROM sales_leads l JOIN sales_partners p ON p.slot = l.partner_slot
        WHERE l.via_link = TRUE AND lower(split_part(p.name, ' ', 1)) = ${member.slug}
        ORDER BY l.created_at DESC`);
      linkBookings = lb.rows;
    } catch { /* the sales dashboard tables are created on first use */ }
    res.json({
      today, quota: PER_DAY, messagedToday: Number((m.rows[0] as { n: number }).n), rows, linkBookings, emptyLists,
      me: { name: member.name, slug: member.slug, lists: member.lists, links: linksFor(member.slug) },
    });
  } catch (err) {
    req.log?.error({ err }, "crm team day failed");
    res.status(500).json({ error: "Could not load your day" });
  }
});

// Vanessa's browse of every lead.
router.get("/crm-team/leads", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const source = str(req.query.source, 12);
    const list = str(req.query.list, 12);
    const status = str(req.query.status, 20);
    const q = str(req.query.q, 60).toLowerCase().replace(/^@/, "");
    const page = Math.max(0, parseInt(String(req.query.page ?? "0"), 10) || 0);

    const saved = await db.execute(sql`SELECT source, handle, status, owner, note, list, assigned_to FROM crm_team_leads`);
    const byKey = new Map<string, Row>();
    for (const r of saved.rows as Row[]) byKey.set(r.source + "|" + r.handle, r);

    const counts: Record<string, number> = {};
    for (const s of STATUSES) counts[s] = 0;
    const rows: Array<{ source: string; handle: string; list: string; status: string; owner: string; note: string; assignedTo: string }> = [];
    for (const l of await allLeads()) {
      if (source === "instagram" || source === "tiktok") { if (l.source !== source) continue; }
      if (LISTS.includes(list as ListId) && l.list !== list) continue;
      if (q && !l.handle.includes(q)) continue;
      const r = byKey.get(l.source + "|" + l.handle);
      const st = r?.status ?? "New";
      counts[st] = (counts[st] ?? 0) + 1;
      if (STATUSES.includes(status) && st !== status) continue;
      const member = TEAM.find((t) => t.slug === r?.assigned_to);
      rows.push({ source: l.source, handle: l.handle, list: l.list, status: st, owner: r?.owner ?? "", note: r?.note ?? "", assignedTo: member?.name ?? "" });
    }
    res.json({ total: rows.length, page, perPage: PER_PAGE, counts, rows: rows.slice(page * PER_PAGE, (page + 1) * PER_PAGE) });
  } catch (err) {
    req.log?.error({ err }, "crm team leads failed");
    res.status(500).json({ error: "Could not load the leads" });
  }
});

router.put("/crm-team/leads/:source/:handle", requireAny, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const who = (req as Request & { who?: Who }).who as Who;
    const source = str(req.params.source, 12);
    const handle = str(req.params.handle, 80).toLowerCase().replace(/^@/, "");
    if ((source !== "instagram" && source !== "tiktok") || !handle) { res.status(400).json({ error: "Unknown lead" }); return; }
    const hasStatus = typeof req.body?.status === "string";
    const hasNote = typeof req.body?.note === "string";
    const status = hasStatus ? str(req.body.status, 20) : "";
    if (hasStatus && !STATUSES.includes(status)) { res.status(400).json({ error: "Unknown status" }); return; }
    const note = hasNote ? str(req.body.note, 500) : "";
    const today = todayStr();
    const mine = who.admin ? "" : who.slug;
    const lead = (await allLeads()).find((l) => l.source === source && l.handle === handle);
    const list = lead?.list ?? "sms";
    await db.execute(sql`
      INSERT INTO crm_team_leads (source, handle, status, owner, note, updated_at, list, assigned_to, assigned_on)
      VALUES (${source}, ${handle}, ${hasStatus ? status : "New"}, ${who.name}, ${note}, now(), ${list}, ${mine}, ${mine ? today : null}::date)
      ON CONFLICT (source, handle) DO UPDATE SET
        status = ${hasStatus ? sql`EXCLUDED.status` : sql`crm_team_leads.status`},
        note = ${hasNote ? sql`EXCLUDED.note` : sql`crm_team_leads.note`},
        owner = EXCLUDED.owner,
        assigned_to = CASE WHEN crm_team_leads.assigned_to = '' THEN EXCLUDED.assigned_to ELSE crm_team_leads.assigned_to END,
        updated_at = now()
    `);
    if (hasStatus) {
      if (status === "Messaged") {
        // One reminder only: 3 working days later, and never again once they have been followed up.
        await db.execute(sql`
          UPDATE crm_team_leads SET messaged_on = ${today}::date,
            followup_due = CASE WHEN followed_up THEN NULL ELSE ${addWorkingDays(today, 3)}::date END
          WHERE source = ${source} AND handle = ${handle}`);
      } else if (status === "Followed up") {
        await db.execute(sql`UPDATE crm_team_leads SET followed_up = TRUE, followup_due = NULL WHERE source = ${source} AND handle = ${handle}`);
      } else {
        await db.execute(sql`UPDATE crm_team_leads SET followup_due = NULL WHERE source = ${source} AND handle = ${handle}`);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "crm team save failed");
    res.status(500).json({ error: "Could not save" });
  }
});

// Add Hammered, Freehold or Social Media Sister leads from pasted usernames.
router.post("/crm-team/import", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const list = str(req.body?.list, 12) as ListId;
    const source = str(req.body?.source, 12);
    if (!LISTS.includes(list) || (source !== "instagram" && source !== "tiktok")) { res.status(400).json({ error: "Choose a business and where the leads are from" }); return; }
    const handles: string[] = [];
    const seenIn = new Set<string>();
    for (const part of String(req.body?.text ?? "").split(/[\s,;]+/)) {
      const h = part.trim().toLowerCase().replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\//, "").replace(/^@/, "").replace(/[/?#].*$/, "");
      if (/^[a-z0-9._]{1,40}$/.test(h) && !seenIn.has(h)) { seenIn.add(h); handles.push(h); }
    }
    if (handles.length === 0) { res.status(400).json({ error: "No usernames found" }); return; }
    const known = new Set((await allLeads()).map((l) => l.source + "|" + l.handle));
    const fresh = handles.filter((h) => !known.has(source + "|" + h));
    for (let i = 0; i < fresh.length; i += 500) {
      const chunk = fresh.slice(i, i + 500);
      const values = chunk.map((h) => sql`(${list}, ${source}, ${h})`);
      await db.execute(sql`INSERT INTO crm_team_extra (list, source, handle) VALUES ${sql.join(values, sql`, `)} ON CONFLICT DO NOTHING`);
    }
    extraCache = null;
    res.json({ ok: true, added: fresh.length, skipped: handles.length - fresh.length });
  } catch (err) {
    req.log?.error({ err }, "crm team import failed");
    res.status(500).json({ error: "Could not add the leads" });
  }
});

router.get("/crm-team/summary", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const rows = await db.execute(sql`
      SELECT assigned_to, status, followed_up, COUNT(*)::int AS n FROM crm_team_leads WHERE assigned_to <> '' GROUP BY assigned_to, status, followed_up`);
    const data = rows.rows as Array<{ assigned_to: string; status: string; followed_up: boolean; n: number }>;
    const tally = (slug: string, pick: (r: { status: string; followed_up: boolean }) => boolean) =>
      data.filter((r) => r.assigned_to === slug && pick(r)).reduce((a, r) => a + r.n, 0);
    const taken = await db.execute(sql`SELECT list, COUNT(*)::int AS n FROM crm_team_leads GROUP BY list`);
    const takenBy = new Map((taken.rows as Array<{ list: string; n: number }>).map((r) => [r.list, r.n]));
    const clickRows = await db.execute(sql`SELECT slug, target, COUNT(*)::int AS n FROM crm_team_clicks GROUP BY slug, target`);
    const clicks = clickRows.rows as Array<{ slug: string; target: string; n: number }>;
    const clickOf = (slug: string, target: string) => clicks.find((c) => c.slug === slug && c.target === target)?.n ?? 0;
    const all = await allLeads();
    const origin = `${req.header("x-forwarded-proto") || req.protocol}://${req.header("x-forwarded-host") || req.get("host")}`;
    res.json({
      origin,
      stock: LISTS.map((l) => {
        const total = all.filter((x) => x.list === l).length;
        return { list: l, total, left: Math.max(0, total - (takenBy.get(l) ?? 0)) };
      }),
      team: TEAM.map((m) => ({
        slug: m.slug, name: m.name, lists: m.lists, password: passwordFor(m.slug), xmasOpens: clickOf(m.slug, "xmas"), sampleOpens: clickOf(m.slug, "sample"), packageOpens: ["12m", "6m", "3m", "club"].reduce((a, t) => a + clickOf(m.slug, t), 0),
        messaged: tally(m.slug, (r) => r.status !== "New" && r.status !== "Not relevant"),
        followed: tally(m.slug, (r) => r.followed_up),
        replied: tally(m.slug, (r) => ["Replied", "Call booked", "Signed"].includes(r.status)),
        booked: tally(m.slug, (r) => ["Call booked", "Signed"].includes(r.status)),
        signed: tally(m.slug, (r) => r.status === "Signed"),
      })),
    });
  } catch {
    res.status(500).json({ error: "Could not load the team" });
  }
});

// The team portal. Same look as the CRM, but only the daily routine. Nothing else from the CRM is in it.
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
.app { max-width: 1000px; margin: 0 auto; padding: 24px 20px 60px; }
h1 { font-size: 44px; line-height: 1; margin: 0; font-weight: 900; }
.subtitle { color: var(--grey); font-size: 15px; margin: 6px 0 18px; font-weight: 500; }
.divider { height: 6px; background: var(--pink); border-radius: 3px; margin-bottom: 20px; }
nav.tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; border-bottom: 2px solid var(--ink); padding-bottom: 12px; }
nav.tabs button { background: #fff; color: var(--ink); border: 2px solid var(--ink); padding: 9px 16px; border-radius: 10px; font-family: inherit; font-size: 14px; font-weight: 800; cursor: pointer; }
nav.tabs button.active { background: var(--ink); color: var(--pink); }
.card { background: #fff; border: 2px solid var(--ink); border-radius: 14px; padding: 20px 22px; margin-bottom: 20px; }
.card h2 { font-size: 22px; margin: 0 0 4px; font-weight: 900; }
.card .hint { font-size: 14px; color: var(--grey); margin: 0 0 14px; font-weight: 500; line-height: 1.5; }
.form-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: end; margin-bottom: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; min-width: 140px; flex: 1; }
input, select, textarea { font-family: inherit; padding: 10px 12px; border-radius: 10px; border: 2px solid var(--ink); background: #fff; color: var(--ink); font-size: 14px; font-weight: 500; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--pink); }
button { font-family: inherit; border: none; border-radius: 10px; padding: 10px 18px; font-weight: 800; font-size: 14px; cursor: pointer; }
.btn-primary { background: var(--pink); color: #000; }
.btn-ghost { background: var(--ink); color: var(--pink); }
.btn-ghost:disabled { opacity: .35; cursor: default; }
.btn-copy { background: var(--pink); color: #000; }
a.profile-link { color: var(--pink); text-decoration: underline; font-weight: 800; font-size: 15px; }
.empty-note { color: var(--grey); font-size: 14px; font-style: italic; padding: 6px 0; }
.dm-card { border: 2px solid var(--ink); border-radius: 12px; padding: 16px; margin-bottom: 12px; background: #fff; }
.dm-title { font-weight: 900; font-size: 16px; color: var(--pink); margin-bottom: 4px; }
.dm-body { font-size: 14px; line-height: 1.55; margin-bottom: 10px; white-space: pre-wrap; }
.toast { position: fixed; top: 18px; right: 18px; background: var(--ink); border: 2px solid var(--pink); color: var(--pink); padding: 12px 20px; border-radius: 10px; font-weight: 800; font-size: 14px; opacity: 0; transition: opacity .3s; pointer-events: none; z-index: 999; }
.toast.show { opacity: 1; }
.login { max-width: 420px; margin: 40px auto; }
.err { color: #b00020; font-weight: 700; font-size: 14px; min-height: 20px; }
.who { font-size: 14px; font-weight: 700; display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 12px; }
.who .right { display: flex; gap: 8px; align-items: center; }
.who button, .who a { padding: 8px 14px; font-size: 13px; }
.inbox-btn { display: inline-block; background: var(--pink); color: #000; border-radius: 10px; font-weight: 800; text-decoration: none; }
</style>
</head>
<body>
<div class="app">
  <h1>Sales Team CRM</h1>
  <p class="subtitle">Your leads, your follow ups and your calls, all in one place</p>
  <div class="divider"></div>
  <div id="login" class="card login">
    <h2>Log in</h2>
    <p class="hint">Choose your name and enter your password.</p>
    <div class="form-row"><label class="field">Your name<select id="lg-name">${TEAM.map((m) => `<option value="${m.slug}">${m.name}</option>`).join("")}</select></label></div>
    <div class="form-row"><label class="field">Password<input type="password" id="lg-pw" autocomplete="current-password"></label></div>
    <div class="err" id="lg-err"></div>
    <button class="btn-primary" id="lg-go">Log in</button>
  </div>
  <div id="main" style="display:none;">
    <div class="who"><span id="who-name"></span><span class="right"><a class="inbox-btn" href="https://www.instagram.com/direct/inbox/" target="_blank" rel="noopener">Open my Instagram inbox</a><button class="btn-ghost" id="logout">Log out</button></span></div>
    <div id="portal"></div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>${CRM_TEAM_UI_JS}</script>
<script>
(function () {
  var KEY = "crm-team-login-v2";
  function $(id) { return document.getElementById(id); }
  function saved() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function startUp(slug, name, pw) {
    CT.cfg.api = "/api";
    CT.cfg.myName = name; CT.cfg.ref = slug;
    CT.cfg.headers = function () { return { "x-team-name": slug, "x-team-password": pw }; };
    $("login").style.display = "none"; $("main").style.display = "block";
    $("who-name").textContent = "Logged in as " + name;
    var st = document.createElement("style"); st.textContent = CT.css; document.head.appendChild(st);
    if (slug === "scott") {
      document.documentElement.style.setProperty("--pink", "#00e5ff");
      var fh = document.createElement("style");
      fh.textContent = "body{background:#000!important;color:#fff!important}.divider{background:#00e5ff!important}h1,.subtitle,.card h2,.card .hint,.who{color:#fff!important}.card,.dm-card{background:#111!important;border-color:#00e5ff!important;color:#fff!important}input,select,textarea{background:#111!important;color:#fff!important;border-color:#00e5ff!important}nav.tabs{border-color:#00e5ff!important}nav.tabs button{background:#000!important;color:#00e5ff!important;border-color:#00e5ff!important}nav.tabs button.active{background:#00e5ff!important;color:#000!important}.btn-primary,.btn-copy,.inbox-btn{background:#00e5ff!important;color:#000!important}.btn-ghost{background:#000!important;color:#00e5ff!important;border:2px solid #00e5ff}.ct-act,.ct-mode{background:#111!important;color:#fff!important;border-color:#00e5ff!important}.ct-act.go,.ct-mode.on{background:#00e5ff!important;color:#000!important}.ct-pill,.ct-tag,.ct-alert{background:#111!important;color:#00e5ff!important;border:1px solid #00e5ff}.ct-pill b{color:#fff!important}.empty-note,.ct-link{color:#9fe9f5!important}table,td,th{color:#fff!important;border-color:#00e5ff!important}";
      document.head.appendChild(fh);
    }
    CT.portal($("portal"));
  }
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
