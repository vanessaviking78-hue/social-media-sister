import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Reads a clinic's own website for the treatments it offers, using the same reader and the same remembered
// list as Client Stylish, so a clinic is only read once.
export function useSiteTreatments(website: string): { treatments: string[]; loading: boolean } {
  const [treatments, setTreatments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const w = website.trim();
    setTreatments([]);
    if (!/\.[a-z]{2,}/i.test(w)) return;
    const key = `client-stylish-treatments:${w.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "")}`;
    try { const c = JSON.parse(localStorage.getItem(key) ?? "null"); if (Array.isArray(c) && c.length) { setTreatments(c); return; } } catch { /* ignore */ }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`${BASE}/api/client-stylish/treatments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ website: w }) });
        const d = JSON.parse(await r.text()) as { treatments?: string[] };
        if (!cancelled && Array.isArray(d.treatments)) {
          setTreatments(d.treatments);
          if (d.treatments.length) { try { localStorage.setItem(key, JSON.stringify(d.treatments)); } catch { /* ignore */ } }
        }
      } catch { /* the page still works without the list */ }
      finally { if (!cancelled) setLoading(false); }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [website]);
  return { treatments, loading };
}
