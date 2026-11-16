import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

// CLUB BUILD: the one place to build a club member's month. Pick a member, see everything they sent, build, check, approve.
// It uses the same builder as the premium freebies, so the posts, studio photos, logo and clinic photo all come through the same way.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const pw = () => localStorage.getItem("cybersuite-pw") || "";
const authOnly = (): Record<string, string> => ({ "x-app-password": pw(), Authorization: "Bearer " + pw() });
const jsonHeaders = (): Record<string, string> => ({ ...authOnly(), "Content-Type": "application/json" });
const PINK = "#ff1f8e";

type Month = { id: string; month: string; status: string; choices: { treatments?: string[] }; postCount: number; reelCount: number; aiUrls: string[]; aiStatus: string };
type Member = {
  id: string; name: string; email: string; plan: "69" | "222"; status: string; detailsDone: boolean; canBuild?: boolean; details: Record<string, any>;
  photoCount: number; photoUrls?: string[]; logoUrl?: string; clinicPhotoUrl?: string; refPhotoUrl?: string; months: Month[];
};

const monthName = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }); };

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
  const row = (k: string, v: unknown) => (v ? <div key={k} className="text-sm"><b className="uppercase text-xs" style={{ color: PINK }}>{k}</b> {Array.isArray(v) ? v.join(", ") : String(v)}</div> : null);
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex gap-4 flex-wrap items-center">
        {m.logoUrl ? <div className="text-center"><img src={m.logoUrl} className="h-16 max-w-[160px] object-contain bg-gray-100 rounded p-1" /><div className="text-xs">Logo</div></div> : <div className="text-xs text-red-600">No logo sent</div>}
        {m.clinicPhotoUrl ? <div className="text-center"><img src={m.clinicPhotoUrl} className="h-16 rounded" /><div className="text-xs">Clinic photo</div></div> : <div className="text-xs text-red-600">No clinic photo sent</div>}
        <div className="flex items-center gap-2 text-xs">Brand colours <span className="inline-block w-6 h-6 rounded border" style={{ background: d.mainHex || "#d6006f" }} /><span className="inline-block w-6 h-6 rounded border" style={{ background: d.accentHex || "#1a1a1a" }} /></div>
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

  const latest = (m: Member) => [...m.months].sort((a, b) => b.month.localeCompare(a.month))[0];
  const rows = members
    .filter((m) => showCancelled || m.status === "active" || m.status === "pending")
    .map((m) => ({ m, x: latest(m) }))
    .map((r) => ({ ...r, s: stage(r.m, r.x) }))
    .sort((a, b) => a.s.rank - b.s.rank || a.m.name.localeCompare(b.m.name));

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
  const approve = async (x: Month) => { if (await call(`ap-${x.id}`, `/club/months/${x.id}/approve`, {})) { toast.success("Approved. It is now in their portal."); load(); } };

  return (
    <div style={{ background: "#fff", minHeight: "100vh", fontFamily: "'League Spartan', sans-serif" }}>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link href="/" className="text-xs uppercase underline">Back to the hub</Link>
            <h1 style={{ fontWeight: 900, fontSize: "clamp(2.2rem,6vw,3.6rem)", lineHeight: 0.95, textTransform: "uppercase" }}>Club <span style={{ color: PINK }}>build</span></h1>
            <p className="text-sm mt-1">Pick a member. Everything they sent is here. Press Build and it opens the builder with their logo, photos, clinic photo and treatments already loaded.</p>
          </div>
          <Link href="/club-admin" className="px-3 py-1.5 rounded border text-sm">Members and billing</Link>
        </div>

        {loading && <p>Loading...</p>}
        {!loading && rows.length === 0 && <p className="text-sm">No members yet.</p>}

        <div className="space-y-3">
          {rows.map(({ m, x, s }) => {
            const ready = m.canBuild ?? m.detailsDone;
            return (
              <div key={m.id} className="border-2 border-black rounded-lg p-4 space-y-2" style={{ boxShadow: s.rank === 0 ? `5px 5px 0 ${PINK}` : "none", opacity: m.status === "cancelled" ? 0.55 : 1 }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div style={{ fontWeight: 900, fontSize: "1.35rem", textTransform: "uppercase" }}>{m.name} <span className="text-xs" style={{ color: PINK }}>{m.plan === "69" ? "£69 club" : "£275 club"}</span></div>
                    <div className="text-sm"><span className="uppercase font-bold" style={{ color: PINK }}>{s.label}</span>{x ? ` · ${monthName(x.month)}` : ""}</div>
                    {x && <div className="text-xs text-gray-600">Treatments: {(x.choices.treatments ?? []).join(", ") || "not chosen yet (starts from their favourites)"} · Posts {x.postCount} · Reels {x.reelCount} · Studio photos {x.aiUrls.length}{x.aiStatus === "working" ? " (making them now)" : ""}</div>}
                  </div>
                  <div className="flex gap-2 flex-wrap text-sm">
                    <button className="px-3 py-1.5 rounded border" onClick={() => setOpen(open === m.id ? "" : m.id)}>{open === m.id ? "Hide their details" : "Their details"}</button>
                    {ready && s.key !== "live" && <button disabled={!!busy} className="px-4 py-1.5 rounded text-white disabled:opacity-50" style={{ background: PINK }} onClick={() => build(m, x)}>{!x ? "Start their month" : x.postCount ? "Open the builder" : "Build"}</button>}
                    {ready && s.key === "live" && x && <button disabled={!!busy} className="px-3 py-1.5 rounded border" onClick={() => build(m, x)}>Open the builder</button>}
                    {x && x.postCount > 0 && x.status !== "approved" && <button disabled={!!busy} className="px-4 py-1.5 rounded bg-black text-white disabled:opacity-50" onClick={() => approve(x)}>Approve and show to member</button>}
                  </div>
                </div>
                {!ready && <div className="text-sm text-red-600">They have not sent their details form yet. Their link is in Members and billing.</div>}
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
