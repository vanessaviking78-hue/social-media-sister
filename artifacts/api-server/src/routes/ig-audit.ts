import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { isNotNull, and, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Vanessa-only tool. Lives on thecybersuite.com/audit behind the admin
// password, never on the client-facing apps side.
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

router.use("/ig-audit", requireAuth);

const GRAPH = "https://graph.facebook.com/v22.0";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Media = {
  id: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  media_type?: string;
  media_product_type?: string;
  timestamp?: string;
  permalink?: string;
};

type Profile = {
  username: string;
  name: string;
  biography: string;
  website: string;
  followers: number;
  following: number;
  mediaCount: number;
  picture: string;
};

type BreakdownItem = { key: string; label: string; score: number; max: number; note: string };
type Flag = { severity: "high" | "medium"; category: string; matched: string; permalink: string | null; snippet: string };

type AuditRow = {
  id: number;
  handle: string;
  display_name: string;
  followers: number;
  score: number;
  tag: string;
  notes: string;
  style: string;
  contact_name: string;
  profile: Profile;
  breakdown: BreakdownItem[];
  metrics: Record<string, any>;
  flags: Flag[];
  posts: any[];
  sales_html: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Instagram fetch (Graph API business discovery)
// ---------------------------------------------------------------------------
async function getCredentials(): Promise<{ igUserId: string; token: string } | null> {
  if (process.env.AUDIT_IG_USER_ID && process.env.AUDIT_IG_TOKEN) {
    return { igUserId: process.env.AUDIT_IG_USER_ID, token: process.env.AUDIT_IG_TOKEN };
  }
  const rows = await db
    .select()
    .from(clientPresetsTable)
    .where(and(isNotNull(clientPresetsTable.metaPageAccessToken), isNotNull(clientPresetsTable.metaInstagramAccountId)));
  const usable = rows.filter((r) => r.metaPageAccessToken && r.metaInstagramAccountId);
  if (!usable.length) return null;
  // Rotate through connected accounts so one token isn't hammered
  const pick = usable[Math.floor(Math.random() * usable.length)];
  return { igUserId: pick.metaInstagramAccountId as string, token: pick.metaPageAccessToken as string };
}

function cleanHandle(input: string): string {
  let h = input.trim();
  const urlMatch = h.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (urlMatch) h = urlMatch[1];
  return h.replace(/^@/, "").replace(/\/$/, "").toLowerCase();
}

async function discover(handle: string, igUserId: string, token: string, withProductType: boolean) {
  const mediaFields = `caption,like_count,comments_count,media_type,${withProductType ? "media_product_type," : ""}timestamp,permalink`;
  const fields = `business_discovery.username(${handle}){username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url,media.limit(50){${mediaFields}}}`;
  const url = `${GRAPH}/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  const r = await fetch(url);
  const data: any = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}

async function fetchViaApify(handle: string, token: string): Promise<{ profile: Profile; media: Media[] }> {
  const url = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=90`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [handle] }),
  });
  const data: any = await r.json().catch(() => null);
  if (!r.ok) {
    logger.warn({ handle, status: r.status, err: data?.error }, "ig-audit: scraper request failed");
    if (r.status === 401 || r.status === 403) {
      throw Object.assign(new Error("The scraper key isn't being accepted. Check APIFY_TOKEN in Railway."), { status: 502 });
    }
    if (r.status === 402) {
      throw Object.assign(new Error("The scraper account is out of credit. Top it up on apify.com and try again."), { status: 502 });
    }
    throw Object.assign(new Error("The scraper had a wobble. Give it a minute and try again."), { status: 502 });
  }
  const item = Array.isArray(data) ? data[0] : null;
  if (!item || item.error || !item.username) {
    throw Object.assign(new Error("I couldn't find that account. Check the handle is spelled exactly right."), { status: 404 });
  }
  if (item.private === true) {
    throw Object.assign(new Error("That account is private, so I can't see the posts."), { status: 404 });
  }
  const profile: Profile = {
    username: item.username || handle,
    name: item.fullName || "",
    biography: item.biography || "",
    website: item.externalUrl || "",
    followers: item.followersCount ?? 0,
    following: item.followsCount ?? 0,
    mediaCount: item.postsCount ?? 0,
    picture: item.profilePicUrl || "",
  };
  const media: Media[] = ((item.latestPosts ?? []) as any[]).map((p) => ({
    id: String(p.id ?? p.shortCode ?? p.url ?? Math.random()),
    caption: p.caption || "",
    like_count: typeof p.likesCount === "number" && p.likesCount >= 0 ? p.likesCount : undefined,
    comments_count: typeof p.commentsCount === "number" && p.commentsCount >= 0 ? p.commentsCount : 0,
    media_type: p.type === "Sidecar" ? "CAROUSEL_ALBUM" : p.type === "Video" ? "VIDEO" : "IMAGE",
    media_product_type: p.type === "Video" ? "REELS" : undefined,
    timestamp: p.timestamp,
    permalink: p.url,
  }));
  return { profile, media };
}

async function fetchInstagram(handle: string): Promise<{ profile: Profile; media: Media[] }> {
  // Preferred route: a scraper service, because Meta has not approved this app to read other public accounts
  if (process.env.APIFY_TOKEN) return fetchViaApify(handle, process.env.APIFY_TOKEN);
  const creds = await getCredentials();
  if (!creds) {
    throw Object.assign(new Error("No connected Instagram account to run the audit through. Connect a client account first."), { status: 400 });
  }
  let result = await discover(handle, creds.igUserId, creds.token, true);
  if (!result.ok && /media_product_type/i.test(JSON.stringify(result.data?.error || {}))) {
    result = await discover(handle, creds.igUserId, creds.token, false);
  }
  if (!result.ok || !result.data?.business_discovery) {
    const err = result.data?.error;
    logger.warn({ handle, err }, "ig-audit: business discovery failed");
    const code = err?.code;
    if (code === 4 || code === 17 || code === 32 || code === 613) {
      throw Object.assign(new Error("Instagram is rate limiting the audit tool. Give it ten minutes and try again."), { status: 429 });
    }
    if (code === 190) {
      throw Object.assign(new Error("The connected Instagram token has expired. Reconnect a client account in Settings and try again."), { status: 502 });
    }
    if (code === 10 || code === 200) {
      throw Object.assign(new Error("Meta has not approved this app to read other public Instagram accounts yet. Add APIFY_TOKEN in Railway to use the scraper route instead."), { status: 502 });
    }
    throw Object.assign(
      new Error("I couldn't read that account. It needs to be a public Business or Creator account and the handle spelled exactly right. Personal accounts can't be audited this way."),
      { status: 404 }
    );
  }
  const bd = result.data.business_discovery;
  const profile: Profile = {
    username: bd.username || handle,
    name: bd.name || "",
    biography: bd.biography || "",
    website: bd.website || "",
    followers: bd.followers_count ?? 0,
    following: bd.follows_count ?? 0,
    mediaCount: bd.media_count ?? 0,
    picture: bd.profile_picture_url || "",
  };
  const media: Media[] = (bd.media?.data ?? []) as Media[];
  return { profile, media };
}

// ---------------------------------------------------------------------------
// Compliance scan (captions only, indicative not legal advice)
// ---------------------------------------------------------------------------
const POM_TERMS = [
  "botox", "dysport", "azzalure", "bocouture", "xeomin", "vistabel", "nuceiva", "letybo", "botulinum",
  "ozempic", "wegovy", "mounjaro", "saxenda", "semaglutide", "tirzepatide", "liraglutide",
];
const OFFER_WORDS = /(£\s?\d|\d+\s?%\s?off|\boffer\b|\bdiscount\b|\bdeal\b|\bspecial price\b|\bfrom £|\bonly £|\bper unit\b|\bper area\b|\bbook now\b|\bpackage\b)/i;

const CLAIM_RULES: { re: RegExp; category: string; severity: "high" | "medium" }[] = [
  { re: /\bguarantee[ds]?\b/i, category: "Guaranteed results", severity: "high" },
  { re: /\b(cure[sd]?|miracle|permanent(ly)?)\b/i, category: "Overclaim (cure, miracle or permanent)", severity: "high" },
  { re: /\b(100%|completely|totally)\s+(safe|painless|risk[- ]free)\b/i, category: "Safety or pain claim", severity: "high" },
  { re: /\b(painless|risk[- ]free|no (risk|side effects?))\b/i, category: "Safety or pain claim", severity: "high" },
  { re: /\bsafe\b/i, category: "The word 'safe' used as a claim", severity: "medium" },
  { re: /\banti[- ]?wrinkle\b/i, category: "Efficacy claim ('anti-wrinkle')", severity: "medium" },
  { re: /\b(best|no\.? ?1|number one|#1|leading|top[- ]rated|award[- ]winning)\b/i, category: "Superlative", severity: "medium" },
  { re: /\b(no downtime|instant results?|overnight results?)\b/i, category: "Results or downtime claim", severity: "medium" },
];

function scanCompliance(media: Media[]): Flag[] {
  const flags: Flag[] = [];
  for (const m of media) {
    const cap = (m.caption || "").trim();
    if (!cap) continue;
    const lower = cap.toLowerCase();
    const snippet = cap.replace(/\s+/g, " ").slice(0, 140);
    const permalink = m.permalink || null;

    const pom = POM_TERMS.find((t) => new RegExp(`\\b${t}\\b`, "i").test(lower));
    if (pom) {
      const promo = OFFER_WORDS.test(cap);
      flags.push({
        severity: promo ? "high" : "medium",
        category: promo ? "Prescription-only medicine named alongside an offer" : "Prescription-only medicine named",
        matched: pom,
        permalink,
        snippet,
      });
    }
    for (const rule of CLAIM_RULES) {
      const hit = cap.match(rule.re);
      if (hit) {
        flags.push({ severity: rule.severity, category: rule.category, matched: hit[0], permalink, snippet });
      }
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

function formatOf(m: Media): "reel" | "carousel" | "image" | "video" | "other" {
  if (m.media_product_type === "REELS") return "reel";
  if (m.media_type === "CAROUSEL_ALBUM") return "carousel";
  if (m.media_type === "VIDEO") return m.media_product_type ? "video" : "reel";
  if (m.media_type === "IMAGE") return "image";
  return "other";
}

function analyse(profile: Profile, media: Media[]) {
  const now = Date.now();
  const DAY = 86400000;
  const dated = media.filter((m) => m.timestamp).map((m) => ({ ...m, t: new Date(m.timestamp as string).getTime() })).sort((a, b) => b.t - a.t);

  // Consistency
  const recent = dated.filter((m) => now - m.t <= 60 * DAY);
  const spanDays = dated.length > 1 ? Math.max(1, (dated[0].t - dated[dated.length - 1].t) / DAY) : 0;
  // Scraped samples only hold the latest handful of posts, so measure frequency across the span they cover
  const perWeek = dated.length > 0 && dated.length <= 15 && spanDays > 0 ? ((dated.length - 1) / spanDays) * 7 : recent.length / (60 / 7);
  const daysSinceLast = dated.length ? Math.floor((now - dated[0].t) / DAY) : null;
  let longestGap = 0;
  for (let i = 0; i < dated.length - 1; i++) longestGap = Math.max(longestGap, Math.floor((dated[i].t - dated[i + 1].t) / DAY));

  let consistencyRatio = perWeek >= 3 ? 1 : perWeek >= 2 ? 0.85 : perWeek >= 1 ? 0.6 : perWeek >= 0.5 ? 0.3 : 0.1;
  if (daysSinceLast !== null && daysSinceLast > 21) consistencyRatio *= 0.5;
  else if (daysSinceLast !== null && daysSinceLast > 10) consistencyRatio *= 0.8;
  if (longestGap > 21) consistencyRatio *= 0.9;

  // Engagement
  const withLikes = dated.filter((m) => typeof m.like_count === "number");
  const engagementOf = (m: Media) => (m.like_count ?? 0) + (m.comments_count ?? 0);
  const likesHidden = withLikes.length === 0;
  const basis = likesHidden ? dated : withLikes;
  const avgEng = basis.length ? basis.reduce((s, m) => s + engagementOf(m), 0) / basis.length : 0;
  const avgComments = dated.length ? dated.reduce((s, m) => s + (m.comments_count ?? 0), 0) / dated.length : 0;
  const er = profile.followers > 0 ? (avgEng / profile.followers) * 100 : 0;
  const erRatio = likesHidden
    ? 0.5
    : er >= 4 ? 1 : er >= 3 ? 0.85 : er >= 2 ? 0.65 : er >= 1 ? 0.4 : er >= 0.5 ? 0.2 : 0.05;

  // Format mix
  const fmt: Record<string, { count: number; eng: number }> = {};
  for (const m of dated) {
    const f = formatOf(m);
    fmt[f] ||= { count: 0, eng: 0 };
    fmt[f].count += 1;
    fmt[f].eng += engagementOf(m);
  }
  const total = dated.length || 1;
  const reelShare = (fmt.reel?.count ?? 0) / total;
  const carouselShare = (fmt.carousel?.count ?? 0) / total;
  const formatsUsed = Object.keys(fmt).length;
  const mixRatio = 0.4 * clamp01(reelShare / 0.2) + 0.4 * clamp01(carouselShare / 0.2) + 0.2 * (formatsUsed >= 3 ? 1 : formatsUsed === 2 ? 0.5 : 0);

  const formatStats = Object.entries(fmt).map(([format, v]) => ({
    format,
    count: v.count,
    avgEngagement: round1(v.eng / v.count),
    engagementRate: profile.followers > 0 ? round1((v.eng / v.count / profile.followers) * 100) : 0,
  })).sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Captions
  const caps = dated.map((m) => m.caption || "");
  const avgWords = caps.length ? caps.reduce((s, c) => s + wordCount(c), 0) / caps.length : 0;
  const wordsRatio = avgWords >= 25 && avgWords <= 120 ? 1 : avgWords > 120 && avgWords <= 200 ? 0.7 : avgWords >= 10 ? 0.6 : 0.2;
  const ctaRe = /\?|\b(book|dm|message|comment|tap|link in bio|save|share|tag|call|enquire|ask|let me know|tell me)\b/i;
  const ctaShare = caps.length ? caps.filter((c) => ctaRe.test(c)).length / caps.length : 0;
  const avgHashtags = caps.length ? caps.reduce((s, c) => s + (c.match(/#\w+/g)?.length ?? 0), 0) / caps.length : 0;
  const hashRatio = avgHashtags >= 2 && avgHashtags <= 10 ? 1 : 0.5;
  const captionRatio = 0.4 * wordsRatio + 0.4 * clamp01(ctaShare / 0.6) + 0.2 * hashRatio;

  // Profile
  const bio = profile.biography || "";
  const bioCta = /\b(book|dm|message|call|email|enquire|link|whatsapp|consult)/i.test(bio);
  const profilePoints = (bio ? 5 : 0) + (bio.length >= 60 ? 3 : 0) + (bioCta ? 4 : 0) + (profile.website ? 3 : 0);

  // Compliance
  const flags = scanCompliance(dated);
  const high = new Set(flags.filter((f) => f.severity === "high").map((f) => f.permalink + f.category)).size;
  const med = new Set(flags.filter((f) => f.severity === "medium").map((f) => f.permalink + f.category)).size;
  const compRatio = clamp01(1 - (high * 0.2 + med * 0.07));

  // Best day / time (UK time)
  const dayBuckets: Record<string, { n: number; eng: number }> = {};
  for (const m of dated) {
    const day = new Date(m.t).toLocaleDateString("en-GB", { weekday: "long", timeZone: "Europe/London" });
    dayBuckets[day] ||= { n: 0, eng: 0 };
    dayBuckets[day].n += 1;
    dayBuckets[day].eng += engagementOf(m);
  }
  const days = Object.entries(dayBuckets).filter(([, v]) => v.n >= 3).map(([day, v]) => ({ day, posts: v.n, avgEngagement: round1(v.eng / v.n) })).sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Top and bottom posts
  const ranked = [...basis].sort((a, b) => engagementOf(b) - engagementOf(a));
  const toPost = (m: any) => ({
    permalink: m.permalink || null,
    format: formatOf(m),
    likes: m.like_count ?? null,
    comments: m.comments_count ?? 0,
    date: m.timestamp || null,
    caption: (m.caption || "").replace(/\s+/g, " ").slice(0, 120),
  });
  const topPosts = ranked.slice(0, 3).map(toPost);
  const bottomPosts = ranked.length > 6 ? ranked.slice(-3).reverse().map(toPost) : [];

  const breakdown: BreakdownItem[] = [
    {
      key: "profile", label: "Profile set up", max: 15, score: profilePoints,
      note: profilePoints >= 12 ? "Bio, contact route and link are all doing their job."
        : `${!bio ? "No bio. " : ""}${bio && !bioCta ? "Bio has no clear way to book or get in touch. " : ""}${!profile.website ? "No link on the profile. " : ""}`.trim() || "Bio could be tighter.",
    },
    {
      key: "consistency", label: "Posting consistency", max: 20, score: round1(consistencyRatio * 20),
      note: `${round1(perWeek)} posts a week${daysSinceLast !== null ? `, last post ${daysSinceLast} day${daysSinceLast === 1 ? "" : "s"} ago` : ""}${longestGap > 21 ? `, longest gap ${longestGap} days` : ""}.`,
    },
    {
      key: "engagement", label: "Engagement", max: 25, score: round1(erRatio * 25),
      note: likesHidden
        ? "Likes are hidden so this is a neutral score. Comments only."
        : `${round1(er)}% average engagement rate (${round1(avgEng)} likes and comments per post on ${profile.followers.toLocaleString("en-GB")} followers).`,
    },
    {
      key: "mix", label: "Content mix", max: 15, score: round1(mixRatio * 15),
      note: `${Math.round(reelShare * 100)}% reels, ${Math.round(carouselShare * 100)}% carousels, ${formatsUsed} format${formatsUsed === 1 ? "" : "s"} in use.`,
    },
    {
      key: "captions", label: "Captions", max: 15, score: round1(captionRatio * 15),
      note: `Average ${Math.round(avgWords)} words, ${Math.round(ctaShare * 100)}% ask people to do something, ${round1(avgHashtags)} hashtags a post.`,
    },
    {
      key: "compliance", label: "Compliance", max: 10, score: round1(compRatio * 10),
      note: flags.length ? `${high} high and ${med} medium wording flags across the last ${dated.length} posts.` : "Nothing obvious flagged in the captions.",
    },
  ];
  const score = Math.round(breakdown.reduce((s, b) => s + b.score, 0));

  const metrics = {
    postsAnalysed: dated.length,
    postsPerWeek: round1(perWeek),
    daysSinceLastPost: daysSinceLast,
    longestGapDays: longestGap,
    engagementRate: round1(er),
    avgEngagementPerPost: round1(avgEng),
    avgComments: round1(avgComments),
    likesHidden,
    avgCaptionWords: Math.round(avgWords),
    ctaShare: Math.round(ctaShare * 100),
    avgHashtags: round1(avgHashtags),
    reelShare: Math.round(reelShare * 100),
    carouselShare: Math.round(carouselShare * 100),
    formatStats,
    bestDays: days.slice(0, 2),
    topPosts,
    bottomPosts,
  };

  return { score, breakdown, metrics, flags: flags.slice(0, 40) };
}

// ---------------------------------------------------------------------------
// Sales write-up (prospect facing)
// ---------------------------------------------------------------------------
const STYLE_DIRECTIVES: Record<string, string> = {
  northern: "Northern grit Vanessa style. Write like a no-nonsense northern woman, direct, warm, working class honest. Plain words. Real talk. Like talking to your best mate over a brew. Short punchy sentences mixed with the odd longer one.",
  springsteen: "Storytelling in the manner of a great American storyteller, but written in British English: whimsical, small scenes, a shop window at closing time, a Friday night, someone doing their best against the odds. Warm and a little romantic about ordinary people. Never mention songs, lyrics, albums or the man's name.",
  dawn: "Dawn French style: funny, blunt, self-deprecating, warm, gloriously cheeky. Say the awkward thing out loud and make them laugh while you do it.",
  professional: "Professional but with personality. Polished and credible, still warm and human, with the odd wry aside. No jargon.",
  feral: "Feral, savage, sarcastic. Dry, cutting humour aimed at the situation (the algorithm, the state of the industry, the scheduling chaos), never at the person. Still leaves them feeling seen and wanting to reply.",
};

const COMPLIANCE_AND_WRITING_RULES = `
COMPLIANCE (non-negotiable)
- NEVER name Botox or any prescription-only medicine, by brand or generic name. NEVER say "anti-wrinkle" or "anti-wrinkle injections" either, that's an efficacy claim in its own right. Say "facial aesthetics", "injectable treatments", "facial rejuvenation" instead.
- If a client's own existing caption is being referenced back to them as an example of what's already on their page, "anti-wrinkle" can only be quoted to flag it as something to fix, never used approvingly or repeated as if it's fine.
- Never use the word "safe" as a marketing claim. No medical claims, no guaranteed results. No superlatives (best, number one, guaranteed).

WRITING RULES (non-negotiable)
- Write in the FIRST PERSON as Vanessa ("I", "my"), speaking straight to the clinic owner as "you".
- NEVER use em dashes or en dashes. Use a comma, a full stop, or a plain hyphen inside compound words only.
- British English throughout: colour, specialise, favour, practitioner, programme. Never Americanised spellings.
- Never use the word "fluff", "genuinely", "honestly" or "straightforward".
- BANNED words and phrases: elevate, transform, unlock, journey, empower, revolutionise, game-changer, dive into, harness, leverage, delve, navigate, streamline, cutting-edge, holistic, synergy, bespoke, unleash, tapestry, landscape, realm, testament, boasts, nestled, seamless, effortless, next level, top-tier, "not fuss not fluff", "most clinics don't have a content problem", "at the end of the day", "when it comes to", "look no further", "say goodbye to", "make no mistake".
- BANNED openers: "Are you tired of", "It's time to", "What if we told you", "Picture this", "Imagine a world", "In today's world".
- It must not read like AI. Say the thing plainly the way a real person would say it face to face. If a sentence sounds like a chatbot, cut it and say it straight.
- Never mention any software, app, platform or tool of mine by name. Never mention the Graph API or how the numbers were gathered.
- Consumer psychology of women over 35: warm, validating, a bit of humour, never shaming, never make them feel behind. No boring medical education.`;

async function writeSales(row: { profile: Profile; score: number; breakdown: BreakdownItem[]; metrics: Record<string, any>; flags: Flag[] }, style: string, contactName: string, tag: string): Promise<string> {
  const directive = STYLE_DIRECTIVES[style] || STYLE_DIRECTIVES.northern;
  const isClient = tag === "client";
  const ranked = [...row.breakdown].sort((a, b) => b.score / b.max - a.score / a.max);
  const strengths = ranked.slice(0, isClient ? 4 : 2).map((b) => `${b.label}: ${b.note}`);
  const gaps = ranked.slice(-3).reverse().map((b) => `${b.label}: ${b.note}`);
  const flagCategories = [...new Set(row.flags.map((f) => f.category))];
  const best = row.metrics.formatStats?.[0];
  // Clients get a warmer, rounder headline number for the write-up itself (their real score
  // is untouched in the database and in her own insights). The lower the real score, the
  // bigger the lift, but it never claims a perfect 100.
  const clientDisplayScore = isClient ? Math.min(96, Math.round(row.score + (100 - row.score) * 0.5)) : row.score;

  const data = {
    clinicName: row.profile.name || row.profile.username,
    handle: `@${row.profile.username}`,
    contactFirstName: contactName || null,
    followers: row.profile.followers,
    scoreOutOf100: clientDisplayScore,
    workingWell: strengths,
    biggestGaps: gaps,
    bestPerformingFormat: best ? `${best.format} (about ${best.avgEngagement} likes and comments a post)` : null,
    postsPerWeek: row.metrics.postsPerWeek,
    reelSharePercent: row.metrics.reelShare,
    wordingFlags: flagCategories,
  };

  const clientContentRules = `
CONTENT RULES
- Only use the facts in the data given. Never invent a post, a treatment, a review or a number.
- This is one of my own clients, not a cold prospect, so this is a warm check in on how their page is doing, not a pitch.
- Open warmly and personally, using ${contactName ? "their first name" : "the clinic name"}.
- Mention the score once, as "X out of 100", and frame it kindly and positively whatever the number is.
- The whole tone is complimentary and encouraging, like their strategist popping up to say the page is looking good. Genuinely celebrate what's working, using specifics from the data, not generic praise.
- Section "What's working": 3 to 4 specific, genuine compliments drawn from the data.
- Section "A couple of ideas": exactly 2 small, low-pressure suggestions, framed as fun extras to try, never as problems, gaps or things missing. One of the two is always about doing more Reels (use reelSharePercent if it helps make the point, but never sound like a telling off), the other is whichever single idea genuinely stands out from the rest of the data (posting rhythm, captions, hashtags, bio or link, replying to comments), picked fresh from what's actually there.
- If wordingFlags is not empty, fold one gentle mention into the ideas section, framed as "one to keep an eye on" rather than a compliance telling off. Refer to it generally, never repeat a drug name.
- Close warmly, inviting them to have a chat about it next time we're in touch. No hard sell and no "book a call", just a warm sign off as their strategist who has their back.
- Around 200 to 300 words in total.`;

  const prospectContentRules = `
CONTENT RULES
- Only use the facts in the data given. Never invent a post, a treatment, a review or a number.
- Open warmly and personally, using ${contactName ? "their first name" : "the clinic name"}.
- Mention the score once, as "X out of 100", framed kindly.
- Section "What's already working": 2 short specific wins, genuinely encouraging.
- Section "Where I'd start": the 3 biggest gaps as easy, doable wins. Make each feel fixable this week. Never a telling off.
- If wordingFlags is not empty, add a short, gentle "Worth a tidy" paragraph saying a few captions use wording the ASA and CAP Code tend to look at, and that it's an easy fix. Refer to it generally. Never repeat a drug name.
- Close with a strong stealth-sales call to action: warm, low-pressure and specific, an offer to have a proper look through their page together and map out their next 30 days of content, asking them to reply or send a message to book it in. It must feel like a friend's invitation, not a pitch. Keep it short.
- Around 250 to 350 words in total.`;

  const instructions = `You are Vanessa Wormald, a UK social media strategist for the medical and aesthetics sector. You have 7 years in aesthetics, 20 in social media marketing, and have managed hundreds of clinics. You are known for a real, honest approach and for helping clinics show their true personality online. You are writing a short, friendly mini page audit${isClient ? " for one of your own existing clients" : " that you are sending directly to a clinic owner you'd love to work with"}.

VOICE FOR THIS ONE: ${directive}
${isClient ? clientContentRules : prospectContentRules}
${COMPLIANCE_AND_WRITING_RULES}

OUTPUT: clean semantic HTML only (h2, p, strong, ul, li). No inline styles, no html/head/body wrapper, no markdown, no code fences, no preamble.`;

  const response = await openai.responses.create({
    model: "gpt-5.5",
    reasoning: { effort: "low" },
    instructions,
    input: `Data for this audit:\n${JSON.stringify(data, null, 2)}\n\nWrite the mini audit now.`,
    max_output_tokens: 2500,
  });

  let html = (response.output_text ?? "").trim();
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/i, "").trim();
  // Belt and braces: the no em dash rule
  html = html.replace(/\s*[—–]\s*/g, ", ");
  return html;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
const rowsOf = (r: unknown) => ((r as { rows?: any[] }).rows ?? []) as any[];

const LIST_COLS = sql`id, handle, display_name, followers, score, tag, created_at`;
const FULL_COLS = sql`id, handle, display_name, followers, score, tag, notes, style, contact_name, profile, breakdown, metrics, flags, posts, sales_html, created_at`;

// GET /api/ig-audit  -> history list
router.get("/ig-audit", async (_req, res) => {
  try {
    const result = await db.execute(sql`SELECT ${LIST_COLS} FROM ig_audits ORDER BY created_at DESC LIMIT 300`);
    res.json({ audits: rowsOf(result) });
  } catch (err) {
    logger.error({ err }, "Failed to list ig audits");
    res.status(500).json({ error: "Failed to load audits" });
  }
});

// GET /api/ig-audit/insights -> what's working and what isn't across every audit saved
router.get("/ig-audit/insights", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (handle) handle, score, breakdown, metrics, created_at
      FROM ig_audits ORDER BY handle, created_at DESC
    `);
    const latest = rowsOf(result);
    if (!latest.length) return res.json({ accounts: 0 });

    const avg = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
    const catTotals: Record<string, { label: string; ratio: number[] }> = {};
    const formatTotals: Record<string, number[]> = {};
    for (const a of latest) {
      for (const b of a.breakdown as BreakdownItem[]) {
        catTotals[b.key] ||= { label: b.label, ratio: [] };
        catTotals[b.key].ratio.push(b.score / b.max);
      }
      for (const f of (a.metrics?.formatStats ?? []) as any[]) {
        formatTotals[f.format] ||= [];
        formatTotals[f.format].push(f.engagementRate);
      }
    }
    const categories = Object.entries(catTotals)
      .map(([key, v]) => ({ key, label: v.label, avgPercent: Math.round(avg(v.ratio) * 100) }))
      .sort((a, b) => a.avgPercent - b.avgPercent);
    const formats = Object.entries(formatTotals)
      .map(([format, xs]) => ({ format, accounts: xs.length, avgEngagementRate: avg(xs) }))
      .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);

    res.json({
      accounts: latest.length,
      avgScore: Math.round(avg(latest.map((a) => a.score))),
      avgEngagementRate: avg(latest.map((a) => a.metrics?.engagementRate ?? 0)),
      avgPostsPerWeek: avg(latest.map((a) => a.metrics?.postsPerWeek ?? 0)),
      weakestAreas: categories.slice(0, 3),
      strongestAreas: [...categories].reverse().slice(0, 3),
      formats,
    });
  } catch (err) {
    logger.error({ err }, "Failed to build ig audit insights");
    res.status(500).json({ error: "Failed to build insights" });
  }
});

// GET /api/ig-audit/:id
router.get("/ig-audit/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    const result = await db.execute(sql`SELECT ${FULL_COLS} FROM ig_audits WHERE id = ${id}`);
    const row = rowsOf(result)[0];
    if (!row) return res.status(404).json({ error: "Audit not found" });
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Failed to fetch ig audit");
    res.status(500).json({ error: "Failed to load audit" });
  }
});

// PATCH /api/ig-audit/:id { tag?, notes? }
router.patch("/ig-audit/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    const tag = req.body?.tag !== undefined ? String(req.body.tag).slice(0, 30) : null;
    const notes = req.body?.notes !== undefined ? String(req.body.notes).slice(0, 5000) : null;
    await db.execute(sql`
      UPDATE ig_audits SET tag = COALESCE(${tag}, tag), notes = COALESCE(${notes}, notes) WHERE id = ${id}
    `);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to update ig audit");
    res.status(500).json({ error: "Failed to update audit" });
  }
});

// DELETE /api/ig-audit/:id
router.delete("/ig-audit/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    await db.execute(sql`DELETE FROM ig_audits WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete ig audit");
    res.status(500).json({ error: "Failed to delete audit" });
  }
});

// POST /api/ig-audit/run { handle, style?, contactName?, tag? }
router.post("/ig-audit/run", async (req, res) => {
  try {
    const handle = cleanHandle(String(req.body?.handle || ""));
    const style = String(req.body?.style || "northern");
    const contactName = String(req.body?.contactName || "").trim().slice(0, 60);
    const tag = ["prospect", "client", "won", "lost"].includes(req.body?.tag) ? req.body.tag : "prospect";

    if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
      return res.status(400).json({ error: "That doesn't look like an Instagram handle. Try it without spaces, like clinicname_aesthetics." });
    }

    const { profile, media } = await fetchInstagram(handle);
    const { score, breakdown, metrics, flags } = analyse(profile, media);

    let salesHtml = "";
    try {
      salesHtml = await writeSales({ profile, score, breakdown, metrics, flags }, style, contactName, tag);
    } catch (err) {
      logger.error({ err, handle }, "ig-audit: sales write-up failed, saving audit without it");
    }

    const posts = metrics.topPosts; // kept small on purpose, full set not stored
    const insert = await db.execute(sql`
      INSERT INTO ig_audits (handle, display_name, followers, score, tag, style, contact_name, profile, breakdown, metrics, flags, posts, sales_html)
      VALUES (
        ${profile.username}, ${profile.name}, ${profile.followers}, ${score}, ${tag}, ${style}, ${contactName},
        ${JSON.stringify(profile)}::jsonb, ${JSON.stringify(breakdown)}::jsonb, ${JSON.stringify(metrics)}::jsonb,
        ${JSON.stringify(flags)}::jsonb, ${JSON.stringify(posts)}::jsonb, ${salesHtml}
      )
      RETURNING ${FULL_COLS}
    `);
    res.json({ ...rowsOf(insert)[0], salesFailed: !salesHtml });
  } catch (err: any) {
    const status = err?.status || 500;
    if (status === 500) logger.error({ err }, "Failed to run ig audit");
    res.status(status).json({ error: err?.message || "Audit failed" });
  }
});

// POST /api/ig-audit/:id/sales { style, contactName? } -> rewrite the prospect write-up in another style
router.post("/ig-audit/:id/sales", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid id" });
    const style = String(req.body?.style || "northern");
    const contactName = String(req.body?.contactName ?? "").trim().slice(0, 60);
    const result = await db.execute(sql`SELECT ${FULL_COLS} FROM ig_audits WHERE id = ${id}`);
    const row = rowsOf(result)[0] as AuditRow | undefined;
    if (!row) return res.status(404).json({ error: "Audit not found" });
    const tag = ["prospect", "client", "won", "lost"].includes(req.body?.tag) ? req.body.tag : row.tag;

    const html = await writeSales(
      { profile: row.profile, score: row.score, breakdown: row.breakdown, metrics: row.metrics, flags: row.flags },
      style,
      contactName || row.contact_name,
      tag
    );
    if (!html) return res.status(502).json({ error: "The write up didn't come back properly, try again" });
    await db.execute(sql`UPDATE ig_audits SET sales_html = ${html}, style = ${style}, contact_name = ${contactName || row.contact_name}, tag = ${tag} WHERE id = ${id}`);
    res.json({ sales_html: html, style, tag });
  } catch (err) {
    logger.error({ err }, "Failed to rewrite ig audit sales copy");
    res.status(500).json({ error: "Failed to rewrite" });
  }
});

export default router;
