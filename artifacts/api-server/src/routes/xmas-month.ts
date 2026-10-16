import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { scheduledPostsTable } from "@workspace/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";

const router: IRouter = Router();

const WEEKDAY_OF: Record<string, number> = { monday: 1, wednesday: 3, friday: 5, sunday: 0 };

// December of the current year (the next December once this one has finished)
function decemberRange(now: Date) {
  const year = now.getUTCFullYear();
  const start = new Date(Date.UTC(year, 11, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return { year, start, end };
}

function countWeekday(year: number, weekday: number) {
  let n = 0;
  for (let d = 1; d <= 31; d++) if (new Date(Date.UTC(year, 11, d)).getUTCDay() === weekday) n++;
  return n;
}

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

router.get("/xmas-month", async (req, res) => {
  try {
    const presetId = Number(req.query.presetId);
    if (!Number.isFinite(presetId)) {
      res.status(400).json({ error: "presetId is required" });
      return;
    }
    const now = new Date();
    const { year, start, end } = decemberRange(now);
    const from = now > start ? now : start;
    const rows = await db
      .select()
      .from(scheduledPostsTable)
      .where(
        and(
          eq(scheduledPostsTable.presetId, presetId),
          eq(scheduledPostsTable.status, "pending"),
          gte(scheduledPostsTable.scheduledAt, from),
          lt(scheduledPostsTable.scheduledAt, end),
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

    const kinds = (Object.keys(counts) as Kind[]).map((k) => {
      const target = countWeekday(year, WEEKDAY_OF[k]);
      return {
      kind: k,
      scheduled: Math.min(counts[k], target),
      target,
      done: counts[k] >= target,
      latest: latest[k],
    };
    });
    const allDone = kinds.every((k) => k.done);
    const completeUntil = allDone
      ? kinds.map((k) => k.latest as string).sort().slice(-1)[0]
      : null;

    res.json({ presetId, year, kinds, allDone, completeUntil });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to build xmas month" });
  }
});

export default router;
