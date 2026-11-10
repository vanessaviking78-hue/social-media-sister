import { useCallback, useEffect, useState } from "react";
import { U_GROUPS, U_TREATMENTS } from "@/lib/universal-treatments";
import { PREMIUM_FONTS } from "@/lib/tenfree-fonts";

// cybersuite.com/club/<private token>: the member's own portal for the £69 and £222 clubs.
// First visit: the one-off details form. After that: choose this month's treatments and posts, then download what has been approved.

const PINK = "#ff1f8e";
const INK = "#111";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;700;900&display=swap');
.cp, .cp * { font-family:'League Spartan',sans-serif; box-sizing:border-box; }
.cp { background:#fff; color:${INK}; min-height:100vh; }
.cp-w { max-width:960px; margin:0 auto; padding:0 20px 80px; }
.cp-top { display:flex; justify-content:space-between; padding:26px 0; letter-spacing:.26em; font-size:12px; text-transform:uppercase; font-weight:900; }
.cp h1 { font-weight:900; text-transform:uppercase; font-size:clamp(38px,8vw,84px); line-height:.92; margin:10px 0 14px; letter-spacing:-.02em; }
.cp h1 span, .cp-pink { color:${PINK}; }
.cp h2 { font-weight:900; text-transform:uppercase; font-size:clamp(24px,4vw,34px); border-top:3px solid ${INK}; padding-top:16px; margin:44px 0 8px; line-height:1; }
.cp p, .cp li, .cp label { font-size:17px; line-height:1.35; font-weight:400; }
.cp-sub { color:#666; max-width:620px; }
.cp-tabs { display:flex; border-bottom:3px solid ${INK}; margin-top:28px; }
.cp-tab { flex:1; background:#fff; border:0; padding:16px 8px; font-weight:900; text-transform:uppercase; letter-spacing:.12em; font-size:clamp(13px,2.8vw,19px); cursor:pointer; color:${INK}; }
.cp-tab.on { background:${PINK}; color:#fff; }
.cp-field { display:block; margin:14px 0; }
.cp-field > span { display:block; font-weight:700; font-size:14px; letter-spacing:.06em; text-transform:uppercase; margin-bottom:5px; }
.cp input[type=text], .cp input[type=email], .cp textarea, .cp select { width:100%; border:2px solid ${INK}; padding:11px 12px; font-size:16px; font-family:inherit; background:#fff; color:${INK}; border-radius:0; }
.cp textarea { min-height:96px; }
.cp-btn { background:${PINK}; color:#fff; border:0; padding:14px 22px; font-weight:900; letter-spacing:.14em; text-transform:uppercase; font-size:14px; cursor:pointer; text-decoration:none; display:inline-block; margin:0 8px 8px 0; }
.cp-btn.k { background:${INK}; }
.cp-btn[disabled] { opacity:.45; cursor:default; }
.cp-chips { display:flex; flex-wrap:wrap; gap:8px; }
.cp-chip { border:2px solid ${INK}; background:#fff; padding:8px 12px; font-size:15px; cursor:pointer; font-family:inherit; color:${INK}; }
.cp-chip.on { background:${PINK}; border-color:${PINK}; color:#fff; }
.cp-chip[disabled] { opacity:.35; cursor:default; }
.cp-hook { display:flex; gap:10px; align-items:flex-start; padding:8px 0; border-bottom:1px solid #eee; font-size:16px; line-height:1.3; }
.cp-hook input { margin-top:4px; }
.cp-strip { display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x mandatory; padding-bottom:8px; }
.cp-strip img { height:min(70vh,640px); width:auto; max-width:90vw; flex:none; scroll-snap-align:start; box-shadow:0 14px 34px -20px rgba(0,0,0,.5); }
.cp-cap { white-space:pre-wrap; font-size:15px; line-height:1.4; margin:10px 0; }
.cp-box { border:3px solid ${INK}; padding:20px; margin:18px 0; }
.cp-count { font-weight:900; color:${PINK}; }
.cp-ai { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; }
.cp-ai img { width:100%; display:block; }
.cp-reel { border-bottom:1px solid #e5e5e5; padding:14px 0; }
.cp-reel b { font-weight:900; }
.cp-err { color:#b3001b; font-weight:700; margin:10px 0; }
`;


type Caps = { price: number; posts: number; treatmentPosts: number; picks: number; reels: number; tailoredReels: number };
type Pick = { kind: "hook" | "tool"; code?: string; tool?: string; useTemplate?: boolean; label?: string };
type Reel = { n: number; kind: string; treatment?: string; hook: string; onScreen?: string; script: string };
type MonthContent = { posts?: { n: number; label: string; images: string[]; caption: string; tags: string }[]; reels?: Reel[] };
type Portal = {
  member: { name: string; plan: "69" | "222"; caps: Caps; detailsDone: boolean; details: Record<string, any>; logoUrl: string; photoUrls: string[]; clinicPhotoUrl: string };
  cycle: { month: string; nextBilling: string; cutOff: string; open: boolean; status: "choosing" | "building" | "approved"; choices: { treatments?: string[]; picks?: Pick[]; note?: string; savedAt?: string } };
  months: { month: string; content: MonthContent; aiUrls: string[]; approvedAt: string }[];
};

const monthName = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
};
const dateName = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });


// Phone photos can be huge. Shrink each one before it leaves the browser, and send them a few at a time so nothing is too big to upload.
async function shrink(file: File, max = 1800): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    const png = file.type === "image/png";
    if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, png ? "image/png" : "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, png ? ".png" : ".jpg"), { type: blob.type });
  } catch {
    return file;
  }
}

async function sendDetails(token: string, fd: FormData) {
  const r = await fetch(`${API}/club/me/${token}/details`, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || (r.status === 413 ? "Those photos were too big to send. Please try again with fewer." : `Something went wrong (${r.status}). Please try again.`));
}

async function download(url: string, name: string) {
  const r = await fetch(url);
  const b = await r.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// A burst of confetti in the club colours, drawn on a canvas that removes itself when it has finished.
function fireConfetti() {
  try {
    const c = document.createElement("canvas");
    c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
    document.body.appendChild(c);
    const g = c.getContext("2d");
    if (!g) { c.remove(); return; }
    const colours = ["#ff1f8e", "#111111", "#ffffff", "#ff7ac0", "#ffd1e6", "#d6006f"];
    const bits = Array.from({ length: 220 }, () => ({
      x: c.width / 2 + (Math.random() - 0.5) * c.width * 0.3, y: c.height * 0.35,
      vx: (Math.random() - 0.5) * 18 * dpr, vy: (-Math.random() * 16 - 4) * dpr,
      w: (6 + Math.random() * 8) * dpr, h: (4 + Math.random() * 6) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      col: colours[Math.floor(Math.random() * colours.length)],
    }));
    const t0 = performance.now();
    const frame = (now: number) => {
      const age = now - t0;
      g.clearRect(0, 0, c.width, c.height);
      for (const b of bits) {
        b.vy += 0.45 * dpr; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.globalAlpha = Math.max(0, 1 - age / 4200);
        g.fillStyle = b.col; g.strokeStyle = "#11111133"; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); g.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h); g.restore();
      }
      if (age < 4200) requestAnimationFrame(frame); else c.remove();
    };
    requestAnimationFrame(frame);
  } catch { /* confetti is only a treat */ }
}

function Details({ token, onDone, existing }: { token: string; onDone: () => void; existing?: Record<string, any> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [main, setMain] = useState("#d6006f");
  const [accent, setAccent] = useState("#1a1a1a");
  const [font, setFont] = useState("hatcher");
  const [progress, setProgress] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const src = new FormData(e.currentTarget);
    const photos = (src.getAll("photos") as File[]).filter((f) => f && f.size);
    const logo = src.get("logo") as File | null;
    const clinic = src.get("clinicPhoto") as File | null;
    setBusy(true);
    setErr("");
    try {
      setProgress("Getting your photos ready...");
      const fd = new FormData();
      for (const [k, v] of src.entries()) if (!(v instanceof File)) fd.append(k, v);
      fd.set("mainHex", main);
      fd.set("accentHex", accent);
      fd.set("font", font);
      if (logo && logo.size) fd.append("logo", await shrink(logo, 1200));
      if (clinic && clinic.size) fd.append("clinicPhoto", await shrink(clinic));
      const small = await Promise.all(photos.slice(0, 20).map((f) => shrink(f)));
      const first = small.slice(0, 3);
      first.forEach((f) => fd.append("photos", f));
      setProgress("Saving your details...");
      await sendDetails(token, fd);
      // The rest of the photos go up three at a time.
      for (let i = 3; i < small.length; i += 3) {
        setProgress(`Uploading photos ${Math.min(i + 3, small.length)} of ${small.length}...`);
        const more = new FormData();
        small.slice(i, i + 3).forEach((f) => more.append("photos", f));
        await sendDetails(token, more);
      }
      onDone();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Something went wrong");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };
  const T = (name: string, label: string, ph = "", area = false) => (
    <label className="cp-field"><span>{label}</span>{area ? <textarea name={name} placeholder={ph} defaultValue={existing?.[name] ?? ""} /> : <input type="text" name={name} placeholder={ph} defaultValue={existing?.[name] ?? ""} />}</label>
  );
  return (
    <form onSubmit={submit}>
      <h2>About you and your clinic</h2>
      <p className="cp-sub">You only fill this in once. Everything is used to make your posts sound like you, so be as chatty as you like.</p>
      {T("clinicianName", "Your name")}
      {T("clinicName", "Clinic name")}
      {T("handle", "Instagram handle", "without the @")}
      {T("area", "Your area", "for example Leeds, West Yorkshire")}
      <h2>Your story</h2>
      {T("howStarted", "How did you get into aesthetics?", "", true)}
      {T("why", "What do you love most about what you do?", "", true)}
      {T("personality", "How would your clients describe you, and how do you talk?", "For example warm and a bit sweary, or calm and precise", true)}
      {T("threeWords", "Three words that describe you")}
      {T("passion", "What are you passionate about outside work?", "", true)}
      {T("hobbies", "Hobbies")}
      {T("pets", "Pets")}
      <label className="cp-field"><span>5 facts about you, or things people might not know (one per line)</span><textarea name="facts" defaultValue={(existing?.facts ?? []).join("\n")} placeholder={"I once met Dolly Parton\nI cannot parallel park\n..."} /></label>
      <label className="cp-field"><span>Your 5 favourite treatments to give (one per line)</span><textarea name="favTreatments" defaultValue={(existing?.favTreatments ?? []).join("\n")} /></label>
      <h2>Your look</h2>
      <div className="cp-chips" style={{ alignItems: "center" }}>
        <label className="cp-chip" style={{ cursor: "default" }}>Main colour <input type="color" value={main} onChange={(e) => setMain(e.target.value)} style={{ verticalAlign: "middle", marginLeft: 6 }} /></label>
        <label className="cp-chip" style={{ cursor: "default" }}>Accent colour <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ verticalAlign: "middle", marginLeft: 6 }} /></label>
      </div>
      <label className="cp-field"><span>Headline font</span>
        <select value={font} onChange={(e) => setFont(e.target.value)}>{PREMIUM_FONTS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      </label>
      <label className="cp-field"><span>Your logo (optional)</span><input type="file" name="logo" accept="image/*" /></label>
      <label className="cp-field"><span>Photos of you, up to 20 (the more the better)</span><input type="file" name="photos" accept="image/*" multiple /></label>
      <label className="cp-field"><span>A photo of your clinic (optional, I will place you in it for your colour AI photos)</span><input type="file" name="clinicPhoto" accept="image/*" /></label>
      {err && <div className="cp-err">{err}</div>}
      <button className="cp-btn" disabled={busy} type="submit">{busy ? progress || "Saving, please wait..." : "Save my details"}</button>
    </form>
  );
}

function Choose({ token, data, reload }: { token: string; data: Portal; reload: () => void }) {
  const caps = data.member.caps;
  const [treatments, setTreatments] = useState<string[]>(data.cycle.choices.treatments ?? []);
  const [note, setNote] = useState(data.cycle.choices.note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const open = data.cycle.open;

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`${API}/club/me/${token}/choices`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ treatments, note }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not save");
      setMsg("Saved. You can change it any time until the closing date.");
      fireConfetti();
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  if (data.cycle.status !== "choosing") {
    return <div className="cp-box"><b>Your {monthName(data.cycle.month)} content is {data.cycle.status === "approved" ? "ready, it is under My content" : "being made now"}.</b><p className="cp-sub">Your next choices open once this month is done.</p></div>;
  }
  return (
    <div>
      <h2>Your {monthName(data.cycle.month)} choices</h2>
      <p className="cp-sub">Choices close on {dateName(data.cycle.cutOff)}, a week before your next payment on {dateName(data.cycle.nextBilling)}. Your content is then built and checked by me personally.</p>
      {!open && <div className="cp-err">Choices have closed for this month. Message me if something has changed.</div>}
      {data.cycle.choices.savedAt && (
        <div className="cp-box" style={{ borderColor: "#ff1f8e" }}>
          <b style={{ fontSize: 22 }}>That's your socials done for the month.</b>
          <p className="cp-sub" style={{ marginTop: 6 }}>Vanessa will send you your link with your content shortly.</p>
        </div>
      )}

      <h2>What {caps.treatmentPosts} treatments would you like to promote this month? <span className="cp-count">{treatments.length} of {caps.treatmentPosts}</span></h2>
      <p className="cp-sub">If you only choose 1, 2 or 3, that is perfectly fine. You can promote the same treatment again another month, I will make it with fresh hooks so it never looks repeated.</p>
      {U_GROUPS.map((g) => (
        <div key={g.id} style={{ margin: "14px 0" }}>
          <div className="cp-pink" style={{ fontWeight: 900, fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", marginBottom: 6 }}>{g.label}</div>
          <div className="cp-chips">
            {U_TREATMENTS.filter((t) => t.group === g.id).map((t) => {
              const on = treatments.includes(t.name);
              return <button key={t.id} type="button" disabled={!open || (!on && treatments.length >= caps.treatmentPosts)} className={`cp-chip ${on ? "on" : ""}`} onClick={() => setTreatments((c) => (on ? c.filter((x) => x !== t.name) : [...c, t.name]))}>{t.name}</button>;
            })}
          </div>
        </div>
      ))}

      <label className="cp-field"><span>Anything I should know this month? (a launch, a holiday, a new treatment)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="cp-btn" disabled={busy || !open || treatments.length === 0} onClick={save}>{busy ? "Saving..." : "Save my choices"}</button>
      {msg && <p className="cp-pink" style={{ fontWeight: 700 }}>{msg}</p>}
    </div>
  );
}

function Content({ data, plan }: { data: Portal; plan: "69" | "222" }) {
  const [open, setOpen] = useState<string>(data.months[0]?.month ?? "");
  if (!data.months.length) return <div className="cp-box"><b>Nothing here yet.</b><p className="cp-sub">Once I have built and checked your {monthName(data.cycle.month)} content it will appear here, ready to download and upload yourself.</p></div>;
  const m = data.months.find((x) => x.month === open) ?? data.months[0];
  return (
    <div>
      <div className="cp-chips" style={{ margin: "18px 0" }}>
        {data.months.map((x) => <button key={x.month} className={`cp-chip ${x.month === m.month ? "on" : ""}`} onClick={() => setOpen(x.month)}>{monthName(x.month)}</button>)}
      </div>
      <h2>Your posts</h2>
      {(m.content.posts ?? []).map((p) => (
        <div key={p.n} style={{ padding: "26px 0", borderBottom: "1px solid #e5e5e5" }}>
          <div className="cp-pink" style={{ fontWeight: 900, letterSpacing: ".2em", fontSize: 12, textTransform: "uppercase" }}>Post {p.n} · {p.label}</div>
          <div className="cp-strip" style={{ marginTop: 10 }}>{p.images.map((u, i) => <img key={u} src={u} alt={`Post ${p.n} image ${i + 1}`} loading="lazy" />)}</div>
          <div className="cp-cap">{p.caption}{p.tags ? `\n\n${p.tags}` : ""}</div>
          <button className="cp-btn k" onClick={() => navigator.clipboard?.writeText(`${p.caption}${p.tags ? `\n\n${p.tags}` : ""}`)}>Copy caption</button>
          {p.images.map((u, i) => <button key={u} className="cp-btn" onClick={() => download(u, `${m.month}-post-${p.n}-${i + 1}.jpg`)}>Download {p.images.length > 1 ? i + 1 : "image"}</button>)}
        </div>
      ))}
      {m.aiUrls.length > 0 && (
        <>
          <h2>Your 6 AI photos</h2>
          <div className="cp-ai">{m.aiUrls.map((u, i) => <div key={u}><img src={u} alt={`AI photo ${i + 1}`} /><button className="cp-btn k" style={{ marginTop: 6 }} onClick={() => download(u, `${m.month}-photo-${i + 1}.jpg`)}>Download</button></div>)}</div>
        </>
      )}
      <h2>Your {m.content.reels?.length ?? 0} reel hooks and scripts</h2>
      {(m.content.reels ?? []).map((r) => (
        <div key={r.n} className="cp-reel">
          <div className="cp-pink" style={{ fontWeight: 900, fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase" }}>Reel {r.n}{r.treatment ? ` · ${r.treatment}` : ""}</div>
          <p><b>{r.hook}</b></p>
          {r.onScreen && <p className="cp-sub">On screen: {r.onScreen}</p>}
          <p style={{ whiteSpace: "pre-wrap" }}>{r.script}</p>
          <button className="cp-btn k" onClick={() => navigator.clipboard?.writeText(`${r.hook}\n\n${r.script}`)}>Copy</button>
        </div>
      ))}
      <div className="cp-box"><b>Upload these yourself.</b><p className="cp-sub">Download the images, copy the captions, and post when you like. For {plan === "69" ? "anything you need, I am on the end of WhatsApp like a big sister in the background" : "anything you need, message me on Instagram DM"}.</p></div>
    </div>
  );
}

export default function ClubPortal({ token }: { token: string }) {
  const [data, setData] = useState<Portal | null>(null);
  const [ended, setEnded] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"choose" | "content" | "me">("choose");
  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/club/me/${token}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.status === 403 && j.ended) { setEnded(j.error); return; }
      if (!r.ok) { setError(j.error || "Could not load"); return; }
      setData(j);
      if (j.cycle.status === "approved" || (j.months.length && j.cycle.status !== "choosing")) setTab((t) => t);
    } catch {
      setError("Could not load your portal, please check your connection");
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="cp">
      <style>{CSS}</style>
      <div className="cp-w">
        <div className="cp-top"><span>Social Media Sister</span><span>{data ? (data.member.plan === "69" ? "The £69 club" : "The £222 club") : "The club"}</span></div>
        {ended && <><h1>See you <span>soon</span></h1><p className="cp-sub">{ended}</p></>}
        {error && <p className="cp-err">{error}</p>}
        {!data && !ended && !error && <p>Loading...</p>}
        {data && !data.member.detailsDone && (
          <>
            <h1>Welcome, <span>{data.member.name.split(" ")[0]}</span></h1>
            <p className="cp-sub">Fill in your details once and I will do the rest, every single month.</p>
            <Details token={token} onDone={load} existing={data.member.details} />
          </>
        )}
        {data && data.member.detailsDone && (
          <>
            <h1>Hello, <span>{data.member.name.split(" ")[0]}</span></h1>
            <p className="cp-sub">{data.member.caps.posts} posts, {data.member.caps.reels} reel hooks and scripts and 6 AI photos every month. {data.member.plan === "69" ? "My full support via WhatsApp, think big sister in the background you can always ask anything you want." : "Message me on Instagram DM any time."}</p>
            <div className="cp-tabs">
              <button className={`cp-tab ${tab === "choose" ? "on" : ""}`} onClick={() => setTab("choose")}>This month</button>
              <button className={`cp-tab ${tab === "content" ? "on" : ""}`} onClick={() => setTab("content")}>My content</button>
              <button className={`cp-tab ${tab === "me" ? "on" : ""}`} onClick={() => setTab("me")}>My details</button>
            </div>
            {tab === "choose" && <Choose token={token} data={data} reload={load} />}
            {tab === "content" && <Content data={data} plan={data.member.plan} />}
            {tab === "me" && (
              <div>
                <h2>Add more photos</h2>
                <p className="cp-sub">You have {data.member.photoUrls.length} of 20 photos. More photos of you means better posts. To change anything else, just message me.</p>
                <div className="cp-ai">{data.member.photoUrls.map((u) => <img key={u} src={u} alt="" />)}</div>
                <AddPhotos token={token} left={20 - data.member.photoUrls.length} hasClinic={!!data.member.clinicPhotoUrl} onDone={load} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AddPhotos({ token, left, hasClinic, onDone }: { token: string; left: number; hasClinic: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const src = new FormData(form);
    const photos = (src.getAll("photos") as File[]).filter((f) => f && f.size);
    const clinic = src.get("clinicPhoto") as File | null;
    setBusy(true);
    setErr("");
    try {
      const small = await Promise.all(photos.slice(0, Math.max(0, left)).map((f) => shrink(f)));
      const first = new FormData();
      if (clinic && clinic.size) first.append("clinicPhoto", await shrink(clinic));
      small.slice(0, 3).forEach((f) => first.append("photos", f));
      if ([...first.keys()].length) await sendDetails(token, first);
      for (let i = 3; i < small.length; i += 3) {
        const more = new FormData();
        small.slice(i, i + 3).forEach((f) => more.append("photos", f));
        await sendDetails(token, more);
      }
      form.reset();
      onDone();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} style={{ marginTop: 18 }}>
      {left > 0 && <label className="cp-field"><span>More photos of you ({left} spaces left)</span><input type="file" name="photos" accept="image/*" multiple /></label>}
      <label className="cp-field"><span>{hasClinic ? "Replace your clinic photo" : "A photo of your clinic"}</span><input type="file" name="clinicPhoto" accept="image/*" /></label>
      {err && <div className="cp-err">{err}</div>}
      <button className="cp-btn" disabled={busy} type="submit">{busy ? "Uploading..." : "Upload"}</button>
    </form>
  );
}
