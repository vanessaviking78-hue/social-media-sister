import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Palette, Loader2, Download, Send, Sparkles } from "lucide-react";
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

type GeneratedBackground = {
  imageUrl: string;
  prompt: string;
};

const EXAMPLE_PROMPT =
  "Sage green background, continuous botanical border wrapping from bottom left corner across the full width to bottom right, layered leaves in green and gold, small dragonfly motif";

export default function BackgroundBuilder() {
  const { presets } = usePresets();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [current, setCurrent] = useState<GeneratedBackground | null>(null);
  const [history, setHistory] = useState<GeneratedBackground[]>([]);
  const [sendPresetId, setSendPresetId] = useState<string>("");
  const [sending, setSending] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) { toast.error("Enter a prompt first"); return; }
    setGenerating(true);
    try {
      const r = await fetch(`${BASE}/api/background-builder/generate`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(d.error || "Generation failed");
      }
      const d = await r.json();
      const result: GeneratedBackground = { imageUrl: d.imageUrl, prompt: prompt.trim() };
      if (current) setHistory((prev) => [current, ...prev]);
      setCurrent(result);
      toast.success("Background ready");
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
    setSending(true);
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
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
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
            <p className="text-zinc-400 text-sm mt-0.5">Describe a background in your own words. It generates, resizes to a Seamless Carousels strip, and is ready to download, add to Canva, or send straight to a client.</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 mb-6">
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
          <Button onClick={handleGenerate} disabled={generating} className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? "Generating..." : "Generate Background"}
          </Button>
        </div>

        {current && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6">
            <img src={current.imageUrl} alt="Generated background" className="w-full h-auto block" />
            <div className="p-4 space-y-3">
              <p className="text-xs text-zinc-500 truncate">{current.prompt}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => handleDownload(current)} className="gap-1.5 border-zinc-700 text-zinc-300 hover:text-white">
                  <Download size={14} /> Download
                </Button>
                <ExportToCanvaButton imageUrl={current.imageUrl} name="Background Builder" variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:text-white" />
                <div className="flex items-center gap-2 ml-auto">
                  <Select value={sendPresetId} onValueChange={setSendPresetId}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white w-44 h-9">
                      <SelectValue placeholder="Pick a client" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {(presets || []).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)} className="text-white hover:bg-zinc-700">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => handleSendToSeamless(current)} disabled={sending} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                    <Send size={14} /> {sending ? "Sending..." : "Send to Seamless Carousels"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Earlier this session</p>
            <div className="grid grid-cols-3 gap-2">
              {history.map((bg, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setHistory((prev) => {
                      const rest = prev.filter((_, idx) => idx !== i);
                      return current ? [current, ...rest] : rest;
                    });
                    setCurrent(bg);
                  }}
                  className="rounded-lg overflow-hidden border border-zinc-800 hover:border-amber-500/50 transition-colors"
                  title={bg.prompt}
                >
                  <img src={bg.imageUrl} alt="" className="w-full h-16 object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
