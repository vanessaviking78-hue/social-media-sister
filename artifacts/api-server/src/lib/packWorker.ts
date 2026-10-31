import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { freeSampleDraftsTable, aiSourcePhotosTable } from "@workspace/db/schema";
import { readKey, appLink } from "./freeSampleWorker";
import { createJob, getJob, processPortraitJob } from "./aiPortraitWorker";
import { notifySampleReady } from "./notify";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Post Pack orders. A clinic fills in the public order form, which saves a draft with source "pack".
// This builds the pool of Studio portraits for it (12 for every size while Vanessa tests). The posts
// themselves are planned, written and drawn in her browser on the review page, exactly as the free
// sample is, so nothing reaches a clinic without her eye on it.
// ---------------------------------------------------------------------------

export const PACK_POOL_SIZE = 12;

export type PackInput = {
  size: 12 | 20 | 30;
  role: string;
  website: string;
  /** brand colours as hex codes, main first */
  mainHex: string;
  accentHex: string;
  /** the clinician photo used to make the Studio portraits */
  photoKey: string;
  /** optional photos the clinic sent, used as they are in the pool */
  extraKeys: string[];
  /** the treatments the clinic ticked, never prescription only */
  treatments: string[];
  /** the month the pack is for, e.g. "2026-11", which rotates the designs */
  month: string;
  /** true while Vanessa is testing, so no payment is taken */
  test: boolean;
};

// 12 Studio images: 3 clinical, 3 jeans and shirt, 2 seasonal, 4 black jumper. Seasonal ones need the month.
const POOL: { id: string; mixStyle?: string }[] = [
  { id: "mx-01" }, { id: "mx-05" }, { id: "mx-13" }, { id: "mx-09", mixStyle: "luxe" },
  { id: "mx-02" }, { id: "mx-06" }, { id: "mx-14" }, { id: "mx-10", mixStyle: "everyday" },
  { id: "mx-03" }, { id: "mx-07" }, { id: "mx-15" }, { id: "mx-16" },
];

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setDraft(id: string, patch: Partial<typeof freeSampleDraftsTable.$inferInsert>): Promise<void> {
  await db.update(freeSampleDraftsTable).set({ ...patch, updatedAt: new Date() }).where(eq(freeSampleDraftsTable.id, id));
}

export async function runPackDraft(id: string): Promise<void> {
  const [draft] = await db.select().from(freeSampleDraftsTable).where(eq(freeSampleDraftsTable.id, id));
  if (!draft) return;
  await setDraft(id, { status: "working", error: "" });
  try {
    const input = (draft.input ?? {}) as { pack?: PackInput };
    const pack = input.pack;
    if (!pack?.photoKey) throw new Error("A clinician photo is needed to make the Studio images");
    const monthIdx = Number(pack.month.split("-")[1]) - 1;
    const month = MONTH_NAMES[monthIdx] ?? MONTH_NAMES[new Date().getMonth()];

    const sourceBuf = await readKey(pack.photoKey);
    const [source] = await db
      .insert(aiSourcePhotosTable)
      .values({ clientName: draft.clinicName, photoUrl: `/api/media/${pack.photoKey}`, notes: "Post pack" })
      .returning();

    const scenarioFor = (slot: { id: string; mixStyle?: string }) => {
      const promptVars: Record<string, string> = {};
      if (slot.mixStyle) {
        promptVars.month = month;
        promptVars.mixStyle = slot.mixStyle;
      }
      return { id: slot.id, aspectRatio: "3:4", ...(Object.keys(promptVars).length ? { promptVars } : {}) };
    };

    const results = new Map<string, string>();
    let pending = POOL.map((p) => p.id);
    for (let round = 0; round < 3 && pending.length > 0; round++) {
      const slots = pending.map((pid) => POOL.find((p) => p.id === pid)!);
      const jobId = `pk_${Date.now()}_${uuid().slice(0, 8)}`;
      createJob(jobId, pending);
      await processPortraitJob(jobId, sourceBuf, source.id, draft.clinicName, slots.map(scenarioFor));
      const job = getJob(jobId);
      for (const c of job?.cards ?? []) {
        if (c.status === "success" && c.outputImageUrl) results.set(c.scenarioId, c.outputImageUrl);
      }
      pending = pending.filter((pid) => !results.has(pid));
      if (pending.length > 0) await sleep(3000);
    }
    // A pool that is a little short still works, because the posts reuse photos. Fail only if most are missing.
    if (results.size < Math.ceil(PACK_POOL_SIZE / 2)) throw new Error(`Only ${results.size} of ${PACK_POOL_SIZE} Studio photos would generate`);

    const photos = [
      ...POOL.filter((p) => results.has(p.id)).map((p) => ({ url: results.get(p.id)!, source: "studio" as const })),
      ...pack.extraKeys.map((k) => ({ url: `/api/media/${k}`, source: "own" as const })),
    ];
    await setDraft(id, { status: "ready", data: { photos, pack: { size: pack.size, month: pack.month } }, error: "" });
    await notifySampleReady({ clinicName: draft.clinicName, handle: draft.handle, link: appLink(`/post-pack?draft=${id}`), ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "The pack did not finish building";
    logger.error({ err, id }, "post pack build failed");
    await setDraft(id, { status: "failed", error: msg }).catch(() => {});
    await notifySampleReady({ clinicName: draft.clinicName, handle: draft.handle, link: appLink(`/post-pack?draft=${id}`), ok: false, detail: msg });
  }
}
