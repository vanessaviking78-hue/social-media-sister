import { useEffect, useState } from "react";
import { ClareFreebie, type FreebieReq } from "@/pages/clare";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const API = `${BASE}/api`;
const authHeaders = (): Record<string, string> => {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, Authorization: "Bearer " + pw, "Content-Type": "application/json" };
};

// /xmas-build?id=... : opens one Xmas freebie request in the NEWXMAS posts, in that clinic's own colours, logo and photos.
export default function XmasBuild() {
  const id = new URLSearchParams(window.location.search).get("id") || "";
  const [req, setReq] = useState<FreebieReq | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) { setErr("No request chosen. Open this from the freebies list."); return; }
    (async () => {
      try {
        const r = await fetch(`${API}/ten-free/requests`, { headers: authHeaders() });
        const j = await r.json();
        const list = (j.requests ?? j ?? []) as Array<Record<string, unknown>>;
        const row = list.find((x) => String(x.id) === id);
        if (!row) { setErr("I could not find that request."); return; }
        setReq({
          id,
          clinicName: String(row.clinicName ?? ""),
          area: String(row.area ?? ""),
          mainHex: String(row.mainHex || "#d6246e"),
          accentHex: String(row.accentHex || "#ffffff"),
          logoUrl: String(row.logoUrl ?? ""),
          photos: Array.isArray(row.photos) ? (row.photos as string[]) : [],
          photoUrl: String(row.photoUrl ?? ""),
        });
      } catch {
        setErr("I could not load that request.");
      }
    })();
  }, [id]);

  if (err) return <div className="p-8 text-white">{err}</div>;
  if (!req) return <div className="p-8 text-white/70">Loading the request...</div>;
  return (
    <div className="p-4 text-white">
      <h1 className="text-2xl font-bold mb-1">Xmas gift for {req.clinicName}</h1>
      <p className="text-white/60 text-sm mb-4">{req.area}</p>
      <ClareFreebie req={req} />
    </div>
  );
}
