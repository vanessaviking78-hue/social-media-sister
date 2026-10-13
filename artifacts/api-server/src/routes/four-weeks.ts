import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scheduledPostsTable } from "@workspace/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

const router: IRouter = Router();

const WINDOW_DAYS = 28;
const TARGET_PER_KIND = 4;

type Kind = "monday" | "wednesday" | "friday" | "sunday";

const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" });

function classify(sourceTool: string | undefined, postType: string, scheduledAt: Date): Kind | null {
  const tool = (sourceTool || "").toLowerCase();
  const day = weekdayFmt.format(scheduledAt);
  if (tool === "magazine post") return "monday";
  if (tool === "magazine-flip" || (postType === "reel" && tool.includes("flip"))) return "wednesday";
  if (tool === "stylish" && day === "Fri") return "friday";
  if (tool === "tweet-maker") return "sunday";
  return null;
}

router.get("/four-weeks", async (req, res) => {
  try {
    const presetId = Number(req.query.presetId);
    if (!Number.isFinite(presetId)) {
      res.status(400).json({ error: "presetId is required" });
      return;
    }
    const now = new Date();
    const end = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(scheduledPostsTable)
      .where(
        and(
          eq(scheduledPostsTable.presetId, presetId),
          eq(scheduledPostsTable.status, "pending"),
          gte(scheduledPostsTable.scheduledAt, now),
          lte(scheduledPostsTable.scheduledAt, end),
        ),
      );

    const counts: Record<Kind, number> = { monday: 0, wednesday: 0, friday: 0, sunday: 0 };
    const latest: Record<Kind, string | null> = { monday: null, wednesday: null, friday: null, sunday: null };
    for (const r of rows) {
      const when = new Date(r.scheduledAt as unknown as string);
      const kind = classify(r.content?.sourceTool, r.postType, when);
      if (!kind) continue;
      counts[kind] += 1;
      if (!latest[kind] || when > new Date(latest[kind] as string)) latest[kind] = when.toISOString();
    }

    const kinds = (Object.keys(counts) as Kind[]).map((k) => ({
      kind: k,
      scheduled: Math.min(counts[k], TARGET_PER_KIND),
      target: TARGET_PER_KIND,
      done: counts[k] >= TARGET_PER_KIND,
      latest: latest[k],
    }));
    const allDone = kinds.every((k) => k.done);
    const completeUntil = allDone
      ? kinds.map((k) => k.latest as string).sort().slice(-1)[0]
      : null;

    res.json({ presetId, windowDays: WINDOW_DAYS, kinds, allDone, completeUntil });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to build four weeks" });
  }
});

router.post("/four-weeks/run", async (req, res) => {
  try {
    const clientName = String(req.body?.clientName || "").trim();
    if (!clientName) {
      res.status(400).json({ error: "clientName is required" });
      return;
    }
    const url = process.env.FOUR_WEEKS_FIRE_URL;
    const token = process.env.FOUR_WEEKS_FIRE_TOKEN;
    if (!url || !token) {
      res.status(503).json({ error: "The run button is not connected yet. FOUR_WEEKS_FIRE_URL and FOUR_WEEKS_FIRE_TOKEN need adding in Railway." });
      return;
    }
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "experimental-cc-routine-2026-04-01",
      },
      body: JSON.stringify({ text: `Client: ${clientName}` }),
    });
    const body = await r.text();
    if (!r.ok) {
      res.status(502).json({ error: `Claude did not accept the job (${r.status}). ${body.slice(0, 200)}` });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to start the run" });
  }
});

export default router;
