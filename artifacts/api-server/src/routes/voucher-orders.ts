import { Router, type IRouter, type Request, type Response } from "express";
import { v4 as uuid } from "uuid";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { appLink } from "../lib/freeSampleWorker";
import { notifyOwner } from "../lib/notify";

// VOUCHER ORDERS at /voucher-order. A clinic types in its name, area, colours and the voucher offers it wants, and Vanessa gets an email with the lot.
// She then makes the designs in her Vouchers tool (www.thecybersuite.com/vouchers) and sends them back. No payment is taken on the page.

const router: IRouter = Router();
const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (ready) return ready;
  const p: Promise<void> = db
    .execute(sql`CREATE TABLE IF NOT EXISTS voucher_orders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      insta TEXT NOT NULL DEFAULT '',
      area TEXT NOT NULL DEFAULT '',
      colours TEXT NOT NULL DEFAULT '',
      offers TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
    .then(() => db.execute(sql`ALTER TABLE voucher_orders ADD COLUMN IF NOT EXISTS deal TEXT NOT NULL DEFAULT ''`))
    .then(() => undefined);
  ready = p;
  p.catch(() => { ready = null; });
  return p;
}

const hits = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 6;
}

router.post("/voucher-orders", async (req: Request, res: Response) => {
  try {
    if (tooMany(String(req.ip))) { res.status(429).json({ error: "Too many tries, please try again later" }); return; }
    await ensureTable();
    const name = str(req.body?.name, 120);
    const email = str(req.body?.email, 160);
    const phone = str(req.body?.phone, 40);
    const insta = str(req.body?.insta, 60).replace(/^@/, "");
    const area = str(req.body?.area, 160);
    const colours = str(req.body?.colours, 300);
    const offers = str(req.body?.offers, 2000);
    const deal = str(req.body?.deal, 200);
    const note = str(req.body?.note, 1000);
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !area || !colours || !offers) {
      res.status(400).json({ error: "Please fill in your name, email, area, colours and your voucher offers" });
      return;
    }
    const id = uuid();
    await db.execute(sql`INSERT INTO voucher_orders (id, name, email, phone, insta, area, colours, offers, deal, note) VALUES (${id}, ${name}, ${email}, ${phone}, ${insta}, ${area}, ${colours}, ${offers}, ${deal}, ${note})`);
    void notifyOwner(
      `Voucher order: ${name}`,
      [
        `${name} has filled in the voucher form.`,
        `Area: ${area}`,
        `Colours: ${colours}`,
        `Instagram: @${insta || "not given"}`,
        `WhatsApp: ${phone || "not given"}`,
        `Email: ${email}`,
        "",
        "Voucher offers they want:",
        offers,
        deal ? `\nDiscount or bonus deal: ${deal}` : "",
        note ? `\nAnything else: ${note}` : "",
        "",
        "Make their designs here, then send them back:",
        appLink("/vouchers"),
      ].join("\n"),
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Something went wrong, please try again" });
  }
});

export default router;
