import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Loader2,
  CheckCircle2,
  Wand2,
  ChevronLeft,
  FileSpreadsheet,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const CONTENT_MIX_OPTIONS = [
  { value: "educational", label: "Educational tips", description: "Facts, advice and things to know" },
  { value: "promotional", label: "Promotional", description: "Offers, availability and services" },
  { value: "faq", label: "FAQ & myth-busting", description: "Common questions answered honestly" },
  { value: "results", label: "Client journeys", description: "Compliance-safe experience posts" },
  { value: "seasonal", label: "Seasonal & trending", description: "Timely, topical content" },
];

const BATCH_SIZES = [30, 60, 90];

type ParsedData = {
  headers: string[];
  rows: Record<string, string>[];
};

type Preset = { id: number; name: string };

export default function Intake() {
  const [, navigate] = useLocation();

  const [step, setStep] = useState<"upload" | "review" | "generating" | "done">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [editedRows, setEditedRows] = useState<Record<string, string>[]>([]);
  const [clientName, setClientName] = useState("");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetId, setPresetId] = useState<number | undefined>(undefined);
  const [batchSize, setBatchSize] = useState(30);
  const [contentMix, setContentMix] = useState<string[]>(["educational", "faq"]);
  const [modalOpen, setModalOpen] = useState(false);
  const [generated, setGenerated] = useState(0);
  const [total, setTotal] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number | null>(0);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch(`${BASE}api/presets`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPresets([...data].sort((a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })));
      })
      .catch(() => {});

    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }
    setUploading(true);
    setFileName(file.name);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const resp = await fetch(`${BASE}api/intake/parse-csv`, { method: "POST", body: formData });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: "Parse failed" }));
        throw new Error(data.error || "Parse failed");
      }
      const data = await resp.json();
      setParsed({ headers: data.headers, rows: data.rows });
      setEditedRows(data.rows.map((r: Record<string, string>) => ({ ...r })));
      setStep("review");
    } catch (e: any) {
      toast.error("Could not read that CSV: " + (e.message || "unknown error"));
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  const updateCell = (rowIdx: number, header: string, value: string) => {
    setEditedRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [header]: value };
      return next;
    });
  };

  const startGeneration = async () => {
    if (!clientName.trim()) { toast.error("Enter a client name first"); return; }
    if (!contentMix.length) { toast.error("Select at least one content type"); return; }
    setModalOpen(false);
    setStep("generating");
    setGenerated(0);
    setTotal(batchSize);

    const body = JSON.stringify({
      rows: editedRows,
      clientName: clientName.trim(),
      presetId,
      batchSize,
      contentMix,
    });

    try {
      const resp = await fetch(`${BASE}api/intake/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as any).error || "Generation failed");
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "start") { setTotal(event.total); }
            if (event.type === "progress") { setGenerated(event.generated); }
            if (event.type === "complete") {
              setGenerated(event.generated);
              setStep("done");
            }
            if (event.type === "error") {
              toast.error("Generation error: " + event.message);
              setStep("review");
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (e: any) {
      toast.error("Generation failed: " + (e.message || "unknown error"));
      setStep("review");
    }
  };

  const progressPct = total > 0 ? Math.round((generated / total) * 100) : 0;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-4">
        <Link href="/hub">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
            Hub
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="text-yellow-400"><Wand2 className="w-5 h-5" /></div>
          <div>
            <h1 className="font-bold text-lg leading-none">Content Machine</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Upload a client intake CSV and generate a full batch of ready-to-post captions</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Step 1 of 3 — Upload intake CSV</h2>
              <p className="text-muted-foreground text-sm">
                Export your Google Form responses as a CSV and drop it here. Each row is one client.
              </p>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-16 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
                isDragging
                  ? "border-yellow-500/70 bg-yellow-500/5"
                  : "border-border/40 hover:border-border/70 hover:bg-white/2"
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
              {uploading ? (
                <Loader2 className="w-10 h-10 text-yellow-400 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="font-medium">{uploading ? "Reading your file…" : "Drop your CSV here"}</p>
                <p className="text-sm text-muted-foreground mt-1">{uploading ? "" : "or click to browse"}</p>
              </div>
            </div>

            <div className="rounded-xl border border-border/30 bg-white/2 p-5">
              <p className="text-sm font-medium mb-2 text-muted-foreground">What columns does the CSV need?</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Any Google Form export works. The more business detail you include — services offered, tone of voice, key treatments, target client — the better the output. There are no required column names. Every row you include gets used to shape the content.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Review */}
        {step === "review" && parsed && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-1">Step 2 of 3 — Review and configure</h2>
                <p className="text-muted-foreground text-sm">
                  Check the data looks right. Edit any field, then set the client and generate.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="w-4 h-4" />
                <span>{fileName}</span>
                <button
                  onClick={() => { setStep("upload"); setParsed(null); setEditedRows([]); setFileName(""); }}
                  className="ml-1 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Client name + preset */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Client name <span className="text-red-400">*</span></label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Radiance Aesthetics"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Client preset (optional)</label>
                <select
                  value={presetId?.toString() ?? ""}
                  onChange={(e) => setPresetId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                >
                  <option value="">No preset linked</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Form rows */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">{editedRows.length} row{editedRows.length !== 1 ? "s" : ""} from the CSV</p>
              {editedRows.map((row, rowIdx) => (
                <div key={rowIdx} className="rounded-xl border border-border/30 bg-white/2 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-white/3 transition-colors"
                    onClick={() => setExpandedRow(expandedRow === rowIdx ? null : rowIdx)}
                  >
                    <span>Row {rowIdx + 1}{row["Business Name"] ? ` — ${row["Business Name"]}` : row[parsed.headers[0]] ? ` — ${row[parsed.headers[0]].slice(0, 40)}` : ""}</span>
                    {expandedRow === rowIdx ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {expandedRow === rowIdx && (
                    <div className="px-4 pb-4 grid grid-cols-2 gap-3 border-t border-border/20 pt-3">
                      {parsed.headers.map((header) => (
                        <div key={header}>
                          <label className="text-xs text-muted-foreground block mb-1 truncate" title={header}>{header}</label>
                          <textarea
                            value={row[header] || ""}
                            onChange={(e) => updateCell(rowIdx, header, e.target.value)}
                            rows={2}
                            className="w-full bg-zinc-800/60 border border-zinc-700 rounded-md px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="lg"
                onClick={() => {
                  if (!clientName.trim()) { toast.error("Enter a client name first"); return; }
                  setModalOpen(true);
                }}
                className="px-8 py-5 text-base font-bold bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                Generate content
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Generating */}
        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-24 gap-8">
            <div className="text-yellow-400">
              <Wand2 className="w-12 h-12 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Generating content for {clientName}…</h2>
              <p className="text-muted-foreground text-sm">This takes a few minutes. Do not close this tab.</p>
            </div>
            <div className="w-full max-w-md space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{generated} of {total} captions written</span>
                <span className="font-medium text-yellow-400">{progressPct}%</span>
              </div>
              <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Each caption is written fresh, checked against UK compliance rules, then saved to the library.
              </p>
            </div>
            <div className="text-xs text-zinc-600 text-center max-w-sm">
              Roughly £3.50 per 90-post batch in AI fees. A bargain compared to the time saved.
            </div>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="text-emerald-400">
              <CheckCircle2 className="w-16 h-16" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Done.</h2>
              <p className="text-muted-foreground">
                {generated} caption{generated !== 1 ? "s" : ""} saved to the library under <span className="text-white font-medium">{clientName}</span>.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                size="lg"
                onClick={() => navigate(`/library?client=${encodeURIComponent(clientName)}`)}
                className="px-8 py-5 text-base font-bold bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black"
              >
                View in Library
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setParsed(null);
                  setEditedRows([]);
                  setFileName("");
                  setClientName("");
                  setPresetId(undefined);
                  setGenerated(0);
                  setTotal(0);
                }}
              >
                Generate another batch
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Generation settings modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Generation settings</h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Batch size */}
            <div className="space-y-2">
              <label className="text-sm font-medium">How many posts?</label>
              <div className="flex gap-2">
                {BATCH_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setBatchSize(size)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                      batchSize === size
                        ? "border-yellow-500/60 bg-yellow-500/15 text-yellow-300"
                        : "border-zinc-700 text-muted-foreground hover:border-zinc-600"
                    }`}
                  >
                    {size} posts
                    <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                      {size === 30 ? "~1 month" : size === 60 ? "~2 months" : "~3 months"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content mix */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Content mix</label>
              <div className="space-y-2">
                {CONTENT_MIX_OPTIONS.map((opt) => {
                  const active = contentMix.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setContentMix((prev) =>
                          active ? prev.filter((x) => x !== opt.value) : [...prev, opt.value]
                        )
                      }
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                        active
                          ? "border-yellow-500/60 bg-yellow-500/10"
                          : "border-zinc-700 hover:border-zinc-600"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${active ? "bg-yellow-500 border-yellow-500" : "border-zinc-600"}`}>
                        {active && <span className="text-black text-xs font-bold">✓</span>}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${active ? "text-yellow-200" : "text-foreground"}`}>{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {contentMix.length === 0 && (
                <p className="text-xs text-red-400">Select at least one content type</p>
              )}
            </div>

            {/* Cost note */}
            <p className="text-xs text-zinc-600 text-center">
              Approx. cost: {batchSize === 30 ? "~£1.20" : batchSize === 60 ? "~£2.40" : "~£3.50"} in AI fees for this batch.
            </p>

            <Button
              size="lg"
              className="w-full font-bold bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black"
              disabled={contentMix.length === 0}
              onClick={startGeneration}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Start generating {batchSize} posts
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
