import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookImage, Loader2, Download, Sparkles, Pipette, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePresets } from "@/lib/use-presets";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, "Authorization": "Bearer " + pw, "Content-Type": "application/json" };
}

type Cover = { name: string; iconKey: string; imageUrl: string };
type SavedCover = { id: number; name: string; iconKey: string; imageUrl: string; createdAt: string };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const EXAMPLE_NAMES = "Skincare\nBotox\nReviews\nBefore & After\nBook Now\nAftercare";

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

export default function HighlightCovers() {
  const { presets } = usePresets();
  const [presetId, setPresetId] = useState<string>("");
  const [colour1, setColour1] = useState("");
  const [colour2, setColour2] = useState("");
  const [loadingColours, setLoadingColours] = useState(false);
  const [names, setNames] = useState("");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Cover[]>([]);
  const [saved, setSaved] = useState<SavedCover[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const clientName = (presets || []).find((p) => String(p.id) === presetId)?.name || "";

  const fetchLogoColours = useCallback(async (id: string) => {
    if (!id) { setColour1(""); setColour2(""); return; }
    setLoadingColours(true);
    try {
      const r = await fetch(`${BASE}/api/background-builder/logo-colours/${id}`, { headers: authHeaders() });
      const d = await r.json().catch(() => ({ colours: [] }));
      const [c1, c2] = d.colours || [];
      setColour1(c1 || "");
      setColour2(c2 || "");
      if (!c1) toast.info("Could not read colours from that logo, type the brand hex codes in yourself");
    } catch {
      setColour1(""); setColour2("");
    } finally {
      setLoadingColours(false);
    }
  }, []);

  const fetchSaved = useCallback(async (id: string) => {
    if (!id) { setSaved([]); return; }
    setSavedLoading(true);
    try {
      const r = await fetch(`${BASE}/api/highlight-covers/list?presetId=${id}`, { headers: authHeaders() });
      const d = await r.json().catch(() => []);
      setSaved(Array.isArray(d) ? d : []);
    } catch {
      setSaved([]);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (presetId) { fetchLogoColours(presetId); fetchSaved(presetId); }
    else { setColour1(""); setColour2(""); setSaved([]); }
  }, [presetId, fetchLogoColours, fetchSaved]);

  async function handleGenerate() {
    const nameList = names.split("\n").map((n) => n.trim()).filter((n) => n.length > 0);
    if (nameList.length === 0) { toast.error("Add at least one highlight name, one per line"); return; }

    const colours = [colour1, colour2].filter((c) => HEX_RE.test(c));
    const body: Record<string, unknown> = { names: nameList, colours };
    if (presetId) body.presetId = Number(presetId);

    setGenerating(true);
    setResults([]);
    try {
      const r = await fetch(`${BASE}/api/highlight-covers/generate-batch`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(d.error || "Generation failed");
      }
      const d = await r.json();
      setResults(d.covers || []);
      const savedNote = d.autoSaved && clientName ? `, saved to ${clientName}'s highlight covers` : "";
      toast.success(`${d.count} highlight cover${d.count === 1 ? "" : "s"} ready${savedNote}`);
      if (presetId) fetchSaved(presetId);
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload(imageUrl: string, name: string) {
    const a = document.createElement("a");
    a.href = imageUrl.startsWith("http") ? imageUrl : `${window.location.origin}${imageUrl}`;
    a.download = `highlight-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDeleteSaved(id: number) {
    try {
      const r = await fetch(`${BASE}/api/highlight-covers/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!r.ok) throw new Error("Failed to delete");
      setSaved((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error("Could not delete, please try again");
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
              <BookImage size={22} className="text-amber-400" /> Highlight Cover Maker
            </h1>
            <p className="text-zinc-400 text-sm mt-0.5">Pick a client, confirm their brand colours, list out the highlight names, and get a matching set of Instagram highlight covers back with the right icon on each one, no typing icon names, it works that out for you.</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 mb-6">
          <div>
            <label className="text-zinc-300 text-sm mb-1.5 block">Client (optional)</label>
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white w-full sm:w-64 h-9">
                <SelectValue placeholder="Pick a client" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-800 border-zinc-700">
                {(presets || []).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} className="text-white hover:bg-zinc-700">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500 mt-1.5">Pick a client to pull their brand colours automatically and auto-save the set to their account. Leave blank to just generate and download.</p>
          </div>

          <div>
            <label className="text-zinc-300 text-sm mb-1.5 flex items-center gap-1.5">
              <Pipette size={14} className="text-zinc-500" /> Brand colours
              {loadingColours && <Loader2 size={12} className="animate-spin text-zinc-500" />}
            </label>
            <div className="flex flex-wrap gap-3">
              <ColourField label="Colour 1" value={colour1} onChange={setColour1} />
              <ColourField label="Colour 2 (optional, alternates across the set)" value={colour2} onChange={setColour2} />
            </div>
            <p className="text-xs text-zinc-500 mt-1.5">Pulled off the client's logo if picked above. Pick two and they'll alternate across the row for a bit of rhythm, or leave one blank to keep every cover the same colour.</p>
          </div>

          <div>
            <label className="text-zinc-300 text-sm mb-1.5 block">Highlight names, one per line</label>
            <textarea
              value={names}
              onChange={(e) => setNames(e.target.value)}
              placeholder={EXAMPLE_NAMES}
              rows={6}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-pink-500 resize-none"
            />
            <p className="text-xs text-zinc-500 mt-1.5">Type whatever the highlight is called, up to 30 at once. The right icon gets picked automatically, e.g. "Botox" gets a syringe, "Reviews" gets a star, "Book Now" gets a calendar. Anything it doesn't recognise gets a little sparkle so nothing ever comes back blank.</p>
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="bg-pink-600 hover:bg-pink-700 text-white gap-2">
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? "Generating..." : "Generate Highlight Covers"}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-3 mb-8">
            <p className="text-xs uppercase tracking-widest text-zinc-500">{results.length} covers just made</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {results.map((cover, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="p-3">
                    <img src={cover.imageUrl} alt={cover.name} className="w-full aspect-square object-cover rounded-full block" />
                  </div>
                  <div className="px-2 pb-2 flex flex-col gap-1.5 items-center">
                    <p className="text-xs text-zinc-300 text-center truncate w-full">{cover.name}</p>
                    <button
                      onClick={() => handleDownload(cover.imageUrl, cover.name)}
                      title="Download"
                      className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs"
                    >
                      <Download size={12} /> Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {presetId && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-zinc-500">{clientName ? `Previously made for ${clientName}` : "Previously made"}</p>
            {savedLoading ? (
              <div className="text-zinc-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</div>
            ) : saved.length === 0 ? (
              <p className="text-zinc-500 text-sm">Nothing saved for this client yet.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {saved.map((cover) => (
                  <div key={cover.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="p-3">
                      <img src={cover.imageUrl} alt={cover.name} className="w-full aspect-square object-cover rounded-full block" />
                    </div>
                    <div className="px-2 pb-2 flex flex-col gap-1.5 items-center">
                      <p className="text-xs text-zinc-300 text-center truncate w-full">{cover.name}</p>
                      <div className="flex gap-1.5 w-full">
                        <button
                          onClick={() => handleDownload(cover.imageUrl, cover.name)}
                          title="Download"
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteSaved(cover.id)}
                          title="Delete"
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-red-400 text-xs"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
