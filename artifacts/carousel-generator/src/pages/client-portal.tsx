import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, CalendarDays, ChevronLeft, X, Clock, CheckCircle2, FileImage, Layers, Film, ImageIcon, ShieldCheck, Camera, ChevronRight, Share, Smile, MessageSquarePlus, ClipboardList, Clapperboard, Circle, Star, FileText, Download, Newspaper, TrendingUp, Bell, BellOff, Gift } from "lucide-react";
import { toast } from "sonner";
import { NewsList } from "@/pages/aesthetic-news";

const BASE = import.meta.env.BASE_URL || "/";
const SEND_LABEL = "Send to Vanessa, Aesthetic Angel / Digital Darling";

type CalendarPost = { id: number; date: string; title: string; caption: string; postType: string; status: string; color: string; imageUrl: string | null; imageUrls: string[]; source: "calendar" | "scheduler"; scheduledPostId: number | null; };
type ApprovalBatch = { id: number; name: string; token: string; status: string; totalImages: number; pendingImages: number; approvedImages: number; rejectedImages: number; createdAt: string; expiresAt: string | null; };
type RevenueIdea = { title: string; instructions: string; draftContent: string; weekOf: string };
type PortalData = { clientName: string; logoUrl: string | null; upcomingPosts: CalendarPost[]; approvalBatches: ApprovalBatch[]; revenueIdeas: RevenueIdea[]; };
type Resource = { id: number; title: string; description: string; fileKey: string; fileName: string; createdAt: string; };

const POST_TYPE_ICON: Record<string, React.ReactNode> = {
  carousel: <Layers className="w-3.5 h-3.5" />,
  "single-image": <ImageIcon className="w-3.5 h-3.5" />,
  story: <Film className="w-3.5 h-3.5" />,
};
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(dateStr: string) { const [y, m, d] = dateStr.split("-").map(Number); return `${d} ${MONTH_NAMES[m - 1]} ${y}`; }
function getDayOfWeek(dateStr: string) { const d = new Date(dateStr + "T12:00:00"); return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]; }
function fileToBase64(file: File): Promise<string> { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file); }); }

// Converts the VAPID public key (base64url) into the Uint8Array format the
// Push API's applicationServerKey option expects.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Downloads an image URL to the device rather than opening it in a new tab.
// Falls back to a plain link open if the fetch/blob approach is blocked.
async function downloadImage(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank");
  }
}

async function copyCaption(caption: string) {
  try {
    await navigator.clipboard.writeText(caption);
    toast.success("Caption copied.");
  } catch {
    toast.error("Could not copy, please select and copy the text manually.");
  }
}

function SlideShow({ urls }: { urls: string[] }) {
  const [idx, setIdx] = useState(0);
  if (urls.length === 0) return null;
  return (
    <div className="relative select-none">
      <div className="aspect-[4/5] bg-zinc-900 rounded-xl overflow-hidden">
        <img src={urls[idx]} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
      </div>
      {urls.length > 1 && (
        <>
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white disabled:opacity-30 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setIdx((i) => Math.min(urls.length - 1, i + 1))} disabled={idx === urls.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white disabled:opacity-30 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex justify-center gap-1.5 mt-2">
            {urls.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const REEL_GROUPS: { heading: string; items: string[] }[] = [
  { heading: "The basics & consultations", items: [
    "What actually happens in a consultation",
    "3 things to know before your first treatment",
    "Why we always start with a consultation",
    "Skin consultations and why they matter",
    "What 'less is more' really means in aesthetics",
    "How we keep results looking natural",
    "Signs you might be ready for a skin consultation",
  ]},
  { heading: "Treatment explainers", items: [
    "How long does filler really last?",
    "What is skin boosting and who is it for?",
    "The difference between filler and anti-wrinkle treatment",
    "What is microneedling and what it does",
    "Polynucleotides explained in plain English",
    "Skin boosters, explained",
    "Injectable skin hydration, explained",
    "Gentle chemical peels 101",
    "Lip treatments for a natural finish",
    "Under-eye options explained",
    "Jawline and profile balancing",
    "Hand rejuvenation, the forgotten area",
    "LED light therapy basics",
    "Microneedling for texture",
  ]},
  { heading: "Prep & aftercare", items: [
    "What to expect the day after a treatment",
    "How to prep your skin before your appointment",
    "Aftercare dos and don'ts",
  ]},
  { heading: "Behind the scenes", items: [
    "A day in the life at the clinic",
    "Setting up the treatment room",
    "Meet the person behind the clinic",
    "Meet the team",
    "What's in my treatment kit",
    "How we keep everything clean and safe",
    "The bit clients never see before an appointment",
    "Morning prep and restock routine",
    "Our favourite products and why",
  ]},
  { heading: "The client journey", items: [
    "A client's first visit, start to finish",
    "What our follow-up appointments look like",
    "Why we say no sometimes",
    "How we tailor treatments to each face",
    "Real talk: managing expectations",
    "What good aftercare support looks like",
  ]},
  { heading: "Myth busting", items: [
    "'Filler migrates everywhere': the truth",
    "'Anti-wrinkle treatment is addictive': myth",
    "'You'll look done': not with us",
    "'It's only for older women': nope",
    "'Once you start you can't stop': busted",
    "'Cheaper is just as good': why it isn't",
    "'It's really painful': what it actually feels like",
    "Reacting to aesthetics myths online",
    "Rating common skincare myths",
  ]},
  { heading: "You & your personality", items: [
    "Things I'd tell my younger self about skin",
    "Why I got into aesthetics",
    "My own skincare non-negotiables",
    "The compliment that made my week",
    "What I wish clients knew",
    "My biggest pet peeve in the industry",
    "A treatment I'll never regret having",
    "Get ready with me before clinic",
    "Things clients say that I love",
  ]},
  { heading: "Answering their questions", items: [
    "Answering your most-asked question",
    "'How much does it cost?': how we price",
    "'How do I book?': a quick walkthrough",
    "'Will it hurt?': an honest answer",
    "'How often should I come?': it depends",
    "'Can I have it before an event?': timing",
    "'Is it safe?': how we keep you safe",
  ]},
  { heading: "Seasonal & timely", items: [
    "Prepping your skin for summer",
    "Winter skin survival tips",
    "Getting party-ready the right way",
    "New year, new skin goals",
    "Valentine's self-love, not just treatments",
    "Wedding season skin timeline",
    "Back to routine after the holidays",
  ]},
  { heading: "Clinic news & offers", items: [
    "Introducing a new treatment",
    "What's new at the clinic this month",
    "A little thank you to our clients",
    "We've hit a milestone",
    "Meet our newest bit of kit",
  ]},
  { heading: "Skincare education", items: [
    "Building a simple skincare routine",
    "SPF: the one step you shouldn't skip",
    "Why hydration matters for your skin",
    "Retinol: how to start without the drama",
    "The order to apply your skincare",
    "Ingredients that actually work",
    "What causes those under-eye shadows",
    "Menopause and your skin",
    "Skin in your 30s vs 40s vs 50s",
    "The skincare mistake I see most",
  ]},
  { heading: "Confidence & connection", items: [
    "It's not about looking different, it's feeling like you",
    "A confidence story from the chair",
    "Ageing is a privilege, my take",
    "Self-care that isn't a treatment",
    "Why we celebrate every client",
    "Little wins that make a big difference",
  ]},
  { heading: "Trends & fun", items: [
    "A trending audio with a clinic twist",
    "Green flags in a good clinic",
    "Red flags to watch out for",
    "This or that: skincare edition",
    "Expectation vs reality of a treatment day",
    "A week of skin in the life",
    "Answering 'would you do it again?'",
    "The one tip I give every single client",
  ]},
];
const REEL_TOTAL = REEL_GROUPS.reduce((n, g) => n + g.items.length, 0);

type Tab = "upcoming" | "approvals" | "ba" | "selfies" | "request" | "onboarding" | "reels" | "reviews" | "resources" | "news" | "revenue" | "homework" | "bonus" | "rants" | "connect";

const TAB_ICON: Record<Tab, React.ReactNode> = {
  upcoming: <CalendarDays className="w-4 h-4" />,
  approvals: <ShieldCheck className="w-4 h-4" />,
  ba: <Camera className="w-4 h-4" />,
  selfies: <Smile className="w-4 h-4" />,
  request: <MessageSquarePlus className="w-4 h-4" />,
  reviews: <Star className="w-4 h-4" />,
  onboarding: <ClipboardList className="w-4 h-4" />,
  reels: <Clapperboard className="w-4 h-4" />,
  resources: <FileText className="w-4 h-4" />,
  news: <Newspaper className="w-4 h-4" />,
  revenue: <TrendingUp className="w-4 h-4" />,
  homework: <MessageSquarePlus className="w-4 h-4" />,
  bonus: <Gift className="w-4 h-4" />,
  rants: <Newspaper className="w-4 h-4" />,
};

export default function ClientPortal({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showTip, setShowTip] = useState(true);

  // "unknown" = hasn't decided yet, so we show the banner offering to turn them on.
  const [notifState, setNotifState] = useState<"unknown" | "on" | "off" | "unsupported">("unknown");
  const [notifBusy, setNotifBusy] = useState(false);

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);

  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);

  const [before, setBefore] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);
  const [beforePrev, setBeforePrev] = useState("");
  const [afterPrev, setAfterPrev] = useState("");
  const [treatment, setTreatment] = useState("");
  const [story, setStory] = useState("");
  const [baName, setBaName] = useState("");
  const [baBusy, setBaBusy] = useState(false);
  const [baDone, setBaDone] = useState(false);
  const [baErr, setBaErr] = useState("");
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const [selfie, setSelfie] = useState<File | null>(null);
  const [selfiePrev, setSelfiePrev] = useState("");
  const [selfieNote, setSelfieNote] = useState("");
  const [selfieName, setSelfieName] = useState("");
  const [selfieBusy, setSelfieBusy] = useState(false);
  const [selfieDone, setSelfieDone] = useState(false);
  const [selfieErr, setSelfieErr] = useState("");
  const selfieRef = useRef<HTMLInputElement>(null);

  const [reqText, setReqText] = useState("");
  const [reqName, setReqName] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqDone, setReqDone] = useState(false);
  const [reqErr, setReqErr] = useState("");

  const [hwSet, setHwSet] = useState<{ id: number; question1: string; question2: string; question3: string; question4?: string; question5?: string; question6?: string; question7?: string; question8?: string; question9?: string; question10?: string } | null>(null);
  const [hwA1, setHwA1] = useState("");
  const [hwA2, setHwA2] = useState("");
  const [hwA3, setHwA3] = useState("");
  const [hwA4, setHwA4] = useState("");
  const [hwA5, setHwA5] = useState("");
  const [hwA6, setHwA6] = useState("");
  const [hwA7, setHwA7] = useState("");
  const [hwA8, setHwA8] = useState("");
  const [hwA9, setHwA9] = useState("");
  const [hwA10, setHwA10] = useState("");
  const [hwBusy, setHwBusy] = useState(false);
  const [hwDone, setHwDone] = useState(false);
  const [hwErr, setHwErr] = useState("");

  const [bcItems, setBcItems] = useState<{ id: number; title: string; note: string; mediaUrl: string | null; mediaType: string; createdAt: string }[]>([]);
  const [bcLoading, setBcLoading] = useState(true);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [blogLoading, setBlogLoading] = useState(false);

  const [obTreatments, setObTreatments] = useState("");
  const [obAbout, setObAbout] = useState("");
  const [obLogo, setObLogo] = useState<File | null>(null);
  const [obLogoPrev, setObLogoPrev] = useState("");
  const [obName, setObName] = useState("");
  const [obBusy, setObBusy] = useState(false);
  const [obDone, setObDone] = useState(false);
  const [obErr, setObErr] = useState("");
  const obLogoRef = useRef<HTMLInputElement>(null);
  const [rvText, setRvText] = useState("");
  const [rvFrom, setRvFrom] = useState("");
  const [rvShot, setRvShot] = useState<File | null>(null);
  const [rvShotPrev, setRvShotPrev] = useState("");
  const [rvName, setRvName] = useState("");
  const [rvBusy, setRvBusy] = useState(false);
  const [rvDone, setRvDone] = useState(false);
  const [rvErr, setRvErr] = useState("");
  const rvShotRef = useRef<HTMLInputElement>(null);

  const reelsKey = `tcs_reels_${token}`;
  const [ticked, setTicked] = useState<Record<number, boolean>>({});
  useEffect(() => { try { setTicked(JSON.parse(localStorage.getItem(reelsKey) || "{}")); } catch { /* ignore */ } }, [reelsKey]);
  const toggleReel = (i: number) => setTicked((prev) => { const n = { ...prev, [i]: !prev[i] }; try { localStorage.setItem(reelsKey, JSON.stringify(n)); } catch { /* ignore */ } return n; });
  const doneCount = Object.values(ticked).filter(Boolean).length;

  useEffect(() => {
    fetch(`${BASE}api/portal/${token}`)
      .then(async (r) => { const json = await r.json(); if (!r.ok) throw new Error(json.error || "failed"); setData(json); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetch(`${BASE}api/portal/${token}/homework`)
      .then((r) => r.json())
      .then((d) => {
        setHwSet(d.set || null);
        if (d.existingReply) {
          setHwA1(d.existingReply.answer1 || "");
          setHwA2(d.existingReply.answer2 || "");
          setHwA3(d.existingReply.answer3 || "");
          setHwA4(d.existingReply.answer4 || "");
          setHwA5(d.existingReply.answer5 || "");
          setHwA6(d.existingReply.answer6 || "");
          setHwA7(d.existingReply.answer7 || "");
          setHwA8(d.existingReply.answer8 || "");
          setHwA9(d.existingReply.answer9 || "");
          setHwA10(d.existingReply.answer10 || "");
          setHwDone(true);
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    setBcLoading(true);
    fetch(`${BASE}api/portal/${token}/bonus-content`)
      .then((r) => r.json())
      .then((d) => setBcItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => setBcItems([]))
      .finally(() => setBcLoading(false));
  }, [token]);

  useEffect(() => {
    setBlogLoading(true);
    fetch(`${BASE}api/blog-posts`)
      .then((r) => r.json())
      .then((d) => setBlogPosts(Array.isArray(d.posts) ? d.posts : []))
      .catch(() => setBlogPosts([]))
      .finally(() => setBlogLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${BASE}api/portal-resources`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setResources(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setResourcesLoading(false));
  }, []);

  // Register the service worker once on load, and work out whether this
  // device already has an active push subscription so we know whether to
  // show the "turn on notifications" banner or not.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotifState("unsupported");
      return;
    }
    navigator.serviceWorker.register(`${BASE}sw.js`).then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (existing && Notification.permission === "granted") {
        setNotifState("on");
      } else if (Notification.permission === "denied") {
        setNotifState("off");
      } else {
        setNotifState("unknown");
      }
    }).catch(() => setNotifState("unsupported"));
  }, []);

  const enableNotifications = async () => {
    setNotifBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setNotifState("off"); return; }

      const keyRes = await fetch(`${BASE}api/portal-push/vapid-public-key`);
      const keyData = await keyRes.json().catch(() => ({}));
      if (!keyRes.ok || !keyData.publicKey) throw new Error("Notifications aren't ready yet, please try again shortly.");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });
      const subJson = sub.toJSON();

      const r = await fetch(`${BASE}api/portal/${token}/push-subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      });
      if (!r.ok) throw new Error("Couldn't save that, please try again.");
      setNotifState("on");
      toast.success("Notifications are on, we'll ping you when there's news, ideas or posted work.");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't turn on notifications, please try again.");
    } finally {
      setNotifBusy(false);
    }
  };

  const submitReject = async (post: CalendarPost) => {
    if (!rejectReason.trim()) { toast.error("Please add a reason."); return; }
    if (!post.scheduledPostId) return;
    setRejectBusy(true);
    try {
      const r = await fetch(`${BASE}api/portal/${token}/posts/${post.scheduledPostId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not reject, please try again.");
      setData((prev) => (prev ? { ...prev, upcomingPosts: prev.upcomingPosts.filter((p) => p.id !== post.id) } : prev));
      setRejectingId(null);
      setRejectReason("");
      toast.success("Rejected, it's been pulled from the schedule.");
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
    } finally {
      setRejectBusy(false);
    }
  };

  const uploadOne = async (f: File): Promise<string> => {
    const base64 = await fileToBase64(f);
    const r = await fetch(`${BASE}api/content/upload-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: [{ name: f.name, base64 }] }) });
    if (!r.ok) throw new Error("Upload failed, please try a smaller photo.");
    const d = await r.json(); const url = d.results?.[0]?.url; if (!url) throw new Error("Upload failed, please try again."); return url;
  };
  const send = async (body: Record<string, unknown>) => {
    const r = await fetch(`${BASE}api/submit/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Could not send, please try again."); }
  };

  const pick = (which: "before" | "after") => (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const prev = URL.createObjectURL(f); if (which === "before") { setBefore(f); setBeforePrev(prev); } else { setAfter(f); setAfterPrev(prev); } };
  const pickSelfie = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; setSelfie(f); setSelfiePrev(URL.createObjectURL(f)); };
  const pickLogo = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; setObLogo(f); setObLogoPrev(URL.createObjectURL(f)); };

  const submitBA = async () => { setBaErr(""); if (!before || !after) { setBaErr("Please add both a before and an after photo."); return; } setBaBusy(true); try { const beforeUrl = await uploadOne(before); const afterUrl = await uploadOne(after); await send({ beforeUrl, afterUrl, treatment, story, submitterName: baName }); setBaDone(true); } catch (e: any) { setBaErr(e?.message || "Something went wrong."); } finally { setBaBusy(false); } };
  const submitSelfie = async () => { setSelfieErr(""); if (!selfie) { setSelfieErr("Please add a selfie first."); return; } setSelfieBusy(true); try { const url = await uploadOne(selfie); await send({ beforeUrl: url, afterUrl: url, treatment: "SELFIE", story: selfieNote, submitterName: selfieName }); setSelfieDone(true); } catch (e: any) { setSelfieErr(e?.message || "Something went wrong."); } finally { setSelfieBusy(false); } };
  const submitHomework = async () => {
    setHwErr("");
    if (!hwSet) { setHwErr("No questions to answer right now."); return; }
    setHwBusy(true);
    try {
      const r = await fetch(`${BASE}api/portal/${token}/homework/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId: hwSet.id,
          answer1: hwA1, answer2: hwA2, answer3: hwA3,
          answer4: hwA4, answer5: hwA5, answer6: hwA6, answer7: hwA7,
          answer8: hwA8, answer9: hwA9, answer10: hwA10,
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      setHwDone(true);
    } catch (e: any) {
      setHwErr(e?.message || "Something went wrong.");
    } finally {
      setHwBusy(false);
    }
  };
  const submitRequest = async () => { setReqErr(""); if (!reqText.trim()) { setReqErr("Tell us what you'd like a post about."); return; } setReqBusy(true); try { await send({ beforeUrl: "", afterUrl: "", treatment: "POST REQUEST", story: reqText, submitterName: reqName }); setReqDone(true); } catch (e: any) { setReqErr(e?.message || "Something went wrong."); } finally { setReqBusy(false); } };
  const submitOnboarding = async () => {
    setObErr("");
    if (!obTreatments.trim() && !obAbout.trim() && !obLogo) { setObErr("Add your treatments, a bit about you, or your logo."); return; }
    setObBusy(true);
    try {
      let logoUrl = "";
      if (obLogo) logoUrl = await uploadOne(obLogo);
      const storyText = `ABOUT THE BUSINESS:\n${obAbout || "(none given)"}\n\nTREATMENT LIST:\n${obTreatments || "(none given)"}`;
      await send({ beforeUrl: logoUrl, afterUrl: "", treatment: "ONBOARDING", story: storyText, submitterName: obName });
      setObDone(true);
    } catch (e: any) { setObErr(e?.message || "Something went wrong."); } finally { setObBusy(false); }
  };
  const pickReviewShot = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; setRvShot(f); setRvShotPrev(URL.createObjectURL(f)); };
  const submitReview = async () => {
    setRvErr("");
    if (!rvText.trim() && !rvShot) { setRvErr("Paste a review or add a screenshot."); return; }
    setRvBusy(true);
    try {
      let shotUrl = "";
      if (rvShot) shotUrl = await uploadOne(rvShot);
      const storyText = `REVIEW FROM: ${rvFrom || "(not given)"}\n\n${rvText || "(screenshot attached)"}`;
      await send({ beforeUrl: shotUrl, afterUrl: "", treatment: "REVIEW", story: storyText, submitterName: rvName });
      setRvDone(true);
    } catch (e: any) { setRvErr(e?.message || "Something went wrong."); } finally { setRvBusy(false); }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>;
  if (error === "not_found" || !data) {
    return (<div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4"><div className="text-center max-w-md"><AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" /><h1 className="text-xl font-bold text-white mb-2">Portal Not Found</h1><p className="text-zinc-400">This link doesn't exist or has been removed. Please contact your social media manager.</p></div></div>);
  }
  if (error) {
    return (<div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4"><div className="text-center max-w-md"><AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" /><h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1><p className="text-zinc-400">Please try again later or contact us.</p></div></div>);
  }

  const pendingBatches = data.approvalBatches.filter((b) => b.pendingImages > 0);
  const reviewedBatches = data.approvalBatches.filter((b) => b.pendingImages === 0);
  const pendingCount = pendingBatches.reduce((n, b) => n + b.pendingImages, 0);
  const revenueIdeas = data.revenueIdeas || [];

  const inputCls = "w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none focus:border-pink-600";
  const sendBtn = "w-full rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-3.5 flex items-center justify-center gap-2";

  const TabBtn = ({ id, label, badge }: { id: Tab; label: string; badge?: number }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
        tab === id
          ? "bg-pink-600 text-white"
          : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
      }`}
    >
      {TAB_ICON[id]}
      <span>{label}</span>
      {badge ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white">{badge}</span> : null}
    </button>
  );
  const DoneCard = ({ onAgain, label }: { onAgain: () => void; label: string }) => (
    <div className="rounded-2xl border border-green-800/40 bg-green-950/20 p-8 text-center"><CheckCircle2 className="w-10 h-10 mx-auto text-green-500 mb-3" /><h3 className="text-white font-semibold mb-1">Sent, thank you.</h3><p className="text-zinc-400 text-sm mb-4">It's landed with Vanessa. {label}</p><button onClick={onAgain} className="text-pink-400 text-sm font-semibold">Send another</button></div>
  );

  let reelIdx = -1;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.logoUrl ? (<img src={data.logoUrl} alt="logo" className="h-9 w-auto object-contain rounded" />) : (<div className="flex items-center gap-2"><Layers className="w-5 h-5 text-pink-500" /><span className="font-bold text-sm text-pink-400">The CyberSuite&trade;</span></div>)}
          </div>
          <div className="text-right"><p className="text-sm font-semibold text-white">{data.clientName}</p><p className="text-xs text-zinc-500">Your Portal</p></div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3 flex flex-wrap gap-2">
          <TabBtn id="upcoming" label="Posts" />
          <TabBtn id="homework" label="Homework" />
          <TabBtn id="bonus" label="Bonus Content" />
              <TabBtn id="rants" label="Vanessa Rants" />
              <TabBtn id="connect" label="Connect" />
          {revenueIdeas.length > 0 && <TabBtn id="revenue" label="Ideas For You" />}
          <TabBtn id="approvals" label="Approvals" badge={pendingCount || undefined} />
          <TabBtn id="ba" label="Before & After" />
          <TabBtn id="selfies" label="Selfies" />
          <TabBtn id="request" label="Request a post" />
          <TabBtn id="reviews" label="Reviews" />
          <TabBtn id="onboarding" label="Get set up" />
          <TabBtn id="reels" label="100 Reels" />
          <TabBtn id="resources" label="Resources" />
          <TabBtn id="news" label="Aesthetic News" />
        </div>
      </header>

      {showTip && (
        <div className="max-w-3xl mx-auto px-4 pt-4"><div className="rounded-xl border border-pink-800/40 bg-pink-950/20 px-4 py-2.5 flex items-center gap-2 text-xs text-pink-200"><Share className="w-4 h-4 shrink-0" /><span>Tip: tap your browser's Share button, then <b>Add to Home Screen</b>, to keep your portal one tap away.</span><button onClick={() => setShowTip(false)} className="ml-auto text-pink-400/70 hover:text-pink-300">Got it</button></div></div>
      )}

      {notifState === "unknown" && (
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 flex items-center gap-2 text-xs text-zinc-300">
            <Bell className="w-4 h-4 shrink-0 text-pink-400" />
            <span>Want a nudge when there's news, a new idea, or your work goes live?</span>
            <button onClick={enableNotifications} disabled={notifBusy} className="ml-auto rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5">
              {notifBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />} Turn on
            </button>
          </div>
        </div>
      )}
      {notifState === "off" && (
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 flex items-center gap-2 text-xs text-zinc-500">
            <BellOff className="w-4 h-4 shrink-0" />
            <span>Notifications are off. You can turn them on any time from your browser's site settings.</span>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8">
        {tab === "upcoming" && (
          <section>
            <div className="flex items-center gap-2 mb-5"><CalendarDays className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Upcoming Content</h2>{data.upcomingPosts.length > 0 && (<span className="ml-auto text-xs text-zinc-500">{data.upcomingPosts.length} post{data.upcomingPosts.length !== 1 ? "s" : ""} scheduled</span>)}</div>
            {data.upcomingPosts.length === 0 ? (<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center"><CalendarDays className="w-8 h-8 mx-auto text-zinc-700 mb-3" /><p className="text-zinc-500">No upcoming content scheduled yet.</p></div>) : (
              <div className="space-y-4">
                {data.upcomingPosts.map((post) => {
                  const urls = post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []);
                  const isRejecting = rejectingId === post.id;
                  return (
                    <div key={post.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                      <div className="p-4">
                        {urls.length > 0 ? <SlideShow urls={urls} /> : (
                          <div className="aspect-square rounded-xl flex items-center justify-center" style={{ backgroundColor: post.color + "22" }}>
                            <FileImage className="w-6 h-6 text-zinc-600" />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2 mt-3 mb-1">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="font-semibold text-white">{getDayOfWeek(post.date)}</span><span>{formatDate(post.date)}</span></div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="flex items-center gap-1 text-xs text-zinc-500 capitalize">{POST_TYPE_ICON[post.postType] || <FileImage className="w-3.5 h-3.5" />}{post.postType.replace("-", " ")}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${post.status === "scheduled" ? "bg-green-900/30 text-green-400 border-green-700/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{post.status}</span>
                          </div>
                        </div>
                        {post.title && <p className="font-medium text-white text-sm">{post.title}</p>}
                        {post.caption && <p className="text-sm text-zinc-400 mt-1 whitespace-pre-wrap">{post.caption}</p>}

                        {urls.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap gap-2">
                            <button onClick={() => urls.forEach((u, i) => downloadImage(u, `${data.clientName.replace(/\s+/g, "-").toLowerCase()}-${post.date}-${i + 1}.jpg`))} className="text-xs font-semibold text-pink-400 hover:text-pink-300 flex items-center gap-1.5 rounded-full border border-pink-800/40 bg-pink-950/10 px-3 py-1.5">
                              <Download className="w-3.5 h-3.5" /> Download image{urls.length > 1 ? "s" : ""}
                            </button>
                            {post.caption && (
                              <button onClick={() => copyCaption(post.caption)} className="text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5">
                                <ClipboardList className="w-3.5 h-3.5" /> Copy caption
                              </button>
                            )}
                          </div>
                        )}

                        {post.source === "scheduler" && (
                          <div className="mt-4 pt-3 border-t border-zinc-800">
                            {!isRejecting ? (
                              <button onClick={() => { setRejectingId(post.id); setRejectReason(""); }} className="text-xs font-semibold text-red-400 hover:text-red-300 flex items-center gap-1">
                                <X className="w-3.5 h-3.5" /> Not happy with this one?
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="Tell us why, so we can put it right..."
                                  rows={3}
                                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-red-500/50"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => submitReject(post)} disabled={rejectBusy} className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold py-2.5 flex items-center justify-center gap-1.5">
                                    {rejectBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Reject this post
                                  </button>
                                  <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold py-2.5 px-4">Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {tab === "revenue" && revenueIdeas.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5"><TrendingUp className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Ideas For You</h2></div>
            <div className="space-y-5">
              {revenueIdeas.map((idea, i) => (
                <div key={i} className="rounded-2xl border border-pink-800/40 bg-pink-950/10 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-white">{idea.title}</h3>
                    <span className="text-xs text-zinc-500 shrink-0">Week of {formatDate(idea.weekOf)}</span>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-pink-400/80 mb-1.5">What to run and why</p>
                    <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{idea.instructions}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-pink-400/80 mb-1.5">Ready-to-use copy</p>
                    <div className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-4"><p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{idea.draftContent}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "approvals" && (
          <section>
            <div className="flex items-center gap-2 mb-5"><ShieldCheck className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Approvals</h2></div>
            {pendingBatches.length === 0 && reviewedBatches.length === 0 && (<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center"><CheckCircle2 className="w-8 h-8 mx-auto text-zinc-700 mb-3" /><p className="text-zinc-500">Nothing waiting on you right now.</p></div>)}
            {pendingBatches.length > 0 && (<div className="space-y-3 mb-8"><p className="text-xs uppercase tracking-wide text-pink-400/80">Waiting for you</p>{pendingBatches.map((b) => (<a key={b.id} href={`${BASE}approve/${b.token}`} className="flex items-center gap-3 rounded-2xl border border-pink-800/40 bg-pink-950/10 hover:bg-pink-950/20 transition-colors px-4 py-4"><Clock className="w-5 h-5 text-pink-400 shrink-0" /><div className="min-w-0 flex-1"><p className="font-medium text-white text-sm truncate">{b.name}</p><p className="text-xs text-zinc-400">{b.pendingImages} waiting &middot; {b.approvedImages} approved</p></div><span className="text-xs font-semibold text-pink-300 flex items-center gap-1">Review <ChevronRight className="w-4 h-4" /></span></a>))}</div>)}
            {reviewedBatches.length > 0 && (<div className="space-y-3"><p className="text-xs uppercase tracking-wide text-zinc-500">Done</p>{reviewedBatches.map((b) => (<div key={b.id} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-4"><CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" /><div className="min-w-0 flex-1"><p className="font-medium text-white text-sm truncate">{b.name}</p><p className="text-xs text-zinc-500">{b.approvedImages} approved &middot; {b.rejectedImages} flagged</p></div></div>))}</div>)}
          </section>
        )}

        {tab === "ba" && (
          <section>
            <div className="flex items-center gap-2 mb-2"><Camera className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Send a Before &amp; After</h2></div>
            <p className="text-sm text-zinc-400 mb-6">Add a before photo, an after photo and a few words about the treatment.</p>
            {baDone ? (<DoneCard label="Want to send another before and after?" onAgain={() => { setBaDone(false); setBefore(null); setAfter(null); setBeforePrev(""); setAfterPrev(""); setTreatment(""); setStory(""); setBaName(""); }} />) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">{(["before", "after"] as const).map((which) => { const prev = which === "before" ? beforePrev : afterPrev; const ref = which === "before" ? beforeRef : afterRef; return (<div key={which}><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{which}</label><button type="button" onClick={() => ref.current?.click()} className="w-full aspect-square rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 overflow-hidden flex items-center justify-center">{prev ? <img src={prev} alt={which} className="w-full h-full object-cover" /> : (<div className="text-center text-zinc-600"><Camera className="w-6 h-6 mx-auto mb-1" /><span className="text-xs">Tap to add</span></div>)}</button><input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick(which)} /></div>); })}</div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Treatment</label><input value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="e.g. Lip filler, skin boosters" className={inputCls} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">A little back story</label><textarea value={story} onChange={(e) => setStory(e.target.value)} rows={4} placeholder="What were they hoping for, how did it go, anything nice they said..." className={inputCls + " resize-none"} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Your name</label><input value={baName} onChange={(e) => setBaName(e.target.value)} placeholder="So we know who sent it" className={inputCls} /></div>
                {baErr && <p className="text-sm text-red-400">{baErr}</p>}
                <button onClick={submitBA} disabled={baBusy} className={sendBtn}>{baBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : SEND_LABEL}</button>
              </div>
            )}
          </section>
        )}

        {tab === "selfies" && (
          <section>
            <div className="flex items-center gap-2 mb-2"><Smile className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Upload a Selfie</h2></div>
            <p className="text-sm text-zinc-400 mb-6">Send us a lovely selfie for your content, with anything you'd like us to know.</p>
            {selfieDone ? (<DoneCard label="Want to send another selfie?" onAgain={() => { setSelfieDone(false); setSelfie(null); setSelfiePrev(""); setSelfieNote(""); setSelfieName(""); }} />) : (
              <div className="space-y-5">
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Your selfie</label><button type="button" onClick={() => selfieRef.current?.click()} className="w-full aspect-[4/5] max-w-xs mx-auto rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 overflow-hidden flex items-center justify-center">{selfiePrev ? <img src={selfiePrev} alt="selfie" className="w-full h-full object-cover" /> : (<div className="text-center text-zinc-600"><Smile className="w-7 h-7 mx-auto mb-1" /><span className="text-xs">Tap to add a selfie</span></div>)}</button><input ref={selfieRef} type="file" accept="image/*" className="hidden" onChange={pickSelfie} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Anything to add?</label><textarea value={selfieNote} onChange={(e) => setSelfieNote(e.target.value)} rows={3} placeholder="Optional, e.g. after my treatment today, feeling great..." className={inputCls + " resize-none"} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Your name</label><input value={selfieName} onChange={(e) => setSelfieName(e.target.value)} placeholder="So we know who sent it" className={inputCls} /></div>
                {selfieErr && <p className="text-sm text-red-400">{selfieErr}</p>}
                <button onClick={submitSelfie} disabled={selfieBusy} className={sendBtn}>{selfieBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : SEND_LABEL}</button>
              </div>
            )}
          </section>
        )}

        {tab === "homework" && (
          <section>
            <div className="flex items-center gap-2 mb-2"><MessageSquarePlus className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">This Weeks Homework</h2></div>
            {!hwSet ? (
              <p className="text-sm text-zinc-400">No homework set at the moment, check back soon.</p>
            ) : hwDone ? (
              <div className="space-y-5">
                <p className="text-sm text-emerald-400">Thanks, your answers are saved. Come back if you want to change anything.</p>
                <div className="space-y-4 text-sm">
                  <div><p className="text-zinc-400 mb-1">{hwSet.question1}</p><p>{hwA1}</p></div>
                  <div><p className="text-zinc-400 mb-1">{hwSet.question2}</p><p>{hwA2}</p></div>
                  <div><p className="text-zinc-400 mb-1">{hwSet.question3}</p><p>{hwA3}</p></div>
                  {(hwSet.question4) && <div><p className="text-zinc-400 mb-1">{hwSet.question4}</p><p>{hwA4}</p></div>}
                  {(hwSet.question5) && <div><p className="text-zinc-400 mb-1">{hwSet.question5}</p><p>{hwA5}</p></div>}
                  {(hwSet.question6) && <div><p className="text-zinc-400 mb-1">{hwSet.question6}</p><p>{hwA6}</p></div>}
                  {(hwSet.question7) && <div><p className="text-zinc-400 mb-1">{hwSet.question7}</p><p>{hwA7}</p></div>}
                  {(hwSet.question8) && <div><p className="text-zinc-400 mb-1">{hwSet.question8}</p><p>{hwA8}</p></div>}
                  {(hwSet.question9) && <div><p className="text-zinc-400 mb-1">{hwSet.question9}</p><p>{hwA9}</p></div>}
                  {(hwSet.question10) && <div><p className="text-zinc-400 mb-1">{hwSet.question10}</p><p>{hwA10}</p></div>}
                </div>
                <button onClick={() => setHwDone(false)} className="text-xs text-pink-400 underline">Edit my answers</button>
              </div>
            ) : (
              <div className="space-y-5">
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{hwSet.question1}</label><textarea value={hwA1} onChange={(e) => setHwA1(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{hwSet.question2}</label><textarea value={hwA2} onChange={(e) => setHwA2(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{hwSet.question3}</label><textarea value={hwA3} onChange={(e) => setHwA3(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>
                {(hwSet.question4) && <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{hwSet.question4}</label><textarea value={hwA4} onChange={(e) => setHwA4(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>}
                {(hwSet.question5) && <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{hwSet.question5}</label><textarea value={hwA5} onChange={(e) => setHwA5(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>}
                {(hwSet.question6) && <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{hwSet.question6}</label><textarea value={hwA6} onChange={(e) => setHwA6(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>}
                {(hwSet.question7) && <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{hwSet.question7}</label><textarea value={hwA7} onChange={(e) => setHwA7(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>}
                {(hwSet.question8) && <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{hwSet.question8}</label><textarea value={hwA8} onChange={(e) => setHwA8(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>}
                {(hwSet.question9) && <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{hwSet.question9}</label><textarea value={hwA9} onChange={(e) => setHwA9(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>}
                {(hwSet.question10) && <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">{hwSet.question10}</label><textarea value={hwA10} onChange={(e) => setHwA10(e.target.value)} rows={3} className={inputCls + " resize-none"} /></div>}
                {hwErr && <p className="text-sm text-red-400">{hwErr}</p>}
                <button onClick={submitHomework} disabled={hwBusy} className={sendBtn}>{hwBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : SEND_LABEL}</button>
              </div>
            )}
          </section>
        )}

        {tab === "bonus" && (
          <section>
            <div className="flex items-center gap-2 mb-2"><Gift className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Bonus Content</h2></div>
            <p className="text-sm text-zinc-400 mb-6">Things saved specially for you.</p>
            {bcLoading && <p className="text-sm text-zinc-500">Loading...</p>}
            {!bcLoading && bcItems.length === 0 && <p className="text-sm text-zinc-500">Nothing here yet, check back soon.</p>}
            <div className="space-y-4">
              {bcItems.map((it) => (
                <div key={it.id} className="rounded-2xl border border-zinc-800 p-4">
                  {it.title && <p className="font-semibold text-sm mb-1">{it.title}</p>}
                  {it.note && <p className="text-sm text-zinc-400 mb-2 whitespace-pre-wrap">{it.note}</p>}
                  {it.mediaUrl && it.mediaType === "image" && <img src={it.mediaUrl} alt="" className="rounded-lg max-w-full" />}
                  {it.mediaUrl && it.mediaType === "video" && <video src={it.mediaUrl} controls className="rounded-lg max-w-full" />}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "rants" && (
              <section className="space-y-4">
                {blogLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>}
                {!blogLoading && blogPosts.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet, check back soon.</p>}
                {blogPosts.map((p: any) => (
                  <div key={p.id} className="rounded-2xl border border-border/50 p-4">
                    {p.title && <p className="font-semibold text-sm mb-1">{p.title}</p>}
                    {p.body && <p className="text-sm text-muted-foreground mb-2 whitespace-pre-wrap">{p.body}</p>}
                    {p.imageUrls?.length > 0 && (
                      <div className={`grid gap-2 ${p.imageUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                        {p.imageUrls.map((url: string, i: number) => <img key={i} src={url} alt="" className="rounded-lg w-full object-cover" />)}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}
            {tab === "connect" && (
              <section className="space-y-4">
                <p className="font-semibold text-base mb-1">Connect Your Facebook Page</p>
                <div className="rounded-2xl border border-border/50 p-4 space-y-4">
                  <p className="text-sm text-muted-foreground">Right, before we crack on I need you to give me proper access to your Facebook Page so I can actually get in there and work. Here's exactly how to do it, step by step, with no buggering  about.</p>
                  <p className="text-sm font-semibold">First check where your Page lives. If you manage it straight on Facebook (most common), do this:</p>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1.5">
                    <li>Log into Facebook and switch into your Page. Click your profile photo, top right, then "See all profiles" and pick the Page</li>
                    <li>Go to Settings &amp; privacy → Settings → Page setup → Page access</li>
                    <li>Under "People with Facebook access," click "Add new"</li>
                    <li>Pop in my email: VANESSAVIKING78@GMAIL.COM</li>
                    <li>Turn the "Full control" toggle on</li>
                    <li>Click "Give access"</li>
                    <li>You'll need to type your Facebook password to confirm, that's just Facebook checking it's really you</li>
                  </ol>
                  <p className="text-sm font-semibold">If your Page sits inside Meta Business Suite (this is likely if you've ever run ads), it's slightly different:</p>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1.5">
                    <li>Go to Meta Business Suite → Settings → People</li>
                    <li>Click "+ Invite people" and enter my email VANESSAVIKING78@ME.COM</li>
                    <li>Choose "Full control" as the permission level</li>
                    <li>Select your Page</li>
                    <li>Confirm and send</li>
                  </ol>
                  <p className="text-sm text-muted-foreground">I'll get a notification to accept and then I'm in.</p>
                  <p className="text-sm text-muted-foreground">Quick honest bit, and this matters. Facebook's renamed "Admin" to "Full Control," so don't panic if you don't see the word Admin anywhere, it's the same thing. Full control means I can do everything you can on the Page, including managing settings and other people's access. That's not me being nosy, it's what I actually need to do the job properly, schedule content, reply to messages, run things behind the scenes without pinging you every five minutes.</p>
                  <p className="text-sm text-muted-foreground">Any bother with any of this, screenshot it and send it over, I'll talk you through it.</p>
                  <p className="text-sm text-muted-foreground">Speak soon,</p>
                </div>
              </section>
            )}
            {tab === "request" && (
          <section>
            <div className="flex items-center gap-2 mb-2"><MessageSquarePlus className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Request a Post</h2></div>
            <p className="text-sm text-zinc-400 mb-6">Got something you'd like posted? An offer, an update, a treatment to shout about? Tell us here and we'll sort it.</p>
            {reqDone ? (<DoneCard label="Want to send another request?" onAgain={() => { setReqDone(false); setReqText(""); setReqName(""); }} />) : (
              <div className="space-y-5">
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">What would you like a post about?</label><textarea value={reqText} onChange={(e) => setReqText(e.target.value)} rows={5} placeholder="e.g. A post about our summer skin package, or that we now offer polynucleotides..." className={inputCls + " resize-none"} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Your name</label><input value={reqName} onChange={(e) => setReqName(e.target.value)} placeholder="So we know who sent it" className={inputCls} /></div>
                {reqErr && <p className="text-sm text-red-400">{reqErr}</p>}
                <button onClick={submitRequest} disabled={reqBusy} className={sendBtn}>{reqBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : SEND_LABEL}</button>
              </div>
            )}
          </section>
        )}

        {tab === "reviews" && (
          <section>
            <div className="flex items-center gap-2 mb-2"><Star className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Add a Review</h2></div>
            <p className="text-sm text-zinc-400 mb-6">Had a lovely review? Paste it here or add a screenshot, and I'll turn it into content for you.</p>
            {rvDone ? (<DoneCard label="Lovely review saved, thank you. Got another? Send it over." onAgain={() => { setRvDone(false); setRvText(""); setRvFrom(""); setRvShot(null); setRvShotPrev(""); setRvName(""); }} />) : (
              <div className="space-y-5">
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Paste the review</label><textarea value={rvText} onChange={(e) => setRvText(e.target.value)} rows={5} placeholder="Copy and paste what they said..." className={inputCls + " resize-none"} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Who's it from?</label><input value={rvFrom} onChange={(e) => setRvFrom(e.target.value)} placeholder="First name is fine, e.g. Sarah" className={inputCls} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Screenshot of the review (optional)</label><button type="button" onClick={() => rvShotRef.current?.click()} className="w-full h-32 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 overflow-hidden flex items-center justify-center">{rvShotPrev ? <img src={rvShotPrev} alt="review" className="max-h-full max-w-full object-contain p-2" /> : (<div className="text-center text-zinc-600"><ImageIcon className="w-6 h-6 mx-auto mb-1" /><span className="text-xs">Tap to add a screenshot</span></div>)}</button><input ref={rvShotRef} type="file" accept="image/*" className="hidden" onChange={pickReviewShot} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Your name</label><input value={rvName} onChange={(e) => setRvName(e.target.value)} placeholder="So we know who sent it" className={inputCls} /></div>
                {rvErr && <p className="text-sm text-red-400">{rvErr}</p>}
                <button onClick={submitReview} disabled={rvBusy} className={sendBtn}>{rvBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : SEND_LABEL}</button>
              </div>
            )}
          </section>
        )}

        {tab === "onboarding" && (
          <section>
            <div className="flex items-center gap-2 mb-2"><ClipboardList className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Let's Get You Set Up</h2></div>
            <p className="text-sm text-zinc-400 mb-6">Fill this in once so I've got everything I need to make your content sing, your treatments, your logo and a bit about you.</p>
            {obDone ? (<DoneCard label="Sent it through, we're all set. Change anything? Just resend." onAgain={() => { setObDone(false); setObTreatments(""); setObAbout(""); setObLogo(null); setObLogoPrev(""); setObName(""); }} />) : (
              <div className="space-y-5">
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Your treatment list &amp; prices</label><textarea value={obTreatments} onChange={(e) => setObTreatments(e.target.value)} rows={6} placeholder={"List everything you offer, one per line, with prices if you like.\ne.g.\nLip filler - from £150\nSkin boosters - from £180\nAnti-wrinkle treatment - from £120"} className={inputCls + " resize-none"} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">A bit about your business</label><textarea value={obAbout} onChange={(e) => setObAbout(e.target.value)} rows={5} placeholder="Who are you, what makes you you, your vibe, your ideal client, anything I should know..." className={inputCls + " resize-none"} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Your logo</label><button type="button" onClick={() => obLogoRef.current?.click()} className="w-full h-28 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 overflow-hidden flex items-center justify-center">{obLogoPrev ? <img src={obLogoPrev} alt="logo" className="max-h-full max-w-full object-contain p-3" /> : (<div className="text-center text-zinc-600"><ImageIcon className="w-6 h-6 mx-auto mb-1" /><span className="text-xs">Tap to add your logo</span></div>)}</button><input ref={obLogoRef} type="file" accept="image/*" className="hidden" onChange={pickLogo} /></div>
                <div><label className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5 block">Your name</label><input value={obName} onChange={(e) => setObName(e.target.value)} placeholder="So we know who sent it" className={inputCls} /></div>
                {obErr && <p className="text-sm text-red-400">{obErr}</p>}
                <button onClick={submitOnboarding} disabled={obBusy} className={sendBtn}>{obBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : SEND_LABEL}</button>
              </div>
            )}
          </section>
        )}

        {tab === "reels" && (
          <section>
            <div className="flex items-center gap-2 mb-2"><Clapperboard className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">{REEL_TOTAL} Reel Ideas</h2><span className="ml-auto text-xs text-zinc-500">{doneCount}/{REEL_TOTAL} done</span></div>
            <p className="text-sm text-zinc-400 mb-5">Work your way through these. Tap one when you've filmed it and it ticks off, saved on this device.</p>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full mb-6 overflow-hidden"><div className="h-full bg-pink-500 transition-all" style={{ width: `${Math.round((doneCount / REEL_TOTAL) * 100)}%` }} /></div>
            <div className="space-y-7">
              {REEL_GROUPS.map((g) => (
                <div key={g.heading}>
                  <h3 className="text-pink-400 text-sm font-semibold uppercase tracking-wide border-b border-zinc-800 pb-2 mb-3">{g.heading}</h3>
                  <div className="space-y-2">
                    {g.items.map((idea) => { reelIdx += 1; const i = reelIdx; return (
                      <button key={i} onClick={() => toggleReel(i)} className={`w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${ticked[i] ? "border-green-800/40 bg-green-950/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}>
                        {ticked[i] ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-zinc-600 shrink-0 mt-0.5" />}
                        <span className={`text-sm ${ticked[i] ? "text-zinc-500 line-through" : "text-white"}`}><span className="text-zinc-600 mr-1">{i + 1}.</span>{idea}</span>
                      </button>
                    ); })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "resources" && (
          <section>
            <div className="flex items-center gap-2 mb-5"><FileText className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Resources</h2>{resources.length > 0 && (<span className="ml-auto text-xs text-zinc-500">{resources.length} document{resources.length !== 1 ? "s" : ""}</span>)}</div>
            <p className="text-sm text-zinc-400 mb-6">Cheat sheets, guides and useful bits from Vanessa. Tap to download.</p>
            {resourcesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-pink-500" /></div>
            ) : resources.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center"><FileText className="w-8 h-8 mx-auto text-zinc-700 mb-3" /><p className="text-zinc-500">Nothing here yet, check back soon.</p></div>
            ) : (
              <div className="space-y-3">
                {resources.map((r) => (
                  <a key={r.id} href={`${BASE}api/media/${r.fileKey}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 transition-colors px-4 py-4">
                    <FileText className="w-5 h-5 text-pink-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white text-sm truncate">{r.title}</p>
                      {r.description && <p className="text-xs text-zinc-400 mt-0.5">{r.description}</p>}
                    </div>
                    <Download className="w-4 h-4 text-zinc-500 shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </section>
        )}
        {tab === "news" && (<section><div className="flex items-center gap-2 mb-5"><Newspaper className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Aesthetic News</h2></div><p className="text-sm text-zinc-400 mb-6">What's happening across aesthetics and skincare, refreshed every Monday.</p><NewsList /></section>)}
      </main>

      <footer className="border-t border-zinc-900 py-6 mt-4"><p className="text-center text-xs text-zinc-700">Powered by <span className="text-zinc-600">The CyberSuite&trade;</span></p></footer>
    </div>
  );
}
