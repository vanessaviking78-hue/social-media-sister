import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Loader2, Sparkles } from "lucide-react";

type GeneratedPost = {
  title: string;
  slide1_hook: string;
  slide1_subtitle: string;
  slide2_body: string;
  slide3_body: string;
  slide4_cta: string;
};

const TONES = [
  { value: "1", label: "Northern Grit", desc: "Raw, real, working-class warm. No fluff." },
  { value: "2", label: "Whimsical Storytelling", desc: "Poetic, vivid, story-led, character-driven." },
  { value: "3", label: "Dawn French", desc: "Funny, blunt, self-aware. Woman over 40." },
  { value: "4", label: "Professional with Personality", desc: "Warm but authoritative. Relatable expert." },
  { value: "5", label: "High Brow Doctor", desc: "Super professional, clinical authority, premium." },
  { value: "6", label: "Male Clinician", desc: "Direct, approachable, dry humour." },
];

const BATCH_OPTIONS = [
  { value: "1", label: "1 post" },
  { value: "5", label: "5 posts" },
  { value: "10", label: "10 posts" },
  { value: "20", label: "20 posts" },
  { value: "all", label: "All posts" },
];

function csvEscape(value: string): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsv(posts: GeneratedPost[]): string {
  const header = "title,slide1_hook,slide1_subtitle,slide2_body,slide3_body,slide4_cta";
  const rows = posts.map((p) =>
    [p.title, p.slide1_hook, p.slide1_subtitle, p.slide2_body, p.slide3_body, p.slide4_cta]
      .map(csvEscape)
      .join(",")
  );
  return [header, ...rows].join("\n");
}

function downloadCsv(posts: GeneratedPost[], clinicName: string) {
  const csv = buildCsv(posts);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = clinicName
    ? `${clinicName.toLowerCase().replace(/\s+/g, "-")}-carousel-content.csv`
    : "carousel-content.csv";
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ContentGenerator() {
  const [clinicianName, setClinicianName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [location, setLocation] = useState("");
  const [treatments, setTreatments] = useState("");
  const [tone, setTone] = useState("1");
  const [brandVoice, setBrandVoice] = useState("");
  const [postTitlesRaw, setPostTitlesRaw] = useState("");
  const [batchSize, setBatchSize] = useState("all");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  function parseTitles(): string[] {
    return postTitlesRaw
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  function titlesToGenerate(): string[] {
    const all = parseTitles();
    if (batchSize === "all") return all;
    const n = parseInt(batchSize, 10);
    return all.slice(0, n);
  }

  async function handleGenerate() {
    const titles = titlesToGenerate();
    if (titles.length === 0) {
      toast.error("Paste at least one post title before generating.");
      return;
    }

    setLoading(true);
    setProgress(0);
    setPosts([]);
    setExpanded(null);

    const timer = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8, 88));
    }, 600);

    try {
      const res = await fetch("/api/content-generator/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicianName,
          clinicName,
          location,
          treatments,
          tone,
          brandVoice: brandVoice.trim() || undefined,
          postTitles: titles,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error((data as { error?: string }).error ?? "Generation failed");
      }

      const data = await res.json() as { posts: GeneratedPost[] };
      clearInterval(timer);
      setProgress(100);
      setPosts(data.posts);
      toast.success(`${data.posts.length} post${data.posts.length === 1 ? "" : "s"} generated.`);
    } catch (err: unknown) {
      clearInterval(timer);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 800);
    }
  }

  const titleCount = parseTitles().length;
  const toGenerateCount = batchSize === "all" ? titleCount : Math.min(parseInt(batchSize, 10), titleCount);

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/hub">
            <img src="/sms-logo.png" alt="Social Media Sister" className="h-8 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <Link href="/hub">
            <Button variant="outline" size="sm" className="text-muted-foreground border-border/40 text-xs">← All Tools</Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pink-400" />
          <span className="font-semibold text-sm hidden sm:inline">Content Generator</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
        <div className="mb-8">
          <h1 className="font-bold text-2xl mb-1">Content Generator</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            Fill in the clinic details, paste your post titles, and get carousel-ready copy for every slide. Downloads as a CSV, ready for the Carousel Builder.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[480px_1fr] gap-10 items-start">

          {/* Left: form */}
          <div className="space-y-6">

            {/* Clinician details */}
            <div className="rounded-xl border border-border/30 bg-card/30 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Clinician Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1.5 block">Clinician Name</Label>
                  <Input
                    value={clinicianName}
                    onChange={(e) => setClinicianName(e.target.value)}
                    placeholder="Dr. Sarah Jones"
                    className="bg-background/60 border-border/40 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Clinic Name</Label>
                  <Input
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="Radiance Clinic"
                    className="bg-background/60 border-border/40 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Location / Town</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Manchester"
                  className="bg-background/60 border-border/40 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Treatments Offered</Label>
                <Textarea
                  value={treatments}
                  onChange={(e) => setTreatments(e.target.value)}
                  placeholder="Botox, dermal filler, profhilo, skin boosters, PRP hair loss"
                  rows={2}
                  className="bg-background/60 border-border/40 text-sm resize-none"
                />
              </div>
            </div>

            {/* Tone */}
            <div className="rounded-xl border border-border/30 bg-card/30 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Writing Tone</h2>
              <div className="space-y-2">
                {TONES.map((t) => (
                  <label
                    key={t.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      tone === t.value && !brandVoice.trim()
                        ? "border-pink-500/60 bg-pink-500/8"
                        : "border-border/25 hover:border-border/50"
                    } ${brandVoice.trim() ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="tone"
                      value={t.value}
                      checked={tone === t.value}
                      onChange={() => setTone(t.value)}
                      disabled={!!brandVoice.trim()}
                      className="mt-0.5 accent-pink-500 shrink-0"
                    />
                    <div>
                      <span className="text-sm font-medium">{t.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Brand Voice */}
            <div className="rounded-xl border border-border/30 bg-card/30 p-5 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Brand Voice Document</h2>
                <p className="text-xs text-muted-foreground mt-1">Optional. Paste the client's brand guidelines here and they override the tone selection above.</p>
              </div>
              <Textarea
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                placeholder="Paste brand voice or guidelines here..."
                rows={4}
                className="bg-background/60 border-border/40 text-sm resize-none"
              />
              {brandVoice.trim() && (
                <p className="text-xs text-pink-400">Tone selection overridden by brand voice document.</p>
              )}
            </div>

            {/* Post titles */}
            <div className="rounded-xl border border-border/30 bg-card/30 p-5 space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Post Titles</h2>
                <p className="text-xs text-muted-foreground mt-1">One post title per line. Paste from the client tick form.</p>
              </div>
              <Textarea
                value={postTitlesRaw}
                onChange={(e) => setPostTitlesRaw(e.target.value)}
                placeholder={"Why filler doesn't have to look obvious\nWhat happens to your skin in your 40s\nThe truth about lip filler"}
                rows={8}
                className="bg-background/60 border-border/40 text-sm font-mono resize-none"
              />
              {titleCount > 0 && (
                <p className="text-xs text-muted-foreground">{titleCount} title{titleCount === 1 ? "" : "s"} detected.</p>
              )}
            </div>

            {/* Batch size + generate */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-xs mb-1.5 block">Posts to generate</Label>
                <Select value={batchSize} onValueChange={setBatchSize}>
                  <SelectTrigger className="bg-background/60 border-border/40 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BATCH_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={loading || titleCount === 0}
                className="bg-pink-600 hover:bg-pink-500 text-white px-6 h-9"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate {toGenerateCount > 0 ? toGenerateCount : ""}</>
                )}
              </Button>
            </div>

            {/* Progress bar */}
            {loading && (
              <div className="space-y-1.5">
                <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-fuchsia-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Writing {toGenerateCount} post{toGenerateCount === 1 ? "" : "s"}...
                </p>
              </div>
            )}
          </div>

          {/* Right: results */}
          <div>
            {posts.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-border/30 text-center px-6">
                <FileText className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Generated posts will appear here.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Fill in the form and click Generate.</p>
              </div>
            )}

            {posts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{posts.length} post{posts.length === 1 ? "" : "s"} generated</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCsv(posts, clinicName)}
                    className="border-pink-500/40 text-pink-400 hover:text-white hover:bg-pink-600 text-xs"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download CSV
                  </Button>
                </div>

                <div className="space-y-3">
                  {posts.map((post, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-border/30 bg-card/20 overflow-hidden"
                    >
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/3 transition-colors"
                        onClick={() => setExpanded(expanded === idx ? null : idx)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-pink-500/15 text-pink-400 text-xs font-semibold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium truncate">{post.title}</span>
                        </div>
                        <span className="text-muted-foreground/60 text-xs ml-3 shrink-0">
                          {expanded === idx ? "▲" : "▼"}
                        </span>
                      </button>

                      {expanded === idx && (
                        <div className="border-t border-border/20 px-4 pb-4 pt-3 space-y-4">
                          <SlideField label="Slide 1 — Hook" value={post.slide1_hook} accent />
                          <SlideField label="Slide 1 — Subtitle" value={post.slide1_subtitle} />
                          <SlideField label="Slide 2 — Body" value={post.slide2_body} multiline />
                          <SlideField label="Slide 3 — Body" value={post.slide3_body} multiline />
                          <SlideField label="Slide 4 — CTA" value={post.slide4_cta} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCsv(posts, clinicName)}
                    className="border-pink-500/40 text-pink-400 hover:text-white hover:bg-pink-600"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideField({ label, value, multiline, accent }: {
  label: string;
  value: string;
  multiline?: boolean;
  accent?: boolean;
}) {
  function copy() {
    navigator.clipboard.writeText(value).then(() => toast.success("Copied"));
  }

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">{label}</p>
      <div
        className={`group relative rounded-lg px-3 py-2.5 text-sm cursor-pointer border transition-colors hover:border-pink-500/30 ${
          accent
            ? "bg-pink-500/6 border-pink-500/20 font-medium"
            : "bg-white/4 border-border/20"
        }`}
        onClick={copy}
        title="Click to copy"
      >
        {multiline ? (
          <p className="whitespace-pre-line leading-relaxed">{value}</p>
        ) : (
          <p>{value}</p>
        )}
        <span className="absolute top-2 right-2 text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors">copy</span>
      </div>
    </div>
  );
}
