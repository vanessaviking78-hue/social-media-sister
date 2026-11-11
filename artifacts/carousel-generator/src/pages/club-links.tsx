import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

// The club as members see it. Every member has a private link; this page lists them so Vanessa can open any portal or copy the link to send.

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const pw = () => localStorage.getItem("cybersuite-pw") || "";
const authOnly = (): Record<string, string> => ({ "x-app-password": pw(), Authorization: "Bearer " + pw() });

type M = { id: string; name: string; plan: "69" | "222"; status: string; detailsDone: boolean; link: string; nextBilling: string };

export default function ClubLinks() {
  const [members, setMembers] = useState<M[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/club/members`, { headers: authOnly() }).then((r) => r.json()).then((j) => setMembers(j.members ?? [])).catch(() => undefined).finally(() => setLoading(false));
  }, []);
  const copy = (l: string) => { navigator.clipboard?.writeText(l); toast.success("Link copied, ready to send"); };
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">The club, as members see it</h1><Link href="/club-admin" className="text-sm underline">Club admin</Link></div>
      <p className="text-sm text-muted-foreground">Each member has their own private link. Open one to see exactly what they see, or copy it to send them.</p>
      {loading && <p>Loading...</p>}
      {!loading && members.length === 0 && <p className="text-sm">No members yet. Add one in <Link href="/club-admin" className="underline">Club admin</Link> and their link appears here.</p>}
      {(["69", "222"] as const).map((p) => {
        const list = members.filter((m) => m.plan === p && (m.status === "active" || m.status === "pending"));
        if (!list.length) return null;
        return (
          <div key={p} className="space-y-2">
            <h2 className="font-bold uppercase">{p === "69" ? "£69 club" : "£275 club"}</h2>
            {list.map((m) => (
              <div key={m.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                <div><b>{m.name}</b><div className="text-xs text-muted-foreground">{m.detailsDone ? "details done" : "details not filled in yet"} · next billing {m.nextBilling}</div></div>
                <div className="flex gap-2">
                  <a href={m.link} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded bg-pink-500 text-white text-sm">Open their portal</a>
                  <button className="px-3 py-1.5 rounded border text-sm" onClick={() => copy(m.link)}>Copy link</button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
