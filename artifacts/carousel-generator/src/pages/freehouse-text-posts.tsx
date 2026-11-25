import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";

// cybersuite.com/freeholdtext : Freehold Socials text only posts. Black, cyan and white, big League Spartan headlines,
// one highlighted phrase on each. Made to catch the eye of the public and of pub, restaurant and hotel owners.
// Press the button and all of them are drawn, uploaded and loaded into the scheduler at 12 noon daily from tomorrow.

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1350;
const BLACK = "#000000";
const WHITE = "#ffffff";
const CYAN = "#00e5ff";
const DEEP_CYAN = "#00a9be"; // cyan that still reads on a white background

type Scheme = "black" | "cyan" | "white";
type TextPost = { id: string; scheme: Scheme; head: string; sub: string; caption: string };

// A phrase between asterisks is the highlighted one.
const INITIAL_POSTS: TextPost[] = [
  {
    id: "ghost", scheme: "black",
    head: "Your pub has a ghost. *POST ABOUT IT.*",
    sub: "Nobody has ever scrolled past a haunted snug.",
    caption: "Every old pub has a story. A creaky stair, a cold spot by the fruit machine, a regular who has not left since 1987 and might not be entirely alive. Your customers want that story, and so do the local papers, the ghost tour people and the lad who films everything. I turn the spookiest corner of your pub into a post people send to their mates. Comment GHOST and I will show you how. What is the strangest thing that has ever happened behind your bar?\n\n#pubsofinstagram #hauntedpubs #pubmarketing #landlordlife #freeholdsocials",
  },
  {
    id: "chef", scheme: "cyan",
    head: "Your chef is a *LEGEND.* Your Instagram says closed.",
    sub: "Let's fix that before the pie starts a petition.",
    caption: "Your chef is working miracles in a kitchen the size of a wardrobe, and your Instagram last posted in August. Somewhere a hungry stranger is scrolling past a pie that deserves a medal. I make the posts, you keep the pass running. Comment CHEF and I will show you what a week of real food content looks like. What is the dish your kitchen is quietly proud of?\n\n#restaurantmarketing #chefsofinstagram #pubfood #hospitalityuk #freeholdsocials",
  },
  {
    id: "real", scheme: "white",
    head: "Stop posting AI pies. Nobody wants to eat a *MELTED ROBOT.*",
    sub: "Real food. Real faces. Real hungry customers.",
    caption: "I have seen the AI pies. The pastry has no edges and the gravy appears to be breathing. Your customers can tell, and so can everyone who has ever been let down by a photo that looked nothing like the plate. Your real food, shot by you on a phone, wins every time. Comment REAL and I will show you how I make real photos look fantastic. Which dish do your regulars order without even looking at the menu?\n\n#realfood #pubgrub #foodphotography #supportlocalpubs #freeholdsocials",
  },
  {
    id: "curry", scheme: "black",
    head: "Free curry Thursday has run for six years. Your socials found out *YESTERDAY.*",
    sub: "We tell the town before the poppadoms go cold.",
    caption: "Six years of free curry night and half the town still has no idea. Meanwhile the quiz team has been quietly eating for free since 2019 and telling nobody. A weekly special deserves a weekly post, made properly and sent out before the poppadoms go cold. Comment CURRY and I will set your weekly special up so it fills the room. What is the offer that your regulars know about and everyone else has missed?\n\n#pubdeals #curryclub #quiznight #localpub #freeholdsocials",
  },
  {
    id: "pillow", scheme: "white",
    head: "Hoteliers: your pillows deserve a *FAN CLUB.*",
    sub: "Guests photograph the cushions. Give them something to share.",
    caption: "Guests will photograph a cushion if you give them a reason. A proper hotel bed, a breakfast that makes the table go quiet, a view from room six that no one has ever shown anyone. I find the thing your guests already love and turn it into a post that fills your calendar. Comment PILLOW and I will tell you what I would post first. What is the one thing every guest mentions in the review book?\n\n#boutiquehotel #hotelmarketing #bedandbreakfast #hospitalityuk #freeholdsocials",
  },
  {
    id: "carpet", scheme: "cyan",
    head: "Your sticky carpet has seen *THINGS.* That is a brand story.",
    sub: "Character sells. Beige never has.",
    caption: "That carpet has seen weddings, wakes, three Christmas parties and a very ambitious karaoke night. Somewhere in there is a brand. Pubs with character beat pubs with beige every single time, and people travel for the ones with a story. I help you shout about the bits other places would paint over. Comment CARPET and I will show you what makes your pub impossible to copy. What is the most British thing that has ever happened in your pub?\n\n#pubcharacter #localpubs #traditionalpub #pubculture #freeholdsocials",
  },
  {
    id: "menu", scheme: "black",
    head: "Restaurant owners: if your menu is a PDF from 2019, we need to *TALK.*",
    sub: "Gently. With a drink in hand.",
    caption: "If your menu is a PDF from 2019, it is probably still listing a dish the chef retired years ago. Your menu is your shop window, and a blurry PDF is a very small window. A handful of crisp posts of what you actually serve now will do more than any leaflet drop. Comment MENU and I will show you how I turn a tired menu into a week of posts. What is the dish you wish more people knew about?\n\n#menudesign #restaurantowner #pubfood #hospitalitymarketing #freeholdsocials",
  },
  {
    id: "pie", scheme: "white",
    head: "Somewhere near you, a pie is so good it needs a *PASSPORT.*",
    sub: "Go and find it. Then tell your friends.",
    caption: "Somewhere near you, a landlord is serving a pie so good it should have its own passport. Go and find it, then tell the people you love. And if you are the landlord, I am the person who makes sure the whole town finds out too. I run social media for pubs, bars, restaurants and hotels, with real photos and a bit of cheek. Comment PIE and I will send you a free sample post. Where is the best pie you have ever eaten?\n\n#bestpie #pubgrubuk #supportlocalhospitality #foodie #freeholdsocials",
  },
];

const SCHEMES: Record<Scheme, { bg: string; ink: string; accent: string; sub: string; highlightBox: boolean }> = {
  black: { bg: BLACK, ink: WHITE, accent: CYAN, sub: WHITE, highlightBox: false },
  cyan: { bg: CYAN, ink: BLACK, accent: CYAN, sub: BLACK, highlightBox: true },
  white: { bg: WHITE, ink: BLACK, accent: DEEP_CYAN, sub: BLACK, highlightBox: false },
};

type Tok = { w: string; a: boolean };

function tokenise(head: string): Tok[] {
  const toks: Tok[] = [];
  let acc = false;
  for (let w of head.split(" ")) {
    let a = acc;
    if (w.startsWith("*")) { acc = true; a = true; w = w.slice(1); }
    if (w.endsWith("*")) { acc = false; w = w.slice(0, -1); }
    toks.push({ w, a });
  }
  return toks;
}

function drawPost(canvas: HTMLCanvasElement, p: TextPost) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  const s = SCHEMES[p.scheme];
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  const m = 90;
  const maxW = W - 2 * m;
  const fam = `"League Spartan", "Arial Black", sans-serif`;
  const toks = tokenise(p.head);

  let size = 150;
  let lines: Tok[][] = [];
  let lh = 0;
  for (; size > 40; size -= 4) {
    ctx.font = `900 ${size}px ${fam}`;
    lh = Math.round(size * 1.04);
    lines = [];
    let cur: Tok[] = [];
    let cw = 0;
    const space = ctx.measureText(" ").width;
    for (const t of toks) {
      const ww = ctx.measureText(t.w).width;
      if (cur.length && cw + space + ww > maxW) { lines.push(cur); cur = []; cw = 0; }
      cw += (cur.length ? space : 0) + ww;
      cur.push(t);
    }
    if (cur.length) lines.push(cur);
    if (lines.length * lh <= 720) break;
  }

  const subSize = 42;
  const subFam = `500 ${subSize}px ${fam}`;
  ctx.font = subFam;
  const subLines: string[] = [];
  let cur = "";
  for (const w of p.sub.split(" ")) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= maxW) cur = t; else { subLines.push(cur); cur = w; }
  }
  if (cur) subLines.push(cur);

  const block = lines.length * lh + 44 + subLines.length * 58;
  let y = Math.max(110, Math.round((H - block) / 2) - 40);
  ctx.textBaseline = "top";
  ctx.font = `900 ${size}px ${fam}`;
  const space = ctx.measureText(" ").width;
  for (const line of lines) {
    let x = m;
    for (const t of line) {
      const wd = ctx.measureText(t.w).width;
      if (t.a && s.highlightBox) {
        ctx.fillStyle = BLACK;
        ctx.fillRect(x - 12, y + Math.round(size * 0.12), wd + 24, lh - Math.round(size * 0.08));
        ctx.fillStyle = CYAN;
      } else {
        ctx.fillStyle = t.a ? s.accent : s.ink;
      }
      ctx.fillText(t.w, x, y);
      x += wd + space;
    }
    y += lh;
  }
  y += 44;
  ctx.font = subFam;
  ctx.fillStyle = s.sub;
  for (const l of subLines) { ctx.fillText(l, m, y); y += 58; }

  // The mark at the bottom.
  ctx.fillStyle = p.scheme === "cyan" ? WHITE : s.accent;
  ctx.fillRect(m, H - 176, 14, 76);
  ctx.font = `900 44px ${fam}`;
  ctx.fillStyle = s.ink;
  ctx.fillText("FREEHOLD", m + 36, H - 178);
  ctx.fillStyle = p.scheme === "cyan" ? BLACK : s.accent;
  ctx.fillText("SOCIALS", m + 36, H - 134);
}

// Tomorrow at 12 noon, as the local "YYYY-MM-DDTHH:mm" string the schedule screen expects.
function tomorrowNoon(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T12:00`;
}

const noDashes = (t: string) => t.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");

function Preview({ post, tick }: { post: TextPost; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) drawPost(ref.current, post); }, [post, tick]);
  return <canvas ref={ref} style={{ width: "100%", height: "auto", display: "block", border: "3px solid #000" }} />;
}

export default function FreeholdTextPosts() {
  const { presets } = usePresets();
  const preset = useMemo(() => presets.find((p) => /free(house|hold)/i.test(p.name)), [presets]);
  const [posts, setPosts] = useState<TextPost[]>(INITIAL_POSTS);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [items, setItems] = useState<SchedulePostPayload[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=League+Spartan:wght@500;900&display=swap";
    document.head.appendChild(link);
    Promise.all([document.fonts.load('900 60px "League Spartan"'), document.fonts.load('500 40px "League Spartan"')])
      .then(() => setTick((t) => t + 1))
      .catch(() => setTick((t) => t + 1));
    return () => { link.remove(); };
  }, []);

  const update = (id: string, patch: Partial<TextPost>) => setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const uploadPng = useCallback(async (dataUrl: string, name: string): Promise<string> => {
    let url = "";
    for (let attempt = 0; attempt < 3 && !url; attempt++) {
      try {
        const up = await fetch(`${BASE}/api/content/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images: [{ name, base64: dataUrl }] }),
        });
        if (!up.ok) throw new Error("Image upload failed");
        const { results } = (await up.json()) as { results: { url: string }[] };
        url = results[0]?.url ?? "";
        if (!url) throw new Error("No image URL returned");
      } catch (e) {
        if (attempt === 2) throw e;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    return url;
  }, []);

  // Draws every post, uploads it, then opens the schedule screen at 12 noon daily from tomorrow.
  // Nothing is booked until the person confirms on that screen.
  const scheduleAll = async () => {
    if (!preset) { toast.error("I cannot find the Freehold Socials client"); return; }
    setBusy("Starting");
    try {
      const canvas = document.createElement("canvas");
      const out: SchedulePostPayload[] = [];
      for (let i = 0; i < posts.length; i++) {
        setBusy(`Uploading post ${i + 1} of ${posts.length}`);
        drawPost(canvas, posts[i]);
        const url = await uploadPng(canvas.toDataURL("image/png"), `freehold-text-${posts[i].id}-${Date.now()}.png`);
        out.push({ title: `${posts[i].head.replace(/\*/g, "").slice(0, 60)} · Freehold Socials`, caption: noDashes(posts[i].caption).trim(), imageUrls: [url] });
      }
      setItems(out);
      setOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "Could not get the posts ready to schedule");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: "#000", fontFamily: "'League Spartan', 'Arial Black', sans-serif" }}>
      <div style={{ background: "#000", padding: "18px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/freehouse" style={{ background: CYAN, color: "#000", padding: "8px 14px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 12, textDecoration: "none" }}>Back to Freehold Socials</Link>
        <span style={{ color: CYAN, fontWeight: 900, letterSpacing: "0.2em", fontSize: 12, textTransform: "uppercase" }}>Text posts</span>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 80px" }}>
        <h1 style={{ fontSize: 56, fontWeight: 900, lineHeight: 0.9, margin: 0, textTransform: "uppercase" }}>Text only posts</h1>
        <div style={{ height: 8, background: CYAN, width: 140, margin: "14px 0 18px" }} />
        <p style={{ fontSize: 18, maxWidth: 680, lineHeight: 1.25, fontWeight: 500 }}>
          Eight outlandish posts for the public and for pub, restaurant and hotel owners. Change any words or caption below, then press the button and they are loaded into the scheduler at 12 noon daily from tomorrow. Nothing goes out until you confirm.
        </p>
        <button
          onClick={scheduleAll}
          disabled={!!busy || !preset}
          style={{ marginTop: 14, background: "#000", color: CYAN, border: "none", padding: "16px 26px", fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", cursor: busy ? "wait" : "pointer", opacity: busy || !preset ? 0.6 : 1 }}
        >
          {busy ?? "Schedule all 8 at 12 noon daily"}
        </button>
        {!preset && <p style={{ color: "#b00", fontWeight: 500 }}>Loading the Freehold Socials client...</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 28, marginTop: 36 }}>
          {posts.map((p, i) => (
            <div key={p.id}>
              <div style={{ fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Post {i + 1}</div>
              <Preview post={p} tick={tick} />
              <label style={{ display: "block", fontSize: 12, marginTop: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>Headline (put *stars* round the highlighted words)</label>
              <textarea value={p.head} onChange={(e) => update(p.id, { head: e.target.value })} rows={2} style={{ width: "100%", border: "2px solid #000", padding: 8, fontFamily: "inherit", fontWeight: 500, fontSize: 15 }} />
              <label style={{ display: "block", fontSize: 12, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Small line</label>
              <input value={p.sub} onChange={(e) => update(p.id, { sub: e.target.value })} style={{ width: "100%", border: "2px solid #000", padding: 8, fontFamily: "inherit", fontWeight: 500, fontSize: 15 }} />
              <label style={{ display: "block", fontSize: 12, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Caption</label>
              <textarea value={p.caption} onChange={(e) => update(p.id, { caption: e.target.value })} rows={9} style={{ width: "100%", border: "2px solid #000", padding: 8, fontFamily: "inherit", fontWeight: 500, fontSize: 14 }} />
            </div>
          ))}
        </div>
      </div>

      {open && items && (
        <ScheduleModal
          presetId={preset?.id ?? null}
          presetName={preset?.name}
          postType="single-image"
          posts={items}
          perPostCaptions
          initialScheduledAt={tomorrowNoon()}
          initialGapMinutes={1440}
          keepClockTime
          sourceTool="freehold-text-posts"
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); toast.success("Scheduled at 12 noon daily"); }}
        />
      )}
    </div>
  );
}
