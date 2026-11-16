import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { logger } from "../lib/logger";

// /crmpage Instagram feed. Reads the connected Social Media Sister Instagram account live from Meta and sends the CRM three things:
// who has commented on recent posts, who has been messaged (and who has replied), and how recent posts are performing.
// Nothing is stored. Instagram does not share who liked a post, so likes only ever come through as a count per post.

const router: IRouter = Router();
const GRAPH = "https://graph.facebook.com/v22.0";
const CACHE_MS = 3 * 60 * 1000;

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return next();
  const expected = appPassword.trim().toLowerCase();
  const provided = (req.headers["x-app-password"] as string | undefined)?.trim().toLowerCase();
  if (provided === expected) return next();
  res.status(401).json({ error: "Please log in to your tools first." });
}

async function graphGet(path: string, params: Record<string, string>, token: string): Promise<any> {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`, { signal: AbortSignal.timeout(25000) });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(String(data?.error?.message || `Meta said ${res.status}`));
  return data;
}

type Person = {
  comments: number;
  postsCommented: number;
  lastCommentAt: string | null;
  lastCommentText: string;
  dm: "none" | "sent" | "replied" | "inbound";
  dmLastAt: string | null;
  dmLastFrom: "me" | "them" | null;
  dmLastText: string;
};

type Post = {
  id: string; permalink: string; caption: string; postedAt: string; type: string;
  likes: number | null; comments: number | null; reach: number | null; saved: number | null; shares: number | null; score: number;
  commenters: string[];
};

let cache: { at: number; body: unknown } | null = null;

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function build() {
  const presets = await db.select().from(clientPresetsTable);
  const preset =
    presets.find((p) => p.name.trim().toLowerCase() === "social media sister") ||
    presets.find((p) => (p.metaInstagramUsername || "").toLowerCase() === "social_media_sister");
  if (!preset || !preset.metaInstagramAccountId || !preset.metaPageAccessToken) {
    return { connected: false, reason: "Social Media Sister is not connected to Instagram yet.", people: {}, posts: [], errors: {} };
  }
  const igId = preset.metaInstagramAccountId;
  const pageId = preset.metaFacebookPageId || "";
  const token = preset.metaPageAccessToken;
  const own = (preset.metaInstagramUsername || "").toLowerCase();
  const errors: { posts?: string; dms?: string; insights?: string } = {};
  const people: Record<string, Person> = {};
  const person = (u: string): Person =>
    (people[u] ||= { comments: 0, postsCommented: 0, lastCommentAt: null, lastCommentText: "", dm: "none", dmLastAt: null, dmLastFrom: null, dmLastText: "" });

  // ---- posts and comments ----
  const posts: Post[] = [];
  try {
    const media = await graphGet(`${igId}/media`, {
      fields: "id,permalink,caption,timestamp,media_type,like_count,comments_count,comments.limit(50){id,text,username,timestamp}",
      limit: "25",
    }, token);
    for (const m of media.data || []) {
      const commenters = new Set<string>();
      for (const c of m.comments?.data || []) {
        const u = String(c.username || "").toLowerCase();
        if (!u || u === own) continue;
        commenters.add(u);
        const p = person(u);
        p.comments++;
        if (!p.lastCommentAt || String(c.timestamp) > p.lastCommentAt) { p.lastCommentAt = c.timestamp; p.lastCommentText = clip(c.text, 140); }
      }
      commenters.forEach((u) => { person(u).postsCommented++; });
      posts.push({
        id: String(m.id), permalink: String(m.permalink || ""), caption: clip(m.caption, 120), postedAt: String(m.timestamp || ""), type: String(m.media_type || ""),
        likes: num(m.like_count), comments: num(m.comments_count), reach: null, saved: null, shares: null, score: 0, commenters: [...commenters],
      });
    }
  } catch (e) {
    errors.posts = e instanceof Error ? e.message : String(e);
  }

  // ---- post insights (reach, saves, shares) for the newest posts ----
  if (posts.length) {
    const results = await Promise.allSettled(posts.slice(0, 15).map((p) => graphGet(`${p.id}/insights`, { metric: "reach,saved,shares" }, token)));
    results.forEach((r, i) => {
      const post = posts[i];
      if (r.status === "rejected") { errors.insights = r.reason instanceof Error ? r.reason.message : String(r.reason); return; }
      for (const row of r.value.data || []) {
        const v = row.values?.[0]?.value ?? row.total_value?.value;
        if (row.name === "reach") post.reach = num(Number(v));
        if (row.name === "saved") post.saved = num(Number(v));
        if (row.name === "shares") post.shares = num(Number(v));
      }
    });
    for (const p of posts) p.score = (p.likes ?? 0) + 2 * (p.comments ?? 0) + 3 * (p.saved ?? 0) + 4 * (p.shares ?? 0);
  }

  // ---- DMs: who has been messaged, who replied ----
  if (!pageId) {
    errors.dms = "No Facebook page is linked to the Instagram account, so messages cannot be read.";
  } else {
    try {
      let url: string | null = null;
      let first = true;
      for (let page = 0; page < 4; page++) {
        let data: any;
        if (first) {
          data = await graphGet(`${pageId}/conversations`, {
            platform: "instagram",
            fields: "id,updated_time,participants,messages.limit(8){id,message,from,created_time}",
            limit: "50",
          }, token);
          first = false;
        } else {
          const res = await fetch(url as string, { signal: AbortSignal.timeout(25000) });
          data = await res.json().catch(() => ({}));
          if (!res.ok || data?.error) throw new Error(String(data?.error?.message || `Meta said ${res.status}`));
        }
        for (const conv of data.data || []) {
          const other = (conv.participants?.data || []).find((x: any) => String(x.id) !== String(igId) && String(x.id) !== String(pageId) && String(x.username || "").toLowerCase() !== own);
          const u = String(other?.username || "").toLowerCase();
          if (!u) continue;
          const msgs: any[] = (conv.messages?.data || []).slice().sort((a, b) => String(a.created_time).localeCompare(String(b.created_time)));
          if (!msgs.length) continue;
          const mine = (m: any) => String(m.from?.id) === String(igId) || String(m.from?.id) === String(pageId);
          const hasOut = msgs.some(mine);
          const hasIn = msgs.some((m) => !mine(m));
          const last = msgs[msgs.length - 1];
          const p = person(u);
          // sent = I wrote and they have not answered; replied = I wrote first and they answered; inbound = they wrote first.
          if (hasOut && hasIn) p.dm = mine(msgs[0]) ? "replied" : "inbound";
          else if (hasOut) p.dm = "sent";
          else p.dm = "inbound";
          p.dmLastFrom = mine(last) ? "me" : "them";
          p.dmLastAt = String(last.created_time || "");
          p.dmLastText = clip(last.message || "[attachment]", 140);
        }
        url = data.paging?.next || null;
        if (!url) break;
      }
    } catch (e) {
      errors.dms = e instanceof Error ? e.message : String(e);
    }
  }

  return { connected: true, account: own, fetchedAt: new Date().toISOString(), people, posts, errors };
}

router.get("/crm-instagram", requireAuth, async (req, res) => {
  try {
    if (!req.query.refresh && cache && Date.now() - cache.at < CACHE_MS) {
      res.setHeader("Cache-Control", "no-store");
      res.json(cache.body);
      return;
    }
    const body = await build();
    cache = { at: Date.now(), body };
    res.setHeader("Cache-Control", "no-store");
    res.json(body);
  } catch (err) {
    logger.error({ err }, `CRM Instagram feed failed: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).json({ error: "Could not read Instagram just now." });
  }
});

export default router;
