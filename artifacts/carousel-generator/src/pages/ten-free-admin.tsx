import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { postTypesFor } from "@/lib/universal-treatments";
import { TEN_PLAN, PREMIUM_PLAN, RELATABLE_IDS, relatableFor, GATECRASHER_PRESET, pickTreatments, pickFact, monthNameUK, PREMIUM_TREATMENTS, PREMIUM_HOOKS, PREMIUM_ABOUT, clubPlan } from "@/lib/tenfree-content";
import { buildAssets, renderStory, renderUniversalPost, loadPlayfair } from "@/lib/tenfree-engine";
import { hashSeed } from "@/lib/pack-plan";
import { U_GROUPS, U_TREATMENTS } from "@/lib/universal-treatments";
import { PREMIUM_FONTS } from "@/lib/tenfree-fonts";
import { injectSuiteFontCss } from "@/lib/suite-fonts";
import { renderAboutPost, aboutDefaults, aboutMovable, ABOUT_LAYOUTS, ABOUT_FONTS, ABOUT_DEFAULT_FONTS, type AboutRenderOptions, type AboutLayout } from "@/lib/about-designs";
import { ColourPicker } from "@/components/colour-picker";
import { CoverPanel } from "@/components/cover-panel";
import { renderCoverPost, coverInfo, type CoverOptions } from "@/lib/cover-designs";
import { HOOKS as HOOK_BANK, pickedHookPayload, hookFits, type Hook } from "@/lib/hook-bank";
import { pickReels } from "@/lib/tenfree-reels";
import { UNIQUE } from "@/lib/unique-designs";
import { EMPOWER } from "@/lib/empower-designs";
import { decor } from "@/lib/empower-kit";
import { applyCopy, skeleton, type CopyResult } from "@/lib/pack-build";
import { renderPackPost, renderPackSlide, packFonts, slidesOf, type PackClient, type PackPost } from "@/lib/pack-engine";
import { DEFAULT_FOCUS, type PoolPhoto } from "@/lib/month-engine";
import { brandPalette, loadImage, textLogo } from "@/lib/sample-post";
import { makeClearLogo } from "@/lib/logo-clear";
import { loadBitmap } from "@/pages/universal";
import { canvasToPng } from "@/lib/logo-clear";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};

type Req = {
  id: string; email: string; status: string; clinicName: string; clinicianName: string; handle: string; area: string; website: string; whatsapp: string;
  mainHex: string; accentHex: string; treatments: string[]; seq?: number; answers: { bizType?: string; age?: string; hobbies: string; mum: string; pets: string; why: string; threeWords: string; personality?: string; font?: string; passion: string };
  logoUrl: string; photoUrl: string; notes: string; slug: string; code: string; createdAt: string; aiUrls: string[]; aiStatus: string; kind?: string; photos?: string[]; presetId?: number | null;
};
type Poll = { question: string; a: string; b: string };

const siteLink = (slug: string) => `${window.location.origin}${BASE}/10free/${slug}`;

function List() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const r = await fetch(`${API}/ten-free/requests`, { headers: authHeaders() });
    const j = await r.json().catch(() => ({}));
    setRows(j.requests ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const patch = async (id: string, status: string) => {
    await fetch(`${API}/ten-free/requests/${id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ status }) });
    load();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this request for good?")) return;
    await fetch(`${API}/ten-free/requests/${id}`, { method: "DELETE", headers: authHeaders() });
    load();
  };
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Free posts: requests</h1><Link href="/10free-tracker" className="text-sm underline">Tracker of the ones done</Link></div>
      <p className="text-sm text-muted-foreground">Premium form: {window.location.origin}{BASE}/premiumfreebies</p>
      {loading && <p>Loading...</p>}
      {!loading && rows.length === 0 && <p>No requests yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="border rounded-lg p-4 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="font-semibold">{r.clinicName} <span className="text-xs uppercase text-pink-500">{r.status}</span>{r.kind === "premium" && <span className="ml-2 text-xs uppercase bg-black text-white rounded px-2 py-0.5">Premium</span>}</div>
            <div className="text-sm text-muted-foreground">{r.clinicianName} · {r.email} · {r.area}</div>
          </div>
          <div className="flex gap-2 text-sm">
            <Link href={`/10free-admin?id=${r.id}`} className="px-3 py-1 rounded bg-pink-500 text-white">{r.status === "published" ? "Open" : "Build"}</Link>
            {r.status === "new" && <button className="px-3 py-1 rounded border" onClick={() => patch(r.id, "declined")}>Decline</button>}
            {r.status === "declined" && <button className="px-3 py-1 rounded border" onClick={() => patch(r.id, "new")}>Reopen</button>}
            <button className="px-3 py-1 rounded border" onClick={() => del(r.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

type Item = {
  n: number; label: string; source: "universal" | "pack"; carousel: boolean;
  post?: PackPost; uni?: HTMLCanvasElement[]; uniArgs?: { treatmentId: string; headline: string; copy: { subtitle: string; slides: any; cta: string }; photos: ImageBitmap[]; offset: number; angle: number; shift: number[]; blockY?: number; variant?: number; textColour?: string; coverY?: number; coverScale?: number; blockScale?: number; gradOpacity?: number; gradColour?: string; bgColour?: string; block?: string; noHead?: boolean; box?: { fill: string; text?: string; x: number; y: number; w?: number }; zoom?: number[]; panX?: number[]; panY?: number[]; custom?: (ImageBitmap | null)[] }; caption: string; tags: string; previews: string[];
  poll: Poll & { instruction: string }; libUrls?: string[];
  aboutArgs?: AboutRenderOptions;
  aboutLogo?: HTMLCanvasElement;
  coverArgs?: CoverOptions;
};

// The Month tool's hook sections, in the same order as the clinic pages.
const HOOK_SECTIONS = ["Treatment", "Emotional", "Personal", "Nostalgia", "Engagement", "Audience", "Seasonal", "Original"];
const HOOK_SECTION_LABEL: Record<string, string> = { Original: "My first hooks" };

const voiceFor = (personality?: string) => `VOICE FOR THIS POST: ${personality?.trim() ? `her own words for her personality are "${personality.trim()}". Write exactly like that person: if it says northern grit, plain talking, dry and warm with a bit of bite; super professional, polished and assured with the odd dry line; professional with personality, expert first with a wink; cute and girly, giggly and sweet with a sparkle; sassy and feral, loud, savage and funny.` : "professional with a cheeky streak. She knows her stuff and says it with a raised eyebrow."} Write like a clever friend who happens to be the expert. Every slide should have one line a reader would screenshot or send to a friend, an unexpected comparison, a wry aside or a blunt truth. Short sentences, everyday words, no stock phrases and nothing that could sit on any clinic's page. No emojis, no dashes, no tea or biscuit jokes, no 'not X but Y' phrasing, no medical lecture.`;
const UNI_FONTS = PREMIUM_FONTS.map((f) => ({ id: f.id, label: f.name }));

const HEAD_FONTS = [
  { id: "instrument", label: "Instrument Serif", css: "'Instrument Serif', serif" },
  { id: "playfair", label: "Playfair Display", css: "'Playfair Display', serif" },
  { id: "spartan", label: "League Spartan", css: "'League Spartan', sans-serif" },
] as const;
const BODY_CSS = "'Playfair Display', serif";

// Short lines for the pill notes and fact arrows templates, taken only from what the clinician told us.
function aboutFacts(a: Record<string, any>, area: string): string[] {
  // Their own fun facts (written on the details form, one per line) come first.
  const own = (Array.isArray(a.facts) ? a.facts : String(a.facts ?? "").split("\n")).map((x: unknown) => String(x ?? "").trim()).filter(Boolean);
  if (own.length) return own.slice(0, 6);
  const clip = (t: unknown, n = 44) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n).replace(/[\s,.;:-]+\S*$/, (m) => (String(t ?? "").trim().length > n ? "" : m));
  const out: string[] = [];
  const hob = clip(a.hobbies); if (hob) out.push(`Happiest when: ${hob}`);
  const pets = clip(a.pets); if (pets && !/^(no|none|n\/a)/i.test(pets)) out.push(`Pets: ${pets}`);
  const why = clip(a.why, 60); if (why) out.push(why);
  const pass = clip(a.passion, 56); if (pass) out.push(`Passionate about ${pass}`);
  const tw = clip(a.threeWords, 40); if (tw) out.push(`In three words: ${tw}`);
  const ar = String(area || "").split(",")[0].trim(); if (ar) out.push(`Proudly local to ${ar}`);
  return out.slice(0, 6);
}

export function Builder({ id }: { id: string }) {
  const [headChoice, setHeadChoice] = useState<(typeof HEAD_FONTS)[number]["id"]>("instrument");
  const [req, setReq] = useState<Req | null>(null);
  // A club month is built like a premium freebie, with its own sizes: four treatment carousels and one hook carousel for each hook the member picked.
  const isClub = id.startsWith("club-") || !!req?.kind?.startsWith("club");
  const isPrem = req?.kind === "premium" || isClub;
  const monthId = id.startsWith("club-") ? id.slice(5) : "";
  const nT = isClub ? Math.max(1, Number((req?.answers as any)?.clubTreatmentSlots) || 4) : PREMIUM_TREATMENTS;
  const nA = isClub ? Math.max(1, Number((req?.answers as any)?.clubAboutSlots) || 2) : PREMIUM_ABOUT;
  const nH = isClub ? Math.max(0, Number((req?.answers as any)?.clubHookSlots) || 0) : PREMIUM_HOOKS;
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [hooks, setHooks] = useState<{ hook: string; script: string; onScreen: string }[]>([]);
  const [fact, setFact] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  // Which logo the build uses: theirs (the default), one uploaded here, or none, which gives the clinic name as text.
  const [logoPick, setLogoPick] = useState<File | "none" | null>(null);
  // The preview is the logo after its background has been taken off, shown on a chequerboard so the see-through part is obvious.
  const [logoPreview, setLogoPreview] = useState("");
  useEffect(() => {
    let live = true;
    (async () => {
      if (logoPick === "none") { setLogoPreview(""); return; }
      try {
        const blob = logoPick instanceof File ? logoPick : req?.logoUrl ? await fetch(req.logoUrl).then((r) => (r.ok ? r.blob() : null)) : null;
        const c = blob ? await makeClearLogo(blob) : null;
        if (live) setLogoPreview(c ? c.toDataURL("image/png") : "");
      } catch { if (live) setLogoPreview(""); }
    })();
    return () => { live = false; };
  }, [logoPick, req?.logoUrl]);
  const [link, setLink] = useState("");
  const [code, setCode] = useState("");
  const [pickedHooks, setPickedHooks] = useState<string[]>([]);
  const [hookSection, setHookSection] = useState<string>("Treatment");
  const [attaching, setAttaching] = useState(false);
  // Premium: the three treatments, the about me answers and the two about me designs are chosen here before building.
  const [chosenT, setChosenT] = useState<string[]>([]);
  const [oldTools, setOldTools] = useState(false);
  const [chEl, setChEl] = useState<Record<number, string>>({});
  const [tAngles, setTAngles] = useState<Record<string, number>>({});
  const [textHex, setTextHex] = useState<string>("");
  const [uniFont, setUniFont] = useState<string>("hatcher");
  const [about, setAbout] = useState<Req["answers"] | null>(null);
  // Club: the two About me designs she picks from the five.
  const [aboutPick, setAboutPick] = useState<AboutLayout[]>(["hello", "founder", "intro"]);
  const [sel, setSel] = useState<{ n: number; i: number } | null>(null);
  const clientRef = useRef<PackClient | null>(null);
  const assetsRef = useRef<Awaited<ReturnType<typeof buildAssets>> | null>(null);
  // The clinic's own photos (Studio portraits and the ones they sent) as pictures, so any post can use them.
  const ownRef = useRef<{ url: string; bmp: ImageBitmap }[]>([]);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  // Subtitles and every page after the first use Playfair Display on all the posts. The headline font is the picker.
  useEffect(() => {
    const def = { head: packFonts.head, body: packFonts.body };
    packFonts.body = BODY_CSS;
    decor.off = true;
    return () => {
      packFonts.head = def.head;
      packFonts.body = def.body;
      decor.off = false;
    };
  }, []);
  useEffect(() => {
    const f = HEAD_FONTS.find((x) => x.id === headChoice)!;
    packFonts.head = f.css;
    packFonts.body = BODY_CSS;
    (async () => {
      await loadPlayfair();
      await Promise.all([400, 700, 900].map((w) => document.fonts.load(`${w} 40px ${f.css}`).catch(() => [])));
      const client = clientRef.current;
      if (!client) return;
      for (const it of itemsRef.current) {
        if (!it.post) continue;
        const cvs = await renderPackPost(it.post, client, 0.4);
        patchItem(it.n, { previews: cvs.map((c) => c.toDataURL("image/jpeg", 0.8)) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headChoice]);

  const loadReq = useCallback(() => {
    fetch(`${API}/ten-free/requests/${id}`, { headers: authHeaders() }).then((r) => r.json()).then((j) => {
      setReq(j);
      if (j.slug) { setLink(siteLink(j.slug)); setCode(j.code || ""); }
    });
  }, [id]);
  useEffect(() => { loadReq(); }, [loadReq]);
  useEffect(() => {
    if (!req) return;
    setChosenT((c) => (c.length ? c : req.treatments.slice(0, req.kind?.startsWith("club") ? Math.max(1, Number((req.answers as any)?.clubTreatmentSlots) || 4) : 3)));
    if (req.kind?.startsWith("club")) setPickedHooks((h) => (h.length ? h : (((req.answers as any).clubHooks as string[]) ?? [])));
    setAbout((a) => a ?? req.answers);
    if (req.answers.font) setUniFont(req.answers.font);
    injectSuiteFontCss();
  }, [req?.id]);
  useEffect(() => {
    if (req?.aiStatus !== "working") return;
    const t = setInterval(loadReq, 10000);
    return () => clearInterval(t);
  }, [req?.aiStatus, loadReq]);

  const post = async (path: string, body: unknown) => {
    const r = await fetch(`${API}${path}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Something failed");
    return j;
  };
  const upload = async (blob: Blob, name: string) => {
    const fd = new FormData();
    fd.append("image", blob, name);
    const r = await fetch(`${API}/free-samples/image`, { method: "POST", body: fd });
    const d = await r.json();
    if (!r.ok || !d.url) throw new Error(d.error || "Upload failed");
    return d.url as string;
  };
  const jpg = (c: HTMLCanvasElement): Promise<Blob> => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not save an image"))), "image/jpeg", 0.92));
  const patchItem = (n: number, p: Partial<Item>) => {
    itemsRef.current = itemsRef.current.map((x) => (x.n === n ? { ...x, ...p } : x));
    setItems(itemsRef.current);
  };

  // The colour buttons need the loaded logo, fonts and photos. If this page was opened on posts that are already built, load them now.
  const ensureAssets = async () => {
    if (assetsRef.current || !req) return assetsRef.current;
    try {
      const logoBlob = logoPick === "none" ? null : logoPick instanceof File ? logoPick : req.logoUrl ? await fetch(req.logoUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
      const photoBlob = req.photoUrl ? await fetch(req.photoUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
      assetsRef.current = await buildAssets({ main: req.mainHex, accent: req.accentHex, clinicName: req.clinicName, handle: req.handle, whatsapp: "", logoBlob, photoBlob, titleFont: uniFont, premium: isPrem });
    } catch { toast.error("I could not load the fonts and photos for these posts. Press Rebuild."); }
    return assetsRef.current;
  };
  useEffect(() => {
    if (req && items.length && !assetsRef.current) void ensureAssets().then(() => setItems([...itemsRef.current]));
  }, [req, items.length]);

  const build = async () => {
    if (!req) return;
    if (isPrem && (isClub ? chosenT.length < 1 : chosenT.length !== nT)) {
      toast.error(isClub ? "Please pick at least one treatment first." : `Please pick exactly ${nT} treatments first. You have ${chosenT.length}.`);
      return;
    }
    if (isPrem && pickedHooks.length !== nH) {
      toast.error(`Please tick exactly ${nH} hooks first. You have ${pickedHooks.length}.`);
      return;
    }
    setBusy(true);
    setLink("");
    try {
      setStatus("Reading the website...");
      let siteNotes = "";
      if (req.website) siteNotes = (await post("/ten-free/site-notes", { url: req.website }).catch(() => ({ notes: "" }))).notes || "";
      const isPremium = isPrem;
      const tList = isPremium ? chosenT : req.treatments;
      const ans = isPremium && about ? about : req.answers;
      const clinic = { name: req.clinicName, owner: req.clinicianName, area: req.area, treatments: tList, siteNotes, month: monthNameUK() };

      setStatus("Getting the photo library...");
      const lib = (await (await fetch(`${API}/universal/images`)).json()).images as { treatmentId: string; url: string }[];
      const byT = new Map<string, string[]>();
      lib.forEach((i) => byT.set(i.treatmentId, [...(byT.get(i.treatmentId) ?? []), i.url]));
      const picks = pickTreatments(tList, (tid) => (byT.get(tid)?.length ?? 0) >= 1, req.id, req.seq ?? 0, isPremium ? nT : 3, tAngles, ((req.answers as any)?.usedAngles as Record<string, number[]>) ?? {});
      if (picks.length < (isPremium ? nT : 3)) throw new Error("None of the treatments she ticked have photos in the Universal library");
      const distinct = new Set(picks.map((p) => p.treatment.id)).size;
      if (distinct < (isPremium ? nT : 3)) toast.message(`Only ${distinct} of the treatments she ticked have photos in the Universal library, so some posts reuse a treatment at a different angle.`);

      setStatus("Preparing the logo, fonts and photos...");
      const logoBlob = logoPick === "none" ? null : logoPick instanceof File ? logoPick : req.logoUrl ? await fetch(req.logoUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
      const photoBlob = req.photoUrl ? await fetch(req.photoUrl).then((r) => (r.ok ? r.blob() : null)).catch(() => null) : null;
      const assets = await buildAssets({ main: req.mainHex, accent: req.accentHex, clinicName: req.clinicName, handle: req.handle, whatsapp: "", logoBlob, photoBlob, titleFont: uniFont, premium: isPremium });
      assetsRef.current = assets;

      // The pool for the pack templates: her three Studio portraits, then the photo she sent.
      const pool: PoolPhoto[] = [];
      const plan = isPremium ? clubPlan(nT, nH, aboutPick.slice(0, nA)) : TEN_PLAN;
      // Premium: her two AI portraits first, then the three photos the clinic sent. The free version has the AI portraits and the one photo.
      const sources = [...(req.aiUrls ?? []), ...(isPremium ? (req.photos ?? []) : req.photoUrl ? [req.photoUrl] : [])];
      for (const [i, u] of sources.entries()) {
        try {
          const r = await fetch(`${API}/free-samples/source-image?url=${encodeURIComponent(u)}`);
          if (!r.ok) continue;
          const blob = await r.blob();
          pool.push({ id: `${req.id}-${i}`, file: new File([blob], `pool-${i}.jpg`, { type: blob.type || "image/jpeg" }), url: URL.createObjectURL(blob) });
        } catch { /* skip */ }
      }
      // A colour that shows up on both the dark blocks and the light pages of the templates (a near black accent would vanish).
      const lumOf = (h: string) => { const v = parseInt(h.slice(1), 16); const f = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f((v >> 16) & 255) + 0.7152 * f((v >> 8) & 255) + 0.0722 * f(v & 255); };
      const mixTo = (h: string, to: number, t: number) => { const v = parseInt(h.slice(1), 16); const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.round(x + (to - x) * t)); return "#" + c.map((x) => x.toString(16).padStart(2, "0")).join(""); };
      let accent = req.accentHex;
      for (let i = 0; i < 20 && lumOf(accent) < 0.16; i++) accent = mixTo(accent, 255, 0.15);
      for (let i = 0; i < 20 && lumOf(accent) > 0.5; i++) accent = mixTo(accent, 0, 0.15);
      if (Math.abs(lumOf(accent) - lumOf(req.mainHex)) < 0.1) accent = lumOf(req.mainHex) > 0.3 ? mixTo(req.mainHex, 0, 0.45) : mixTo(req.mainHex, 255, 0.55);
      const clear = logoBlob ? await makeClearLogo(logoBlob).catch(() => null) : null;
      const base = textLogo(req.clinicName);
      const logoCanvas = clear || base.logo;
      const logoImg = await loadImage(logoCanvas.toDataURL("image/png")).catch(() => null);
      const owner = req.clinicianName;
      const client: PackClient = {
        businessName: req.clinicName, ownerName: owner, role: "Aesthetic practitioner", area: req.area, audience: "women over 35", brandNotes: "", footnote: "",
        fill: { owner, clinic: req.clinicName, area: req.area.split(",")[0].trim(), role: "Aesthetic practitioner" },
        headFont: "'Instrument Serif', serif", bodyFont: "'Montserrat', sans-serif",
        brand: { main: req.mainHex, accent }, logo: logoImg, pool, handle: req.handle,
        portraitLogo: logoCanvas, portraitPalette: { ...brandPalette(req.mainHex, base.palette), tile: "rgba(0,0,0,0)" },
      };
      clientRef.current = client;

      const dm = `If you are from ${req.area.split(",")[0].trim()} and want a safe caring practitioner meet me in the DMs`;
      packFonts.body = BODY_CSS;

      // The personal posts, from the pack templates.
      const uniqueIds = UNIQUE.filter((u) => u.photo).map((u) => u.id);
      const packSlots = plan.filter((s) => s.source === "pack") as Extract<(typeof TEN_PLAN)[number], { source: "pack" }>[];
      const cursor: { at: number; hookBase?: number; forced?: string[] } = { at: 0, hookBase: (req.seq ?? 0) * 5 };
      if (isPremium) cursor.forced = pickedHookPayload(pickedHooks, tList, req.area.split(",")[0].trim(), req.clinicianName).map((h) => h.text);
      const built = packSlots.map((s) => {
        const relIds = relatableFor(ans.age, /^(yes|grandma)/i.test(ans.mum)).filter((id) => EMPOWER.some((e) => e.id === id));
        const design = s.design === "auto" ? uniqueIds[(req.seq ?? hashSeed(req.id)) % uniqueIds.length] : s.design === "relatable" ? relIds[(req.seq ?? hashSeed(req.id + "relatable")) % relIds.length] : s.design;
        const sk = skeleton({ n: s.n, kind: s.kind, design }, cursor, pool.length, !!s.preset || design === "gatecrasher");
        const facts = `About me (the only facts you may use): age group ${ans.age || "not given"} (never state it, and never use a memory or life stage that does not fit it); hobbies ${ans.hobbies}; mum: ${ans.mum}; pets: ${ans.pets}; why I got into aesthetics: ${ans.why}; three words: ${ans.threeWords}; passion: ${ans.passion}; area: ${req.area}; month: ${monthNameUK()}. ${siteNotes ? "My clinic offers things in line with: " + siteNotes.slice(0, 600) : ""}`;
        const rel = s.design === "relatable" ? EMPOWER.find((e) => e.id === design) : null;
        sk.spec.idea = `${rel ? `${s.idea}, in the style of this template: ${rel.idea}` : s.idea}. ${facts}`;
        const slot = s.design === "relatable" ? { ...s, label: rel?.name || s.label, preset: design === "gatecrasher" ? GATECRASHER_PRESET : undefined } : s;
        return { slot, post: sk.post, spec: sk.spec };
      });
      const results: PackPost[] = built.map((b) => b.post);
      let tagsA = "", tagsB = "";
      for (let i = 0; i < built.length; i += 4) {
        setStatus(`Writing the posts... ${Math.min(i + 4, built.length)} of ${built.length}`);
        const chunk = built.slice(i, i + 4);
        const j = await post("/post-packs/copy", { clinic: { name: req.clinicName, owner, role: "Aesthetic practitioner", area: req.area, treatments: tList }, items: chunk.map((b) => ({ n: b.spec.n, kind: b.spec.kind, idea: b.spec.idea, fields: b.spec.fields, current: b.spec.current, photoSlides: b.spec.photoSlides })) });
        if (!tagsA && j.tagsA) tagsA = j.tagsA;
        if (!tagsB && j.tagsB) tagsB = j.tagsB;
        for (const r of j.items as CopyResult[]) {
          const idx = results.findIndex((p) => p.n === r.n);
          if (idx >= 0) results[idx] = applyCopy(results[idx], r, r.n % 2 === 0 ? tagsB || tagsA : tagsA || tagsB);
        }
      }
      const finalPack = results.map((p) => {
        const preset = built.find((b) => b.post.n === p.n)?.slot.preset;
        const withPreset = { ...(preset ? { ...p, text: { ...p.text, ...preset } } : p), cta: slidesOf(p) > 1 ? dm : p.cta };
        return withPreset.hashtags ? withPreset : { ...withPreset, hashtags: tagsA || tagsB };
      });

      setStatus("Writing the treatment posts...");
      // Premium: every treatment carousel opens on a scroll stopping hook from the Treatment section of the bank, filled with the treatment.
      if (isPremium) {
        const taken = new Set(pickedHooks);
        const tHooks = HOOK_BANK.filter((h: Hook) => h.theme === "Treatment" && /\[treatment\]/i.test(h.text) && !taken.has(h.code));
        picks.forEach((p, i) => {
          const h = tHooks[(hashSeed(req.id) + (req.seq ?? 0) * 3 + i * 7) % Math.max(1, tHooks.length)];
          if (h) p.headline = pickedHookPayload([h.code], [p.treatment.name], req.area.split(",")[0].trim())[0]?.text || p.headline;
        });
      }
      const tcopy: any[] = [];
      for (const p of picks) {
        tcopy.push(await post("/universal/copy", { client: req.clinicName, area: req.area, treatment: p.treatment.name, headline: p.headline, brief: p.brief, intro: p.angle === 0, note: isPremium ? voiceFor(ans.personality) : "" }));
      }

      setStatus("Drawing the posts...");
      // Premium about me posts: written from her answers, drawn in the usual photo, gradient and text look with the clinic's own five photos.
      const aboutSlots = plan.filter((s) => s.source === "about") as Extract<(typeof PREMIUM_PLAN)[number], { source: "about" }>[];
      let aboutCopy: { posts: { headline: string; subtitle: string; body: string; slides: string[]; caption: string; hashtags: string[]; poll: Poll }[] } = { posts: [] };
      let aboutBmps: ImageBitmap[] = [];
      const hookSlots = plan.filter((x) => x.source === "hook");
      if (aboutSlots.length || hookSlots.length) {
        setStatus("Writing the about me posts...");
        if (aboutSlots.length) aboutCopy = await post("/ten-free/copy", { clinic: { name: req.clinicName, owner: req.clinicianName, area: req.area, treatments: tList, month: monthNameUK() }, answers: ans, kinds: aboutSlots.map((x) => x.kind) });
        aboutBmps = (await Promise.all(pool.map((p) => createImageBitmap(p.file).catch(() => null)))).filter((x): x is ImageBitmap => !!x);
      }
      ownRef.current = (await Promise.all(pool.map(async (p) => { const bmp = await createImageBitmap(p.file).catch(() => null); return bmp ? { url: p.url, bmp } : null; }))).filter((x): x is { url: string; bmp: ImageBitmap } => !!x);
      // Some of the posts get a solid block along the bottom instead of the gradient, alternating the two brand colours. She can switch any post either way.
      const BLOCK_N = isPremium ? plan.map((x) => x.n).filter((n) => n % 3 === 1) : [1, 3, 6, 8, 10];
      const blockFor = (n: number) => (isPremium && BLOCK_N.includes(n) ? (BLOCK_N.indexOf(n) % 2 ? accent : req.mainHex) : undefined);
      const hookTexts = isPremium ? pickedHookPayload(pickedHooks, tList, req.area.split(",")[0].trim(), req.clinicianName).map((h) => h.text) : [];
      let ai = 0, hi = 0, vi = 0;
      const out: Item[] = [];
      let ti = 0;
      for (const slot of plan) {
        if (slot.source === "about") {
          const w = aboutCopy.posts[ai];
          let cutout: ImageBitmap | null = null;
          if (slot.layout === "peach") {
            // ImageKit takes the background off so she stands on the peach page. If that fails the plain photo is used.
            try {
              setStatus("Removing the photo background...");
              const fd = new FormData();
              fd.append("image", pool[ai % pool.length].file, "photo.jpg");
              const rr = await fetch(`${API}/ten-free/cutout`, { method: "POST", headers: { ...authHeaders(), "Content-Type": undefined as unknown as string }, body: fd });
              if (rr.ok) cutout = await createImageBitmap(await rr.blob());
            } catch { /* plain photo */ }
          }
          const aboutArgs = { layout: slot.layout, photo: aboutBmps[ai % aboutBmps.length], cutout, colours: { main: req.mainHex, accent: accent }, bio: w.body || w.subtitle || "", name: req.clinicianName, logo: logoCanvas, logoPos: "tr" as const, facts: ABOUT_LAYOUTS.find((l) => l.id === slot.layout)?.needsFacts ? aboutFacts(ans, req.area) : ([] as string[]) };
          const cv = await renderAboutPost(aboutArgs);
          ai++;
          out.push({ n: slot.n, label: slot.label, source: "universal", carousel: false, uni: [cv], aboutArgs, aboutLogo: logoCanvas, caption: w.caption || "", tags: (w.hashtags || []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "), previews: [cv.toDataURL("image/jpeg", 0.6)], poll: { question: "", a: "", b: "", instruction: "" } });
          continue;
        }
        if (slot.source === "hook") {
          const text = hookTexts[hi] || "";
          const tr = (picks[hi % picks.length] ?? picks[0]).treatment;
          setStatus(`Writing the hook posts... ${hi + 1} of ${hookSlots.length}`);
          const c = await post("/universal/copy", { client: req.clinicName, area: req.area, treatment: tr.name, headline: text, brief: "The cover line is a hook the clinician chose. Carry the idea on from it with friendly, informative slides that feel true to her as a person, using only what she told us about herself and her clinic. No claims, results or promises.", intro: false, note: voiceFor(ans.personality) });
          const args = { treatmentId: "about-me", headline: text, copy: { subtitle: c.subtitle, slides: c.slides, cta: dm }, photos: aboutBmps, offset: 1 + hi * 2, angle: hi % 2, shift: [0, 0, 0, 0], variant: isPremium ? vi++ % 2 : 0, block: blockFor(slot.n) };
          hi++;
          const canvases = renderUniversalPost(args, assets);
          out.push({ n: slot.n, label: "Hook carousel", source: "universal", carousel: true, uni: canvases, uniArgs: args, libUrls: pool.map((p) => p.url), caption: c.caption || "", tags: (c.hashtags || []).map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" "), previews: canvases.map((cv) => cv.toDataURL("image/jpeg", 0.6)), poll: { question: "", a: "", b: "", instruction: "" } });
          continue;
        }
        if (slot.source === "universal") {
          const p = picks[ti];
          const c = tcopy[ti];
          const urls = byT.get(p.treatment.id) ?? [];
          const photos = await Promise.all(urls.slice(0, 12).map((u) => loadBitmap(u).catch(() => null)));
          const uniArgs = { treatmentId: p.treatment.id, headline: p.headline, copy: { subtitle: c.subtitle, slides: c.slides, cta: dm }, photos: photos.filter((x): x is ImageBitmap => !!x), offset: ti * 2, angle: p.angle, shift: [0, 0, 0, 0], variant: isPremium ? vi++ % 2 : 0, block: blockFor(slot.n) };
          const canvases = renderUniversalPost(uniArgs, assets);
          out.push({ n: slot.n, label: `${p.treatment.name} carousel`, source: "universal", carousel: true, uni: canvases, uniArgs, libUrls: urls.slice(0, 12), caption: c.caption || "", tags: (c.hashtags || []).map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" "), previews: canvases.map((cv) => cv.toDataURL("image/jpeg", 0.6)), poll: { question: "", a: "", b: "", instruction: "" } });
          ti++;
        } else {
          const pp = finalPack.find((x) => x.n === slot.n)!;
          const cvs = await renderPackPost(pp, client, 0.4);
          out.push({ n: slot.n, label: slot.label, source: "pack", carousel: slot.carousel, post: pp, caption: pp.caption, tags: pp.hashtags, previews: cvs.map((c) => c.toDataURL("image/jpeg", 0.8)), poll: { question: "", a: "", b: "", instruction: "" } });
        }
      }

      // Club members get posts, reels and photos only. The reels are written by the server, so there are no story polls to write here.
      if (!isClub) {
        setStatus("Picking the 10 reels and writing the story polls...");
        const extras = await post("/ten-free/extras", { clinic, answers: ans, posts: out.map((o) => ({ n: o.n, label: o.label })) });
        setHooks(pickReels(10));
        for (const o of out) {
          const pl = (extras.polls || []).find((x: any) => x.n === o.n);
          if (pl) o.poll = { question: pl.question, a: pl.a, b: pl.b, instruction: pl.instruction || "" };
        }
      }
      itemsRef.current = out;
      setItems(out);
      setFact(pickFact(req.id));
      if (!isClub && assets.logo) setLogoUrl(await upload(await canvasToPng(assets.logo), "logo.png").catch(() => ""));
      setStatus("Built. Drag a photo to move it in its frame, click a treatment photo to swap it, then publish.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The build stopped");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  // Dragging a photo moves it inside its frame (pack posts only).
  const dragRef = useRef<{ n: number; i: number; x: number; y: number; start: [number, number, number?]; w: number; h: number; text?: [number, number] } | null>(null);
  const [textMode, setTextMode] = useState<Record<number, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startFocus = (p: PackPost, i: number): [number, number, number?] => (p.focus?.[`f${i}`] as [number, number, number?] | undefined) ?? (p.kind === "portrait" ? [0.5, 0] : (DEFAULT_FOCUS as [number, number]));
  const redraw = (n: number, i: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const client = clientRef.current;
      const it = itemsRef.current.find((x) => x.n === n);
      if (!client || !it?.post) return;
      const cv = document.createElement("canvas");
      await renderPackSlide(it.post, i, client, cv, 0.4);
      const list = [...it.previews];
      list[i] = cv.toDataURL("image/jpeg", 0.8);
      patchItem(n, { previews: list });
    }, 60);
  };
  // Click a photo on a treatment carousel to swap it for the next one in the library.
  const swapPhoto = (it: Item, i: number) => {
    const assets = assetsRef.current;
    if (!it.uniArgs || !assets || i > 3 || it.uniArgs.photos.length < 2) return;
    const shift = [...it.uniArgs.shift];
    shift[i] = (shift[i] || 0) + 1;
    const args = { ...it.uniArgs, shift };
    const cvs = renderUniversalPost(args, assets);
    patchItem(it.n, { uniArgs: args, uni: cvs, previews: cvs.map((cv) => cv.toDataURL("image/jpeg", 0.6)) });
  };
  // Premium: choose exactly which library photo goes in a slide. The slide picks library photo number (angle*4 + slide + offset + shift) so the shift is worked out to land on the one she clicks.
  const pickPhoto = (it: Item, i: number, k: number) => {
    const assets = assetsRef.current;
    if (!it.uniArgs || !assets) return;
    const len = it.uniArgs.photos.length;
    if (!len) return;
    const base = it.uniArgs.angle * 4 + i + it.uniArgs.offset;
    const shift = [...it.uniArgs.shift];
    shift[i] = (((k - base) % len) + len) % len;
    const args = { ...it.uniArgs, shift };
    const cvs = renderUniversalPost(args, assets);
    patchItem(it.n, { uniArgs: args, uni: cvs, previews: cvs.map((cv) => cv.toDataURL("image/jpeg", 0.6)) });
  };
  // Picture controls for every post: swap the photo for one of theirs or one uploaded, zoom, and slide it about inside the frame.
  const applyUni = (it: Item, args: NonNullable<Item["uniArgs"]>) => {
    const assets = assetsRef.current;
    if (!assets) return;
    const cvs = renderUniversalPost(args, assets);
    patchItem(it.n, { uniArgs: args, uni: cvs, previews: cvs.map((cv) => cv.toDataURL("image/jpeg", 0.6)) });
    if (itemsRef.current.find((x) => x.n === it.n)?.coverArgs) void coverApply({ ...it, uniArgs: args }, itemsRef.current.find((x) => x.n === it.n)!.coverArgs!);
  };
  const withArr = (arr: (number | undefined)[] | undefined, i: number, v: number, def: number) => { const out = [0, 1, 2, 3].map((k) => arr?.[k] ?? def); out[i] = v; return out; };
  const setAdj = (it: Item, i: number, key: "zoom" | "panX" | "panY", v: number) => applyUni(it, { ...it.uniArgs!, [key]: withArr(it.uniArgs![key], i, v, key === "zoom" ? 1 : 0) });
  const setCustom = (it: Item, i: number, bmp: ImageBitmap | null) => {
    const c = [0, 1, 2, 3].map((k) => it.uniArgs!.custom?.[k] ?? null);
    c[i] = bmp;
    applyUni(it, { ...it.uniArgs!, custom: c });
  };
  const aboutApply = async (it: Item, patch: Partial<NonNullable<Item["aboutArgs"]>>) => {
    const aa = { ...it.aboutArgs!, ...patch };
    // Switching to Fact arrows or Pill notes fills the notes from what the client told me, so they are never empty.
    const needs = ABOUT_LAYOUTS.find((l) => l.id === aa.layout)?.needsFacts;
    if (needs && !(aa.facts ?? []).some((f) => f.trim()) && req) aa.facts = aboutFacts((about ?? req.answers) as Record<string, any>, req.area);
    const cv = await renderAboutPost(aa);
    patchItem(it.n, { aboutArgs: aa, uni: [cv], previews: [cv.toDataURL("image/jpeg", 0.6)] });
  };
  const aboutPhoto = async (it: Item, bmp: ImageBitmap) => {
    let cutout: ImageBitmap | null = null;
    if (it.aboutArgs!.layout === "peach") {
      try {
        setStatus("Removing the photo background...");
        const blob = await new Promise<Blob | null>((res) => { const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d")!.drawImage(bmp, 0, 0); c.toBlob(res, "image/jpeg", 0.92); });
        if (blob) {
          const fd = new FormData();
          fd.append("image", blob, "photo.jpg");
          const rr = await fetch(`${API}/ten-free/cutout`, { method: "POST", headers: { ...authHeaders(), "Content-Type": undefined as unknown as string }, body: fd });
          if (rr.ok) cutout = await createImageBitmap(await rr.blob());
        }
      } catch { /* plain photo */ }
      setStatus("");
    }
    await aboutApply(it, { photo: bmp, cutout });
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>, then: (b: ImageBitmap) => void) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { then(await createImageBitmap(f)); } catch { toast.error("That file would not open as a picture"); }
  };
  // About me posts: pick a piece (a headline, a box, a note) and drag it anywhere on the picture.
  const [moveSel, setMoveSel] = useState<Record<number, string>>({});
  const aboutDrag = useRef<{ n: number; key: string; x: number; y: number; w: number; h: number; base: [number, number]; busy: boolean } | null>(null);
  const aboutDown = (e: React.PointerEvent<HTMLImageElement>, it: Item): boolean => {
    const key = moveSel[it.n];
    if (!key || !it.aboutArgs) return false;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    aboutDrag.current = { n: it.n, key, x: e.clientX, y: e.clientY, w: r.width, h: r.height, base: it.aboutArgs.move?.[key] ?? [0, 0], busy: false };
    return true;
  };
  const aboutMove = async (e: React.PointerEvent<HTMLImageElement>): Promise<boolean> => {
    const d = aboutDrag.current;
    if (!d) return false;
    if (d.busy) return true;
    const it = itemsRef.current.find((x) => x.n === d.n);
    if (!it?.aboutArgs) return true;
    d.busy = true;
    const mv: [number, number] = [Math.round(d.base[0] + ((e.clientX - d.x) / d.w) * 1080), Math.round(d.base[1] + ((e.clientY - d.y) / d.h) * 1350)];
    try {
      const aa = { ...it.aboutArgs, move: { ...(it.aboutArgs.move ?? {}), [d.key]: mv } };
      const cv = await renderAboutPost(aa);
      patchItem(d.n, { aboutArgs: aa, uni: [cv], previews: [cv.toDataURL("image/jpeg", 0.6)] });
    } finally { d.busy = false; }
    return true;
  };
  // New slide 1 covers: drawn over slide 1 of the post, with every piece draggable and sizable.
  const [coverSel, setCoverSel] = useState<Record<number, string>>({});
  const [coverBusy, setCoverBusy] = useState<Record<number, boolean>>({});
  const coverQ = useRef<Record<number, { running: boolean; next?: CoverOptions | null }>>({});
  const doCover = async (n: number, next: CoverOptions | null) => {
    const it = itemsRef.current.find((x) => x.n === n);
    const assets = assetsRef.current;
    if (!it) return;
    const rest = it.uniArgs && assets ? renderUniversalPost(it.uniArgs, assets) : it.uni ?? [];
    if (!next) { patchItem(n, { coverArgs: undefined, uni: rest, previews: rest.map((cv) => cv.toDataURL("image/jpeg", 0.6)) }); return; }
    const cv = await renderCoverPost(next);
    const cvs = coverInfo(next.layout).statik ? [cv] : [cv, ...rest.slice(1)];
    patchItem(n, { coverArgs: next, uni: cvs, previews: cvs.map((c2) => c2.toDataURL("image/jpeg", 0.6)) });
  };
  const coverApply = (it: Item, next: CoverOptions | null) => {
    const q = (coverQ.current[it.n] ??= { running: false });
    q.next = next;
    if (q.running) return Promise.resolve();
    q.running = true;
    setCoverBusy((b) => ({ ...b, [it.n]: true }));
    return (async () => {
      try { while (q.next !== undefined) { const nx = q.next; q.next = undefined; await doCover(it.n, nx); } }
      catch { toast.error("That cover would not draw. Try another photo."); }
      finally { q.running = false; setCoverBusy((b) => ({ ...b, [it.n]: false })); }
    })();
  };
  const cutoutOf = async (bmp: ImageBitmap): Promise<ImageBitmap | null> => {
    try {
      setStatus("Cutting the clinician out of the photo...");
      const blob = await new Promise<Blob | null>((res) => { const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d")!.drawImage(bmp, 0, 0); c.toBlob(res, "image/jpeg", 0.92); });
      if (!blob) return null;
      const fd = new FormData();
      fd.append("image", blob, "photo.jpg");
      const rr = await fetch(`${API}/ten-free/cutout`, { method: "POST", headers: { ...authHeaders(), "Content-Type": undefined as unknown as string }, body: fd });
      return rr.ok ? await createImageBitmap(await rr.blob()) : null;
    } catch { return null; } finally { setStatus(""); }
  };
  const coverDrag = useRef<{ n: number; key: string; x: number; y: number; w: number; h: number; base: [number, number] } | null>(null);
  const coverDown = (e: React.PointerEvent<HTMLImageElement>, it: Item): boolean => {
    const key = coverSel[it.n];
    if (!key || !it.coverArgs) return false;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    coverDrag.current = { n: it.n, key, x: e.clientX, y: e.clientY, w: r.width, h: r.height, base: it.coverArgs.move?.[key] ?? [0, 0] };
    return true;
  };
  const coverMove = (e: React.PointerEvent<HTMLImageElement>): boolean => {
    const d = coverDrag.current;
    if (!d) return false;
    const it = itemsRef.current.find((x) => x.n === d.n);
    if (!it?.coverArgs) return true;
    const mv: [number, number] = [Math.round(d.base[0] + ((e.clientX - d.x) / d.w) * 1080), Math.round(d.base[1] + ((e.clientY - d.y) / d.h) * 1350)];
    void coverApply(it, { ...it.coverArgs, move: { ...(it.coverArgs.move ?? {}), [d.key]: mv } });
    return true;
  };
  // Text box cover: drag the box anywhere on the first slide.
  const boxDrag = useRef<{ n: number; w: number; h: number } | null>(null);
  const boxMove = (e: React.PointerEvent<HTMLImageElement>, it: Item) => {
    const d = boxDrag.current;
    if (!d || d.n !== it.n || !it.uniArgs?.box) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0.1, Math.min(0.9, (e.clientX - r.left) / r.width));
    const y = Math.max(0.08, Math.min(0.92, (e.clientY - r.top) / r.height));
    applyUni(it, { ...it.uniArgs, box: { ...it.uniArgs.box, x, y } });
  };
  const onDown = (e: React.PointerEvent<HTMLImageElement>, it: Item, i: number) => {
    if (i === 0 && it.uniArgs?.box) { e.currentTarget.setPointerCapture(e.pointerId); boxDrag.current = { n: it.n, w: 0, h: 0 }; boxMove(e, it); return; }
    if (!it.post || it.post.kind === "tweet") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const r = (e.target as HTMLElement).getBoundingClientRect();
    dragRef.current = { n: it.n, i, x: e.clientX, y: e.clientY, start: startFocus(it.post, i), w: r.width, h: r.height, text: textMode[it.n] ? [it.post.textDx ?? 0, it.post.textDy ?? 0] : undefined };
  };
  const onMove = (e: React.PointerEvent<HTMLImageElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.text) {
      const it0 = itemsRef.current.find((x) => x.n === d.n);
      if (!it0?.post) return;
      patchItem(d.n, { post: { ...it0.post, textDx: d.text[0] + ((e.clientX - d.x) / d.w) * 400, textDy: d.text[1] + ((e.clientY - d.y) / d.h) * 500 } });
      redraw(d.n, d.i);
      return;
    }
    const fx = Math.max(0, Math.min(1, d.start[0] - (e.clientX - d.x) / d.w));
    const fy = Math.max(0, Math.min(1, d.start[1] - (e.clientY - d.y) / d.h));
    const it = itemsRef.current.find((x) => x.n === d.n);
    if (!it?.post) return;
    patchItem(d.n, { post: { ...it.post, focus: { ...(it.post.focus ?? {}), [`f${d.i}`]: [fx, fy, startFocus(it.post, d.i)[2]] as [number, number, number?] } } });
    redraw(d.n, d.i);
  };

  // Premium: one text colour for every carousel (blank means each post picks the colour that reads best on its gradient).
  const applyTextColour = async (hex: string) => {
    setTextHex(hex);
    const assets = assetsRef.current ?? (await ensureAssets());
    if (!assets) { toast.error("The photos are still loading, please press again in a moment."); return; }
    let changed = 0;
    try {
      for (const it of itemsRef.current) {
        if (!it.uniArgs) continue;
        const args = { ...it.uniArgs, textColour: hex || undefined };
        const cvs = renderUniversalPost(args, assets);
        patchItem(it.n, { uniArgs: args, uni: cvs, previews: cvs.map((cv) => cv.toDataURL("image/jpeg", 0.6)) });
        changed++;
      }
      toast[changed ? "success" : "message"](changed ? `Text colour changed on ${changed} post${changed === 1 ? "" : "s"}.` : "No posts to change.");
    } catch { toast.error("That colour would not draw. Try another."); }
  };

  // Change all: one colour applied to every post at once (block, gradient, text, background, about me).
  type UA = NonNullable<Item["uniArgs"]>;
  const applyAll = async (key: "block" | "gradColour" | "textColour" | "bgColour", val: string) => {
    if (key === "textColour") { void applyTextColour(val); return; }
    const assets = assetsRef.current ?? (await ensureAssets());
    if (!assets) { toast.error("The photos are still loading, please press again in a moment."); return; }
    let changed = 0;
    try {
    for (const it of itemsRef.current) {
      if (!it.uniArgs) continue;
      if (key === "block" && !it.uniArgs.block) continue;
      if (key === "gradColour" && it.uniArgs.block) continue;
      changed++;
      const args: Record<string, unknown> = { ...it.uniArgs, [key]: val || undefined };
      for (const k of Object.keys(args)) if (args[k] === undefined) delete args[k];
      const a2 = args as unknown as UA;
      const cvs = renderUniversalPost(a2, assets);
      patchItem(it.n, { uniArgs: a2, uni: cvs, previews: cvs.map((cv) => cv.toDataURL("image/jpeg", 0.6)) });
    }
    } catch { toast.error("That colour would not draw. Try another."); return; }
    toast[changed ? "success" : "message"](changed ? `Changed ${changed} post${changed === 1 ? "" : "s"}.` : key === "block" ? "None of the posts are colour block posts, so nothing changed. Use Look of the post on a post to make one." : "No posts to change.");
  };
  const applyAllAbout = async (k: "bg" | "head" | "text" | "box" | "all" | "reset", val = "") => {
    if (!req) return;
    let changed = 0;
    for (const it of itemsRef.current) {
      if (!it.aboutArgs) continue;
      changed++;
      let colours = it.aboutArgs.colours;
      if (k === "reset") colours = { main: req.mainHex, accent: req.accentHex };
      else if (k === "all") {
        // headline and boxes take the colour, the writing flips to dark or white so it stays readable
        const hex = /^#[0-9a-f]{6}$/i.test(val) ? val : "#888888";
        const n = parseInt(hex.slice(1), 16);
        const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
        colours = { ...colours, head: val, box: val, text: lum > 0.55 ? "#1a1a1a" : "#ffffff" };
      } else colours = { ...colours, [k]: val };
      const aa = { ...it.aboutArgs, colours };
      const cv = await renderAboutPost(aa);
      patchItem(it.n, { aboutArgs: aa, uni: [cv], previews: [cv.toDataURL("image/jpeg", 0.6)] });
    }
    if (changed) toast.success(`Changed ${changed} About me post${changed === 1 ? "" : "s"}.`);
  };

  const publish = async () => {
    const client = clientRef.current;
    const assets = assetsRef.current;
    if (!req || !client || !assets || !itemsRef.current.length) return;
    setBusy(true);
    try {
      const posts = [];
      const stories = [];
      for (const [i, it] of itemsRef.current.entries()) {
        setStatus(`Saving images ${i + 1} of ${itemsRef.current.length}...`);
        const cvs = it.post ? await renderPackPost(it.post, client, 1) : it.uni!;
        const images: string[] = [];
        for (const [k, c] of cvs.entries()) images.push(await upload(await jpg(c), `post-${it.n}-${k + 1}.jpg`));
        posts.push({ n: it.n, kind: it.source, label: it.label, images, caption: it.caption, tags: it.tags, ...(it.uniArgs && it.source === "universal" ? { treatment: it.uniArgs.treatmentId, angle: it.uniArgs.angle } : {}) });
        if (!isClub) stories.push({ n: it.n, image: await upload(await jpg(renderStory(cvs[0], assets)), `story-${it.n}.jpg`), instruction: it.poll.instruction, poll: { question: it.poll.question, a: it.poll.a, b: it.poll.b } });
      }
      if (isClub) {
        await post(`/club/months/${monthId}/posts`, { posts });
        setStatus("Saved to your approval queue. Nothing reaches the member until you approve it.");
      } else {
        const j = await post("/ten-free/publish", { id: req.id, posts, stories, hooks, fact, logoUrl });
        setLink(siteLink(j.slug));
        setCode(j.code);
        setStatus("Published. Send her the link.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publishing failed");
    } finally {
      setBusy(false);
    }
  };

  if (!req) return <div className="p-6">Loading...</div>;
  const ticked = req.treatments.join(", ");
  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-5">
      <Link href={isClub ? `/club-admin` : "/10free-admin"} className="text-sm underline">{isClub ? "Back to the clubs" : "Back to requests"}</Link>
      <h1 className="text-2xl font-bold">{req.clinicName}</h1>
      {isClub && (
        <div className="border-2 border-pink-500 rounded-lg p-3 bg-pink-50 text-sm space-y-1">
          <div className="font-bold uppercase text-pink-600">How this works</div>
          <div><b>1.</b> Build each post below. Tap a photo to swap it, drag text to move it, and use the little panel under each post to change the look.</div>
          <div><b>2.</b> Happy with them all? Press <b>Send to my approval queue</b> at the bottom.</div>
          <div><b>3.</b> Go back to the clubs page, check it, then press Approve. Nothing reaches the member until you do.</div>
        </div>
      )}
      <details open={!isClub} className="text-sm"><summary className="cursor-pointer font-semibold underline mb-2">{isClub ? "Show everything she told me" : "Show their details"}</summary>
      <div className="text-sm space-y-1">
        <div>{req.clinicianName} · {req.email} · {req.area} · @{req.handle}</div>
        <div>{req.website} {req.whatsapp && `· WhatsApp ${req.whatsapp}`}</div>
        <div>Ticked: {ticked || "nothing"}</div>
        <div>{req.answers.bizType === "Academy" && <b className="text-pink-500">ACADEMY (academy posts are not built yet) · </b>}Age: {req.answers.age || "not given"} · Hobbies: {req.answers.hobbies} · Mum: {req.answers.mum} · Pets: {req.answers.pets}</div>
        <div>Why: {req.answers.why}</div>
        <div>Three words: {req.answers.threeWords} · Passion: {req.answers.passion}</div>
        {isClub ? <div className="font-semibold">Studio photos: {req.aiUrls.length ? `${req.aiUrls.length} ready` : "none yet. Make them in the club admin."}</div> : (
        <div className="font-semibold">Studio portraits: {req.photoUrl ? (req.aiStatus === "ready" ? `${req.aiUrls.length} ready` : req.aiStatus === "failed" ? "failed" : "still being made") : "no photo sent"}
          {req.photoUrl && req.aiStatus !== "working" && <button className="ml-3 underline" onClick={async () => { await post(`/ten-free/requests/${req.id}/studio`, {}); loadReq(); }}>{req.aiStatus === "ready" ? "Make again" : "Try again"}</button>}
        </div>)}
        {req.aiUrls.length > 0 && <div className="flex gap-2 overflow-x-auto">{req.aiUrls.map((u) => <img key={u} src={u} className="h-24 rounded max-w-none shrink-0" />)}</div>}
        {isPrem && (req.photos ?? []).length > 0 && (
          <div><div className="font-semibold">Their 3 photos</div><div className="flex gap-2 overflow-x-auto">{(req.photos ?? []).map((u) => <img key={u} src={u} className="h-24 rounded max-w-none shrink-0" />)}</div></div>
        )}
      </div>
      </details>
      {isPrem && items.length > 0 && (
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none"><input type="checkbox" checked={oldTools} onChange={(e) => setOldTools(e.target.checked)} />Show the treatment chooser, About me answers, hooks and the old long tools</label>
      )}
      {isPrem && (oldTools || !items.length) && (
        <div className="border-2 border-black rounded-lg p-4 space-y-3">
          <h2 className="font-bold uppercase">1. The {nT} treatments <span className="text-pink-500">({chosenT.length} of {nT})</span></h2>
          <p className="text-xs text-muted-foreground">They ticked: {ticked || "nothing"}. Pick {nT}. Tap a different one and it swaps out the first, so you never need to untick anything.</p>
          {U_GROUPS.map((g) => (
            <div key={g.id}>
              <div className="text-xs font-semibold uppercase text-pink-500 mb-1">{g.label}</div>
              <div className="flex flex-wrap gap-2">
                {U_TREATMENTS.filter((t) => t.group === g.id).map((t) => {
                  const on = chosenT.includes(t.name);
                  return <button key={t.id} onClick={() => setChosenT((c) => (on ? c.filter((x) => x !== t.name) : c.length >= nT ? [...c.slice(1), t.name] : [...c, t.name]))} className={`px-3 py-1 rounded border text-sm bg-white text-black ${on ? "!bg-pink-500 !text-white border-pink-500" : ""}`}>{t.name}</button>;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {isPrem && about && (oldTools || !items.length) && (
        <div className="border-2 border-black rounded-lg p-4 space-y-3">
          <h2 className="font-bold uppercase">2. About me ({nA} posts)</h2>
          {isPrem && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-pink-500">Pick the {nA} About me designs <span>({aboutPick.slice(0, nA).length} of {nA})</span></div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {ABOUT_LAYOUTS.filter((l) => !["cream", "peach"].includes(l.id)).map((l) => {
                  const sel = aboutPick.slice(0, nA);
                  const on = sel.includes(l.id);
                  return (
                    <button key={l.id} type="button" onClick={() => setAboutPick(sel.includes(l.id) ? sel.filter((x) => x !== l.id) : sel.length >= nA ? [...sel.slice(1), l.id] : [...sel, l.id])} className={`rounded border-2 p-1 text-left text-xs ${on ? "border-pink-500 bg-pink-50" : "border-gray-200"}`}>
                      <img src={`${import.meta.env.BASE_URL}about-templates/${l.id}.jpg`} alt="" className="w-full rounded mb-1" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      <span className="font-semibold">{l.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Tap {nA}. Tapping one more swaps out the first. You can still change a post's template after it is built.</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Their answers are below. Tidy them up and the posts are written from exactly this.</p>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            {([["hobbies", "Hobbies"], ["pets", "Pets"], ["why", "Why aesthetics"], ["threeWords", "Three words"], ["personality", "Personality (the voice)"], ["passion", "Passion"], ["mum", "Mum"]] as const).map(([k, label]) => (
              <label key={k} className="flex flex-col gap-1"><span className="font-semibold">{label}</span>
                <textarea rows={k === "why" || k === "passion" ? 3 : 2} className="border rounded p-2" value={(about as Record<string, string>)[k] ?? ""} onChange={(e) => setAbout({ ...about, [k]: e.target.value })} />
              </label>
            ))}
          </div>
        </div>
      )}
      {isPrem && (oldTools || !items.length) && (
        <div className="border-2 border-black rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold uppercase">3. Pick the {nH} hooks <span className="text-pink-500">({pickedHooks.length} of {nH})</span></h2>
            {pickedHooks.length > 0 && <button className="text-sm underline" onClick={() => setPickedHooks([])}>Clear</button>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {HOOK_SECTIONS.map((sec) => (
              <button key={sec} onClick={() => setHookSection(sec)} className={`px-3 py-1.5 rounded border text-sm ${hookSection === sec ? "bg-pink-500 text-white border-pink-500" : ""}`}>{HOOK_SECTION_LABEL[sec] ?? sec} <span className="opacity-60">({HOOK_BANK.filter((h: Hook) => (h.theme || "Original") === sec).length})</span></button>
            ))}
          </div>
          <div className="max-h-[28rem] overflow-y-auto space-y-3">
            {Array.from(HOOK_BANK.filter((h: Hook) => (h.theme || "Original") === hookSection && hookFits(h, [...req.treatments, ...chosenT])).reduce((m, h: Hook) => m.set(h.group || HOOK_SECTION_LABEL[hookSection] || hookSection, [...(m.get(h.group || HOOK_SECTION_LABEL[hookSection] || hookSection) ?? []), h]), new Map<string, Hook[]>())).map(([g, list]) => (
              <div key={g}>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{g}</div>
                {list.map((h: Hook) => {
                  const on = pickedHooks.includes(h.code);
                  const shown = pickedHookPayload([h.code], chosenT.length ? chosenT : req.treatments, req.area.split(",")[0].trim(), req.clinicianName)[0]?.text ?? h.text;
                  return (
                    <label key={h.code} className={`flex gap-3 items-start text-sm p-2 rounded cursor-pointer ${on ? "bg-pink-50" : ""}`}>
                      <input type="checkbox" checked={on} disabled={!on && pickedHooks.length >= nH} onChange={() => setPickedHooks((p) => (p.includes(h.code) ? p.filter((x) => x !== h.code) : [...p, h.code]))} />
                      <span>{shown}{h.season && <span className="ml-2 text-xs text-muted-foreground">({h.season})</span>}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          {pickedHooks.length > 0 && (
            <div className="text-xs text-muted-foreground">Chosen: {pickedHooks.map((c) => pickedHookPayload([c], chosenT.length ? chosenT : req.treatments, req.area.split(",")[0].trim(), req.clinicianName)[0]?.text).filter(Boolean).join("  |  ")}</div>
          )}
        </div>
      )}
      {isPrem && items.length > 0 && (() => {
        const base: [string, string][] = [["Their main", req.mainHex], ["Their accent", req.accentHex], ["White", "#ffffff"], ["Black", "#111111"]];
        const metals: [string, string, string][] = [["Gold", "metal:gold", "linear-gradient(135deg,#7a5a14,#d4a93c,#fff1a8,#c9962b,#7a5a14)"], ["Silver", "metal:silver", "linear-gradient(135deg,#6d6f73,#c9ccd1,#ffffff,#a9adb3,#6d6f73)"]];
        const grp = (title: string, key: "block" | "gradColour" | "textColour" | "bgColour", withMetal: boolean, autoLabel: string) => (
          <div className="flex gap-1.5 items-center flex-wrap text-[10px] leading-none">
            <span className="w-44 shrink-0 font-bold uppercase text-foreground">{title}</span>
            <input type="color" title="Pick any colour" defaultValue="#d4a93c" onChange={(e) => void applyAll(key, e.target.value)} className="h-4 w-5 p-0 cursor-pointer rounded border" />
            {base.map(([label, hex]) => <button key={label} type="button" title={label} onClick={() => void applyAll(key, hex)} className="keep-colour h-3.5 w-3.5 rounded-full border" style={{ background: hex }} />)}
            {withMetal && metals.map(([label, val, css]) => <button key={label} type="button" title={`Metallic ${label.toLowerCase()}`} onClick={() => void applyAll(key, val)} className="keep-colour h-3.5 w-3.5 rounded-full border" style={{ background: css }} />)}
            {key !== "block" && <button type="button" onClick={() => void applyAll(key, "")} className="px-1 py-0.5 rounded border">{autoLabel}</button>}
          </div>
        );
        const aboutGrp = (title: string, k: "bg" | "head" | "text" | "box" | "all") => (
          <div className="bg-white text-black rounded-lg p-2">
            <ColourPicker label={title} value={undefined} onChange={(v) => void applyAllAbout(k, v)} brand={req ? [req.mainHex, req.accentHex] : []} />
          </div>
        );
        return (
          <div className="border rounded-xl p-3 space-y-2">
            <div className="text-sm font-bold">Change all colours at once</div>
            <div className="text-xs text-muted-foreground">Pick a colour here and every post changes together. You can still fine tune any single post below.</div>
            {grp("Colour block (all block posts)", "block", true, "Reset")}
            {grp("Gradient colour (all gradient posts)", "gradColour", true, "Auto")}
            {grp("Text colour (all carousels)", "textColour", false, "Auto")}
            {grp("Background colour (all carousels)", "bgColour", false, "Photo")}
            {items.some((x) => x.aboutArgs) && (
              <>
                {aboutGrp("About me: change all (headline and boxes)", "all")}
                {aboutGrp("About me background", "bg")}
                {aboutGrp("About me headline", "head")}
                {aboutGrp("About me text", "text")}
                {aboutGrp("About me boxes", "box")}
                <button onClick={() => void applyAllAbout("reset")} className="px-2 py-1 rounded border text-xs">About me back to their brand colours</button>
              </>
            )}
          </div>
        );
      })()}
      {isPrem && <div className="flex gap-2 items-center flex-wrap">
        <span className="text-sm font-semibold">Headline font (their choice is ticked, change it if you like):</span>
        {PREMIUM_FONTS.map((f) => (
          <button key={f.id} type="button" onClick={() => setUniFont(f.id)} className={`px-3 py-1.5 rounded border text-xl ${uniFont === f.id ? "bg-pink-500 text-white border-pink-500" : ""}`} style={{ fontFamily: `"${f.family}", serif`, fontWeight: 400, textTransform: "none" }}>{f.name}</button>
        ))}
        <span className="text-xs text-muted-foreground">Then press Rebuild.</span>
      </div>}
      {!isPrem && <div className="flex gap-2 items-center flex-wrap">
        <span className="text-sm font-semibold">Headline font for every post:</span>
        {HEAD_FONTS.map((f) => (
          <button key={f.id} onClick={() => setHeadChoice(f.id)} className={`px-3 py-1.5 rounded border text-sm ${headChoice === f.id ? "bg-pink-500 text-white border-pink-500" : ""}`} style={{ fontFamily: f.css }}>{f.label}</button>
        ))}
        <span className="text-xs text-muted-foreground">Subtitles and later pages are Playfair Display. The three treatment carousels are in Hatcher.</span>
      </div>}
      <div className="flex gap-3 items-center flex-wrap text-sm">
        <span className="font-semibold">Logo:</span>
        {logoPick === "none" ? <span className="text-muted-foreground">None, the clinic name will be used as text</span>
          : <img src={logoPreview} alt="" className="h-12 max-w-40 object-contain rounded border p-1" style={{ display: logoPreview ? undefined : "none", backgroundImage: "repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%)", backgroundSize: "12px 12px" }} />}
        {!logoPreview && logoPick !== "none" && <span className="text-muted-foreground">They did not send one</span>}
        <label className="px-2 py-1 rounded border cursor-pointer">Upload a logo<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setLogoPick(f); }} /></label>
        <button className="px-2 py-1 rounded border" onClick={() => setLogoPick("none")}>Remove their logo</button>
        {logoPick && <button className="px-2 py-1 rounded border" onClick={() => setLogoPick(null)}>Use theirs again</button>}
        <span className="text-xs text-muted-foreground">Then press Rebuild.</span>
      </div>
      <div className="flex gap-3 items-center flex-wrap">
        <button disabled={busy} onClick={build} className="px-4 py-2 rounded bg-pink-500 text-white disabled:opacity-50">{items.length ? "Rebuild" : isPrem ? isClub ? `Build the ${nT + nA + nH} posts` : `Build the ${nT + nA + nH} posts` : "Build the 10 posts"}</button>
        {isPrem && !items.length && ((isClub ? chosenT.length < 1 : chosenT.length !== nT) || pickedHooks.length !== nH) && <span className="text-sm text-red-600">Before you build: {chosenT.length} of {nT} treatments and {pickedHooks.length} of {nH} hooks chosen.</span>}
        {items.length > 0 && <button disabled={busy} onClick={publish} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">{isClub ? "Send to my approval queue" : "Publish and get the link"}</button>}
        <span className="text-sm">{status}</span>
        {!isClub && <button disabled={attaching} className="px-4 py-2 rounded border-2 border-black disabled:opacity-50" onClick={async () => {
          if (req.presetId) { window.location.href = `${BASE}/presets`; return; }
          if (!confirm(`Attach ${req.clinicName} to the Cyber Suite as a client?`)) return;
          setAttaching(true);
          try {
            const j = await post(`/ten-free/requests/${req.id}/attach`, {});
            toast.success(j.already ? "They were already attached." : "Attached. They are now a client in your tools.");
            loadReq();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not attach them");
          } finally {
            setAttaching(false);
          }
        }}>{req.presetId ? "Attached, open my clients" : "Attach to the Cyber Suite"}</button>}
      </div>
      {link && !isClub && (
        <div className="border rounded p-4 space-y-2">
          <div className="text-sm">Private link for {req.clinicianName}:</div>
          <div className="font-mono text-sm break-all">{link}</div>
          <div className="text-sm">Discount code: <b>{code}</b></div>
          <button className="px-3 py-1 border rounded text-sm" onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }}>Copy link</button>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.n} className="border rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Post {it.n} · {it.label}</div>
              <button className="text-xs text-red-600 underline" onClick={() => { if (confirm(`Delete post ${it.n} from this pack?`)) setItems((xs) => xs.filter((x) => x.n !== it.n)); }}>Delete post</button>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {it.previews.map((src, i) => (
                <img key={i} src={src} draggable={false} onPointerDown={(e) => { if (i === 0 && coverDown(e, it)) return; if (!aboutDown(e, it)) onDown(e, it, i); }} onPointerMove={(e) => { if (coverDrag.current) coverMove(e); else if (aboutDrag.current) void aboutMove(e); else if (i === 0 && it.uniArgs?.box) boxMove(e, it); else onMove(e); }} onPointerUp={() => { dragRef.current = null; boxDrag.current = null; aboutDrag.current = null; coverDrag.current = null; }}
                  onClick={() => (i === 0 && it.uniArgs?.box ? undefined : isPrem && it.uniArgs && i <= 3 ? setSel({ n: it.n, i }) : swapPhoto(it, i))} title={it.uniArgs && i <= 3 ? (isPrem ? "Click to choose the photo" : "Click to swap the photo") : undefined}
                  className={`h-[min(30rem,68vh)] w-auto max-w-none rounded shrink-0 ${(it.aboutArgs && moveSel[it.n]) || (i === 0 && it.coverArgs && coverSel[it.n]) ? "cursor-grab touch-none" : ""} ${(it.post && it.post.kind !== "tweet") || (i === 0 && it.uniArgs?.box) ? "cursor-grab touch-none" : it.uniArgs && i <= 3 ? "cursor-pointer" : ""}`} />
              ))}
            </div>
            {isPrem && it.uniArgs && assetsRef.current && (() => {
              const upd = (patch: Partial<NonNullable<Item["uniArgs"]>>, clear: string[] = []) => {
                const args: Record<string, unknown> = { ...it.uniArgs!, ...patch };
                for (const k of clear) delete args[k];
                for (const k of Object.keys(args)) if (args[k] === undefined) delete args[k];
                const a2 = args as unknown as NonNullable<Item["uniArgs"]>;
                const cvs = renderUniversalPost(a2, assetsRef.current!);
                patchItem(it.n, { uniArgs: a2, uni: cvs, previews: cvs.map((cv) => cv.toDataURL("image/jpeg", 0.6)) });
              };
              const row = "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground";
              const ua = it.uniArgs as unknown as Record<string, any>;
              const setU = (patch: Record<string, unknown>, clear: string[] = []) => upd(patch as Partial<NonNullable<Item["uniArgs"]>>, clear);
              const els: [string, string][] = [[it.uniArgs.block ? "block" : "gradColour", it.uniArgs.block ? "Colour block" : "Gradient"], ["textColour", "Text"], ["bgColour", "Background"]];
              const keyEl = els.some(([k]) => k === chEl[it.n]) ? chEl[it.n] : els[0][0];
              const curV = String(ua[keyEl] ?? "");
              const goldCss = "linear-gradient(135deg,#7a5a14,#d4a93c,#fff1a8,#c9962b,#7a5a14)";
              const silverCss = "linear-gradient(135deg,#6d6f73,#c9ccd1,#ffffff,#a9adb3,#6d6f73)";
              const dots: [string, string, string][] = [["Main", req.mainHex, req.mainHex], ["Accent", req.accentHex, req.accentHex], ["White", "#ffffff", "#ffffff"], ["Black", "#111111", "#111111"], ...(keyEl === "textColour" || keyEl === "bgColour" ? [] : ([["Gold", "metal:gold", goldCss], ["Silver", "metal:silver", silverCss]] as [string, string, string][]))];
              const pill = (on: boolean) => `px-1.5 py-1 rounded border ${on ? "bg-pink-500 text-white border-pink-500" : "bg-white text-black"}`;
              const sl = (label: string, key: string, min: number, max: number, step: number, dflt: number) => (
                <label key={key} className="flex items-center gap-1"><span>{label}</span><input type="range" className="w-20 h-2" min={min} max={max} step={step} value={Number(ua[key] ?? dflt)} onChange={(e) => setU({ [key]: Number(e.target.value) })} /></label>
              );
              const compactBar = (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded border px-2 py-1.5 text-[10px] leading-none text-muted-foreground">
                  <span className="flex items-center gap-1"><b className="uppercase text-foreground">Look</b>
                    <button type="button" className={pill(!it.uniArgs.block && !it.uniArgs.box)} onClick={() => setU({}, ["block", "box"])}>Gradient</button>
                    <button type="button" className={pill(!!it.uniArgs.block)} onClick={() => setU({ block: it.uniArgs?.block || req.mainHex }, ["box"])}>Block</button>
                    <button type="button" className={pill(!!it.uniArgs.box)} onClick={() => setU({ box: it.uniArgs?.box || { fill: req.mainHex, x: 0.5, y: 0.5 } }, ["block"])}>Text box</button>
                  </span>
                  <span className="flex items-center gap-1"><b className="uppercase text-foreground">Changing</b>
                    <select className="rounded border bg-white text-black px-1 py-0.5 text-[10px]" value={keyEl} onChange={(e) => setChEl((c) => ({ ...c, [it.n]: e.target.value }))}>{els.map(([k, l]) => <option key={k} value={k}>{l} colour</option>)}</select>
                    <input type="color" title="Pick any colour" className="h-4 w-5 p-0 cursor-pointer rounded border" value={/^#[0-9a-f]{6}$/i.test(curV) ? curV : "#888888"} onChange={(e) => setU({ [keyEl]: e.target.value })} />
                    {dots.map(([label, val, css]) => <button key={label} type="button" title={label} onClick={() => setU({ [keyEl]: val })} className="keep-colour h-3.5 w-3.5 rounded-full border" style={{ background: css }} />)}
                    {keyEl !== "block" && <button type="button" className="px-1 py-0.5 rounded border bg-white text-black" onClick={() => setU({}, [keyEl])}>{keyEl === "bgColour" ? "Photo" : "Auto"}</button>}
                  </span>
                  {sl("Writing up/down", "blockY", -600, 120, 10, 0)}
                  {sl("Cover text up/down", "coverY", -900, 200, 10, 0)}
                  {sl("Cover text size", "coverScale", 0.5, 1.6, 0.05, 1)}
                  {it.uniArgs.block && sl("Block height", "blockScale", 0.5, 2, 0.05, 1)}
                  {!it.uniArgs.block && sl("Gradient %", "gradOpacity", 0, 100, 5, 60)}
                  <span className="flex items-center gap-1"><b className="uppercase text-foreground">Headline</b>
                    <button type="button" className={pill(it.uniArgs.noHead === false)} onClick={() => setU({ noHead: false })}>Every slide</button>
                    <button type="button" className={pill(it.uniArgs.noHead !== false)} onClick={() => setU({ noHead: true })}>Cover only</button>
                  </span>
                  <button type="button" className="px-1.5 py-1 rounded border bg-white text-black" onClick={() => upd({}, ["blockY", "coverY", "coverScale", "blockScale", "gradOpacity", "gradColour", "bgColour", "textColour"])}>Reset</button>
                </div>
              );
              return (
                <div className="space-y-1">
                  {compactBar}
                  {oldTools && (<>
                  <div className="flex justify-end"><button className="px-2 py-0.5 rounded border text-xs" onClick={() => upd({}, ["blockY", "coverY", "coverScale", "blockScale", "gradOpacity", "gradColour", "bgColour", "textColour"])}>Reset this post's look</button></div>
                  <div className={row}><span className="w-44 shrink-0">Headline on every slide</span>
                    <button onClick={() => upd({ noHead: false })} className={`px-2 py-0.5 rounded border ${it.uniArgs.noHead === false ? "bg-pink-500 text-white border-pink-500" : ""}`}>On</button>
                    <button onClick={() => upd({ noHead: true })} className={`px-2 py-0.5 rounded border ${it.uniArgs.noHead === false ? "" : "bg-pink-500 text-white border-pink-500"}`}>Cover only</button>
                  </div>
                  <div className={row}><span className="w-44 shrink-0">Look of the post</span>
                    <button onClick={() => upd({}, ["block", "box"])} className={`px-2 py-0.5 rounded border ${it.uniArgs.block || it.uniArgs.box ? "" : "bg-pink-500 text-white border-pink-500"}`}>Gradient</button>
                    <button onClick={() => upd({ block: it.uniArgs?.block || req.mainHex }, ["box"])} className={`px-2 py-0.5 rounded border ${it.uniArgs.block ? "bg-pink-500 text-white border-pink-500" : ""}`}>Colour block</button>
                    <button onClick={() => upd({ box: it.uniArgs?.box || { fill: req.mainHex, x: 0.5, y: 0.5 } }, ["block"])} className={`px-2 py-0.5 rounded border ${it.uniArgs.box ? "bg-pink-500 text-white border-pink-500" : ""}`}>Text box</button>
                  </div>
                  {it.uniArgs.box && (
                    <div className="space-y-1 border rounded p-2">
                      <div className="text-xs">The full photo with a text box on the cover. Drag the box anywhere on the first slide. The slides after it use the gradient.</div>
                      <div className="bg-white text-black rounded-lg p-2 space-y-2">
                        <ColourPicker label="Box colour" value={it.uniArgs.box.fill} onChange={(v) => v && upd({ box: { ...it.uniArgs!.box!, fill: v } })} brand={[req.mainHex, req.accentHex]} />
                        <ColourPicker label="Box text colour" value={it.uniArgs.box.text} placeholder="Automatic" onChange={(v) => upd({ box: { ...it.uniArgs!.box!, text: v || undefined } })} onReset={() => upd({ box: { ...it.uniArgs!.box!, text: undefined } })} brand={[req.mainHex, req.accentHex]} />
                      </div>
                      <label className={row}><span className="w-44 shrink-0">Box width</span>
                        <input type="range" min={460} max={980} step={20} className="flex-1" value={it.uniArgs.box.w ?? 780} onChange={(e) => upd({ box: { ...it.uniArgs!.box!, w: Number(e.target.value) } })} /></label>
                    </div>
                  )}
                  {it.uniArgs.block && (
                    <div className={row}><span className="w-56 shrink-0 inline-block border-2 border-current rounded-md px-2 py-1 text-sm font-extrabold uppercase tracking-wide">Block colour</span>
                      <input type="color" value={/^#[0-9a-f]{6}$/i.test(it.uniArgs.block) ? it.uniArgs.block : "#d4a93c"} onChange={(e) => upd({ block: e.target.value })} className="h-7 w-12 cursor-pointer rounded border" />
                      {[["Main", req.mainHex], ["Accent", req.accentHex], ["White", "#ffffff"], ["Black", "#111111"]].map(([label, hex]) => (
                        <button key={label} onClick={() => upd({ block: hex })} className="px-2 py-0.5 rounded border flex items-center gap-1"><span className="keep-colour inline-block w-3 h-3 rounded-full border" style={{ background: hex }} />{label}</button>
                      ))}
                      {[["Gold", "metal:gold", "linear-gradient(135deg,#7a5a14,#d4a93c,#fff1a8,#c9962b,#7a5a14)"], ["Silver", "metal:silver", "linear-gradient(135deg,#6d6f73,#c9ccd1,#ffffff,#a9adb3,#6d6f73)"]].map(([label, val, css]) => (
                        <button key={label} onClick={() => upd({ block: val })} className={`px-2 py-0.5 rounded border flex items-center gap-1 ${it.uniArgs?.block === val ? "bg-pink-500 text-white border-pink-500" : ""}`}><span className="keep-colour inline-block w-3 h-3 rounded-full border" style={{ background: css }} />Metallic {label.toLowerCase()}</button>
                      ))}
                    </div>
                  )}
                  <label className={row}><span className="w-56 shrink-0 inline-block border-2 border-current rounded-md px-2 py-1 text-sm font-extrabold uppercase tracking-wide">Headline and writing position</span>
                    <input type="range" min={-600} max={120} step={10} className="flex-1" value={it.uniArgs.blockY ?? 0} onChange={(e) => upd({ blockY: Number(e.target.value) })} /></label>
                  <label className={row}><span className="w-56 shrink-0 inline-block border-2 border-current rounded-md px-2 py-1 text-sm font-extrabold uppercase tracking-wide">Cover text position</span>
                    <input type="range" min={-900} max={200} step={10} className="flex-1" value={it.uniArgs.coverY ?? 0} onChange={(e) => upd({ coverY: Number(e.target.value) })} /></label>
                  <label className={row}><span className="w-56 shrink-0 inline-block border-2 border-current rounded-md px-2 py-1 text-sm font-extrabold uppercase tracking-wide">Colour block height</span>
                    <input type="range" min={0.5} max={2} step={0.05} className="flex-1" value={it.uniArgs.blockScale ?? 1} onChange={(e) => upd({ blockScale: Number(e.target.value) })} /></label>
                  <label className={row}><span className="w-56 shrink-0 inline-block border-2 border-current rounded-md px-2 py-1 text-sm font-extrabold uppercase tracking-wide">Cover text size</span>
                    <input type="range" min={0.5} max={1.6} step={0.05} className="flex-1" value={it.uniArgs.coverScale ?? 1} onChange={(e) => upd({ coverScale: Number(e.target.value) })} /></label>
                  <label className={row}><span className="w-56 shrink-0 inline-block border-2 border-current rounded-md px-2 py-1 text-sm font-extrabold uppercase tracking-wide">Gradient strength</span>
                    <input type="range" min={0} max={100} step={5} className="flex-1" value={it.uniArgs.gradOpacity ?? 60} onChange={(e) => upd({ gradOpacity: Number(e.target.value) })} /></label>
                  <div className={row}><span className="w-56 shrink-0 inline-block border-2 border-current rounded-md px-2 py-1 text-sm font-extrabold uppercase tracking-wide">Gradient colour</span>
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(it.uniArgs.gradColour || "") ? it.uniArgs.gradColour! : "#111111"} onChange={(e) => upd({ gradColour: e.target.value })} className="h-7 w-12 cursor-pointer rounded border" />
                    {[["Main", req.mainHex], ["Accent", req.accentHex], ["Black", "#111111"], ["White", "#ffffff"]].map(([label, hex]) => (
                      <button key={label} onClick={() => upd({ gradColour: hex })} className="px-2 py-0.5 rounded border flex items-center gap-1"><span className="keep-colour inline-block w-3 h-3 rounded-full border" style={{ background: hex }} />{label}</button>
                    ))}
                    {[["Gold", "metal:gold", "linear-gradient(135deg,#7a5a14,#d4a93c,#fff1a8,#c9962b,#7a5a14)"], ["Silver", "metal:silver", "linear-gradient(135deg,#6d6f73,#c9ccd1,#ffffff,#a9adb3,#6d6f73)"]].map(([label, val, css]) => (
                      <button key={label} onClick={() => upd({ gradColour: val })} className={`px-2 py-0.5 rounded border flex items-center gap-1 ${it.uniArgs?.gradColour === val ? "bg-pink-500 text-white border-pink-500" : ""}`}><span className="keep-colour inline-block w-3 h-3 rounded-full border" style={{ background: css }} />Metallic {label.toLowerCase()}</button>
                    ))}
                    <button onClick={() => upd({}, ["gradColour"])} className="px-2 py-0.5 rounded border">Auto</button>
                  </div>
                  <div className={row}><span className="w-56 shrink-0 inline-block border-2 border-current rounded-md px-2 py-1 text-sm font-extrabold uppercase tracking-wide">Text colour (this post)</span>
                    <input type="color" value={it.uniArgs.textColour || "#ffffff"} onChange={(e) => upd({ textColour: e.target.value })} className="h-7 w-12 cursor-pointer rounded border" />
                    {[["White", "#ffffff"], ["Black", "#111111"], ["Main", req.mainHex], ["Accent", req.accentHex]].map(([label, hex]) => (
                      <button key={label} onClick={() => upd({ textColour: hex })} className="px-2 py-0.5 rounded border flex items-center gap-1"><span className="keep-colour inline-block w-3 h-3 rounded-full border" style={{ background: hex }} />{label}</button>
                    ))}
                    <button onClick={() => upd({}, ["textColour"])} className="px-2 py-0.5 rounded border">Auto</button>
                  </div>
                  <div className={row}><span className="w-56 shrink-0 inline-block border-2 border-current rounded-md px-2 py-1 text-sm font-extrabold uppercase tracking-wide">Background colour (instead of the photo)</span>
                    <input type="color" value={it.uniArgs.bgColour || "#ffffff"} onChange={(e) => upd({ bgColour: e.target.value })} className="h-7 w-12 cursor-pointer rounded border" />
                    {[["Main", req.mainHex], ["Accent", req.accentHex], ["White", "#ffffff"], ["Black", "#111111"]].map(([label, hex]) => (
                      <button key={label} onClick={() => upd({ bgColour: hex })} className="px-2 py-0.5 rounded border flex items-center gap-1"><span className="keep-colour inline-block w-3 h-3 rounded-full border" style={{ background: hex }} />{label}</button>
                    ))}
                    <button onClick={() => upd({}, ["bgColour"])} className={`px-2 py-0.5 rounded border ${it.uniArgs.bgColour ? "" : "bg-pink-500 text-white border-pink-500"}`}>Photo</button>
                  </div>
                  </>)}
                </div>
              );
            })()}
            {it.uni && !it.aboutArgs && it.source === "universal" && req && (
              <CoverPanel
                value={it.coverArgs}
                onChange={(nx) => void coverApply(it, nx)}
                busy={!!coverBusy[it.n]}
                base={{ own: ownRef.current, headline: it.uniArgs?.headline ?? "", name: req.clinicianName, treatment: U_TREATMENTS.find((t) => t.id === it.uniArgs?.treatmentId)?.name ?? "", area: req.area, brand: [req.mainHex, req.accentHex], fontId: req.answers?.font, facts: aboutFacts((about ?? req.answers) as Record<string, any>, req.area), offset: it.n }}
                makeCutout={cutoutOf}
                moveSel={coverSel[it.n] ?? ""}
                setMoveSel={(k) => setCoverSel((s0) => ({ ...s0, [it.n]: k }))}
              />
            )}
            {it.aboutArgs && (() => {
              const aa0 = it.aboutArgs!;
              const d = aboutDefaults(aa0.layout, aa0.colours);
              const dflt = ABOUT_DEFAULT_FONTS[aa0.layout];
              const set = async (patch: Partial<typeof aa0.colours>, reset = false) => {
                const aa = { ...aa0, colours: reset ? { main: req.mainHex, accent: req.accentHex } : { ...aa0.colours, ...patch } };
                const cv = await renderAboutPost(aa);
                patchItem(it.n, { aboutArgs: aa, uni: [cv], previews: [cv.toDataURL("image/jpeg", 0.6)] });
              };
              const brand = [req.mainHex, req.accentHex];
              const needsFacts = ABOUT_LAYOUTS.find((l) => l.id === aa0.layout)?.needsFacts;
              return (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="space-y-1 rounded border p-2">
                    <div className="font-semibold text-foreground">Move the text and boxes</div>
                    <div className="flex flex-wrap gap-1.5">
                      {aboutMovable(aa0.layout, (aa0.facts ?? []).filter((f) => f.trim()).length).map((m) => (
                        <button key={m.key} onClick={() => setMoveSel((s0) => ({ ...s0, [it.n]: s0[it.n] === m.key ? "" : m.key }))} className={`px-2 py-1 rounded border ${moveSel[it.n] === m.key ? "bg-pink-500 text-white border-pink-500" : ""}`}>{m.label}</button>
                      ))}
                      <button onClick={() => { setMoveSel((s0) => ({ ...s0, [it.n]: "" })); void aboutApply(it, { move: {} }); }} className="px-2 py-1 rounded border">Put everything back</button>
                    </div>
                    <div>{moveSel[it.n] ? "Now drag on the picture above and it moves. Tap the button again when you have finished." : "Tap a button, then drag on the picture to move it."}</div>
                  </div>
                  <div className="font-semibold">Template</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ABOUT_LAYOUTS.map((l) => (
                      <button key={l.id} onClick={() => void aboutApply(it, { layout: l.id as AboutLayout })} className={`px-2 py-1 rounded border ${aa0.layout === l.id ? "bg-pink-500 text-white border-pink-500" : ""}`}>{l.label}</button>
                    ))}
                  </div>
                  {needsFacts && (
                    <label className="block space-y-1"><span>Facts, one per line</span>
                      <textarea className="w-full rounded border p-2 text-foreground" rows={5} value={(aa0.facts ?? []).join("\n")} onChange={(e) => void aboutApply(it, { facts: e.target.value.split("\n") })} /></label>
                  )}
                  {(aa0.layout === "hello" || aa0.layout === "founder") && (
                    <label className="block space-y-1"><span>{aa0.layout === "hello" ? "Label on the card (for example AESTHETIC NURSE)" : "Role under the photo (for example AESTHETIC INJECTOR)"}</span>
                      <input className="w-full rounded border p-2 text-foreground" value={aa0.intro ?? ""} placeholder={aa0.layout === "hello" ? "ABOUT ME" : "AESTHETIC PRACTITIONER"} onChange={(e) => void aboutApply(it, { intro: e.target.value })} /></label>
                  )}
                  {aa0.layout === "intro" && (
                    <label className="block space-y-1"><span>Hello line</span>
                      <input className="w-full rounded border p-2 text-foreground" value={aa0.intro ?? ""} placeholder={`Hi! I'm ${(aa0.name || "").split(" ")[0]} and this is me...`} onChange={(e) => void aboutApply(it, { intro: e.target.value })} /></label>
                  )}
                  <div className="bg-white text-black rounded-lg p-2 space-y-2">
                    <ColourPicker label="Change all (headline and boxes)" value={aa0.colours.head && aa0.colours.head === aa0.colours.box ? aa0.colours.head : undefined} onChange={(v) => void set({ head: v, box: v })} brand={brand} />
                    <ColourPicker label="Headline" value={aa0.colours.head} placeholder={d.head} onChange={(v) => void set({ head: v })} onReset={() => void set({ head: undefined })} brand={brand} />
                    {aa0.layout === "pills" && <ColourPicker label="Boxes" value={aa0.colours.box} placeholder={d.box} onChange={(v) => void set({ box: v })} onReset={() => void set({ box: undefined })} brand={brand} />}
                    {(aa0.layout === "cream" || aa0.layout === "peach" || aa0.layout === "hello" || aa0.layout === "founder") && <ColourPicker label="Background" value={aa0.colours.bg} placeholder={d.bg} onChange={(v) => void set({ bg: v })} onReset={() => void set({ bg: undefined })} brand={brand} />}
                    <ColourPicker label="Text" value={aa0.colours.text} placeholder={d.text} onChange={(v) => void set({ text: v })} onReset={() => void set({ text: undefined })} brand={brand} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1"><span>Headline font</span>
                      <select className="w-full rounded border p-1.5 text-foreground bg-background" value={aa0.fonts?.head ?? dflt.head} onChange={(e) => void aboutApply(it, { fonts: { ...(aa0.fonts ?? {}), head: e.target.value } })}>
                        {["Google fonts", "Your fonts"].map((g) => <optgroup key={g} label={g}>{ABOUT_FONTS.filter((f) => f.group === g).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>)}
                      </select></label>
                    <label className="block space-y-1"><span>Subtitle and writing font</span>
                      <select className="w-full rounded border p-1.5 text-foreground bg-background" value={aa0.fonts?.body ?? dflt.body} onChange={(e) => void aboutApply(it, { fonts: { ...(aa0.fonts ?? {}), body: e.target.value } })}>
                        {["Google fonts", "Your fonts"].map((g) => <optgroup key={g} label={g}>{ABOUT_FONTS.filter((f) => f.group === g).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</optgroup>)}
                      </select></label>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!!aa0.logo} onChange={(e) => void aboutApply(it, { logo: e.target.checked ? it.aboutLogo ?? aa0.logo : null })} />Logo</label>
                    <select className="rounded border p-1 text-foreground bg-background" value={aa0.logoPos ?? "tr"} onChange={(e) => void aboutApply(it, { logoPos: e.target.value as "tr" | "tl" | "br" | "bl" })}>
                      <option value="tr">Top right</option><option value="tl">Top left</option><option value="br">Bottom right</option><option value="bl">Bottom left</option>
                    </select>
                  </div>
                  <button className="px-2 py-0.5 rounded border" onClick={() => void set({}, true)}>Back to their brand colours</button>
                  <div className="font-semibold pt-1">Photo</div>
                  <div className="flex gap-2 overflow-x-auto">
                    {ownRef.current.map((o) => <img key={o.url} src={o.url} onClick={() => void aboutPhoto(it, o.bmp)} className="h-16 rounded max-w-none shrink-0 cursor-pointer border-2 border-transparent hover:border-pink-500" />)}
                  </div>
                  <label className="underline cursor-pointer block">Upload my own photo<input type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e, (b) => void aboutPhoto(it, b))} /></label>
                  {([["Zoom", "z", 1, 2.5, 1], ["Left and right", "x", -1, 1, 0], ["Up and down", "y", -1, 1, 0]] as const).map(([label, key, mn, mx, def]) => (
                    <label key={key} className="flex items-center gap-3"><span className="w-28 shrink-0">{label}</span>
                      <input type="range" min={mn} max={mx} step={0.05} className="flex-1" value={aa0.view?.[key] ?? def} onChange={(e) => void aboutApply(it, { view: { ...(aa0.view ?? {}), [key]: Number(e.target.value) } })} /></label>
                  ))}
                </div>
              );
            })()}
            {isPrem && it.uniArgs && sel?.n === it.n && (() => {
              const i = sel.i;
              const slider = (label: string, key: "zoom" | "panX" | "panY", min: number, max: number, step: number, def: number) => (
                <label className="flex items-center gap-3 text-xs text-muted-foreground"><span className="w-28 shrink-0">{label}</span>
                  <input type="range" min={min} max={max} step={step} className="flex-1" value={it.uniArgs![key]?.[i] ?? def} onChange={(e) => setAdj(it, i, key, Number(e.target.value))} /></label>
              );
              return (
                <div className="space-y-2 border rounded p-2">
                  <div className="text-xs font-semibold">Photo for slide {i + 1}</div>
                  <div className="text-xs text-muted-foreground">Their photos</div>
                  <div className="flex gap-2 overflow-x-auto">
                    {ownRef.current.map((o) => (
                      <div key={o.url} className="shrink-0 text-center">
                        <img src={o.url} onClick={() => setCustom(it, i, o.bmp)} className="h-20 rounded max-w-none shrink-0 cursor-pointer border-2 border-transparent hover:border-pink-500" />
                        {isClub && <button className="text-[11px] underline text-red-600" onClick={async () => {
                          if (!window.confirm("Delete this photo from their photos?")) return;
                          const r = await fetch(`${API}/club/months/${String(req.id).replace(/^club-/, "")}/photos/remove`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ url: o.url }) });
                          if (!r.ok) { toast.error("Could not delete it"); return; }
                          ownRef.current = ownRef.current.filter((x) => x.url !== o.url);
                          loadReq();
                          toast.success("Photo deleted");
                        }}>Delete</button>}
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">Library photos</div>
                  <div className="flex gap-2 overflow-x-auto">
                    {(it.libUrls ?? []).map((u, k) => <img key={u} src={u} onClick={() => { setCustom(it, i, null); pickPhoto({ ...it, uniArgs: { ...it.uniArgs!, custom: undefined } }, i, k); }} className="h-20 rounded max-w-none shrink-0 cursor-pointer border-2 border-transparent hover:border-pink-500" />)}
                  </div>
                  <label className="text-xs underline cursor-pointer">Upload my own photo<input type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e, (b) => setCustom(it, i, b))} /></label>
                  {slider("Zoom", "zoom", 1, 2.5, 0.05, 1)}
                  {slider("Left and right", "panX", -1, 1, 0.05, 0)}
                  {slider("Up and down", "panY", -1, 1, 0.05, 0)}
                </div>
              );
            })()}
            {it.post?.kind === "empower" && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <label className="flex items-center gap-2">Zoom the photo
                  <input type="range" min={1} max={2.5} step={0.05} value={(startFocus(it.post, 0) as number[])[2] ?? 1}
                    onChange={(e) => { const f = startFocus(it.post!, 0); patchItem(it.n, { post: { ...it.post!, focus: { ...(it.post!.focus ?? {}), f0: [f[0], f[1], Number(e.target.value)] as [number, number, number?] } } }); redraw(it.n, 0); }} />
                </label>
                <label className="flex items-center gap-2">Text size
                  <input type="range" min={0.6} max={1.6} step={0.05} value={it.post.textScale ?? 1}
                    onChange={(e) => { patchItem(it.n, { post: { ...it.post!, textScale: Number(e.target.value) } }); redraw(it.n, 0); }} />
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={!!textMode[it.n]} onChange={(e) => setTextMode((m) => ({ ...m, [it.n]: e.target.checked }))} />
                  Drag the text instead of the photo
                </label>
                <button className="underline" onClick={() => { patchItem(it.n, { post: { ...it.post!, textScale: 1, textDx: 0, textDy: 0 } }); redraw(it.n, 0); }}>Reset text</button>
              </div>
            )}
            <textarea value={it.caption} onChange={(e) => patchItem(it.n, { caption: e.target.value })} rows={6} className="w-full text-sm border rounded p-2" />
            <input value={it.tags} onChange={(e) => patchItem(it.n, { tags: e.target.value })} className="w-full text-xs border rounded p-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TenFreeAdmin() {
  // useSearch re-renders when the link changes only the ?id=, which a plain read of window.location did not.
  const id = new URLSearchParams(useSearch()).get("id");
  if (id?.startsWith("club-")) { window.location.replace(`${BASE}/club-builder?id=${id}`); return <div className="p-6">Opening the club builder...</div>; }
  return id ? <Builder key={id} id={id} /> : <List />;
}
