import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Loader2, Instagram, AlertTriangle, CheckCircle2, ChevronDown, Zap, X, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL || "/";

interface PageRow {
  id: string;
  name: string;
  hasInstagram: boolean;
  suggestedPresetId: number | null;
  matchScore: number;
  existingConnection: boolean;
}

interface PresetOption {
  id: number;
  name: string;
  alreadyConnected: boolean;
}

export default function BulkConnectReview() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const key = params.get("key") || "";
  const errorParam = params.get("error") || "";

  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [sessionError, setSessionError] = useState(errorParam || "");

  useEffect(() => {
    if (!key) return;
    setLoading(true);
    fetch(`${BASE}api/meta/auth/bulk-pending?key=${key}`)
      .then((r) => r.json())
      .then((d: { pages?: PageRow[]; presets?: PresetOption[]; error?: string }) => {
        if (d.error) {
          setSessionError(d.error);
          return;
        }
        const p = d.pages ?? [];
        const pr = d.presets ?? [];
        setPages(p);
        setPresets(pr);
        const initAssign: Record<string, number | null> = {};
        const initInclude: Record<string, boolean> = {};
        for (const page of p) {
          initAssign[page.id] = page.suggestedPresetId;
          initInclude[page.id] = page.matchScore >= 0.7;
        }
        setAssignments(initAssign);
        setIncluded(initInclude);
      })
      .catch(() => setSessionError("Failed to load session data. Please try again."))
      .finally(() => setLoading(false));
  }, [key]);

  const assignedPresetIds = useMemo(() => {
    const ids = new Set<number>();
    for (const [pageId, presetId] of Object.entries(assignments)) {
      if (included[pageId] && presetId !== null && presetId !== undefined) {
        ids.add(presetId);
      }
    }
    return ids;
  }, [assignments, included]);

  const duplicates = useMemo(() => {
    const counts = new Map<number, number>();
    for (const [pageId, presetId] of Object.entries(assignments)) {
      if (included[pageId] && presetId !== null && presetId !== undefined) {
        counts.set(presetId, (counts.get(presetId) ?? 0) + 1);
      }
    }
    const dupeIds = new Set<number>();
    for (const [id, count] of counts) {
      if (count > 1) dupeIds.add(id);
    }
    return dupeIds;
  }, [assignments, included]);

  const includedCount = Object.values(included).filter(Boolean).length;
  const readyCount = Object.entries(included).filter(
    ([id, inc]) => inc && assignments[id] !== null && assignments[id] !== undefined
  ).length;
  const hasDuplicates = duplicates.size > 0;

  async function handleSave() {
    if (hasDuplicates) {
      toast.error("Remove duplicate preset assignments before saving.");
      return;
    }
    const toSave = Object.entries(assignments)
      .filter(([pageId, presetId]) => included[pageId] && presetId !== null && presetId !== undefined)
      .map(([pageId, presetId]) => ({ pageId, presetId: presetId as number }));

    if (toSave.length === 0) {
      toast.error("No pages selected to save.");
      return;
    }

    setSaving(true);
    try {
      const r = await fetch(`${BASE}api/meta/auth/bulk-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, assignments: toSave }),
      });
      const d = (await r.json()) as { saved?: number; failed?: number; failedDetails?: string[]; error?: string };
      if (!r.ok) throw new Error(d.error || "Save failed");

      const skipped = includedCount - (d.saved ?? 0);
      let msg = `${d.saved} client${d.saved === 1 ? "" : "s"} connected to Facebook.`;
      if (skipped > 0) msg += ` ${skipped} skipped.`;
      toast.success(msg);
      navigate("/presets");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to save connections");
    } finally {
      setSaving(false);
    }
  }

  if (sessionError) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-gray-900 rounded-2xl p-8 space-y-5 border border-gray-800 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto" />
          <h2 className="text-xl font-bold">Something went wrong</h2>
          <p className="text-gray-400 text-sm">{decodeURIComponent(sessionError)}</p>
          <Button onClick={() => navigate("/presets")} className="bg-pink-600 hover:bg-pink-700">
            Back to Presets
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/presets")}
              className="text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-white text-sm leading-none">Bulk Connect Review</h1>
              <p className="text-xs text-gray-500 mt-0.5">{pages.length} Facebook Pages found</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {readyCount} of {includedCount} selected ready to save
            </span>
            <Button
              onClick={handleSave}
              disabled={saving || readyCount === 0 || hasDuplicates}
              className="bg-pink-600 hover:bg-pink-700 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Save All Matches
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {hasDuplicates && (
          <div className="flex items-center gap-3 bg-yellow-900/30 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-300 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Two or more pages are assigned to the same preset. Fix duplicates before saving.
          </div>
        )}

        <div className="rounded-2xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/60">
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium w-8">
                  <span className="sr-only">Include</span>
                </th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Facebook Page</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium w-24">IG</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Suggested Preset</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium w-64">Override</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page, i) => {
                const isIncluded = included[page.id] ?? false;
                const assignedId = assignments[page.id] ?? null;
                const isDuplicate = assignedId !== null && duplicates.has(assignedId);
                const assignedPreset = presets.find((p) => p.id === assignedId);
                const willOverwrite = assignedPreset?.alreadyConnected && isIncluded;

                return (
                  <tr
                    key={page.id}
                    className={`border-b border-gray-800/60 transition-colors ${
                      !isIncluded ? "opacity-40" : isDuplicate ? "bg-yellow-900/10" : ""
                    } ${i % 2 === 0 ? "bg-gray-900/20" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setIncluded((d) => ({ ...d, [page.id]: !d[page.id] }))}
                        className={`w-5 h-5 rounded border transition-colors flex items-center justify-center ${
                          isIncluded
                            ? "bg-pink-600 border-pink-600"
                            : "border-gray-600 hover:border-gray-400"
                        }`}
                      >
                        {isIncluded && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{page.name}</span>
                      {willOverwrite && (
                        <span className="ml-2 text-xs text-yellow-400 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> will overwrite
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {page.hasInstagram ? (
                        <span className="inline-flex items-center gap-1 text-xs text-purple-400">
                          <Instagram className="w-3 h-3" /> linked
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">none</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {page.suggestedPresetId ? (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300 text-xs">
                            {presets.find((p) => p.id === page.suggestedPresetId)?.name}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            page.matchScore >= 0.9
                              ? "bg-green-900/50 text-green-400"
                              : page.matchScore >= 0.7
                              ? "bg-blue-900/50 text-blue-400"
                              : "bg-gray-800 text-gray-500"
                          }`}>
                            {Math.round(page.matchScore * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600 italic">no match</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={assignedId !== null ? String(assignedId) : "__none__"}
                        onValueChange={(v) =>
                          setAssignments((d) => ({
                            ...d,
                            [page.id]: v === "__none__" ? null : Number(v),
                          }))
                        }
                        disabled={!isIncluded}
                      >
                        <SelectTrigger
                          className={`bg-gray-800 border-gray-700 text-white text-xs h-8 ${
                            isDuplicate ? "border-yellow-500/60" : ""
                          }`}
                        >
                          <SelectValue placeholder="Choose preset…" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 max-h-72 overflow-y-auto">
                          <SelectItem value="__none__" className="text-gray-400 text-xs">
                            <X className="w-3 h-3 inline mr-1" /> Skip this page
                          </SelectItem>
                          {presets.map((p) => (
                            <SelectItem
                              key={p.id}
                              value={String(p.id)}
                              className={`text-xs ${
                                p.alreadyConnected && assignedId !== p.id
                                  ? "text-yellow-300"
                                  : "text-white"
                              }`}
                            >
                              {p.name}
                              {p.alreadyConnected && " (connected)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            {includedCount} page{includedCount !== 1 ? "s" : ""} selected,{" "}
            {pages.length - includedCount} skipped
          </p>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/presets")} className="text-gray-400">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || readyCount === 0 || hasDuplicates}
              className="bg-pink-600 hover:bg-pink-700 flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Save All Matches
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
