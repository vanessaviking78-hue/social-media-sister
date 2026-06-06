import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import {
  trialBundlesTable,
  strategyTopicsTable,
  captionsTable,
  clientPresetsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getVoiceSystemPrompt } from "./voicePrompts";
import { logger } from "./logger";

// ─── types ────────────────────────────────────────────────────────────────────

export interface PieceSource {
  topic: string;
  captionUsed: boolean;
}

export interface PickAndMixSources {
  carousel: PieceSource;
  aboutMe: PieceSource;
  reel: PieceSource;
  seamless: PieceSource;
}

interface BundleSlide { heading: string; body?: string; }

interface BundleContent {
  carousel: { slides: BundleSlide[]; caption: string };
  aboutMe: { intro: string; caption: string };
  reel: { script: string; caption: string };
  seamless: { tagline: string; caption: string };
  _sources?: PickAndMixSources;
  _mode?: string;
}

export interface PickAndMixOptions {
  clinicName: string;
  igHandle?: string;
  treatmentFocus: string;
  brandColour?: string;
  voiceStyle?: string;
  presetId?: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function treatmentKeywords(treatmentFocus: string): string[] {
  return treatmentFocus.toLowerCase().split(/[\s,]+/).filter((k) => k.length > 3);
}

function filterByTreatment(topics: string[], treatmentFocus: string): string[] {
  if (!topics.length) return [];
  const kws = treatmentKeywords(treatmentFocus);
  if (!kws.length) return topics;
  const relevant = topics.filter((t) => kws.some((k) => t.toLowerCase().includes(k)));
  return relevant.length > 0 ? relevant : topics;
}

function pickOne<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function shufflePick<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// ─── per-piece AI generation ──────────────────────────────────────────────────

const FORMAT_PROMPTS: Record<string, string> = {
  carousel: `{
  "slides": [
    {"heading": "hook slide (under 10 words, direct and real)", "body": "optional 1-2 sentence expansion"},
    {"heading": "value point 2", "body": "specific fact or insight for this treatment"},
    {"heading": "value point 3", "body": "specific fact or insight"},
    {"heading": "value point 4", "body": "specific fact or insight"},
    {"heading": "cta slide heading", "body": "warm invitation — no urgency, no DM us NOW"}
  ],
  "caption": "80-150 words, 3-5 hashtags before the last line, last line must be: Comment [WORD] for more info"
}`,
  aboutMe: `{
  "intro": "2-3 sentences from the clinic owner's perspective. First person. Warm, real, no patter.",
  "caption": "80-150 words, 3-5 hashtags before the last line, last line must be: Comment [WORD] for more info"
}`,
  reel: `{
  "script": "3-4 short punchy lines for video overlay text. Each line under 8 words. Lines separated by | characters.",
  "caption": "80-150 words, 3-5 hashtags before the last line, last line must be: Comment [WORD] for more info"
}`,
  seamless: `{
  "tagline": "one powerful 3-7 word tagline for a seamless panoramic carousel",
  "caption": "80-150 words, 3-5 hashtags before the last line, last line must be: Comment [WORD] for more info"
}`,
};

async function generatePiece<T>(
  type: "carousel" | "aboutMe" | "reel" | "seamless",
  clinicName: string,
  treatmentFocus: string,
  topic: string,
  savedCaption: string | null,
  voicePrompt: string,
  complianceContext: string,
): Promise<T> {
  const captionHint = savedCaption
    ? `\nCAPTION STYLE REFERENCE (match the tone and hashtag structure, but write a fresh caption for this specific topic):\n"${savedCaption.slice(0, 250)}${savedCaption.length > 250 ? "…" : ""}"\n`
    : "";

  const systemPrompt = `${voicePrompt}

${complianceContext ? `CONTENT CONSTRAINTS:\n${complianceContext}\n` : ""}CLINIC: ${clinicName}
TREATMENT FOCUS: ${treatmentFocus}
CONTENT ANGLE: "${topic}"
${captionHint}
Generate the following as a JSON object (no markdown fences, no extra text):
${FORMAT_PROMPTS[type]}

All content must be MHRA/ASA compliant. No em dashes. Each Comment [WORD] CTA must use a different creative uppercase word relevant to that specific post.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Write the ${type} content for ${clinicName} on the angle: "${topic}". Return only the JSON object.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.error({ raw, type, topic }, "Pick and Mix: failed to parse piece JSON");
    throw new Error(`Failed to parse ${type} piece`);
  }
}

// ─── preset helpers ───────────────────────────────────────────────────────────

async function fetchPreset(presetId?: number) {
  if (!presetId) return null;
  const rows = await db
    .select()
    .from(clientPresetsTable)
    .where(eq(clientPresetsTable.id, presetId))
    .limit(1);
  return rows[0] ?? null;
}

function buildComplianceContext(preset: Record<string, unknown> | null): string {
  if (!preset) return "";
  const lines: string[] = [];
  if (preset.brandNotes) lines.push(`BRAND GUIDELINES: ${preset.brandNotes}`);
  if (preset.contentPillars) lines.push(`CONTENT PILLARS: ${preset.contentPillars}`);
  if (preset.targetAudience) lines.push(`TARGET AUDIENCE: ${preset.targetAudience}`);
  return lines.join("\n");
}

function matchCaption(
  captions: Array<{ text: string; category: string }>,
  treatmentFocus: string,
): string | null {
  if (!captions.length) return null;
  const kws = treatmentKeywords(treatmentFocus);
  const match = captions.find((c) =>
    kws.some(
      (k) => c.category.toLowerCase().includes(k) || c.text.toLowerCase().includes(k),
    ),
  );
  return match?.text ?? pickOne(captions)?.text ?? null;
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function pickAndMixBundle(
  opts: PickAndMixOptions,
): Promise<{ token: string; content: BundleContent; sources: PickAndMixSources }> {
  const { clinicName, igHandle, treatmentFocus, brandColour, voiceStyle, presetId } = opts;

  const [topicsRaw, captionsRaw, preset] = await Promise.all([
    db.select({ topic: strategyTopicsTable.topic }).from(strategyTopicsTable),
    db.select({ text: captionsTable.text, category: captionsTable.category }).from(captionsTable),
    fetchPreset(presetId),
  ]);

  const allTopics = topicsRaw.map((r) => r.topic);
  const allCaptions = captionsRaw;

  const effectiveVoice = voiceStyle || (preset as any)?.voiceStyle || "northern-grit";
  const voicePrompt = getVoiceSystemPrompt(effectiveVoice);
  const complianceContext = buildComplianceContext(preset as Record<string, unknown> | null);

  // Pick 4 distinct topics, favouring treatment-relevant ones
  const relevant = filterByTreatment(allTopics, treatmentFocus);
  const pool = relevant.length >= 4 ? relevant : allTopics;
  const picked = shufflePick(pool.length >= 4 ? pool : allTopics, 4);

  const [carouselTopic, aboutMeTopic, reelTopic, seamlessTopic] = [
    picked[0] ?? treatmentFocus,
    picked[1] ?? treatmentFocus,
    picked[2] ?? treatmentFocus,
    picked[3] ?? treatmentFocus,
  ];

  const savedCaption = matchCaption(allCaptions, treatmentFocus);

  const [carousel, aboutMe, reel, seamless] = await Promise.all([
    generatePiece<{ slides: BundleSlide[]; caption: string }>(
      "carousel", clinicName, treatmentFocus, carouselTopic, savedCaption, voicePrompt, complianceContext,
    ),
    generatePiece<{ intro: string; caption: string }>(
      "aboutMe", clinicName, treatmentFocus, aboutMeTopic, savedCaption, voicePrompt, complianceContext,
    ),
    generatePiece<{ script: string; caption: string }>(
      "reel", clinicName, treatmentFocus, reelTopic, savedCaption, voicePrompt, complianceContext,
    ),
    generatePiece<{ tagline: string; caption: string }>(
      "seamless", clinicName, treatmentFocus, seamlessTopic, savedCaption, voicePrompt, complianceContext,
    ),
  ]);

  const sources: PickAndMixSources = {
    carousel: { topic: carouselTopic, captionUsed: !!savedCaption },
    aboutMe: { topic: aboutMeTopic, captionUsed: !!savedCaption },
    reel: { topic: reelTopic, captionUsed: !!savedCaption },
    seamless: { topic: seamlessTopic, captionUsed: !!savedCaption },
  };

  const content: BundleContent = {
    carousel, aboutMe, reel, seamless,
    _sources: sources,
    _mode: "pick-and-mix",
  };

  const token = randomBytes(20).toString("hex");
  const [bundle] = await db
    .insert(trialBundlesTable)
    .values({
      token,
      clinicName,
      igHandle: igHandle || "",
      treatmentFocus,
      brandColour: brandColour || "#ec4899",
      voiceStyle: effectiveVoice,
      content: content as any,
    })
    .returning();

  logger.info({ clinicName, topics: [carouselTopic, aboutMeTopic, reelTopic, seamlessTopic] }, "Pick and Mix bundle created");

  return { token: bundle.token, content, sources };
}

export async function regenerateBundlePiece(
  token: string,
  piece: "carousel" | "aboutMe" | "reel" | "seamless",
  voiceStyle?: string,
  presetId?: number,
): Promise<{ piece: string; data: unknown; source: PieceSource }> {
  const [bundleRows, topicsRaw, captionsRaw, preset] = await Promise.all([
    db.select().from(trialBundlesTable).where(eq(trialBundlesTable.token, token)).limit(1),
    db.select({ topic: strategyTopicsTable.topic }).from(strategyTopicsTable),
    db.select({ text: captionsTable.text, category: captionsTable.category }).from(captionsTable),
    fetchPreset(presetId),
  ]);

  const bundle = bundleRows[0];
  if (!bundle) throw new Error("Bundle not found");

  const content = bundle.content as BundleContent;
  const allTopics = topicsRaw.map((r) => r.topic);
  const allCaptions = captionsRaw;

  const effectiveVoice = voiceStyle || (preset as any)?.voiceStyle || bundle.voiceStyle || "northern-grit";
  const voicePrompt = getVoiceSystemPrompt(effectiveVoice);
  const complianceContext = buildComplianceContext(preset as Record<string, unknown> | null);

  // Pick a new topic — avoid the previous one
  const prevTopic = content._sources?.[piece]?.topic;
  const relevant = filterByTreatment(allTopics, bundle.treatmentFocus);
  const pool = (relevant.length >= 2 ? relevant : allTopics).filter((t) => t !== prevTopic);
  const newTopic = pickOne(pool.length ? pool : allTopics) ?? bundle.treatmentFocus;

  const savedCaption = matchCaption(allCaptions, bundle.treatmentFocus);

  const pieceData = await generatePiece<unknown>(
    piece,
    bundle.clinicName,
    bundle.treatmentFocus,
    newTopic,
    savedCaption,
    voicePrompt,
    complianceContext,
  );

  const source: PieceSource = { topic: newTopic, captionUsed: !!savedCaption };

  const updatedContent: BundleContent = {
    ...content,
    [piece]: pieceData,
    _sources: {
      ...(content._sources ?? {
        carousel: { topic: "", captionUsed: false },
        aboutMe: { topic: "", captionUsed: false },
        reel: { topic: "", captionUsed: false },
        seamless: { topic: "", captionUsed: false },
      }),
      [piece]: source,
    },
  };

  await db
    .update(trialBundlesTable)
    .set({ content: updatedContent as any })
    .where(eq(trialBundlesTable.token, token));

  logger.info({ token, piece, newTopic }, "Bundle piece regenerated");

  return { piece, data: pieceData, source };
}
