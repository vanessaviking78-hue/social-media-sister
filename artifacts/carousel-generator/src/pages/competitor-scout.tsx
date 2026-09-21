import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Trash2, ChevronLeft } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ReportListItem = {
  id: number;
  clinic_name: string;
  postcode: string;
  status: string;
  created_at: string;
};

type ReportFull = ReportListItem & {
  research_notes: string;
  report_html: string;
};

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, "Authorization": "Bearer " + pw, "Content-Type": "application/json" };
}

export default function CompetitorScout() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ReportFull | null>(null);

  const [clinicName, setClinicName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [researchNotes, setResearchNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  function load() {
    setLoading(true);
    fetch(`${BASE}/api/competitor-scout`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setReports(d.reports || []))
      .catch(() => toast.error("Could not load your reports."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function openReport(id: number) {
    try {
      const r = await fetch(`${BASE}/api/competitor-scout/${id}`, { headers: authHeaders() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not open report");
      setOpen(d);
    } catch (e: any) {
      toast.error(e?.message || "Could not open report");
    }
  }

  async function removeReport(id: number) {
    try {
      const r = await fetch(`${BASE}/api/competitor-scout/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error("Delete failed");
      toast.success("Removed.");
      if (open?.id === id) setOpen(null);
      load();
    } catch {
      toast.error("Could not remove this report.");
    }
  }

  async function generate() {
    if (!clinicName.trim() || !postcode.trim() || !researchNotes.trim()) {
      toast.error("Clinic name, postcode and your research notes are all needed first.");
      return;
    }
    setGenerating(true);
    const tid = toast.loading("Writing the report…");
    try {
      const r = await fetch(`${BASE}/api/competitor-scout/generate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ clinicName, postcode, researchNotes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Generation failed");
      toast.success("Report's ready.", { id: tid });
      setClinicName("");
      setPostcode("");
      setResearchNotes("");
      load();
      setOpen(d);
    } catch (e: any) {
      toast.error(e?.message || "Generation failed", { id: tid });
    } finally {
      setGenerating(false);
    }
  }

  if (open) {
    return (
      <div className="min-h-[100dvh] w-full bg-background text-foreground">
        <header className="border-b border-border/40 px-6 py-5 flex items-center gap-3">
          <button onClick={() => setOpen(null)} className="p-2 rounded-full hover:bg-card/60">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{open.clinic_name}</h1>
            <p className="text-sm text-muted-foreground">{open.postcode} · {new Date(open.created_at).toLocaleDateString("en-GB")}</p>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-8">
          <div
            className="prose prose-invert max-w-none prose-h2:text-xs prose-h2:uppercase prose-h2:tracking-wide prose-h2:text-amber-400 prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-2"
            dangerouslySetInnerHTML={{ __html: open.report_html }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="border-b border-border/40 px-6 py-5">
        <h1 className="text-2xl font-bold">Competitor Scout</h1>
        <p className="text-sm text-muted-foreground mt-1">Private to you, never shown to clients. Paste in what you or Claude found on a client's top nearby competitors, and this writes the full report in your voice.</p>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        <section className="rounded-2xl border border-amber-600/40 bg-amber-950/10 p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Clinic name</label>
              <input
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                placeholder="e.g. Beauty & Aesthetics by Emma JB"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-card border border-border/40 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Postcode</label>
              <input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="e.g. BD13 1QP"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-card border border-border/40 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Research notes (paste in what's already been found on the top 2-3 competitors nearby)</label>
            <textarea
              value={researchNotes}
              onChange={(e) => setResearchNotes(e.target.value)}
              rows={8}
              placeholder="Competitor names, locations, what they offer, review counts, anything about their socials..."
              className="w-full mt-1 px-3 py-2 rounded-lg bg-card border border-border/40 text-sm"
            />
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="px-5 py-2.5 rounded-full bg-amber-500 text-black font-semibold text-sm disabled:opacity-40 hover:bg-amber-400 flex items-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {generating ? "Writing…" : "Write the report"}
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Report library</h2>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
          ) : reports.length === 0 ? (
            <div className="rounded-2xl border border-border/40 bg-card/30 p-8 text-center">
              <p className="text-muted-foreground text-sm">No reports yet. Run your first one above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-border/40 bg-card/30 p-4 flex items-center justify-between gap-3">
                  <button onClick={() => openReport(r.id)} className="text-left flex-1">
                    <p className="font-semibold text-sm">{r.clinic_name}</p>
                    <p className="text-xs text-muted-foreground">{r.postcode} · {new Date(r.created_at).toLocaleDateString("en-GB")}</p>
                  </button>
                  <button onClick={() => removeReport(r.id)} className="p-2 rounded-full hover:bg-red-950/30 text-muted-foreground hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
