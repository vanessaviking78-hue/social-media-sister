import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { saveSampleFile, appLink } from "../lib/freeSampleWorker";
import { notifyOwner } from "../lib/notify";
import { openai } from "@workspace/integrations-openai-ai-server";
import { HOUSE_VOICE } from "../lib/houseRules";

// YEAR PASS. A private portal for clinics who buy the 12 month bundle. After paying they get one private link that never changes.
// Each month opens in turn. They upload a photo and say which treatments to promote, it lands with Vanessa, she builds the 20 posts
// in the Month tool, checks them, and publishes them to the portal. A library tab holds everything from the Stan Store.

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 2 } });
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const MIN_PENCE = Number(process.env.YEARPASS_MIN_PENCE || 50000);

const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const noDashes = (t: unknown) => String(t ?? "").replace(/[–—]/g, ", ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/!/g, ".").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
const hex = (v: unknown, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(String(v ?? "").trim()) ? String(v).trim() : fallback);

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided === expected) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7).trim().toLowerCase() === expected) return next();
  res.status(401).json({ error: "Unauthorized" });
}

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = db
    .execute(sql`CREATE TABLE IF NOT EXISTS yp_members (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      paid_ref TEXT UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      clinic_name TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
    .then(() => db.execute(sql`CREATE TABLE IF NOT EXISTS yp_months (
      id SERIAL PRIMARY KEY,
      member_id TEXT NOT NULL,
      month_no INT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      clinic_name TEXT NOT NULL DEFAULT '',
      handle TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      main_hex TEXT NOT NULL DEFAULT '#d6006f',
      treatments JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT NOT NULL DEFAULT '',
      photo_url TEXT NOT NULL DEFAULT '',
      logo_url TEXT NOT NULL DEFAULT '',
      result JSONB,
      submitted_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      UNIQUE (member_id, month_no)
    )`))
    .then(() => db.execute(sql`CREATE TABLE IF NOT EXISTS yp_library (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'link',
      sort INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`))
    .then(() => undefined);
  ready = p;
  p.catch(() => {
    ready = null;
  });
  return p;
}

type Checked = { ok: true; email: string } | { ok: false; code: number; error: string };
async function checkPaid(sessionId: string): Promise<Checked> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, code: 503, error: "Payment checking is not switched on yet. Please email me and I will sort you out." };
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) return { ok: false, code: 400, error: "That payment reference does not look right." };
  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { ok: false, code: 400, error: "I could not find that payment. If you have just paid, wait a minute and try again." };
    const s = (await r.json()) as { payment_status?: string; amount_total?: number; currency?: string; payment_link?: string | null; customer_details?: { email?: string } };
    if (s.payment_status !== "paid") return { ok: false, code: 402, error: "That payment has not gone through yet." };
    if ((s.currency || "gbp") !== "gbp" || (s.amount_total ?? 0) < MIN_PENCE) return { ok: false, code: 400, error: "That payment is not for the Year Pass." };
    const link = process.env.YEARPASS_PAYMENT_LINK_ID;
    if (link && !link.split(",").map((x) => x.trim()).includes(String(s.payment_link))) return { ok: false, code: 400, error: "That payment is not for the Year Pass." };
    return { ok: true, email: s.customer_details?.email || "" };
  } catch {
    return { ok: false, code: 502, error: "I could not reach the payment system just now. Please try again in a minute." };
  }
}

// Month 1 is open straight away. Month 2 opens one calendar month after they joined, and so on.
function opensAt(created: Date, monthNo: number): Date {
  const d = new Date(created);
  d.setMonth(d.getMonth() + (monthNo - 1));
  return d;
}

type MemberRow = { id: string; token: string; email: string; clinic_name: string; created_at: Date };
type MonthRow = { id: number; member_id: string; month_no: number; status: string; clinic_name: string; handle: string; area: string; main_hex: string; treatments: string[]; notes: string; photo_url: string; logo_url: string; result: unknown; submitted_at: Date | null; published_at: Date | null };

async function createMember(email: string, clinicName: string, paidRef: string | null): Promise<MemberRow> {
  const id = randomBytes(6).toString("hex");
  const token = randomBytes(18).toString("hex");
  const r = await db.execute(sql`INSERT INTO yp_members (id, token, paid_ref, email, clinic_name) VALUES (${id}, ${token}, ${paidRef}, ${email}, ${clinicName}) RETURNING *`);
  return r.rows[0] as unknown as MemberRow;
}

// ---------------------------------------------------------------------------
// Public: claim the portal after paying. The same payment always gives the same link.
// ---------------------------------------------------------------------------
router.post("/yearpass/claim", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const sid = str((req.body as { sessionId?: string }).sessionId, 140);
    const found = await db.execute(sql`SELECT token FROM yp_members WHERE paid_ref = ${sid}`);
    if (found.rows.length) {
      res.json({ token: (found.rows[0] as { token: string }).token });
      return;
    }
    const c = await checkPaid(sid);
    if (!c.ok) {
      res.status(c.code).json({ error: c.error });
      return;
    }
    const m = await createMember(c.email, "", sid);
    void notifyOwner("New Year Pass buyer", `${c.email || "A clinic"} has bought the Year Pass.\nTheir portal link: ${appLink(`/yearpass/${m.token}`)}\nManage it here: ${appLink("/yearpass-admin")}`);
    res.json({ token: m.token });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not set up your portal" });
  }
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
router.get("/yearpass/admin/members", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    const m = await db.execute(sql`SELECT * FROM yp_members ORDER BY created_at DESC`);
    const months = await db.execute(sql`SELECT id, member_id, month_no, status, clinic_name, submitted_at FROM yp_months ORDER BY month_no`);
    res.json({ members: m.rows, months: months.rows });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load" });
  }
});

router.post("/yearpass/admin/members", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const b = req.body as { email?: string; clinicName?: string };
    const m = await createMember(str(b.email, 160), str(b.clinicName, 120), null);
    res.json({ id: m.id, token: m.token, link: appLink(`/yearpass/${m.token}`) });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not create" });
  }
});

router.get("/yearpass/admin/months/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const r = await db.execute(sql`SELECT mo.*, m.email, m.token FROM yp_months mo JOIN yp_members m ON m.id = mo.member_id WHERE mo.id = ${Number(req.params.id)}`);
    if (!r.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(r.rows[0]);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load" });
  }
});

type PubPost = { n?: number; day?: string; label?: string; images?: string[]; caption?: string; tags?: string };
type PubStory = { n?: number; image?: string; question?: string };
type PubReel = { hook?: string; script?: string; onScreen?: string };

// Ten reel scripts to film, written from the treatments the clinic chose for the month.
async function writeReels(row: MonthRow): Promise<PubReel[]> {
  try {
    const system = `${HOUSE_VOICE}

YOU ARE WRITING REEL SCRIPTS FOR A CLINICIAN TO FILM ON HER PHONE. Return exactly 10. Each has a hook she says to camera in the first three seconds (6 to 16 words), a short script she can read or paraphrase (40 to 70 words, plain speech, warm and funny, no medical claims, never mention Botox, anti wrinkle or prescription treatments, never mention a website), and the words to put on screen (under 10 words).
Be original. Avoid lines every clinic reel uses. No "POV:" more than once, no "stop scrolling", no "you won't believe". Make a woman over 35 smile and want to reply.
Return JSON only: {"reels":[{"hook":"","script":"","onScreen":""}]}`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Clinic: ${row.clinic_name}${row.area ? `, ${row.area}` : ""}\nTreatments to promote this month: ${(row.treatments || []).join(", ")}\n${row.notes ? `Their notes: ${row.notes}` : ""}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.95,
      max_tokens: 3500,
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as { reels?: PubReel[] };
    return (parsed.reels ?? []).slice(0, 10);
  } catch {
    return [];
  }
}

router.post("/yearpass/admin/months/:id/publish", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const b = req.body as { posts?: PubPost[]; stories?: PubStory[]; reels?: PubReel[] };
    if (!Array.isArray(b.posts) || b.posts.length === 0) { res.status(400).json({ error: "There are no posts to publish" }); return; }
    const cur = (await db.execute(sql`SELECT * FROM yp_months WHERE id = ${Number(req.params.id)}`)).rows[0] as unknown as MonthRow | undefined;
    if (!cur) { res.status(404).json({ error: "Not found" }); return; }
    if (!Array.isArray(b.reels) || b.reels.length === 0) b.reels = await writeReels(cur);
    const result = {
      posts: b.posts.slice(0, 30).map((p, i) => ({
        n: Number(p.n) || i + 1,
        day: str(p.day, 40),
        label: str(p.label, 80),
        images: (p.images ?? []).map((u) => str(u, 400)).filter(Boolean).slice(0, 10),
        caption: noDashes(p.caption).slice(0, 2000),
        tags: noDashes(p.tags).slice(0, 300),
      })),
      stories: (b.stories ?? []).slice(0, 30).map((s, i) => ({ n: Number(s.n) || i + 1, image: str(s.image, 400), question: noDashes(s.question).slice(0, 160) })),
      reels: (b.reels ?? []).slice(0, 20).map((h) => ({ hook: noDashes(h.hook).slice(0, 300), script: noDashes(h.script).slice(0, 1500), onScreen: noDashes(h.onScreen).slice(0, 200) })),
      builtAt: new Date().toISOString(),
    };
    const u = await db.execute(sql`UPDATE yp_months SET status = 'published', result = ${JSON.stringify(result)}::jsonb, published_at = now() WHERE id = ${Number(req.params.id)} RETURNING id`);
    if (!u.rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not publish" });
  }
});

router.get("/yearpass/admin/library", requireAuth, async (_req: Request, res: Response) => {
  try {
    await ensureTables();
    res.json({ library: (await db.execute(sql`SELECT id, title, description, url, kind FROM yp_library ORDER BY sort`)).rows });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load" });
  }
});

router.post("/yearpass/admin/library", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const b = req.body as { title?: string; description?: string; url?: string; kind?: string };
    const title = str(b.title, 120);
    let url = str(b.url, 500);
    if (!title || !url) { res.status(400).json({ error: "A title and a link are needed" }); return; }
    if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) url = `https://${url}`;
    await db.execute(sql`INSERT INTO yp_library (title, description, url, kind, sort) VALUES (${title}, ${str(b.description, 300)}, ${url}, ${b.kind === "file" ? "file" : "link"}, (SELECT COALESCE(MAX(sort), 0) + 1 FROM yp_library))`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not add" });
  }
});

router.delete("/yearpass/admin/library/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureTables();
    await db.execute(sql`DELETE FROM yp_library WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not delete" });
  }
});

// ---------------------------------------------------------------------------
// Public: the portal itself, by private token
// ---------------------------------------------------------------------------
router.get("/yearpass/:token", async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const mem = await db.execute(sql`SELECT * FROM yp_members WHERE token = ${String(req.params.token)}`);
    const m = mem.rows[0] as unknown as MemberRow | undefined;
    if (!m) { res.status(404).json({ error: "Not found" }); return; }
    const rows = (await db.execute(sql`SELECT * FROM yp_months WHERE member_id = ${m.id}`)).rows as unknown as MonthRow[];
    const created = new Date(m.created_at);
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const n = i + 1;
      const row = rows.find((r) => r.month_no === n);
      const opens = opensAt(created, n);
      const locked = opens.getTime() > now.getTime();
      const status = row?.status === "published" ? "published" : row ? "submitted" : locked ? "locked" : "open";
      return {
        n,
        status,
        opens: opens.toISOString(),
        monthName: opens.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        result: row?.status === "published" ? row.result : null,
        answers: row ? { clinicName: row.clinic_name, handle: row.handle, area: row.area, mainHex: row.main_hex, treatments: row.treatments, notes: row.notes } : null,
      };
    });
    const last = [...rows].filter((r) => r.clinic_name).sort((a, b) => b.month_no - a.month_no)[0];
    const lib = await db.execute(sql`SELECT id, title, description, url, kind FROM yp_library ORDER BY sort`);
    res.set("Cache-Control", "private, no-store");
    res.json({ clinicName: last?.clinic_name || m.clinic_name || "", prefill: last ? { clinicName: last.clinic_name, handle: last.handle, area: last.area, mainHex: last.main_hex } : null, months, library: lib.rows });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not load your portal" });
  }
});

router.post("/yearpass/:token/month/:n", upload.fields([{ name: "logo", maxCount: 1 }, { name: "photo", maxCount: 1 }]), async (req: Request, res: Response) => {
  try {
    await ensureTables();
    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 1 || n > 12) { res.status(400).json({ error: "That month does not look right" }); return; }
    const mem = await db.execute(sql`SELECT * FROM yp_members WHERE token = ${String(req.params.token)}`);
    const m = mem.rows[0] as unknown as MemberRow | undefined;
    if (!m) { res.status(404).json({ error: "Not found" }); return; }
    if (opensAt(new Date(m.created_at), n).getTime() > Date.now()) { res.status(400).json({ error: "That month has not opened yet" }); return; }
    const exists = await db.execute(sql`SELECT id FROM yp_months WHERE member_id = ${m.id} AND month_no = ${n}`);
    if (exists.rows.length) { res.status(400).json({ error: "You have already sent this month, I am on it" }); return; }

    const files = (req.files ?? {}) as { [f: string]: Express.Multer.File[] };
    const photo = files.photo?.[0];
    const logo = files.logo?.[0];
    for (const f of [photo, logo]) if (f && !IMAGE_MIMES.includes(f.mimetype)) { res.status(400).json({ error: "Photos and logos need to be JPG, PNG or WebP" }); return; }

    const b = req.body as Record<string, string>;
    const clinicName = str(b.clinicName, 120);
    if (!clinicName) { res.status(400).json({ error: "Please add your clinic name" }); return; }
    let treatments: string[] = [];
    try { treatments = (JSON.parse(b.treatments || "[]") as unknown[]).map((t) => str(t, 60)).filter(Boolean).slice(0, 8); } catch { /* ignore */ }
    if (!treatments.length) { res.status(400).json({ error: "Please tell me which treatments to promote this month" }); return; }

    // Month 2 onwards can reuse last month's photo and logo.
    const prev = (await db.execute(sql`SELECT photo_url, logo_url FROM yp_months WHERE member_id = ${m.id} ORDER BY month_no DESC LIMIT 1`)).rows[0] as { photo_url?: string; logo_url?: string } | undefined;
    const photoUrl = photo ? `/api/media/${await saveSampleFile(photo.buffer, photo.mimetype, "photo")}` : prev?.photo_url || "";
    const logoUrl = logo ? `/api/media/${await saveSampleFile(logo.buffer, logo.mimetype, "logo")}` : prev?.logo_url || "";
    if (!photoUrl) { res.status(400).json({ error: "Please add a photo of you" }); return; }

    await db.execute(sql`INSERT INTO yp_months (member_id, month_no, status, clinic_name, handle, area, main_hex, treatments, notes, photo_url, logo_url, submitted_at)
      VALUES (${m.id}, ${n}, 'submitted', ${clinicName}, ${str(b.handle, 80).replace(/^@/, "").replace(/\s+/g, "")}, ${str(b.area, 120)}, ${hex(b.mainHex, "#d6006f")}, ${JSON.stringify(treatments)}::jsonb, ${str(b.notes, 800)}, ${photoUrl}, ${logoUrl}, now())`);
    await db.execute(sql`UPDATE yp_members SET clinic_name = ${clinicName} WHERE id = ${m.id}`);
    void notifyOwner(`Year Pass month ${n}: ${clinicName}`, `${clinicName} has sent their answers for month ${n}.\nTreatments: ${treatments.join(", ")}\nBuild and check their 20 posts, then publish: ${appLink("/yearpass-admin")}`);
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Could not send your answers" });
  }
});

export default router;
