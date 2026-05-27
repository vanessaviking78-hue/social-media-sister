import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { intakeBatchesTable, contentLibraryTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "../lib/activityLog";

const router: IRouter = Router();

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQuotes) { inQuotes = true; continue; }
      if (ch === '"' && inQuotes && line[i + 1] === '"') { current += '"'; i++; continue; }
      if (ch === '"' && inQuotes) { inQuotes = false; continue; }
      if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
  return { headers, rows };
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  educational: "educational tip and advice posts",
  promotional: "promotional offer and availability posts",
  faq: "FAQ and myth-busting posts",
  results: "compliance-safe client journey posts (no before/after promises, no outcome guarantees, no claims)",
  seasonal: "seasonal and trend-aware posts",
};

const VANESSA_SYSTEM = `You are Vanessa, the Social Media Sister AI — a social media strategist specialising in aesthetic clinics, dental practices, skin clinics, and wellness businesses. You have deep expertise in MHRA/ASA compliance, writing hooks and captions that convert, and social media strategy for clinics.

Write like a real person talking quietly to another real person. Not a brand. Not a marketing department. No performance. Short, complete sentences. No em dashes. No parenthetical asides with dashes. Build slowly toward something real.

COMPLIANCE RULES (non-negotiable):
- Comply with ASA, CAP, MHRA and JCCP UK aesthetics advertising rules
- No before/after promises of any kind
- No guaranteed results or outcome claims
- No prescription medicine brand names (use "anti-wrinkle treatment" not "Botox")
- Use compliance-safe language throughout
- No medical claims`;

router.post("/intake/parse-csv", csvUpload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }
    const text = req.file.buffer.toString("utf-8");
    const { headers, rows } = parseCSV(text);
    if (!headers.length) { res.status(400).json({ error: "CSV appears to be empty or could not be parsed" }); return; }
    res.json({ headers, rows, rowCount: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "CSV parse failed" });
  }
});

router.post("/intake/generate", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const { rows, clientName, presetId, batchSize, contentMix } = req.body as {
      rows: Record<string, string>[];
      clientName: string;
      presetId?: number;
      batchSize: number;
      contentMix: string[];
    };

    if (!rows?.length) { send({ type: "error", message: "No form data rows provided" }); res.end(); return; }
    if (!contentMix?.length) { send({ type: "error", message: "Select at least one content type" }); res.end(); return; }

    const total = Math.min(Number(batchSize) || 30, 90);

    const [batch] = await db.insert(intakeBatchesTable).values({
      clientName: clientName || "",
      presetId: presetId || null,
      status: "generating",
      formDataJson: rows,
      totalCount: total,
      contentMix,
    }).returning();

    send({ type: "start", total, batchId: batch.id });

    const businessProfile = Object.entries(rows[0] || {})
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const perType = Math.max(1, Math.floor(total / contentMix.length));
    const typeDistribution = contentMix.map((t, i) => ({
      type: t,
      count: i === contentMix.length - 1 ? total - perType * i : perType,
    }));

    let generated = 0;

    for (const { type, count } of typeDistribution) {
      const typeLabel = CONTENT_TYPE_LABELS[type] || type;
      const chunkSize = 5;
      let remaining = count;

      while (remaining > 0) {
        const thisChunk = Math.min(chunkSize, remaining);
        remaining -= thisChunk;

        const prompt = `Generate exactly ${thisChunk} ${typeLabel} for a UK aesthetics or wellness clinic's Instagram and Facebook page.

BUSINESS PROFILE:
${businessProfile}

CLIENT: ${clientName || "this clinic"}

Each caption should be ready to post with relevant emoji, a warm call to action, and 3-5 UK-relevant hashtags at the end. Write in the voice of the clinic owner speaking directly and honestly to their ideal client.

Return valid JSON: { "captions": ["caption 1", "caption 2", ...] }`;

        const completion = await openai.chat.completions.create({
          model: "gpt-5.2",
          messages: [
            { role: "system", content: VANESSA_SYSTEM },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        });

        const raw = completion.choices[0]?.message?.content || "{}";
        let parsed: { captions?: string[] } = {};
        try { parsed = JSON.parse(raw); } catch { parsed = { captions: [] }; }

        const captions = parsed.captions || [];
        if (captions.length) {
          const toInsert = captions.map((caption) => ({
            clientName: clientName || "",
            postType: "single",
            caption,
            metadata: { source: "content-machine", contentType: type, batchId: batch.id } as Record<string, unknown>,
          }));
          await db.insert(contentLibraryTable).values(toInsert);
          generated += captions.length;
        }

        await db.update(intakeBatchesTable)
          .set({ generatedCount: generated })
          .where(eq(intakeBatchesTable.id, batch.id));

        send({ type: "progress", generated, total });
      }
    }

    await db.update(intakeBatchesTable)
      .set({ status: "complete", generatedCount: generated })
      .where(eq(intakeBatchesTable.id, batch.id));

    logActivity({ action: "generated", postType: "single-image", clientName: clientName || "", postCount: generated });

    send({ type: "complete", generated, total, clientName });
    res.end();
  } catch (err: any) {
    req.log.error({ err }, "Intake generation failed");
    send({ type: "error", message: err.message || "Generation failed" });
    res.end();
  }
});

export default router;
