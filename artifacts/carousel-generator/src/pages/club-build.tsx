import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { WelcomePhoto } from "@/pages/club-admin";

// CLUB BUILD: the one place to build a club member's month. Pick a member, see everything they sent, build, check, approve.
// It uses the same builder as the premium freebies, so the posts, studio photos, logo and clinic photo all come through the same way.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const pw = () => localStorage.getItem("cybersuite-pw") || "";
const authOnly = (): Record<string, string> => ({ "x-app-password": pw(), Authorization: "Bearer " + pw() });
const jsonHeaders = (): Record<string, string> => ({ ...authOnly(), "Content-Type": "application/json" });

type Month = { id: string; month: string; status: string; choices: { treatments?: string[] }; postCount: number; reelCount: number; aiUrls: string[]; aiStatus: string;
  feedback?: { posts?: { n: number; rating: number; reason: string }[]; overall?: string; at?: string };
  pick?: { phase: string; picked: number[]; deadline: string | null; cap: number; total: number };
  bank?: { n: number; label: string; images: string[]; caption: string; tags: string }[];
  postsList?: { n: number; label: string; image: string }[] };
type Member = {
  id: string; name: string; email: string; phone?: string; link?: string; plan: "69" | "222"; status: string; detailsDone: boolean; canBuild?: boolean; details: Record<string, any>;
  photoCount: number; welcomePhotoUrl?: string; photoUrls?: string[]; logoUrl?: string; clinicPhotoUrl?: string; refPhotoUrl?: string; months: Month[];
};

const monthName = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }); };


// Once a month is live, this is the one-press way to tell the member it is ready: a friendly message with her private link, ready to copy, email or WhatsApp.
function SendToMember({ m, x }: { m: Member; x: Month }) {
  const first = (m.name || "").split(" ")[0] || "lovely";
  const def = `Hi ${first}, your ${monthName(x.month)} content is ready and waiting for you. Pop in here to see everything, choose your posts and tell me what you think:\n\n${m.link ?? ""}\n\nVanessa x`;
  const [msg, setMsg] = useState(def);
  const [show, setShow] = useState(false);
  const phone = (m.phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^0/, "44");
  return (
    <div className="border-2 border-pink-500 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="uppercase text-sm">It is live. Tell {first} it is ready</b>
        <button className="px-3 py-1.5 rounded bg-pink-500 text-white text-sm" onClick={() => setShow((v) => !v)}>{show ? "Hide the message" : `Send it to ${first}`}</button>
      </div>
      {show && (
        <div className="space-y-2">
          <textarea className="w-full border rounded p-2 text-sm min-h-[8rem]" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <div className="flex flex-wrap gap-2 text-sm">
            <button className="px-3 py-1.5 rounded bg-black text-white" onClick={() => { navigator.clipboard?.writeText(msg); toast.success("Message copied. Paste it wherever you chat to her."); }}>Copy message</button>
            <a className="px-3 py-1.5 rounded border" target="_blank" rel="noreferrer" href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}>WhatsApp {phone ? first : "(choose who)"}</a>
            {m.email && <a className="px-3 py-1.5 rounded border" href={`mailto:${m.email}?subject=${encodeURIComponent(`Your ${monthName(x.month)} club content is ready`)}&body=${encodeURIComponent(msg)}`}>Email {first}</a>}
            {m.link && <button className="px-3 py-1.5 rounded border" onClick={() => { navigator.clipboard?.writeText(m.link!); toast.success("Link copied"); }}>Copy just her link</button>}
            {m.link && <a className="px-3 py-1.5 rounded border" target="_blank" rel="noreferrer" href={m.link}>See what she sees</a>}
          </div>
        </div>
      )}
    </div>
  );
}

// What stage is this member at? Drives the badge and the order of the list.
function stage(m: Member, x?: Month) {
  if (!(m.canBuild ?? m.detailsDone)) return { key: "waiting", label: "Waiting for their details", rank: 3 };
  if (!x) return { key: "start", label: "Ready to start", rank: 0 };
  if (x.status === "pending_approval") return { key: "approve", label: "Built, waiting for your approval", rank: 0 };
  if (x.status === "approved") return { key: "live", label: "Approved and live", rank: 2 };
  if (x.status === "to_build") return { key: "build", label: "Ready for you to build", rank: 0 };
  return { key: "choosing", label: "Ready to build (they have not chosen treatments)", rank: 1 };
}

function Details({ m }: { m: Member }) {
  const d = m.details ?? {};
  const row = (k: string, v: unknown) => (v ? <div key={k} className="text-sm"><b className="uppercase text-xs text-pink-500">{k}</b> {Array.isArray(v) ? v.join(", ") : String(v)}</div> : null);
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex gap-4 flex-wrap items-center">
        {m.logoUrl ? <div className="text-center"><img src={m.logoUrl} className="h-16 max-w-[160px] object-contain bg-gray-100 rounded p-1" /><div className="text-xs">Logo</div></div> : <div className="text-xs text-red-600">No logo sent</div>}
        {m.clinicPhotoUrl ? <div className="text-center"><img src={m.clinicPhotoUrl} className="h-16 rounded" /><div className="text-xs">Clinic photo</div></div> : <div className="text-xs text-red-600">No clinic photo sent</div>}
        <div className="flex items-center gap-2 text-xs">Brand colours <span className="inline-block w-6 h-6 rounded border keep-colour" style={{ background: d.mainHex || "#d6006f" }} /><span className="inline-block w-6 h-6 rounded border keep-colour" style={{ background: d.accentHex || "#1a1a1a" }} /></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
        {row("Clinic", d.clinicName)}{row("Name", d.clinicianName)}{row("Instagram", d.handle)}{row("Area", d.area)}{row("Scrubs", d.scrubs)}{row("Font", d.font)}
        {row("Business", d.bizType)}{row("Personality", d.personality)}{row("Three words", d.threeWords)}{row("Favourite treatments", d.favTreatments)}{row("Treatments offered", d.treatmentsOffered)}
        {row("Why", d.why)}{row("How started", d.howStarted)}{row("Passion", d.passion)}{row("Facts", d.facts)}{row("Hobbies", d.hobbies)}{row("Pets", d.pets)}{row("Mum", d.mum)}{row("Age", d.age)}
      </div>
      {(m.photoUrls ?? []).length > 0 && <div className="flex gap-2 overflow-x-auto">{(m.photoUrls ?? []).map((u) => <img key={u} src={u} className="h-20 rounded max-w-none shrink-0" />)}</div>}
    </div>
  );
}

// What the member said about each post, and the posts kept back for later months.
function FeedbackAndBank({ m }: { m: Member }) {
  const withFb = m.months.filter((x) => x.feedback && ((x.feedback.posts ?? []).length || x.feedback.overall));
  const bank = m.months.flatMap((x) => (x.bank ?? []).map((b) => ({ ...b, month: x.month })));
  const [showBank, setShowBank] = useState(false);
  if (!withFb.length && !bank.length) return null;
  return (
    <div className="space-y-2">
      {m.months.filter((x) => x.pick && x.pick.total > x.pick.cap && x.status === "approved").map((x) => (
        <div key={`p-${x.id}`} className="border rounded p-3 text-sm">
          <b className="uppercase">{monthName(x.month)} choice</b>: {x.pick!.phase === "choose" ? `waiting for her to choose ${x.pick!.cap} of ${x.pick!.total} (until ${x.pick!.deadline ? new Date(x.pick!.deadline).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "?"}, then the first ${x.pick!.cap} are used)` : `she chose posts ${x.pick!.picked.slice().sort((a, b) => a - b).join(", ")}`}
        </div>
      ))}
      {withFb.map((x) => {
        const rs = (x.feedback!.posts ?? []).filter((p) => p.rating);
        const avg = rs.length ? (rs.reduce((a, p) => a + p.rating, 0) / rs.length).toFixed(1) : "";
        return (
          <div key={x.id} className="border rounded p-3 text-sm space-y-1">
            <div className="font-bold uppercase">Their feedback for {monthName(x.month)}{avg ? <span className="text-pink-500"> · average {avg} out of 5</span> : null}</div>
            {(x.feedback!.posts ?? []).map((p) => {
              const pic = x.postsList?.find((q) => q.n === p.n)?.image;
              return (
                <div key={p.n} className="flex gap-2 items-start">
                  {pic && <img src={pic} alt="" className="w-10 h-12 object-cover rounded keep-colour" />}
                  <div><b>Post {p.n}</b> {p.rating ? <span className="text-pink-500">{p.rating}/5</span> : null}{p.reason ? <div className="text-gray-600">{p.reason}</div> : null}</div>
                </div>
              );
            })}
            {x.feedback!.overall && <div><b>Overall:</b> {x.feedback!.overall}</div>}
          </div>
        );
      })}
      {bank.length > 0 && (
        <div className="border rounded p-3 text-sm">
          <button className="font-bold uppercase underline" onClick={() => setShowBank((v) => !v)}>{showBank ? "Hide" : "Show"} their bank ({bank.length} saved posts)</button>
          {showBank && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              {bank.map((b) => (
                <div key={`${b.month}-${b.n}`} className="space-y-1">
                  <div className="flex gap-1 overflow-x-auto">{b.images.map((u) => <a key={u} href={u} download target="_blank" rel="noreferrer"><img src={u} alt="" className="h-40 w-auto max-w-none rounded keep-colour" /></a>)}</div>
                  <div className="text-xs text-gray-600">{monthName(b.month)} · {b.label}</div>
                  <button className="text-xs underline" onClick={() => navigator.clipboard?.writeText(`${b.caption}${b.tags ? `\n\n${b.tags}` : ""}`)}>Copy caption</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClubBuild() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<string>("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [, nav] = useLocation();

  const load = useCallback(async () => {
    const r = await fetch(`${API}/club/members`, { headers: authOnly() });
    const j = await r.json().catch(() => ({}));
    setMembers(j.members ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const call = async (key: string, path: string, body: unknown = {}) => {
    setBusy(key);
    try {
      const r = await fetch(`${API}${path}`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "That did not work");
      return j;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not work");
      return null;
    } finally {
      setBusy("");
    }
  };

  // Ticked-off months (kept on this device). Approved months count as done automatically, and a new month is a new id so it starts fresh.
  const [done, setDone] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("club-build-done") || "[]"); } catch { return []; } });
  const toggleDone = (id: string) => setDone((d) => { const n = d.includes(id) ? d.filter((i) => i !== id) : [...d, id]; try { localStorage.setItem("club-build-done", JSON.stringify(n)); } catch {} return n; });
  const latest = (m: Member) => [...m.months].sort((a, b) => b.month.localeCompare(a.month))[0];
  const rows = members
    .filter((m) => showCancelled || m.status === "active" || m.status === "pending")
    .map((m) => ({ m, x: latest(m) }))
    .map((r) => ({ ...r, s: stage(r.m, r.x) }))
    .map((r) => ({ ...r, isDone: !!r.x && (r.s.key === "live" || done.includes(r.x.id)) }))
    .sort((a, b) => Number(a.isDone) - Number(b.isDone) || a.s.rank - b.s.rank || a.m.name.localeCompare(b.m.name));

  const build = async (m: Member, x?: Month) => {
    let month = x;
    if (!month) {
      // No month yet: start one (this also writes their reel hooks), then reload and come back to press Build.
      if (await call(m.id, `/club/members/${m.id}/prepare`, {})) { toast.success("Started their month. Press Build again in a moment."); await load(); }
      return;
    }
    const j = await call(month.id, `/club/months/${month.id}/build-request`, {});
    if (j?.id) nav(`/club-builder?id=${j.id}`);
  };
  const approve = async (x: Month) => { if (await call(`ap-${x.id}`, `/club/months/${x.id}/approve`, {})) { toast.success("Approved and live. Press Send it to her on her card to tell her."); load(); } };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link href="/" className="text-xs uppercase underline">Back to the hub</Link>
            <h1>Club <span className="text-pink-500">build</span></h1>
            <p className="text-sm mt-1">Pick a member. Everything they sent is here. Press Build and it opens the builder with their logo, photos, clinic photo and treatments already loaded.</p>
          </div>
          <Link href="/club-admin" className="px-3 py-1.5 rounded border text-sm">Members and billing</Link>
        </div>

        {loading && <p>Loading...</p>}
        {!loading && rows.length === 0 && <p className="text-sm">No members yet.</p>}

        <div className="space-y-3">
          {rows.map(({ m, x, s, isDone }) => {
            const ready = m.canBuild ?? m.detailsDone;
            return (
              <div key={m.id} className={`border-2 rounded-lg p-4 space-y-2 ${s.rank === 0 && !isDone ? "border-pink-500" : ""} ${isDone ? "opacity-60" : ""} ${m.status === "cancelled" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`text-xl font-extrabold uppercase ${isDone ? "line-through decoration-2" : ""}`}>{m.name} <span className="text-xs text-pink-500">{m.plan === "69" ? "£69 club" : "£275 club"}</span></div>
                    <div className="text-sm"><span className="uppercase font-bold text-pink-500">{isDone ? "Done" : s.label}</span>{x ? ` · ${monthName(x.month)}` : ""}</div>
                    {x && <div className="text-xs text-gray-600">Treatments: {(x.choices.treatments ?? []).join(", ") || "not chosen yet (starts from their favourites)"} · Posts {x.postCount} · Reels {x.reelCount} · Studio photos {x.aiUrls.length}{x.aiStatus === "working" ? " (making them now)" : ""}</div>}
                    {(() => { const old = [...new Set(m.months.filter((o) => o !== x).flatMap((o) => o.choices.treatments ?? []))]; return old.length ? <div className="text-xs text-gray-600">Already done in earlier months: {old.join(", ")}</div> : null; })()}
                  </div>
                  <div className="flex gap-2 flex-wrap text-sm">
                    {x && <label className="px-3 py-1.5 rounded border flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isDone} disabled={s.key === "live"} onChange={() => toggleDone(x.id)} /> Month done</label>}
                    <button className="px-3 py-1.5 rounded border" onClick={() => setOpen(open === m.id ? "" : m.id)}>{open === m.id ? "Hide their details" : "Their details"}</button>
                    {ready && s.key !== "live" && <button disabled={!!busy} className="px-4 py-1.5 rounded bg-pink-500 text-white disabled:opacity-50" onClick={() => build(m, x)}>{!x ? "Start their month" : x.postCount ? "Open the builder" : "Build"}</button>}
                    {ready && s.key === "live" && x && <button disabled={!!busy} className="px-3 py-1.5 rounded border" onClick={() => build(m, x)}>Open the builder</button>}
                    {x && x.postCount > 0 && x.status !== "approved" && <button disabled={!!busy} className="px-4 py-1.5 rounded bg-black text-white disabled:opacity-50" onClick={() => approve(x)}>Approve and show to member</button>}
                  </div>
                </div>
                {x && s.key === "live" && <SendToMember m={m} x={x} />}
                <WelcomePhoto member={m as any} reload={load} />
                {!ready && <div className="text-sm text-red-600">They have not sent their details form yet. Their link is in Members and billing.</div>}
                <FeedbackAndBank m={m} />
                {open === m.id && <Details m={m} />}
              </div>
            );
          })}
        </div>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Show cancelled members</label>
      </div>
    </div>
  );
}
