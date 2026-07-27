import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { brainstormBookingsTable, googleTokensTable } from "@workspace/db/schema";
import { eq, and, gte, ne } from "drizzle-orm";
import { getStoredGoogleToken, refreshGoogleTokenIfNeeded } from "./google-auth";
import { notifyBrainstormBooking } from "../lib/notify";

const router: IRouter = Router();

const SLOT_MINUTES = 30;
const START_HOUR = 8;
const END_HOUR = 12;
const WEEKS_AHEAD = 3;
// Mon=1 .. Thu=4
const OPEN_WEEKDAYS = [1, 2, 3, 4];
const TIME_ZONE = "Europe/London";

function buildCandidateSlots(): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = [];
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let dayOffset = 0; dayOffset < WEEKS_AHEAD * 7; dayOffset++) {
    const day = new Date(now.getTime() + dayOffset * dayMs);
    if (!OPEN_WEEKDAYS.includes(day.getDay())) continue;

    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      for (let min = 0; min < 60; min += SLOT_MINUTES) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, min, 0, 0);
        const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
        if (start.getTime() <= now.getTime() + 60 * 60 * 1000) continue; // require 1hr notice
        slots.push({ start, end });
      }
    }
  }
  return slots;
}

async function getGoogleBusyRanges(token: typeof googleTokensTable.$inferSelect, timeMin: Date, timeMax: Date) {
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: token.calendarId || "primary" }],
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
    };
    const cal = data.calendars?.[token.calendarId || "primary"];
    return (cal?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  } catch {
    return [];
  }
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

router.get("/brainstorm/slots", async (_req: Request, res: Response) => {
  try {
    const candidates = buildCandidateSlots();
    if (candidates.length === 0) {
      res.json({ slots: [], googleConnected: false });
      return;
    }

    const timeMin = candidates[0]!.start;
    const timeMax = candidates[candidates.length - 1]!.end;

    const existingBookings = await db
      .select()
      .from(brainstormBookingsTable)
      .where(and(gte(brainstormBookingsTable.slotEnd, timeMin), ne(brainstormBookingsTable.status, "cancelled")));

    let token = await getStoredGoogleToken();
    let googleConnected = !!token;
    let busyRanges: { start: Date; end: Date }[] = [];

    if (token) {
      const refreshed = await refreshGoogleTokenIfNeeded(token);
      if (refreshed) {
        token = refreshed;
        busyRanges = await getGoogleBusyRanges(token, timeMin, timeMax);
      } else {
        googleConnected = false;
      }
    }

    const freeSlots = candidates.filter((slot) => {
      const bookedClash = existingBookings.some((b) => overlaps(slot.start, slot.end, new Date(b.slotStart), new Date(b.slotEnd)));
      if (bookedClash) return false;
      const busyClash = busyRanges.some((b) => overlaps(slot.start, slot.end, b.start, b.end));
      if (busyClash) return false;
      return true;
    });

    res.json({
      slots: freeSlots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
      googleConnected,
      timeZone: TIME_ZONE,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to load slots" });
  }
});

router.post("/brainstorm/book", async (req: Request, res: Response) => {
  try {
    const { slotStart, slotEnd, clientName, clientToken } = req.body as {
      slotStart?: string;
      slotEnd?: string;
      clientName?: string;
      clientToken?: string;
    };

    if (!slotStart || !slotEnd || !clientName?.trim()) {
      res.status(400).json({ error: "Missing slotStart, slotEnd or clientName" });
      return;
    }

    const start = new Date(slotStart);
    const end = new Date(slotEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      res.status(400).json({ error: "Invalid slot" });
      return;
    }
    if (start.getTime() <= Date.now()) {
      res.status(400).json({ error: "That slot has already passed" });
      return;
    }

    const clash = await db
      .select()
      .from(brainstormBookingsTable)
      .where(and(gte(brainstormBookingsTable.slotEnd, start), ne(brainstormBookingsTable.status, "cancelled")));
    const alreadyTaken = clash.some((b) => overlaps(start, end, new Date(b.slotStart), new Date(b.slotEnd)));
    if (alreadyTaken) {
      res.status(409).json({ error: "That slot has just been taken, pick another." });
      return;
    }

    let googleEventId: string | null = null;
    let token = await getStoredGoogleToken();
    if (token) {
      const refreshed = await refreshGoogleTokenIfNeeded(token);
      if (refreshed) {
        token = refreshed;
        try {
          const evRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(token.calendarId || "primary")}/events`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                summary: `Brainstorm call with ${clientName.trim()}`,
                description: "Booked via The CyberSuite client portal.",
                start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
                end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
              }),
            }
          );
          if (evRes.ok) {
            const evData = (await evRes.json()) as { id?: string };
            googleEventId = evData.id ?? null;
          }
        } catch {
          /* non-fatal, booking still saved below */
        }
      }
    }

    const [booking] = await db
      .insert(brainstormBookingsTable)
      .values({
        slotStart: start,
        slotEnd: end,
        clientName: clientName.trim(),
        clientToken: clientToken ?? "",
        googleEventId,
        status: "confirmed",
      })
      .returning();

    notifyBrainstormBooking({ clientName: clientName.trim(), slotStart: start, slotEnd: end }).catch(() => {});

    res.json({ success: true, booking });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to book" });
  }
});

router.get("/brainstorm/admin/bookings", async (_req: Request, res: Response) => {
  try {
    const bookings = await db
      .select()
      .from(brainstormBookingsTable)
      .where(and(ne(brainstormBookingsTable.status, "cancelled"), gte(brainstormBookingsTable.slotStart, new Date(Date.now() - 24 * 60 * 60 * 1000))))
      .orderBy(brainstormBookingsTable.slotStart);
    res.json({ bookings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/brainstorm/admin/cancel/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params["id"] ?? "", 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.update(brainstormBookingsTable).set({ status: "cancelled" }).where(eq(brainstormBookingsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
