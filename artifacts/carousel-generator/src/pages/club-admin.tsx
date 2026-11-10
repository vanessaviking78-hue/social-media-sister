import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { HOOKS, type Hook } from "@/lib/hook-bank";

// Vanessa's side of the £69 club (5 places) and the £222 club (7 places): members, their private links, the monthly prep, and the approval queue.
// Nothing reaches a member's portal until she presses Approve here.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const pw = () => localStorage.getItem("cybersuite-pw") || "";
const jsonHeaders = (): Record<string, string> => ({ "x-app-password": pw(), Authorization: "Bearer " + pw(), "Content-Type": "application/json" });
const authOnly = (): Record<string, string> => ({ "x-app-password": pw(), Authorization: "Bearer " + pw() });

type Reel = { n: number; kind: string; treatment?: string; hook: string; onScreen?: string; script: string };
type Month = {
  id: string; month: string; status: string; choices: { treatments?: string[]; picks?: { kind: string; code?: string; tool?: string; useTemplate?: boolean; label?: string }[]; note?: string };
  reelCount: number; postCount: number; aiUrls: string[]; aiStatus: string; reelsStatus: string; note: string;
};
type Member = {
  id: string; name: string; email: string; plan: "69" | "222"; status: string; billingDay: number; detailsDone: boolean; link: string; nextBilling: string; daysToBilling: number;
  cycle: string; photoCount: number; hasClinicPhoto: boolean; months: Month[];
};
type MonthFull = { id: string; content: { posts?: { n: number; label: string; images: string[]; caption: string; tags: string }[]; reels?: Reel[] }; aiUrls: string[] };

const LIMITS = { "69": 5, "222": 7 } as const;
const PICK_CAP = { "69": 6, "222": 16 } as const;
const TOOLS: { id: string; name: string }[] = [
  { id: "empower", name: "Empower" }, { id: "november-posts", name: "November posts" }, { id: "xmas-posts", name: "Christmas and New Year posts" },
  { id: "unique", name: "Unique" }, { id: "halloween-posts", name: "Halloween posts" }, { id: "lux", name: "LUX" },
];
const SECTIONS = ["Treatment", "Emotional", "Personal", "Nostalgia", "Engagement", "Audience", "Seasonal", "Original"];
type PickT = { kind: string; code?: string; tool?: string; useTemplate?: boolean; label?: string };
const STATUS: Record<string, string> = { choosing: "Member choosing", to_build: "Ready for you to build", pending_approval: "Waiting for your approval", approved: "Approved and live" };
const monthName = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }); };

function MonthPanel({ member, month, reload }: { member: Member; month: Month; reload: () => void }) {
  const [full, setFull] = useState<MonthFull | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [open, setOpen] = useState(false);
  const [, nav] = useLocation();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [label, setLabel] = useState("");
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [picks, setPicks] = useState<PickT[]>(month.choices.picks ?? []);
  const [section, setSection] = useState("Treatment");
  const cap = PICK_CAP[member.plan];
  const picksFull = picks.length >= cap;
  const hookOn = (c: string) => picks.some((p) => p.kind === "hook" && p.code === c);
  const toolOn = (id: string) => picks.some((p) => p.kind === "tool" && p.tool === id);

  const loadFull = useCallback(async () => {
    const r = await fetch(`${API}/club/months/${month.id}`, { headers: authOnly() });
    const j = await r.json();
    setFull({ id: j.id, content: j.content ?? {}, aiUrls: j.aiUrls ?? [] });
    setReels(j.content?.reels ?? []);
  }, [month.id]);
  useEffect(() => { if (open) loadFull(); }, [open, loadFull]);

  const call = async (path: string, body?: unknown, method = "POST") => {
    setBusy(true);
    try {
      const r = await fetch(`${API}${path}`, { method, headers: jsonHeaders(), body: body === undefined ? undefined : JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "That did not work");
      return j;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not work");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const build = async () => {
    const j = await call(`/club/months/${month.id}/build-request`, {});
    if (j?.id) nav(`/10free-admin?id=${j.id}`);
  };
  const attach = async () => {
    if (!files?.length) { toast.error("Choose the images first"); return; }
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("images", f));
    fd.set("label", label);
    fd.set("caption", caption);
    setBusy(true);
    const r = await fetch(`${API}/club/months/${month.id}/attach-post`, { method: "POST", headers: authOnly(), body: fd });
    setBusy(false);
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || "Could not attach"); return; }
    toast.success("Attached");
    setLabel(""); setCaption(""); setFiles(null);
    loadFull(); reload();
  };
  const saveReels = async () => { if (await call(`/club/months/${month.id}`, { reels }, "PATCH")) { toast.success("Reels saved"); reload(); } };
  const removeAi = async (u: string) => { if (!full) return; if (await call(`/club/months/${month.id}`, { aiUrls: full.aiUrls.filter((x) => x !== u) }, "PATCH")) { loadFull(); reload(); } };
  const savePicks = async () => { if (await call(`/club/months/${month.id}`, { choices: { ...month.choices, picks } }, "PATCH")) { toast.success("Posts saved"); reload(); } };
  const approve = async () => { if (await call(`/club/months/${month.id}/approve`, {})) { toast.success("Approved. It is now in their portal."); reload(); } };
  const sendBack = async () => { if (await call(`/club/months/${month.id}/send-back`, { note })) { toast.success("Sent back to build"); reload(); } };

  const toolPicks = (month.choices.picks ?? []).filter((p) => p.kind === "tool");
  const hookPicks = (month.choices.picks ?? []).filter((p) => p.kind === "hook");
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div><b>{monthName(month.month)}</b> <span className="text-xs uppercase text-pink-500">{STATUS[month.status] ?? month.status}</span></div>
        <div className="text-sm flex gap-2 flex-wrap">
          <button className="px-3 py-1 rounded border" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Open"}</button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Treatments: {(month.choices.treatments ?? []).join(", ") || "not chosen yet"} · {hookPicks.length} hook posts · {toolPicks.length} tool posts · Posts {month.postCount} · Reels {month.reelCount} ({month.reelsStatus || "not started"}) · AI photos {month.aiUrls.length} ({month.aiStatus || "not started"})
      </div>
      {open && (
        <div className="space-y-4 pt-2">
          {month.choices.note && <div className="text-sm bg-pink-50 rounded p-2">Her note: {month.choices.note}</div>}
          {month.note && <div className="text-sm bg-yellow-50 rounded p-2">Your note: {month.note}</div>}
          {toolPicks.length > 0 && (
            <div className="text-sm">
              <b>Tool posts you picked (build these in the tool, then attach below):</b>
              <ul className="list-disc ml-5">{toolPicks.map((p, i) => <li key={i}>{p.label || p.tool} {p.useTemplate ? "(use that tool's template)" : "(any design)"}</li>)}</ul>
            </div>
          )}
          <div className="border rounded p-3 space-y-2">
            <h3 className="font-bold uppercase text-sm">Your choice of other posts <span className="text-pink-500">{picks.length} of {cap}</span></h3>
            <div className="flex flex-wrap gap-3">
              {TOOLS.map((t) => {
                const p = picks.find((x) => x.kind === "tool" && x.tool === t.id);
                return (
                  <div key={t.id} className="text-sm">
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!!p} disabled={!p && picksFull} onChange={() => setPicks((a) => (toolOn(t.id) ? a.filter((x) => !(x.kind === "tool" && x.tool === t.id)) : [...a, { kind: "tool", tool: t.id, useTemplate: true, label: t.name }]))} /> {t.name}</label>
                    {p && <label className="ml-5 flex items-center gap-1 text-xs"><input type="checkbox" checked={!!p.useTemplate} onChange={() => setPicks((a) => a.map((x) => (x.kind === "tool" && x.tool === t.id ? { ...x, useTemplate: !x.useTemplate } : x)))} /> use that tool's template</label>}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1">{SECTIONS.map((x) => <button key={x} className={`px-2 py-0.5 rounded border text-xs ${section === x ? "bg-pink-500 text-white" : ""}`} onClick={() => setSection(x)}>{x === "Original" ? "My first hooks" : x}</button>)}</div>
            <div className="max-h-64 overflow-y-auto">
              {HOOKS.filter((h: Hook) => (h.theme || "Original") === section).map((h: Hook) => (
                <label key={h.code} className="flex gap-2 items-start text-sm py-0.5">
                  <input type="checkbox" className="mt-1" checked={hookOn(h.code)} disabled={!hookOn(h.code) && picksFull} onChange={() => setPicks((a) => (hookOn(h.code) ? a.filter((x) => !(x.kind === "hook" && x.code === h.code)) : [...a, { kind: "hook", code: h.code, label: h.text.slice(0, 100) }]))} />
                  <span>{h.text}</span>
                </label>
              ))}
            </div>
            <button disabled={busy} className="px-3 py-1 rounded border text-sm" onClick={savePicks}>Save these posts</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button disabled={busy || !member.detailsDone} className="px-3 py-1.5 rounded bg-pink-500 text-white disabled:opacity-50" onClick={build}>Build the posts</button>
            <button disabled={busy || !member.detailsDone} className="px-3 py-1.5 rounded border" onClick={async () => { if (await call(`/club/members/${member.id}/prepare`, { month: month.month })) toast.success("Started the reels and AI photos. Refresh in a few minutes."); }}>Make reels and AI photos now</button>
            <button disabled={busy || month.status === "approved"} className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-50" onClick={approve}>Approve and show to member</button>
            <button disabled={busy} className="px-3 py-1.5 rounded border" onClick={sendBack}>Send back to build</button>
          </div>
          <input className="w-full border rounded px-2 py-1 text-sm" placeholder="Note to yourself when sending back" value={note} onChange={(e) => setNote(e.target.value)} />

          {full && (
            <>
              <div>
                <h3 className="font-bold uppercase text-sm">Posts ({full.content.posts?.length ?? 0})</h3>
                <div className="space-y-3">
                  {(full.content.posts ?? []).map((p) => (
                    <div key={p.n} className="border-b pb-2">
                      <div className="text-xs uppercase text-pink-500">Post {p.n} · {p.label}</div>
                      <div className="flex gap-2 overflow-x-auto">{p.images.map((u) => <img key={u} src={u} className="h-40 rounded" />)}</div>
                      <div className="text-xs whitespace-pre-wrap mt-1">{p.caption}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2 border rounded p-2">
                  <div className="text-sm font-semibold">Attach a post built in another tool</div>
                  <input className="w-full border rounded px-2 py-1 text-sm" placeholder="Label, for example Empower" value={label} onChange={(e) => setLabel(e.target.value)} />
                  <textarea className="w-full border rounded px-2 py-1 text-sm" placeholder="Caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
                  <input type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} />
                  <button disabled={busy} className="px-3 py-1 rounded border text-sm" onClick={attach}>Attach</button>
                </div>
              </div>
              <div>
                <h3 className="font-bold uppercase text-sm">AI photos ({full.aiUrls.length} of 6)</h3>
                <div className="flex gap-2 flex-wrap">{full.aiUrls.map((u) => <div key={u}><img src={u} className="h-32 rounded" /><button className="text-xs underline" onClick={() => removeAi(u)}>Remove</button></div>)}</div>
              </div>
              <div>
                <h3 className="font-bold uppercase text-sm">Reel hooks and scripts ({reels.length})</h3>
                <div className="space-y-2">
                  {reels.map((r, i) => (
                    <div key={i} className="border rounded p-2 space-y-1">
                      <div className="text-xs uppercase text-pink-500">Reel {r.n} · {r.kind === "treatment" ? r.treatment || "treatment" : "engagement"}</div>
                      <input className="w-full border rounded px-2 py-1 text-sm font-semibold" value={r.hook} onChange={(e) => setReels((a) => a.map((x, k) => (k === i ? { ...x, hook: e.target.value } : x)))} />
                      <textarea className="w-full border rounded px-2 py-1 text-sm" rows={3} value={r.script} onChange={(e) => setReels((a) => a.map((x, k) => (k === i ? { ...x, script: e.target.value } : x)))} />
                    </div>
                  ))}
                </div>
                {reels.length > 0 && <button disabled={busy} className="mt-2 px-3 py-1 rounded border text-sm" onClick={saveReels}>Save my reel edits</button>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClubAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"69" | "222">("69");
  const [day, setDay] = useState(String(new Date().getDate()));
  const [over, setOver] = useState(false);
  const [made, setMade] = useState("");
  const load = useCallback(async () => {
    const r = await fetch(`${API}/club/members`, { headers: authOnly() });
    const j = await r.json().catch(() => ({}));
    setMembers(j.members ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const r = await fetch(`${API}/club/members`, { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ name, email, plan, billingDay: Number(day), overrideLimit: over }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(j.error || "Could not add"); return; }
    setMade(j.link);
    setName(""); setEmail("");
    load();
  };
  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`${API}/club/members/${id}`, { method: "PATCH", headers: jsonHeaders(), body: JSON.stringify(body) });
    load();
  };

  const waiting = members.flatMap((m) => m.months.filter((x) => x.status === "pending_approval").map((x) => ({ m, x })));
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">The clubs</h1><Link href="/hub" className="text-sm underline">Hub</Link></div>

      <div className="border-2 border-black rounded-lg p-4 space-y-2">
        <h2 className="font-bold uppercase">Waiting for your approval ({waiting.length})</h2>
        {waiting.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting. Five days before each billing date I prepare the reels and AI photos and email you.</p>}
        {waiting.map(({ m, x }) => <MonthPanel key={x.id} member={m} month={x} reload={load} />)}
      </div>

      <div className="border-2 border-black rounded-lg p-4 space-y-3">
        <h2 className="font-bold uppercase">Add a member</h2>
        <div className="flex flex-wrap gap-2">
          <input className="border rounded px-2 py-1" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="border rounded px-2 py-1" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="border rounded px-2 py-1" value={plan} onChange={(e) => setPlan(e.target.value as "69" | "222")}><option value="69">£69 club</option><option value="222">£222 club</option></select>
          <label className="text-sm flex items-center gap-1">Billing day of the month <input className="border rounded px-2 py-1 w-16" value={day} onChange={(e) => setDay(e.target.value)} /></label>
          <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={over} onChange={(e) => setOver(e.target.checked)} /> allow an extra place</label>
          <button className="px-4 py-1.5 rounded bg-pink-500 text-white" onClick={add}>Make their link</button>
        </div>
        {made && <div className="text-sm bg-pink-50 rounded p-2">Their private link: <b className="break-all">{made}</b> <button className="underline ml-2" onClick={() => navigator.clipboard?.writeText(made)}>Copy</button></div>}
      </div>

      {loading && <p>Loading...</p>}
      {(["69", "222"] as const).map((p) => {
        const list = members.filter((m) => m.plan === p);
        const active = list.filter((m) => m.status === "active").length;
        return (
          <div key={p} className="space-y-3">
            <h2 className="font-bold uppercase">{p === "69" ? "£69 club" : "£222 club"} <span className="text-pink-500">{active} of {LIMITS[p]} places</span></h2>
            {list.length === 0 && <p className="text-sm text-muted-foreground">No members yet.</p>}
            {list.map((m) => (
              <div key={m.id} className={`border rounded-lg p-4 space-y-2 ${m.status !== "active" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{m.name} <span className="text-xs uppercase text-pink-500">{m.status}</span></div>
                    <div className="text-xs text-muted-foreground">{m.email || "no email"} · bills on day {m.billingDay} · next {m.nextBilling} ({m.daysToBilling} days) · {m.detailsDone ? `details done, ${m.photoCount} photos${m.hasClinicPhoto ? ", clinic photo" : ""}` : "details not filled in yet"}</div>
                  </div>
                  <div className="flex gap-2 text-sm flex-wrap">
                    <button className="px-3 py-1 rounded border" onClick={() => { navigator.clipboard?.writeText(m.link); toast.success("Link copied"); }}>Copy link</button>
                    <button className="px-3 py-1 rounded border" onClick={() => { const d = prompt("New billing day (1 to 28)", String(m.billingDay)); if (d) patch(m.id, { billingDay: Number(d) }); }}>Billing day</button>
                    {m.detailsDone && <button className="px-3 py-1 rounded border" onClick={() => patch(m.id, { reopenDetails: true })}>Reopen their details</button>}
                    {m.status === "active"
                      ? <button className="px-3 py-1 rounded border text-red-600" onClick={() => confirm(`Cancel ${m.name}? Their portal closes straight away.`) && patch(m.id, { status: "cancelled" })}>Cancel</button>
                      : <button className="px-3 py-1 rounded border" onClick={() => patch(m.id, { status: "active" })}>Reactivate</button>}
                  </div>
                </div>
                {m.months.filter((x) => x.status !== "pending_approval").slice(0, 3).map((x) => <MonthPanel key={x.id} member={m} month={x} reload={load} />)}
                {m.months.length === 0 && m.detailsDone && (
                  <button className="px-3 py-1 rounded border text-sm" onClick={async () => { await fetch(`${API}/club/members/${m.id}/prepare`, { method: "POST", headers: jsonHeaders(), body: "{}" }); toast.success("Started. Refresh in a few minutes."); load(); }}>Start their first month now</button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
