import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Palette, Loader2, Download, Send, Sparkles, Pipette } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExportToCanvaButton from "@/components/export-to-canva";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, "Authorization": "Bearer " + pw, "Content-Type": "application/json" };
}

type GeneratedBackground = { imageUrl: string };

const EXAMPLE_PROMPT =
  "Sage green background, continuous botanical border wrapping from bottom left corner across the full width to bottom right, layered leaves in green and gold, small dragonfly motif";

const STYLES: { id: string; label: string }[] = [
  { id: "botanical-border", label: "Botanical Border" },
  { id: "soft-gradient-wash", label: "Soft Gradient Wash" },
  { id: "geometric-accent", label: "Geometric Accent" },
  { id: "marble-texture", label: "Marble Texture" },
  { id: "scrapbook-style", label: "Scrapbook Style" },
  { id: "editorial", label: "Editorial" },
  { id: "high-end-clinical", label: "High End Clinical" },
  { id: "art-deco", label: "Art Deco" },
  { id: "simple-doodle-stickers", label: "Simple Doodle Stickers" },
];

const COUNT_OPTIONS = [6, 8, 10, 12];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={HEX_RE.test(value) ? value : "#cccccc"}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 rounded-md border border-zinc-700 bg-zinc-800 cursor-pointer"
        title={label}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#RRGGBB"
        className="w-24 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
      />
    </div>
  );
}

export default function BackgroundBuilder() {
  const { presets } = usePresets();
  const [mode, setMode] = useState<"quick" | "custom">("quick");

  // Quick mode state
  const [quickPresetId, setQuickPresetId] = useState<string>("");
  const [styles, setStyles] = useState<string[]>([STYLES[0].id]);
  const [colour1, setColour1] = useState("");
  const [colour2, setColour2] = useState("");
  const [colour3, setColour3] = useState("");
  const [extra, setExtra] = useState("");
  const [loadingColours, setLoadingColours] = useState(false);

  // Custom mode state
  const [prompt, setPrompt] = useState("");

  // Shared
  const [count, setCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedBackground[]>([]);
  const [sendPresetId, setSendPresetId] = useState<string>("");
  const [sendingUrl, setSendingUrl] = useState<string | null>(null);

  const sendClientName = (presets || []).find((p) => String(p.id) === sendPresetId)?.name || "";

  const fetchLogoColours = useCallback(async (presetId: string) => {
    if (!presetId) { setColour1(""); setColour2(""); setColour3(""); return; }
    setLoadingColours(true);
    try {
      const r = await fetch(`${BASE}/api/background-builder/logo-colours/${presetId}`, { headers: authHeaders() });
      const d = await r.json().catch(() => ({ colours: [] }));
      const [c1, c2, c3] = d.colours || [];
      setColour1(c1 || "");
      setColour2(c2 || "");
      setColour3(c3 || "");
      if (!c1) toast.info("Could not read colours from that logo, type the brand hex codes in yourself");
    } catch {
      setColour1(""); setColour2(""); setColour3("");
    } finally {
      setLoadingColours(false);
    }
  }, []);

  useEffect(() => {
    if (quickPresetId) fetchLogoColours(quickPresetId);
  }, [quickPresetId, fetchLogoColours]);

  // Keep "Send to" locked to whichever client is picked in Quick mode, every
  // time it changes, not just the first time. Previously this only fired
  // once (guarded by "!sendPresetId"), so switching client after an earlier
  // batch left the Send button pointed at the old client with no visible
  // warning, which is exactly the bug Vanessa hit sending Ryder Clinic
  // backgrounds while it silently still said Taunton underneath.
  useEffect(() => {
    if (mode === "quick" && quickPresetId) setSendPresetId(quickPresetId);
  }, [quickPresetId, mode]);

  async function handleGenerate() {
    if (mode === "custom" && !prompt.trim()) { toast.error("Enter a prompt first"); return; }

    if (mode === "quick" && styles.length === 0) { toast.error("Pick at least one style first"); return; }

    const body: Record<string, unknown> = { count };
    if (mode === "quick") {
      body.styles = styles;
      body.colours = [colour1, colour2, colour3].filter((c) => HEX_RE.test(c));
      if (extra.trim()) body.extra = extra.trim();
      if (quickPresetId) body.presetId = Number(quickPresetId);
    } else {
      body.prompt = prompt.trim();
    }

    setGenerating(true);
    setResults([]);
    try {
      const r = await fetch(`${BASE}/api/background-builder/generate-batch`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(d.error || "Generation failed");
      }
      const d = await r.json();
      setResults(d.images || []);
      const savedNote = d.autoSaved && sendClientName ? `, already saved to ${sendClientName}'s Seamless Carousels list` : "";
      if (d.succeeded < d.requested) {
        toast.warning(`${d.succeeded} of ${d.requested} generated, a couple didn't land, try again if you want the full set${savedNote}`);
      } else {
        toast.success(`${d.succeeded} backgrounds ready${savedNote}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload(bg: GeneratedBackground) {
    const a = document.createElement("a");
    a.href = bg.imageUrl;
    a.download = `background-${Date.now()}.png`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleSendToSeamless(bg: GeneratedBackground) {
    if (!sendPresetId) { toast.error("Pick a client first"); return; }
    setSendingUrl(bg.imageUrl);
    try {
      const r = await fetch(`${BASE}/api/seamless-caro/backgrounds`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ presetId: Number(sendPresetId), imageUrl: bg.imageUrl, slideCount: 4 }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: "Failed to send" }));
        throw new Error(d.error || "Failed to send");
      }
      toast.success("Sent to Seamless Carousels, pick it up from that client's background list");
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally {
      setSendingUrl(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/hub">
            <button className="text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Palette size={22} className="text-amber-400" /> Background Builder
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">Pick a client and a style, or write your own prompt, and get a batch of ready-to-use backgrounds sized for Seamless Carousels.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("quick")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "quick" ? "bg-pink-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"}`}
          >
            Quick (brand colours + style)
          </button>
          <button
            onClick={() => setMode("custom")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === "custom" ? "bg-pink-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"}`}
          >
            Custom prompt
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 mb-6">
          {mode === "quick" ? (
            <>
              <div>
                <label className="text-zinc-300 text-sm mb-1.5 block">Client</label>
                <Select value={quickPresetId} onValueChange={setQuickPresetId}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white w-full sm:w-64 h-9">
                    <SelectValue placeholder="Pick a client" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {(presets || []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-white hover:bg-zinc-700">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-zinc-300 text-sm mb-1.5 flex items-center gap-1.5">
                  <Pipette size={14} className="text-zinc-500" /> Brand colours
                  {loadingColours && <Loader2 size={12} className="animate-spin text-zinc-500" />}
                </label>
                <div className="flex flex-wrap gap-3">
                  <ColourField label="Colour 1" value={colour1} onChange={setColour1} />
                  <ColourField label="Colour 2" value={colour2} onChange={setColour2} />
                  <ColourField label="Colour 3 (optional)" value={colour3} onChange={setColour3} />
                </div>
                <p className="text-xs text-zinc-500 mt-1.5">Pulled straight off the client's logo. If a logo's rough or the colours come out wrong, just overtype the hex boxes with the real brand colours.</p>
              </div>

              <div>
                <label className="text-zinc-300 text-sm mb-1.5 block">
                  Style {styles.length > 1 && <span className="text-zinc-500 font-normal">({styles.length} picked, split evenly across the batch)</span>}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STYLES.map((s) => {
                    const picked = styles.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => setStyles((prev) => {
                          if (prev.includes(s.id)) {
                            const next = prev.filter((id) => id !== s.id);
                            return next.length > 0 ? next : prev; // always keep at least one style picked
                          }
                          return [...prev, s.id];
                        })}
                        className={`px-3 py-2 rounded-lg text-sm text-left border transition-colors ${picked ? "bg-pink-600 border-pink-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600"}`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-zinc-500 mt-1.5">Pick as many as you like, the batch splits across them so you get a proper mix in one go.</p>
              </div>

              <div>
                <label className="text-zinc-300 text-sm mb-1.5 block">Anything extra? (optional)</label>
                <input
                  type="text"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="e.g. a small dragonfly motif"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="text-zinc-300 text-sm mb-1.5 block">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={EXAMPLE_PROMPT}
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500 resize-none"
              />
              <p className="text-xs text-zinc-500 mt-1.5">Colours, patterns, motifs, mood, whatever you'd tell a designer. No people, no text, no logos, it's a background only.</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm">Generate</span>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white w-20 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {COUNT_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-white hover:bg-zinc-700">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-zinc-400 text-sm">variations</span>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {generating ? `Generating ${count}...` : `Generate ${count} Backgrounds`}
            </Button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs uppercase tracking-widest text-zinc-500">{results.length} backgrounds</p>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-xs">Send to</span>
                <Select value={sendPresetId} onValueChange={setSendPresetId}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white w-44 h-8 text-xs">
                    <SelectValue placeholder="Pick a client" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {(presets || []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-white hover:bg-zinc-700">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {results.map((bg, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <img src={bg.imageUrl} alt="Generated background" className="w-full h-24 object-cover block" />
                  <div className="p-2 flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleDownload(bg)}
                        title="Download"
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs"
                      >
                        <Download size={12} />
                      </button>
                      <ExportToCanvaButton imageUrl={bg.imageUrl} name="Background Builder" label="Canva" variant="outline" size="sm" className="flex-1 border-zinc-700 text-zinc-300 hover:text-white text-xs" />
                    </div>
                    <button
                      onClick={() => handleSendToSeamless(bg)}
                      disabled={sendingUrl === bg.imageUrl}
                      title={sendClientName ? `Sends straight to ${sendClientName}'s Seamless Carousels background list` : "Pick a client above first"}
                      className="w-full flex items-center justify-center gap-1 py-1.5 px-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs disabled:opacity-60"
                    >
                      <Send size={12} className="shrink-0" />
                      <span className="truncate">
                        {sendingUrl === bg.imageUrl ? "Sending..." : sendClientName ? `Send to ${sendClientName}` : "Send"}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
