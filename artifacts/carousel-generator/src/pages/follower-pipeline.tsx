import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

// cybersuite.com/follower-pipeline : admin only. Per client, import followers and following from an Instagram export, then tag each
// person (patient, family, friend...) so they can be crossed off. Not linked from any client page.

const PINK = "#ff2d95";
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const TAGS: { key: string; label: string }[] = [
  { key: "untagged", label: "Untagged" },
  { key: "patient", label: "Patient" },
  { key: "potential-patient", label: "Potential patient" },
  { key: "family", label: "Family" },
  { key: "friend", label: "Friend" },
  { key: "staff", label: "Staff" },
  { key: "supplier", label: "Supplier" },
  { key: "local-business", label: "Local business" },
  { key: "ignore", label: "Ignore" },
];

type Client = { presetId: number; name: string; total: number; untagged: number };
type Person = { id: number; username: string; follower: boolean; following: boolean; tag: string };

const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};

// Reads an Instagram data export (followers_1.json / following.json) or a plain list of usernames or profile links.
function extractUsernames(text: string): string[] {
  const out: string[] = [];
  try {
    const data = JSON.parse(text);
    const walk = (node: any) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === "object") {
        if (typeof node.value === "string" && node.value) out.push(node.value);
        else if (typeof node.title === "string" && node.title && Array.isArray(node.string_list_data)) out.push(node.title);
        else if (typeof node.href === "string") { const m = node.href.match(/instagram\.com\/(?:_u\/)?([A-Za-z0-9._]+)/); if (m) out.push(m[1]); }
        Object.values(node).forEach((v) => { if (v && typeof v === "object") walk(v); });
      }
    };
    walk(data);
    if (out.length) return out;
  } catch { /* not JSON */ }
  for (const line of text.split(/[\r\n,]+/)) {
    const m = line.match(/instagram\.com\/(?:_u\/)?([A-Za-z0-9._]+)/);
    out.push(m ? m[1] : line.trim());
  }
  return out;
}

export default function FollowerPipelinePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [presetId, setPresetId] = useState<number | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("untagged");
  const [limit, setLimit] = useState(60);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const loadClients = useCallback(async () => {
    const r = await fetch(`${BASE}/api/pipeline/clients`, { headers: authHeaders() });
    if (r.ok) setClients((await r.json()).clients || []);
  }, []);
  const loadPeople = useCallback(async (id: number) => {
    const r = await fetch(`${BASE}/api/pipeline/people?presetId=${id}`, { headers: authHeaders() });
    if (r.ok) setPeople((await r.json()).people || []);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);
  useEffect(() => { if (presetId) { setPeople([]); loadPeople(presetId); setLimit(60); } }, [presetId, loadPeople]);

  const importFile = async (file: File, kind: "followers" | "following") => {
    if (!presetId) return;
    setBusy(true);
    setMsg("");
    try {
      const names = extractUsernames(await file.text());
      if (names.length === 0) throw new Error("I could not find any usernames in that file");
      const r = await fetch(`${BASE}/api/pipeline/import`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ presetId, kind, usernames: names }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Import failed");
      setMsg(`Read ${d.read} ${kind}. ${d.added} were new, the rest were already here with their tags kept.`);
      await loadPeople(presetId);
      await loadClients();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const setTag = async (p: Person, tag: string) => {
    setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, tag } : x)));
    await fetch(`${BASE}/api/pipeline/tag`, { method: "POST", headers: authHeaders(), body: JSON.stringify({ id: p.id, tag }) });
    loadClients();
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of people) c[p.tag] = (c[p.tag] || 0) + 1;
    return c;
  }, [people]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => p.tag === view && (!q || p.username.includes(q)));
  }, [people, view, search]);

  const current = clients.find((c) => c.presetId === presetId) || null;

  return (
    <div className="fp">
      <style>{`
        .fp, .fp * { box-sizing: border-box; font-family: 'League Spartan', 'Helvetica Neue', Arial, sans-serif; }
        .fp { min-height: 100vh; background: #fff; color: #000; padding: 28px 5vw 60px; }
        .fp a { color: #000; }
        .fp .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .fp h1 { margin: 0; font-weight: 900; font-size: clamp(34px, 6vw, 64px); text-transform: uppercase; letter-spacing: -0.02em; line-height: 0.9; }
        .fp h1 span { color: ${PINK}; }
        .fp button, .fp .btn, .fp select, .fp input[type=text] { border: 2px solid #000; background: #fff; color: #000; font-weight: 800; font-size: 14px; padding: 9px 12px; cursor: pointer; text-decoration: none; display: inline-block; }
        .fp button:hover, .fp .btn:hover { background: #000; color: #fff; }
        .fp .pink { background: ${PINK}; border-color: ${PINK}; color: #fff; }
        .fp .row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
        .fp .tab.on { background: #000; color: #fff; }
        .fp .tab .n { color: ${PINK}; margin-left: 6px; }
        .fp .tab.on .n { color: #fff; }
        .fp .note { border-left: 6px solid ${PINK}; background: #fff0f7; padding: 10px 14px; margin: 0 0 16px; font-size: 15px; font-weight: 600; }
        .fp .person { border: 2px solid #000; margin-bottom: 8px; padding: 10px 14px; display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: center; }
        .fp .person b { font-weight: 900; font-size: 17px; }
        .fp .person small { color: #666; font-weight: 600; margin-left: 8px; }
        .fp .tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .fp .tags button { padding: 5px 9px; font-size: 12px; }
        .fp .tags button.on { background: ${PINK}; border-color: ${PINK}; color: #fff; }
        .fp .empty { padding: 30px 0; color: #555; font-weight: 600; }
        .fp label.btn input { display: none; }
      `}</style>

      <div className="top">
        <h1>Follower <span>pipeline</span></h1>
        <div className="row" style={{ margin: 0 }}>
          <Link href="/hub" className="btn">Hub</Link>
        </div>
      </div>

      <div className="row">
        <select value={presetId ?? ""} onChange={(e) => setPresetId(Number(e.target.value) || null)}>
          <option value="">Pick an account</option>
          {clients.map((c) => (
            <option key={c.presetId} value={c.presetId}>{c.name}{c.total ? ` (${c.untagged} to tag of ${c.total})` : ""}</option>
          ))}
        </select>
        {presetId && (
          <>
            <label className="btn pink">{busy ? "Importing..." : "Import followers file"}<input type="file" accept=".json,.csv,.txt,.html" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f, "followers"); e.target.value = ""; }} /></label>
            <label className="btn">{busy ? "Importing..." : "Import following file"}<input type="file" accept=".json,.csv,.txt,.html" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f, "following"); e.target.value = ""; }} /></label>
          </>
        )}
      </div>

      {msg && <p className="note">{msg}</p>}
      {!presetId && <div className="empty">Pick an account to start. Instagram does not share follower lists with tools, so download the followers and following export from that account (Settings, Accounts Centre, Your information and permissions, Download your information, choose JSON) and import the two files here. Re-importing later only adds new people and keeps your ticks.</div>}

      {presetId && (
        <>
          <div className="row">
            {TAGS.map((t) => (
              <button key={t.key} className={`tab${view === t.key ? " on" : ""}`} onClick={() => { setView(t.key); setLimit(60); }}>
                {t.label}<span className="n">{counts[t.key] || 0}</span>
              </button>
            ))}
            <input type="text" placeholder="Search a username" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {current && people.length === 0 && <div className="empty">Nothing imported for {current.name} yet.</div>}
          {shown.length === 0 && people.length > 0 && <div className="empty">Nobody here.</div>}
          {shown.slice(0, limit).map((p) => (
            <div key={p.id} className="person">
              <div>
                <b><a href={`https://www.instagram.com/${p.username}/`} target="_blank" rel="noopener noreferrer">@{p.username}</a></b>
                <small>{p.follower && p.following ? "follows each other" : p.follower ? "follows them" : "they follow"}</small>
              </div>
              <div className="tags">
                {TAGS.filter((t) => t.key !== "untagged").map((t) => (
                  <button key={t.key} className={p.tag === t.key ? "on" : ""} onClick={() => setTag(p, p.tag === t.key ? "untagged" : t.key)}>{t.label}</button>
                ))}
              </div>
            </div>
          ))}
          {shown.length > limit && <button onClick={() => setLimit(limit + 100)}>Show 100 more ({shown.length - limit} left)</button>}
        </>
      )}
    </div>
  );
}
