import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Trash2, ChevronLeft, Download } from "lucide-react";

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
  const [savingToDrive, setSavingToDrive] = useState(false);

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
      if (d.status === "processing") {
        toast("Still out there researching this one, give it a bit longer.");
        return;
      }
      if (d.status === "failed") {
        toast.error("This one didn't come back properly. Best to delete it and run it again.");
        return;
      }
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

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function pollForResult(id: number, tid: string | number) {
    // This can genuinely take a minute or two since it's out there doing
    // live research before it writes a word. Poll a short GET rather than
    // holding one request open, since the proxy in front of the API cuts
    // any single request off at 30 seconds.
    const maxAttempts = 40; // roughly 3 minutes at 4.5s apart
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await sleep(4500);
      try {
        const r = await fetch(`${BASE}/api/competitor-scout/${id}`, { headers: authHeaders() });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not check on the report");
        if (d.status === "ready") {
          toast.success("Report's ready.", { id: tid });
          load();
          setOpen(d);
          return;
        }
        if (d.status === "failed") {
          toast.error("The write up didn't come back properly, try generating again.", { id: tid });
          load();
          return;
        }
      } catch (e: any) {
        toast.error(e?.message || "Could not check on the report", { id: tid });
        return;
      }
    }
    toast.error("This one's taking longer than usual, check the library in a minute.", { id: tid });
    load();
  }

  async function generate() {
    if (!clinicName.trim() || !postcode.trim()) {
      toast.error("Clinic name and postcode are needed first.");
      return;
    }
    setGenerating(true);
    const tid = toast.loading("Searching for their top competitors…");
    try {
      const r = await fetch(`${BASE}/api/competitor-scout/generate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ clinicName, postcode, researchNotes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Generation failed");
      setClinicName("");
      setPostcode("");
      setResearchNotes("");
      load();
      await pollForResult(d.id, tid);
    } catch (e: any) {
      toast.error(e?.message || "Generation failed", { id: tid });
    } finally {
      setGenerating(false);
    }
  }

  function connectGoogleThenRetry(retry: () => void) {
    const popup = window.open(
      `${BASE}/api/google/auth/start`,
      "google-oauth",
      "width=540,height=700,scrollbars=yes,resizable=yes",
    );
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "google-oauth-result") return;
      window.removeEventListener("message", handler);
      popup?.close();
      if (e.data.success) {
        toast.success("Google connected.");
        retry();
      } else {
        toast.error(`Google connection failed: ${e.data.error || "Unknown error"}`);
      }
    };
    window.addEventListener("message", handler);
    const poll = setInterval(() => {
      if (popup?.closed) {
        clearInterval(poll);
        window.removeEventListener("message", handler);
      }
    }, 500);
  }

  async function saveToDrive(id: number) {
    setSavingToDrive(true);
    try {
      const r = await fetch(`${BASE}/api/competitor-scout/${id}/save-to-drive`, {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.error === "not_connected") {
          toast("Connect Google Drive first, opening that now…");
          connectGoogleThenRetry(() => saveToDrive(id));
          return;
        }
        throw new Error(d.error || "Could not save to Drive");
      }
      toast.success(`Saved to Drive as ${d.fileName}`, {
        action: d.webViewLink
          ? { label: "Open", onClick: () => window.open(d.webViewLink, "_blank") }
          : undefined,
      });
    } catch (e: any) {
      toast.error(e?.message || "Could not save to Drive");
    } finally {
      setSavingToDrive(false);
    }
  }

  if (open) {
    return (
      <div className="min-h-[100dvh] w-full bg-background text-foreground">
        <header className="border-b border-border/40 px-6 py-5 flex items-center gap-3">
          <button onClick={() => setOpen(null)} className="p-2 rounded-full hover:bg-card/60">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{open.clinic_name}</h1>
            <p className="text-sm text-muted-foreground">{open.postcode} · {new Date(open.created_at).toLocaleDateString("en-GB")}</p>
          </div>
          <button
            onClick={() => saveToDrive(open.id)}
            disabled={savingToDrive}
            className="px-4 py-2 rounded-full bg-card border border-border/40 text-sm font-medium disabled:opacity-40 hover:bg-card/70 flex items-center gap-2"
          >
            {savingToDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {savingToDrive ? "Downloading…" : "Download"}
          </button>
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
        <p className="text-sm text-muted-foreground mt-1">Private to you, never shown to clients. Give it a clinic name and postcode and it goes and finds their top 3 real local competitors itself, then writes the full comparison report in your voice, addressed straight to the client.</p>
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
            <label className="text-xs text-muted-foreground">Anything you already know (optional, helps it search smarter)</label>
            <textarea
              value={researchNotes}
              onChange={(e) => setResearchNotes(e.target.value)}
              rows={5}
              placeholder="Only fill this in if you already know something worth feeding in, competitor names, a review you've seen, anything about their socials. Leave blank and it'll go and find it all itself."
              className="w-full mt-1 px-3 py-2 rounded-lg bg-card border border-border/40 text-sm"
            />
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="px-5 py-2.5 rounded-full bg-amber-500 text-black font-semibold text-sm disabled:opacity-40 hover:bg-amber-400 flex items-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {generating ? "Researching and writing…" : "Find competitors & write the report"}
          </button>
          {generating && (
            <p className="text-xs text-muted-foreground">This one takes a bit longer, it's out there searching for real competitors before it starts writing. Give it a minute or two.</p>
          )}
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
                    <p className="font-semibold text-sm flex items-center gap-2">
                      {r.clinic_name}
                      {r.status === "processing" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-normal text-amber-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> researching…
                        </span>
                      )}
                      {r.status === "failed" && (
                        <span className="text-[11px] font-normal text-red-400">didn't finish</span>
                      )}
                    </p>
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
