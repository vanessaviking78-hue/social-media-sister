import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Package, ArrowLeft, Sparkles, Loader2, Copy, Check, ExternalLink, Shuffle, ChevronDown, BookOpen, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import VoiceStyleSelector from "@/components/voice-style-selector";
import { toast } from "sonner";
import { authHeaders } from "@/lib/use-approval";

const BASE = import.meta.env.BASE_URL || "/";

function api(path: string) {
  return `${BASE}api/${path}`;
}

interface Topic {
  id: number;
  topic: string;
}

const FORMAT_LABELS = ["Carousel", "About Me", "Reel", "Seamless"];

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export default function BundleBuilder() {
  const [, navigate] = useLocation();
  const [clinicName, setClinicName] = useState("");
  const [igHandle, setIgHandle] = useState("");
  const [treatmentFocus, setTreatmentFocus] = useState("");
  const [brandColour, setBrandColour] = useState("#ec4899");
  const [voiceStyle, setVoiceStyle] = useState("northern-grit");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["", "", "", ""]);
  const [topicsLoaded, setTopicsLoaded] = useState(false);

  const bundleUrl = result
    ? `${window.location.origin}${BASE.replace(/\/$/, "")}/bundle/${result.token}`
    : null;

  const applyRandomTopics = useCallback((pool: Topic[]) => {
    if (pool.length === 0) return;
    const picks = pickRandom(pool, Math.min(4, pool.length));
    const filled: string[] = ["", "", "", ""].map((_, i) => picks[i]?.topic ?? "");
    setSelectedTopics(filled);
  }, []);

  useEffect(() => {
    fetch(api("strategy-topics"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data: Topic[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setAllTopics(data);
          applyRandomTopics(data);
        }
      })
      .catch(() => {})
      .finally(() => setTopicsLoaded(true));
  }, [applyRandomTopics]);

  const randomiseAll = () => applyRandomTopics(allTopics);

  const setSlotTopic = (idx: number, value: string) => {
    setSelectedTopics((prev) => prev.map((t, i) => i === idx ? value : t));
  };

  const handleGenerate = async () => {
    if (!clinicName.trim() || !treatmentFocus.trim()) {
      toast.error("Clinic name and treatment focus are required");
      return;
    }
    setGenerating(true);
    try {
      const activeTopics = selectedTopics.filter(Boolean);
      const resp = await fetch(api("bundle/generate"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          clinicName: clinicName.trim(),
          igHandle: igHandle.trim(),
          treatmentFocus: treatmentFocus.trim(),
          brandColour,
          voiceStyle,
          topics: activeTopics.length === 4 ? activeTopics : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Generation failed");
      setResult(data);
      toast.success("Bundle ready.");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const copy = async () => {
    if (!bundleUrl) return;
    await navigator.clipboard.writeText(bundleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/hub">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Hub
            </Button>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/bundle-requests">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                <Inbox className="w-3.5 h-3.5" />
                Requests
              </Button>
            </Link>
            <Link href="/strategy-library">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Strategy Library
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-yellow-400" />
            </div>
            <h1 className="font-sans text-4xl font-semibold tracking-tight">Trial Bundle Builder</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Enter a prospect clinic's details and generate four pieces of content in their voice. Send them one link and let the work speak for itself.
          </p>
        </div>

        {!result ? (
          <div className="space-y-6">
            {/* Clinic Details */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="clinicName" className="text-base font-medium">Clinic name</Label>
                <Input
                  id="clinicName"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. Bloom Aesthetics"
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="igHandle" className="text-base font-medium">
                  Instagram handle <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="igHandle"
                  value={igHandle}
                  onChange={(e) => setIgHandle(e.target.value)}
                  placeholder="@bloom_aesthetics"
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="treatmentFocus" className="text-base font-medium">Treatment focus</Label>
                <Input
                  id="treatmentFocus"
                  value={treatmentFocus}
                  onChange={(e) => setTreatmentFocus(e.target.value)}
                  placeholder="e.g. lip filler, skin boosters, facial aesthetics"
                  className="h-12 text-base"
                />
                <p className="text-sm text-muted-foreground">The more specific, the better the content.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Brand colour</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="color"
                      value={brandColour}
                      onChange={(e) => setBrandColour(e.target.value)}
                      className="w-14 h-12 p-1 cursor-pointer flex-shrink-0"
                    />
                    <Input
                      value={brandColour}
                      onChange={(e) => setBrandColour(e.target.value)}
                      className="flex-1 h-12 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium">Caption voice</Label>
                  <VoiceStyleSelector value={voiceStyle} onChange={setVoiceStyle} />
                </div>
              </div>
            </div>

            {/* Content Angles */}
            <div className="rounded-2xl border border-border/30 bg-card/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium">Content angles</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {allTopics.length > 0
                      ? "4 topics picked at random from your Strategy Library. Override any slot below."
                      : "No topics in Strategy Library yet."}
                  </p>
                </div>
                {allTopics.length > 0 && (
                  <Button variant="outline" size="sm" onClick={randomiseAll} className="flex-shrink-0 gap-1.5">
                    <Shuffle className="w-3.5 h-3.5" />
                    Randomise
                  </Button>
                )}
              </div>

              {allTopics.length === 0 && topicsLoaded ? (
                <div className="rounded-xl border border-dashed border-border/40 py-5 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Topics will be picked once you add some to the Strategy Library.</p>
                  <Link href="/strategy-library">
                    <Button variant="outline" size="sm">
                      <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                      Open Strategy Library
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {FORMAT_LABELS.map((label, idx) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-medium w-20 flex-shrink-0">{label}</span>
                      <Select
                        value={selectedTopics[idx] || "__none__"}
                        onValueChange={(v) => setSlotTopic(idx, v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="flex-1 h-10 text-sm">
                          <SelectValue placeholder="No topic selected" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-muted-foreground">No topic</span>
                          </SelectItem>
                          {allTopics.map((t) => (
                            <SelectItem key={t.id} value={t.topic}>
                              {t.topic}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={generating || !clinicName.trim() || !treatmentFocus.trim()}
              className="w-full py-6 text-lg font-semibold btn-shimmer"
            >
              {generating ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating content...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" />Generate Bundle</>
              )}
            </Button>

            {generating && (
              <p className="text-center text-sm text-muted-foreground animate-pulse">
                Creating carousel, about me, reel, and seamless content. This takes about 20 seconds.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-950/10 p-6 space-y-4">
              <div className="flex items-center gap-2 text-yellow-400 font-semibold text-lg">
                <Package className="w-5 h-5" />
                Bundle ready for {clinicName}
              </div>
              <p className="text-muted-foreground text-base">
                Share this link. They can view everything without logging in.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-accent/30 border border-border/40 rounded-xl px-4 py-3 font-mono text-sm text-muted-foreground truncate">
                  {bundleUrl}
                </div>
                <Button variant="outline" size="default" onClick={copy} className="flex-shrink-0 h-11">
                  {copied ? (
                    <><Check className="w-4 h-4 mr-2 text-green-400" />Copied</>
                  ) : (
                    <><Copy className="w-4 h-4 mr-2" />Copy link</>
                  )}
                </Button>
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  size="lg"
                  onClick={() => navigate(`/bundle/${result.token}`)}
                  className="flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Preview Bundle
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setResult(null);
                    setClinicName("");
                    setIgHandle("");
                    setTreatmentFocus("");
                    setBrandColour("#ec4899");
                    applyRandomTopics(allTopics);
                  }}
                  className="flex-1"
                >
                  New Bundle
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
