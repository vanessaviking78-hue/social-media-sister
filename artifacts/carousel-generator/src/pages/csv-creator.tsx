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
const POST_COUNT = 16;

type Post = { hook: string; body1: string; body2: string; cta: string };

function toCsvField(v: string): string {
  return `"${(v || "").replace(/"/g, '""')}"`;
}

function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function downloadCsv(posts: Post[], filenameHint: string) {
  const rows = posts.map((p) => [p.hook, p.body1, p.body2, p.cta].map(toCsvField).join(","));
  const csv = `hook,body1,body2,cta\n${rows.join("\n")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameHint || "carousels"}.csv`;
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
  const [posts, setPosts] = useState<Post[] | null>(null);

  const selectedPreset = presets.find((p) => String(p.id) === presetId);

  const handleGenerate = async () => {
    if (!area.trim()) { toast.error("Add an area first."); return; }
    if (!brief.trim()) { toast.error("Say what you want the posts to be about."); return; }
    setGenerating(true);
    const id = toast.loading(`Writing ${POST_COUNT} carousels...`);
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
          count: POST_COUNT,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(data.error || "Generation failed");
      }
      const data = await res.json();
      const list: Post[] = Array.isArray(data.posts) ? data.posts : [];
      if (!list.length) throw new Error("Nothing came back, try again");
      setPosts(list);
      toast.success(`${list.length} carousels ready. Have a read through before you download.`, { id });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong", { id });
    } finally {
      setGenerating(false);
    }
  };

  const updatePost = (idx: number, patch: Partial<Post>) => {
    if (!posts) return;
    const next = [...posts];
    next[idx] = { ...next[idx], ...patch };
    setPosts(next);
  };

  const handleDownload = () => {
    if (!posts) return;
    const filenameHint = slugify(`${selectedPreset?.name || "client"}-${area || "posts"}`);
    downloadCsv(posts, filenameHint);
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
        <span className="text-zinc-500 text-sm">Area, website, and a brief in. {POST_COUNT} carousel posts out.</span>
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
          <Label className="text-xs text-zinc-500 mb-1.5 block">What do you want these posts to cover?</Label>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe the treatments, offers or angles you want covered. We'll spread them across the batch so nothing repeats."
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
          {generating ? `Writing ${POST_COUNT} carousels...` : `Generate ${POST_COUNT} carousels`}
        </Button>

        {posts && (
          <div className="border border-white/8 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold tracking-widest uppercase text-zinc-400">
                Your carousels, edit anything before you download
              </p>
              <span className="text-xs text-zinc-500">{posts.length} posts</span>
            </div>

            <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
              {posts.map((post, idx) => (
                <div key={idx} className="border border-white/8 rounded-lg p-4 flex flex-col gap-2 bg-white/[0.02]">
                  <p className="text-[11px] font-semibold text-zinc-500">Post {idx + 1}</p>
                  <div>
                    <Label className="text-[11px] text-zinc-500 mb-1 block">Hook (slide 1)</Label>
                    <Textarea
                      value={post.hook}
                      onChange={(e) => updatePost(idx, { hook: e.target.value })}
                      className="min-h-[44px] text-sm bg-zinc-900 border-white/10"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-zinc-500 mb-1 block">Body (slide 2)</Label>
                    <Textarea
                      value={post.body1}
                      onChange={(e) => updatePost(idx, { body1: e.target.value })}
                      className="min-h-[56px] text-sm bg-zinc-900 border-white/10"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-zinc-500 mb-1 block">Body (slide 3)</Label>
                    <Textarea
                      value={post.body2}
                      onChange={(e) => updatePost(idx, { body2: e.target.value })}
                      className="min-h-[56px] text-sm bg-zinc-900 border-white/10"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] text-zinc-500 mb-1 block">CTA (slide 4)</Label>
                    <Textarea
                      value={post.cta}
                      onChange={(e) => updatePost(idx, { cta: e.target.value })}
                      className="min-h-[44px] text-sm bg-zinc-900 border-white/10"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleDownload}
              variant="outline"
              className="w-full border-green-500/40 text-green-400 hover:bg-green-500/10 hover:border-green-500/60 font-semibold"
              size="lg"
            >
              <Download className="w-4 h-4 mr-2" />Download CSV ({posts.length} posts)
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
