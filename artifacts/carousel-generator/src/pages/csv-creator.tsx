import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Wand2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Slides = { hook: string; body1: string; body2: string; cta: string };

function toCsvField(v: string): string {
  return `"${(v || "").replace(/"/g, '""')}"`;
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function downloadCsv(slides: Slides, filenameHint: string) {
  const csv = `hook,body1,body2,cta\n${[slides.hook, slides.body1, slides.body2, slides.cta].map(toCsvField).join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameHint || "carousel"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function CsvCreator() {
  const { presets, loading: presetsLoading } = usePresets();
  const [presetId, setPresetId] = useState<string>("");
  const [area, setArea] = useState("");
  const [website, setWebsite] = useState("");
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [slides, setSlides] = useState<Slides | null>(null);

  const selectedPreset = presets.find((p) => String(p.id) === presetId);

  const handleGenerate = async () => {
    if (!area.trim()) { toast.error("Add an area first."); return; }
    if (!brief.trim()) { toast.error("Say what you want the post to be about."); return; }
    setGenerating(true);
    const id = toast.loading("Writing your 4 slides...");
    try {
      const res = await fetch(`${BASE}/api/content/csv-creator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: area.trim(),
          website: website.trim(),
          brief: brief.trim(),
          clientName: selectedPreset?.name ?? "",
          voiceStyle: selectedPreset?.voiceStyle ?? "northern-grit",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(data.error || "Generation failed");
      }
      const data = await res.json();
      setSlides({ hook: data.hook || "", body1: data.body1 || "", body2: data.body2 || "", cta: data.cta || "" });
      toast.success("Slides ready. Have a read through before you download.", { id });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong", { id });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!slides) return;
    const filenameHint = slugify(`${selectedPreset?.name || "client"}-${area || "post"}`);
    downloadCsv(slides, filenameHint);
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link href="/hub">
          <button className="text-zinc-400 hover:text-white transition-colors p-1">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <h1 className="font-semibold text-white tracking-tight text-lg">CSV Creator</h1>
        <span className="text-zinc-500 text-sm">Area, website, and a brief in. A 4-slide carousel CSV out.</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <Label className="text-xs text-zinc-500 mb-1.5 block">Client (optional, sets the voice)</Label>
          <Select value={presetId} onValueChange={setPresetId} disabled={presetsLoading}>
            <SelectTrigger className="bg-zinc-900 border-white/10 text-sm">
              <SelectValue placeholder={presetsLoading ? "Loading..." : "Pick a client"} />
            </SelectTrigger>
            <SelectContent>
              {presets.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-zinc-500 mb-1.5 block">Area</Label>
          <Input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="e.g. Wilmslow, Cheshire"
            className="bg-zinc-900 border-white/10 text-sm placeholder:text-zinc-600"
          />
        </div>

        <div>
          <Label className="text-xs text-zinc-500 mb-1.5 block">Their website (optional)</Label>
          <Input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="e.g. www.theirclinic.co.uk"
            className="bg-zinc-900 border-white/10 text-sm placeholder:text-zinc-600"
          />
          <p className="text-[11px] text-zinc-600 mt-1.5">We'll pull a bit of context from it to keep facts right.</p>
        </div>

        <div>
          <Label className="text-xs text-zinc-500 mb-1.5 block">What do you want this post to be about?</Label>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe the treatment, offer or angle you want this carousel to cover."
            className="min-h-[100px] resize-y text-sm bg-zinc-900 border-white/10 placeholder:text-zinc-600"
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-pink-600 hover:bg-pink-500 text-white font-semibold"
          size="lg"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {generating ? "Writing..." : "Generate 4 slides"}
        </Button>

        {slides && (
          <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">
              Your slides, edit anything before you download
            </p>

            <div>
              <Label className="text-xs text-zinc-500 mb-1.5 block">Hook (slide 1)</Label>
              <Textarea
                value={slides.hook}
                onChange={(e) => setSlides({ ...slides, hook: e.target.value })}
                className="min-h-[50px] text-sm bg-zinc-900 border-white/10"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500 mb-1.5 block">Body (slide 2)</Label>
              <Textarea
                value={slides.body1}
                onChange={(e) => setSlides({ ...slides, body1: e.target.value })}
                className="min-h-[70px] text-sm bg-zinc-900 border-white/10"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500 mb-1.5 block">Body (slide 3)</Label>
              <Textarea
                value={slides.body2}
                onChange={(e) => setSlides({ ...slides, body2: e.target.value })}
                className="min-h-[70px] text-sm bg-zinc-900 border-white/10"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500 mb-1.5 block">CTA (slide 4)</Label>
              <Textarea
                value={slides.cta}
                onChange={(e) => setSlides({ ...slides, cta: e.target.value })}
                className="min-h-[50px] text-sm bg-zinc-900 border-white/10"
              />
            </div>

            <Button
              onClick={handleDownload}
              variant="outline"
              className="w-full border-green-500/40 text-green-400 hover:bg-green-500/10 hover:border-green-500/60 font-semibold"
              size="lg"
            >
              <Download className="w-4 h-4 mr-2" />Download CSV
            </Button>
            <p className="text-[11px] text-zinc-600 text-center">
              Drops straight into Bulk Carousel Creator, headers are hook, body1, body2, cta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
