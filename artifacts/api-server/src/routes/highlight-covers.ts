import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import sharp from "sharp";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Same auth pattern as background-builder.ts and the other admin-only tools.
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

router.use("/highlight-covers", requireAuth);

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const SIZE = 1080;
const MAX_NAMES = 30;

// Self-provisions its own table the first time it is needed, the same
// lightweight approach client_backgrounds already uses elsewhere in this
// app, so there is no separate migration step to remember or forget.
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = db
      .execute(
        sql`
        CREATE TABLE IF NOT EXISTS client_highlight_covers (
          id SERIAL PRIMARY KEY,
          preset_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          icon_key TEXT NOT NULL,
          image_url TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `,
      )
      .then(() => undefined);
  }
  return tableReady;
}

// ---- Icon matching --------------------------------------------------------
// A small curated set of clean line/fill icons for the categories an
// aesthetics clinic's Instagram highlights actually cover, matched by
// keyword against whatever Vanessa types as the highlight name. Every icon
// below is built from plain shape primitives (paths, rects, circles, lines),
// not an icon font or emoji, so there is nothing to fetch, nothing that can
// rate limit, and nothing that can render as a missing glyph. Checked in
// order, first keyword match wins.
const ICON_CATEGORIES: { key: string; keywords: string[] }[] = [
  { key: "syringe", keywords: ["botox", "filler", "fillers", "injectable", "injectables", "wrinkle", "anti-wrinkle", "antiwrinkle", "tox", "toxin", "dermal"] },
  { key: "lips", keywords: ["lip", "lips", "pout"] },
  { key: "browEye", keywords: ["brow", "brows", "microblading", "lash", "lashes", "eye", "eyes", "eyebrow"] },
  { key: "droplet", keywords: ["skin", "skincare", "facial", "peel", "hydra", "glow", "hydration"] },
  { key: "camera", keywords: ["before", "after", "result", "results", "transformation", "gallery", "photo", "photos"] },
  { key: "star", keywords: ["review", "reviews", "testimonial", "testimonials", "feedback", "rating", "ratings"] },
  { key: "calendar", keywords: ["book", "booking", "appointment", "appointments", "schedule"] },
  { key: "heart", keywords: ["aftercare", "after care", "post care", "postcare", "recovery", "heal", "healing", "love"] },
  { key: "tag", keywords: ["price", "prices", "pricing", "offer", "offers", "deal", "deals", "sale"] },
  { key: "info", keywords: ["faq", "faqs", "question", "questions", "info", "information", "help"] },
  { key: "team", keywords: ["team", "staff", "meet the team", "about us", "about"] },
  { key: "pin", keywords: ["location", "clinic", "find us", "address", "map", "directions"] },
  { key: "bag", keywords: ["shop", "product", "products", "store", "range"] },
  { key: "message", keywords: ["contact", "dm", "message", "enquire", "enquiries", "get in touch"] },
  { key: "gift", keywords: ["gift", "voucher", "vouchers", "gift card"] },
  { key: "sparkle", keywords: ["new", "launch", "coming soon"] },
];

function matchIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const cat of ICON_CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) return cat.key;
  }
  return "sparkle";
}

function iconMarkup(key: string, colour: string): string {
  switch (key) {
    case "syringe":
      return `<g transform="rotate(45 12 12)">
        <rect x="9" y="2" width="6" height="4" rx="1" fill="none" stroke="${colour}" stroke-width="1.6"/>
        <rect x="9" y="6" width="6" height="10" rx="1" fill="none" stroke="${colour}" stroke-width="1.6"/>
        <line x1="12" y1="16" x2="12" y2="22" stroke="${colour}" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="7" y1="9" x2="9" y2="9" stroke="${colour}" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="7" y1="12" x2="9" y2="12" stroke="${colour}" stroke-width="1.4" stroke-linecap="round"/>
      </g>`;
    case "lips":
      return `<path d="M2.5 12.3 C6 9 9.7 9.3 12 11.4 C14.3 9.3 18 9 21.5 12.3 C18.5 15.6 15 16.8 12 15.6 C9 16.8 5.5 15.6 2.5 12.3 Z" fill="${colour}"/>`;
    case "browEye":
      return `<path d="M3 14 C6 9 10 8 12 9.5 C14 8 18 9 21 14" fill="none" stroke="${colour}" stroke-width="1.8" stroke-linecap="round"/>
        <ellipse cx="12" cy="14.5" rx="7" ry="3" fill="none" stroke="${colour}" stroke-width="1.6"/>
        <circle cx="12" cy="14.5" r="1.6" fill="${colour}"/>`;
    case "droplet":
      return `<path d="M12 2.5 C12 2.5 5.5 11 5.5 15.5 A6.5 6.5 0 0 0 18.5 15.5 C18.5 11 12 2.5 12 2.5 Z" fill="${colour}"/>`;
    case "camera":
      return `<rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="${colour}" stroke-width="1.6"/>
        <path d="M8 7 L9.5 4.5 H14.5 L16 7" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="13.5" r="3.6" fill="none" stroke="${colour}" stroke-width="1.6"/>`;
    case "star":
      return `<path d="M12 2.5 L14.6 9 L21.5 9.6 L16.2 14.1 L17.9 21 L12 17.2 L6.1 21 L7.8 14.1 L2.5 9.6 L9.4 9 Z" fill="${colour}"/>`;
    case "calendar":
      return `<rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="${colour}" stroke-width="1.6"/>
        <line x1="3" y1="10" x2="21" y2="10" stroke="${colour}" stroke-width="1.6"/>
        <line x1="7" y1="2.5" x2="7" y2="6.5" stroke="${colour}" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="17" y1="2.5" x2="17" y2="6.5" stroke="${colour}" stroke-width="1.6" stroke-linecap="round"/>`;
    case "heart":
      return `<path d="M12 21 C12 21 3 14.5 3 8.7 A5.2 5.2 0 0 1 12 5.4 A5.2 5.2 0 0 1 21 8.7 C21 14.5 12 21 12 21 Z" fill="${colour}"/>`;
    case "tag":
      return `<path d="M20 12.3 L12.7 19.6 A2 2 0 0 1 9.9 19.6 L3.4 13.1 A2 2 0 0 1 3.4 10.3 L10.7 3 H17 A3 3 0 0 1 20 6 Z" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="15.2" cy="8.8" r="1.4" fill="${colour}"/>`;
    case "info":
      return `<circle cx="12" cy="12" r="9" fill="none" stroke="${colour}" stroke-width="1.6"/>
        <circle cx="12" cy="7.6" r="1.1" fill="${colour}"/>
        <line x1="12" y1="11" x2="12" y2="17" stroke="${colour}" stroke-width="1.8" stroke-linecap="round"/>`;
    case "team":
      return `<circle cx="8.5" cy="9" r="3" fill="none" stroke="${colour}" stroke-width="1.6"/>
        <circle cx="15.5" cy="9" r="3" fill="none" stroke="${colour}" stroke-width="1.6"/>
        <path d="M3 19.5 C3 15.8 5.6 14 8.5 14 C10 14 11.3 14.5 12.2 15.4" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M21 19.5 C21 15.8 18.4 14 15.5 14 C13.5 14 11.8 14.8 11 16" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round"/>`;
    case "pin":
      return `<path d="M12 2.5 A7 7 0 0 0 5 9.5 C5 15 12 21.5 12 21.5 C12 21.5 19 15 19 9.5 A7 7 0 0 0 12 2.5 Z" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="12" cy="9.5" r="2.4" fill="${colour}"/>`;
    case "bag":
      return `<path d="M6 8 H18 L17 21 H7 Z" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M9 8 V6 A3 3 0 0 1 15 6 V8" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round"/>`;
    case "message":
      return `<path d="M4 5 H20 A1 1 0 0 1 21 6 V16 A1 1 0 0 1 20 17 H9 L4.5 20.5 V17 H4 A1 1 0 0 1 3 16 V6 A1 1 0 0 1 4 5 Z" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linejoin="round"/>`;
    case "gift":
      return `<rect x="4" y="9.5" width="16" height="11" rx="1" fill="none" stroke="${colour}" stroke-width="1.6"/>
        <rect x="2.5" y="6" width="19" height="4" rx="1" fill="none" stroke="${colour}" stroke-width="1.6"/>
        <line x1="12" y1="6" x2="12" y2="20.5" stroke="${colour}" stroke-width="1.6"/>
        <path d="M12 6 C10 2 6 3 6.5 5.5 C7 7.5 10.5 6.8 12 6 Z" fill="${colour}"/>
        <path d="M12 6 C14 2 18 3 17.5 5.5 C17 7.5 13.5 6.8 12 6 Z" fill="${colour}"/>`;
    case "sparkle":
    default:
      return `<path d="M12 2 L13.6 9.4 L21 11 L13.6 12.6 L12 20 L10.4 12.6 L3 11 L10.4 9.4 Z" fill="${colour}"/>`;
  }
}

// Picks a light or dark icon colour depending on how light the background
// swatch is, so the icon is always readable rather than disappearing into a
// pale brand colour.
function contrastColour(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 165 ? "#1a1a2e" : "#ffffff";
}

function buildCoverSvg(bgColour: string, iconKey: string): string {
  const iconColour = contrastColour(bgColour);
  const icon = iconMarkup(iconKey, iconColour);
  const offset = SIZE / 2 - 200;
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${SIZE}" height="${SIZE}" fill="${bgColour}"/>
    <g transform="translate(${offset},${offset}) scale(16.6667)">${icon}</g>
  </svg>`;
}

// Insert-only, wrapped so a failed save never takes a successful generation
// down with it. Same safety-net pattern registerBackground() uses in
// background-builder.ts.
async function registerCover(presetId: number, name: string, iconKey: string, imageUrl: string): Promise<void> {
  try {
    await ensureTable();
    await db.execute(sql`
      INSERT INTO client_highlight_covers (preset_id, name, icon_key, image_url)
      VALUES (${presetId}, ${name}, ${iconKey}, ${imageUrl})
    `);
  } catch (err) {
    logger.error({ err, presetId, name }, "Highlight Cover Maker auto-save failed");
  }
}

type CoverRow = { id: number; name: string; iconKey: string; imageUrl: string; createdAt: string };

router.get("/highlight-covers/list", async (req: Request, res: Response) => {
  try {
    const presetId = Number(req.query.presetId);
    if (!presetId) {
      res.status(400).json({ error: "presetId is required" });
      return;
    }
    await ensureTable();
    const result = await db.execute(sql`
      SELECT id, name, icon_key AS "iconKey", image_url AS "imageUrl", created_at AS "createdAt"
      FROM client_highlight_covers WHERE preset_id = ${presetId} ORDER BY created_at DESC
    `);
    res.set("Cache-Control", "no-store");
    res.json((result as { rows?: CoverRow[] }).rows ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load highlight covers" });
  }
});

router.delete("/highlight-covers/:id", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    await db.execute(sql`DELETE FROM client_highlight_covers WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete cover" });
  }
});

type GenerateBody = { presetId?: number; colours?: string[]; names?: string[] };

// Builds one cover per highlight name in a single request. Colours round-
// robin across the set the same way multi-select styles round-robin in
// Background Builder, so two brand colours alternate across the row instead
// of every cover being identical. Pure shape rendering with sharp, no AI
// model call involved anywhere in this route, so there is nothing here that
// can be rate limited or cost API credit.
router.post("/highlight-covers/generate-batch", async (req: Request, res: Response) => {
  try {
    const body = req.body as GenerateBody;
    const names = (body.names || []).map((n) => n.trim()).filter((n) => n.length > 0).slice(0, MAX_NAMES);
    if (names.length === 0) {
      res.status(400).json({ error: "Add at least one highlight name" });
      return;
    }

    const cleanColours = (body.colours || []).filter((c) => HEX_RE.test(c));
    const colours = cleanColours.length > 0 ? cleanColours : ["#111111"];

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      res.status(500).json({ error: "Object storage not configured" });
      return;
    }
    const bucket = objectStorageClient.bucket(bucketId);

    const covers: { name: string; iconKey: string; imageUrl: string }[] = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const colour = colours[i % colours.length];
      const iconKey = matchIcon(name);
      const svg = buildCoverSvg(colour, iconKey);
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      const key = `highlight-covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      await bucket.file(key).save(png, { contentType: "image/png", metadata: { cacheControl: "public, max-age=31536000" } });
      covers.push({ name, iconKey, imageUrl: `/api/media/${key}` });
    }

    if (body.presetId) {
      await Promise.all(covers.map((c) => registerCover(Number(body.presetId), c.name, c.iconKey, c.imageUrl)));
    }

    res.json({ covers, count: covers.length, autoSaved: !!body.presetId });
  } catch (err: any) {
    logger.error({ err }, "Highlight Cover Maker batch generate failed");
    res.status(500).json({ error: err.message || "Generation failed" });
  }
});

export default router;
