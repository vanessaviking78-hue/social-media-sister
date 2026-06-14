import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, ScrollText, Loader2, RefreshCcw, Zap, BookOpen, Heart } from "lucide-react";

const TONES = [
  { value: "relaxed", label: "Relaxed", icon: Heart, description: "Chatty, easy, like talking to a friend" },
  { value: "educational", label: "Educational", icon: BookOpen, description: "Clear and informative without being dry" },
  { value: "motivational", label: "Motivational", icon: Zap, description: "Warm and grounding — no hype" },
];

const DURATIONS = [
  { value: "15-second", label: "15 seconds", hint: "Hook + 1 point + CTA" },
  { value: "30-second", label: "30 seconds", hint: "Hook + 2–3 points + CTA" },
  { value: "60-second", label: "60 seconds", hint: "Hook + 4–5 points + CTA" },
];

interface Script {
  hook: string;
  body: string[];
  cta: string;
  fullScript: string;
}

export default function ReelScripts() {
  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState("");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("relaxed");
  const [duration, setDuration] = useState("30-second");
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState<Script | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) {
      toast.error("Add a topic first — what is the reel about?");
      return;
    }
    setLoading(true);
    setScript(null);
    try {
      const res = await fetch("/api/reel-scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, industry, topic, tone, duration }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(data.error || "Generation failed");
      }
      const data = await res.json();
      setScript(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }

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
          <ScrollText className="w-5 h-5 text-orange-400" />
          <span className="font-semibold text-sm hidden sm:inline">Reel Script Generator</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

        {/* Left: form */}
        <div className="space-y-6">
          <div>
            <h1 className="font-bold text-2xl mb-1">Reel Script Generator</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Give it a topic and it writes a script structured for camera — hook, talking points, and a call to action that sounds like a real person.
            </p>
          </div>

          <div className="space-y-5 rounded-2xl border border-border/30 bg-card/40 p-6">

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">What is the reel about? <span className="text-red-400">*</span></Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Why we always recommend a consultation before any treatment, even a simple one"
                className="text-sm resize-none h-24"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Business name <span className="opacity-50">(optional)</span></Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Glow Clinic"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Industry <span className="opacity-50">(optional)</span></Label>
                <Input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Aesthetics clinic"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tone</Label>
              <div className="grid grid-cols-3 gap-2">
                {TONES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTone(t.value)}
                      className={`rounded-xl border p-3 text-left transition-all ${tone === t.value ? "border-orange-500/60 bg-orange-500/10" : "border-border/30 hover:border-border/60 bg-card/30"}`}
                    >
                      <Icon className={`w-4 h-4 mb-1.5 ${tone === t.value ? "text-orange-400" : "text-muted-foreground"}`} />
                      <p className={`text-xs font-semibold ${tone === t.value ? "text-orange-300" : "text-foreground"}`}>{t.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Duration</Label>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`rounded-xl border p-3 text-left transition-all ${duration === d.value ? "border-orange-500/60 bg-orange-500/10" : "border-border/30 hover:border-border/60 bg-card/30"}`}
                  >
                    <p className={`text-sm font-semibold ${duration === d.value ? "text-orange-300" : "text-foreground"}`}>{d.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Writing script...</>
              ) : script ? (
                <><RefreshCcw className="w-4 h-4" />Regenerate</>
              ) : (
                <><ScrollText className="w-4 h-4" />Write Reel Script</>
              )}
            </Button>
          </div>
        </div>

        {/* Right: output */}
        <div className="space-y-4">
          {!script && !loading && (
            <div className="rounded-2xl border border-dashed border-border/30 flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <ScrollText className="w-8 h-8 opacity-20" />
              <p className="text-sm">Your script will appear here</p>
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-dashed border-border/30 flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
              <p className="text-sm">Writing your script...</p>
            </div>
          )}

          {script && (
            <>
              {/* Hook */}
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Hook</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Opening line — stop the scroll</p>
                  </div>
                  <button onClick={() => copy(script.hook)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="w-3.5 h-3.5" />Copy
                  </button>
                </div>
                <div className="px-4 pb-4">
                  <p className="text-base font-semibold leading-snug">{script.hook}</p>
                </div>
              </div>

              {/* Body */}
              <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Body</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Talking points — speak naturally</p>
                  </div>
                  <button onClick={() => copy(script.body.join("\n\n"))} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="w-3.5 h-3.5" />Copy
                  </button>
                </div>
                <div className="px-4 pb-4 space-y-3">
                  {script.body.map((point, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-muted/40 flex items-center justify-center flex-shrink-0 text-xs font-bold text-muted-foreground">{i + 1}</span>
                      <p className="text-sm leading-relaxed">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Call to Action</span>
                    <p className="text-xs text-muted-foreground mt-0.5">End line — what to do next</p>
                  </div>
                  <button onClick={() => copy(script.cta)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Copy className="w-3.5 h-3.5" />Copy
                  </button>
                </div>
                <div className="px-4 pb-4">
                  <p className="text-sm leading-relaxed">{script.cta}</p>
                </div>
              </div>

              {/* Copy full script */}
              <button
                onClick={() => copy(`${script.hook}\n\n${script.body.join("\n\n")}\n\n${script.cta}`)}
                className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 rounded-lg border border-border/20 hover:border-border/40"
              >
                <Copy className="w-3.5 h-3.5" />Copy full script
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
