import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { notifyInboxDigest } from "../lib/notify";
import { notifyAdmin, saveAdminSubscription, getVapidPublicKey } from "../lib/push";

// The client inbox: Instagram comments and DMs for every connected client in one place, with reply, unread badges, an email digest and a
// phone push. A background loop syncs every 5 minutes. Comments use instagram_manage_comments. DMs need instagram_manage_messages and
// pages_messaging, which are added to the connect scopes in meta-auth.ts, so each client has to be reconnected once (bulk connect).

const router: IRouter = Router();
const GRAPH = "https://graph.facebook.com/v22.0";

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

const rowsOf = (r: unknown): any[] => ((r as any)?.rows ?? r ?? []) as any[];

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS inbox_items (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL,
      client_name TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'in',
      external_id TEXT NOT NULL UNIQUE,
      thread_id TEXT NOT NULL DEFAULT '',
      permalink TEXT,
      media_caption TEXT,
      author_name TEXT NOT NULL DEFAULT '',
      author_id TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      is_read BOOLEAN NOT NULL DEFAULT false,
      replied BOOLEAN NOT NULL DEFAULT false,
      push_sent BOOLEAN NOT NULL DEFAULT false,
      email_sent BOOLEAN NOT NULL DEFAULT false,
      created_at_meta TIMESTAMPTZ NOT NULL DEFAULT now(),
      synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS inbox_items_preset_idx ON inbox_items (preset_id, created_at_meta DESC)`);
  })();
  ready = p;
  p.catch(() => { ready = null; });
  return p;
}

type SyncStatus = { at: string; comments: string; dms: string };
const syncStatus = new Map<number, SyncStatus>();
let lastEmailAt = 0;
let syncing = false;

async function graphGet(path: string, params: Record<string, string>, token: string): Promise<any> {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`, { signal: AbortSignal.timeout(25000) });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(String(data?.error?.message || `Meta said ${res.status}`));
  return data;
}

async function graphPost(path: string, body: Record<string, unknown>, token: string): Promise<any> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
    signal: AbortSignal.timeout(25000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(String(data?.error?.message || `Meta said ${res.status}`));
  return data;
}

type Preset = typeof clientPresetsTable.$inferSelect;

async function insertItem(it: {
  presetId: number; clientName: string; kind: "comment" | "dm"; direction: "in" | "out"; externalId: string; threadId: string;
  permalink?: string | null; caption?: string | null; authorName: string; authorId: string; body: string; at: string; silent: boolean;
}): Promise<boolean> {
  const silent = it.silent || it.direction === "out";
  const r = await db.execute(sql`INSERT INTO inbox_items
    (preset_id, client_name, kind, direction, external_id, thread_id, permalink, media_caption, author_name, author_id, body, is_read, push_sent, email_sent, created_at_meta)
    VALUES (${it.presetId}, ${it.clientName}, ${it.kind}, ${it.direction}, ${it.externalId}, ${it.threadId}, ${it.permalink ?? null}, ${it.caption ?? null},
      ${it.authorName}, ${it.authorId}, ${it.body}, ${silent}, ${silent}, ${silent}, ${it.at})
    ON CONFLICT (external_id) DO NOTHING RETURNING id`);
  return rowsOf(r).length > 0;
}

async function hasItems(presetId: number, kind: string): Promise<boolean> {
  const r = await db.execute(sql`SELECT 1 FROM inbox_items WHERE preset_id = ${presetId} AND kind = ${kind} LIMIT 1`);
  return rowsOf(r).length > 0;
}

async function syncComments(p: Preset): Promise<string> {
  const igId = p.metaInstagramAccountId;
  const token = p.metaPageAccessToken;
  if (!igId || !token) return "Instagram not connected";
  const first = !(await hasItems(p.id, "comment"));
  const data = await graphGet(`${igId}/media`, {
    fields: "id,permalink,caption,timestamp,comments.limit(25){id,text,username,timestamp}",
    limit: "12",
  }, token);
  const own = (p.metaInstagramUsername || "").toLowerCase();
  for (const m of data.data || []) {
    for (const c of m.comments?.data || []) {
      const mine = !!own && String(c.username || "").toLowerCase() === own;
      await insertItem({
        presetId: p.id, clientName: p.name, kind: "comment", direction: mine ? "out" : "in", externalId: String(c.id), threadId: String(m.id),
        permalink: m.permalink, caption: m.caption ? String(m.caption).slice(0, 160) : null, authorName: String(c.username || ""), authorId: "",
        body: String(c.text || ""), at: c.timestamp || new Date().toISOString(), silent: first,
      });
    }
  }
  return "";
}

async function syncDms(p: Preset): Promise<string> {
  const igId = p.metaInstagramAccountId;
  const pageId = p.metaFacebookPageId;
  const token = p.metaPageAccessToken;
  if (!igId || !pageId || !token) return "Facebook page not connected";
  const first = !(await hasItems(p.id, "dm"));
  const data = await graphGet(`${pageId}/conversations`, {
    platform: "instagram",
    fields: "id,updated_time,participants,messages.limit(10){id,message,from,created_time}",
    limit: "15",
  }, token);
  for (const conv of data.data || []) {
    for (const m of conv.messages?.data || []) {
      const fromId = String(m.from?.id || "");
      const mine = fromId === String(igId) || fromId === String(pageId);
      await insertItem({
        presetId: p.id, clientName: p.name, kind: "dm", direction: mine ? "out" : "in", externalId: String(m.id), threadId: String(conv.id),
        authorName: String(m.from?.username || m.from?.name || ""), authorId: fromId, body: String(m.message || "[attachment]"),
        at: m.created_time || new Date().toISOString(), silent: first,
      });
    }
  }
  return "";
}

export async function syncInbox(): Promise<{ newItems: number }> {
  if (syncing) return { newItems: 0 };
  syncing = true;
  try {
    await ensureTables();
    const presets = (await db.select().from(clientPresetsTable)).filter((p) => p.metaInstagramAccountId && p.metaPageAccessToken);
    for (const p of presets) {
      const status: SyncStatus = { at: new Date().toISOString(), comments: "", dms: "" };
      try { status.comments = await syncComments(p); } catch (e) { status.comments = e instanceof Error ? e.message : String(e); }
      try { status.dms = await syncDms(p); } catch (e) { status.dms = e instanceof Error ? e.message : String(e); }
      syncStatus.set(p.id, status);
    }
    return { newItems: await notifyNew() };
  } catch (err) {
    logger.error({ err }, `Inbox sync failed: ${err instanceof Error ? err.message : String(err)}`);
    return { newItems: 0 };
  } finally {
    syncing = false;
  }
}

async function notifyNew(): Promise<number> {
  const fresh = rowsOf(await db.execute(sql`SELECT id, client_name, kind, author_name, body FROM inbox_items
    WHERE direction = 'in' AND is_read = false AND (push_sent = false OR email_sent = false) ORDER BY created_at_meta`));
  if (fresh.length === 0) return 0;
  const needPush = rowsOf(await db.execute(sql`SELECT id FROM inbox_items WHERE direction = 'in' AND push_sent = false`));
  if (needPush.length > 0) {
    const clients = new Set(fresh.map((f) => f.client_name));
    const first = fresh[fresh.length - 1];
    await notifyAdmin({
      title: fresh.length === 1 ? `New ${first.kind === "dm" ? "DM" : "comment"}: ${first.client_name}` : `${fresh.length} new messages`,
      body: fresh.length === 1 ? `${first.author_name || "Someone"}: ${String(first.body).slice(0, 100)}` : `From ${clients.size} ${clients.size === 1 ? "client" : "clients"}. Tap to reply.`,
      url: "/inbox",
    }).catch((err) => logger.warn({ err }, "Inbox push failed"));
    await db.execute(sql`UPDATE inbox_items SET push_sent = true WHERE direction = 'in' AND push_sent = false`);
  }
  if (Date.now() - lastEmailAt > 30 * 60 * 1000) {
    const pending = rowsOf(await db.execute(sql`SELECT client_name, kind, author_name, body FROM inbox_items
      WHERE direction = 'in' AND is_read = false AND email_sent = false ORDER BY created_at_meta`));
    await notifyInboxDigest(pending.map((r) => ({ clientName: r.client_name, kind: r.kind, author: r.author_name, body: String(r.body) })));
    await db.execute(sql`UPDATE inbox_items SET email_sent = true WHERE direction = 'in' AND email_sent = false`);
    lastEmailAt = Date.now();
  }
  return fresh.length;
}

let timer: NodeJS.Timeout | null = null;
export function startInboxSync(): void {
  if (timer) return;
  const run = () => { syncInbox().catch(() => undefined); };
  setTimeout(run, 45_000);
  timer = setInterval(run, 5 * 60 * 1000);
}

// ---------- routes ----------

router.get("/inbox/summary", requireAuth, async (_req, res) => {
  try {
    await ensureTables();
    const r = rowsOf(await db.execute(sql`SELECT preset_id, client_name,
      COUNT(*) FILTER (WHERE direction = 'in' AND is_read = false) AS unread,
      COUNT(*) FILTER (WHERE direction = 'in' AND is_read = false AND kind = 'comment') AS unread_comments,
      COUNT(*) FILTER (WHERE direction = 'in' AND is_read = false AND kind = 'dm') AS unread_dms,
      MAX(created_at_meta) FILTER (WHERE direction = 'in') AS last_at
      FROM inbox_items GROUP BY preset_id, client_name ORDER BY unread DESC, last_at DESC NULLS LAST`));
    const presets = (await db.select().from(clientPresetsTable)).filter((p) => p.metaInstagramAccountId && p.metaPageAccessToken);
    const seen = new Set(r.map((x) => Number(x.preset_id)));
    const clients = [
      ...r.map((x) => ({ presetId: Number(x.preset_id), clientName: String(x.client_name), unread: Number(x.unread), unreadComments: Number(x.unread_comments), unreadDms: Number(x.unread_dms), lastAt: x.last_at })),
      ...presets.filter((p) => !seen.has(p.id)).map((p) => ({ presetId: p.id, clientName: p.name, unread: 0, unreadComments: 0, unreadDms: 0, lastAt: null })),
    ].map((c) => ({ ...c, sync: syncStatus.get(c.presetId) || null }));
    res.json({ unread: clients.reduce((a, c) => a + c.unread, 0), clients });
  } catch (err) {
    logger.error({ err }, `Inbox summary failed: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ error: "Could not load the inbox" });
  }
});

router.get("/inbox/items", requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const presetId = Number(req.query.presetId);
    if (!presetId) { res.status(400).json({ error: "presetId required" }); return; }
    const r = rowsOf(await db.execute(sql`SELECT id, kind, direction, thread_id, permalink, media_caption, author_name, body, is_read, replied, created_at_meta
      FROM inbox_items WHERE preset_id = ${presetId} ORDER BY created_at_meta DESC LIMIT 300`));
    res.json({
      items: r.map((x) => ({
        id: Number(x.id), kind: x.kind, direction: x.direction, threadId: x.thread_id, permalink: x.permalink, caption: x.media_caption,
        author: x.author_name, body: x.body, isRead: x.is_read, replied: x.replied, at: x.created_at_meta,
      })),
      sync: syncStatus.get(presetId) || null,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load that inbox" });
  }
});

router.post("/inbox/sync", requireAuth, async (_req, res) => {
  const r = await syncInbox();
  res.json(r);
});

router.post("/inbox/read", requireAuth, async (req, res) => {
  await ensureTables();
  const presetId = Number(req.body?.presetId);
  const threadId = typeof req.body?.threadId === "string" ? req.body.threadId : "";
  if (presetId && threadId) await db.execute(sql`UPDATE inbox_items SET is_read = true WHERE preset_id = ${presetId} AND thread_id = ${threadId}`);
  else if (presetId) await db.execute(sql`UPDATE inbox_items SET is_read = true WHERE preset_id = ${presetId}`);
  else await db.execute(sql`UPDATE inbox_items SET is_read = true`);
  res.json({ ok: true });
});

router.post("/inbox/:id/reply", requireAuth, async (req, res) => {
  try {
    await ensureTables();
    const id = Number(req.params.id);
    const text = String(req.body?.text ?? "").trim();
    if (!id || !text) { res.status(400).json({ error: "Write a reply first" }); return; }
    const row = rowsOf(await db.execute(sql`SELECT * FROM inbox_items WHERE id = ${id}`))[0];
    if (!row) { res.status(404).json({ error: "Message not found" }); return; }
    const [preset] = (await db.select().from(clientPresetsTable)).filter((p) => p.id === Number(row.preset_id));
    const token = preset?.metaPageAccessToken;
    if (!preset || !token) { res.status(400).json({ error: "That client is not connected" }); return; }
    if (row.kind === "comment") {
      const out = await graphPost(`${row.external_id}/replies`, { message: text }, token);
      await insertItem({
        presetId: preset.id, clientName: preset.name, kind: "comment", direction: "out", externalId: String(out.id || `out-${Date.now()}`), threadId: row.thread_id,
        permalink: row.permalink, caption: row.media_caption, authorName: preset.metaInstagramUsername || "you", authorId: "", body: text, at: new Date().toISOString(), silent: true,
      });
    } else {
      if (!preset.metaFacebookPageId) { res.status(400).json({ error: "No Facebook page connected for that client" }); return; }
      const out = await graphPost(`${preset.metaFacebookPageId}/messages`, { recipient: { id: row.author_id }, message: { text }, messaging_type: "RESPONSE" }, token);
      await insertItem({
        presetId: preset.id, clientName: preset.name, kind: "dm", direction: "out", externalId: String(out.message_id || `out-${Date.now()}`), threadId: row.thread_id,
        authorName: preset.metaInstagramUsername || "you", authorId: preset.metaInstagramAccountId || "", body: text, at: new Date().toISOString(), silent: true,
      });
    }
    await db.execute(sql`UPDATE inbox_items SET replied = true, is_read = true WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, `Inbox reply failed: ${msg}`);
    res.status(502).json({ error: msg });
  }
});

router.get("/inbox/push/public-key", requireAuth, (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

router.post("/inbox/push-subscribe", requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) { res.status(400).json({ error: "Bad subscription" }); return; }
  await saveAdminSubscription(String(endpoint), String(keys.p256dh), String(keys.auth));
  res.json({ ok: true });
});

export default router;
