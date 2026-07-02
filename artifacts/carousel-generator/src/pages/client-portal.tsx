import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle, CalendarDays, Clock, CheckCircle2, FileImage, Layers, Film, ImageIcon, ShieldCheck, Camera, ChevronRight, Share, Smile, MessageSquarePlus, ClipboardList, Clapperboard, Circle, Star } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";
const SEND_LABEL = "Send to Vanessa, Aesthetic Angel / Digital Darling";

type CalendarPost = { id: number; date: string; title: string; caption: string; postType: string; status: string; color: string; imageUrl: string | null; };
type ApprovalBatch = { id: number; name: string; token: string; status: string; totalImages: number; pendingImages: number; approvedImages: number; rejectedImages: number; createdAt: string; expiresAt: string | null; };
type PortalData = { clientName: string; logoUrl: string | null; upcomingPosts: CalendarPost[]; approvalBatches: ApprovalBatch[]; };

const POST_TYPE_ICON: Record<string, React.ReactNode> = {
  carousel: <Layers className="w-3.5 h-3.5" />,
  "single-image": <ImageIcon className="w-3.5 h-3.5" />,
  story: <Film className="w-3.5 h-3.5" />,
};
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(dateStr: string) { const [y, m, d] = dateStr.split("-").map(Number); return `${d} ${MONTH_NAMES[m - 1]} ${y}`; }
function getDayOfWeek(dateStr: string) { const d = new Date(dateStr + "T12:00:00"); return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]; }
function fileToBase64(file: File): Promise<string> { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file); }); }

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

type Tab = "upcoming" | "approvals" | "ba" | "selfies" | "request" | "onboarding" | "reels" | "reviews";

export default function ClientPortal({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showTip, setShowTip] = useState(true);

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

  const inputCls = "w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white outline-none focus:border-pink-600";
  const sendBtn = "w-full rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-3.5 flex items-center justify-center gap-2";

  const TabBtn = ({ id, label, badge }: { id: Tab; label: string; badge?: number }) => (
    <button onClick={() => setTab(id)} className={`whitespace-nowrap px-3.5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === id ? "border-pink-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>{label}{badge ? <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-pink-600 text-white align-middle">{badge}</span> : null}</button>
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
        <div className="max-w-3xl mx-auto px-2 flex overflow-x-auto">
          <TabBtn id="upcoming" label="Posts" />
          <TabBtn id="approvals" label="Approvals" badge={pendingCount || undefined} />
          <TabBtn id="ba" label="Before & After" />
          <TabBtn id="selfies" label="Selfies" />
          <TabBtn id="request" label="Request a post" />
          <TabBtn id="reviews" label="Reviews" />
          <TabBtn id="onboarding" label="Get set up" />
          <TabBtn id="reels" label="100 Reels" />
        </div>
      </header>

      {showTip && (
        <div className="max-w-3xl mx-auto px-4 pt-4"><div className="rounded-xl border border-pink-800/40 bg-pink-950/20 px-4 py-2.5 flex items-center gap-2 text-xs text-pink-200"><Share className="w-4 h-4 shrink-0" /><span>Tip: tap your browser's Share button, then <b>Add to Home Screen</b>, to keep your portal one tap away.</span><button onClick={() => setShowTip(false)} className="ml-auto text-pink-400/70 hover:text-pink-300">Got it</button></div></div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8">
        {tab === "upcoming" && (
          <section>
            <div className="flex items-center gap-2 mb-5"><CalendarDays className="w-5 h-5 text-pink-400" /><h2 className="text-lg font-semibold">Upcoming Content</h2>{data.upcomingPosts.length > 0 && (<span className="ml-auto text-xs text-zinc-500">{data.upcomingPosts.length} post{data.upcomingPosts.length !== 1 ? "s" : ""} scheduled</span>)}</div>
            {data.upcomingPosts.length === 0 ? (<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center"><CalendarDays className="w-8 h-8 mx-auto text-zinc-700 mb-3" /><p className="text-zinc-500">No upcoming content scheduled yet.</p></div>) : (
              <div className="space-y-3">{data.upcomingPosts.map((post) => (
                <div key={post.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden flex">
                  {post.imageUrl ? (<div className="w-20 shrink-0 bg-zinc-800"><img src={post.imageUrl} alt="" className="w-full h-full object-cover" style={{ minHeight: 80 }} /></div>) : (<div className="w-20 shrink-0 flex items-center justify-center" style={{ backgroundColor: post.color + "22", borderRight: `2px solid ${post.color}44` }}><FileImage className="w-5 h-5 text-zinc-600" /></div>)}
                  <div className="flex-1 px-4 py-3 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1"><div className="flex items-center gap-1.5 text-xs text-zinc-400"><span className="font-semibold text-white">{getDayOfWeek(post.date)}</span><span>{formatDate(post.date)}</span></div><div className="flex items-center gap-1.5 shrink-0"><span className="flex items-center gap-1 text-xs text-zinc-500 capitalize">{POST_TYPE_ICON[post.postType] || <FileImage className="w-3.5 h-3.5" />}{post.postType.replace("-", " ")}</span><span className={`text-xs px-2 py-0.5 rounded-full border ${post.status === "scheduled" ? "bg-green-900/30 text-green-400 border-green-700/40" : "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{post.status}</span></div></div>
                    {post.title && <p className="font-medium text-white text-sm truncate">{post.title}</p>}{post.caption && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{post.caption}</p>}
                  </div>
                </div>))}
              </div>
            )}
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
      </main>

      <footer className="border-t border-zinc-900 py-6 mt-4"><p className="text-center text-xs text-zinc-700">Powered by <span className="text-zinc-600">The CyberSuite&trade;</span></p></footer>
    </div>
  );
}
