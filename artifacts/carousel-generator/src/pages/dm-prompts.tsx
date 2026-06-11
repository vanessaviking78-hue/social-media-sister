import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, MessageSquare, Loader2, RefreshCcw } from "lucide-react";

const SCENARIOS = [
  { value: "new-follower", label: "New follower welcome" },
  { value: "consultation-enquiry", label: "Consultation enquiry reply" },
  { value: "price-enquiry", label: "Price enquiry reply" },
  { value: "collab-outreach", label: "Collab or partnership outreach" },
  { value: "no-show-follow-up", label: "No-show follow-up" },
  { value: "review-request", label: "Review or testimonial request" },
  { value: "post-treatment-check-in", label: "Post-treatment check-in" },
  { value: "lapsed-client", label: "Lapsed client re-engagement" },
];

export default function DmPrompts() {
  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState("");
  const [scenario, setScenario] = useState(SCENARIOS[0].value);
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<string[]>([]);

  async function handleGenerate() {
    setLoading(true);
    setTemplates([]);
    try {
      const res = await fetch("/api/dm-prompts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, industry, scenario, extraContext }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(data.error || "Generation failed");
      }
      const data = await res.json();
      setTemplates(data.templates);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function copyTemplate(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"));
  }

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/30 py-4 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/hub">
            <img src="/sms-logo.png" alt="Social Media Sister" className="h-10 w-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <Link href="/hub">
            <Button variant="outline" size="sm" className="text-muted-foreground border-border/40 text-xs">← All Tools</Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-rose-400" />
          <span className="font-semibold text-sm hidden sm:inline">DM Prompts</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

        {/* Left: form */}
        <div className="space-y-6">
          <div>
            <h1 className="font-bold text-2xl mb-1">DM Prompts</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Write three ready-to-send DM templates for the situation you choose. Human-sounding, specific, and ready to adapt.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-border/30 bg-card/40 p-6">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Scenario</Label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                className="w-full rounded-lg border border-border/40 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {SCENARIOS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Client or business name <span className="opacity-50">(optional)</span></Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Glow Clinic"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Industry or niche <span className="opacity-50">(optional)</span></Label>
              <Input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Aesthetics clinic, dental practice, skin clinic"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Anything specific to include <span className="opacity-50">(optional)</span></Label>
              <Textarea
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="e.g. We're a small family-run clinic. Informal and friendly tone. Don't mention pricing upfront."
                className="text-sm resize-none h-20"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full gap-2 bg-rose-600 hover:bg-rose-700 text-white"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Writing templates...</>
              ) : templates.length > 0 ? (
                <><RefreshCcw className="w-4 h-4" />Regenerate</>
              ) : (
                <><MessageSquare className="w-4 h-4" />Write DM Templates</>
              )}
            </Button>
          </div>
        </div>

        {/* Right: output */}
        <div className="space-y-4">
          {templates.length === 0 && !loading && (
            <div className="rounded-2xl border border-dashed border-border/30 flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <MessageSquare className="w-8 h-8 opacity-20" />
              <p className="text-sm">Your templates will appear here</p>
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-dashed border-border/30 flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
              <p className="text-sm">Writing three templates...</p>
            </div>
          )}

          {templates.map((tmpl, i) => (
            <div key={i} className="rounded-xl border border-border/30 bg-card/40 overflow-hidden">
              <div className="px-4 py-2.5 bg-accent/20 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template {i + 1}</span>
                <button
                  onClick={() => copyTemplate(tmpl)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />Copy
                </button>
              </div>
              <div className="p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{tmpl}</p>
              </div>
            </div>
          ))}

          {templates.length > 0 && (
            <button
              onClick={() => copyTemplate(templates.join("\n\n---\n\n"))}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />Copy all three
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
