import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Trash2, Pencil, Save, X, Layers, ArrowLeft, MessageSquareText, CalendarDays, BarChart3, ShieldCheck, Plus, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePresets, type ClientPreset, type PresetStyleFields, type TextAlign } from "@/lib/use-presets";
import { FONT_OPTIONS } from "@/lib/slide-utils";

const BASE = import.meta.env.BASE_URL || "/";

function TestMetaConnection({ presetId }: { presetId: number }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; name?: string; error?: string } | null>(null);

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await fetch(`${BASE}api/meta/test-connection?presetId=${presetId}`);
      const data = await r.json();
      if (r.ok) setResult({ ok: true, name: data.name });
      else setResult({ ok: false, error: data.error });
    } catch {
      setResult({ ok: false, error: "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={test}
        disabled={testing}
        className="text-xs px-3 py-1.5 rounded-lg bg-purple-700/40 hover:bg-purple-700/60 text-purple-200 border border-purple-500/30 transition flex items-center gap-1.5 disabled:opacity-50"
      >
        {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {testing ? "Testing…" : "Test Connection"}
      </button>
      {result && (
        result.ok ? (
          <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle2 className="w-3.5 h-3.5" /> Connected as {result.name}</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle className="w-3.5 h-3.5" /> {result.error}</span>
        )
      )}
    </div>
  );
}

const DEFAULT_STYLES: PresetStyleFields = {
  pageColor: "#000000",
  overlayColor: "rgba(0,0,0,0.5)",
  fontFamily: "Inter, sans-serif",
  subheadingFont: "Inter, sans-serif",
  fontSize: 52,
  textColor: "#ffffff",
  lineSpacing: 0.9,
  cornerStyle: "none",
  cornerColor: "#d4af37",
  textPosition: "bottom",
  textAlign: "left",
  textBoxOutline: false,
  textBoxOutlineColor: "#ffffff",
  logoPosition: "top-right",
  logoSize: 140,
  accentColor: "#d4af37",
};

export default function PresetsPage() {
  const { presets, loading, savePreset, updatePreset, deletePreset } = usePresets();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<ClientPreset>>({});
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [ccWorkspaces, setCcWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [ccWorkspacesLoading, setCcWorkspacesLoading] = useState(false);
  const [ccWorkspacesError, setCcWorkspacesError] = useState<string | null>(null);

  useEffect(() => {
    if (editingId === null) return;
    setCcWorkspacesLoading(true);
    setCcWorkspacesError(null);
    fetch(`${BASE}api/cloud-campaign/workspaces`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Failed to load workspaces");
        setCcWorkspaces(data.workspaces || []);
      })
      .catch((err: Error) => {
        setCcWorkspacesError(err.message || "Could not load Cloud Campaign workspaces");
        setCcWorkspaces([]);
      })
      .finally(() => setCcWorkspacesLoading(false));
  }, [editingId]);

  const handleDelete = async (id: number) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    if (!confirm(`Delete preset "${preset.name}"?`)) return;
    try {
      await deletePreset(id);
      toast.success(`Preset "${preset.name}" deleted`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  };

  const startEdit = (preset: ClientPreset) => {
    setEditingId(preset.id);
    setEditData({ ...preset });
    setEditNameError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
    setEditNameError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editData.name?.trim()) return;
    setEditNameError(null);
    try {
      const styles: PresetStyleFields = {
        pageColor: editData.pageColor || "#000000",
        overlayColor: editData.overlayColor || "rgba(0,0,0,0.5)",
        fontFamily: editData.fontFamily || "Inter, sans-serif",
        subheadingFont: editData.subheadingFont || editData.fontFamily || "Inter, sans-serif",
        fontSize: editData.fontSize || 52,
        textColor: editData.textColor || "#ffffff",
        lineSpacing: parseFloat(editData.lineSpacing || "0.9"),
        cornerStyle: editData.cornerStyle || "none",
        cornerColor: editData.cornerColor || "#d4af37",
        textPosition: editData.textPosition || "bottom",
        textAlign: editData.textAlign || "left",
        textBoxOutline: editData.textBoxOutline ?? false,
        textBoxOutlineColor: editData.textBoxOutlineColor || "#ffffff",
        logoPosition: editData.logoPosition || "top-right",
        logoSize: editData.logoSize || 140,
        accentColor: editData.accentColor || "#d4af37",
      };
      await updatePreset(editingId, editData.name!.trim(), styles, editData.ccWorkspaceId || undefined, editData.logoUrl, editData.captionFootnote, {
        metaPageAccessToken: editData.metaPageAccessToken || null,
        metaFacebookPageId: editData.metaFacebookPageId || null,
        metaInstagramAccountId: editData.metaInstagramAccountId || null,
      });
      toast.success("Preset updated");
      cancelEdit();
    } catch (err: any) {
      const msg: string = err?.message || "Failed to update";
      if (msg.toLowerCase().includes("already exists")) {
        setEditNameError(msg);
      } else {
        toast.error(msg);
      }
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddName.trim()) return;
    setQuickAddSaving(true);
    setQuickAddError(null);
    try {
      await savePreset(quickAddName.trim(), DEFAULT_STYLES);
      toast.success(`"${quickAddName.trim()}" added`);
      setQuickAddName("");
      setShowQuickAdd(false);
    } catch (err: any) {
      const message = err?.message || "Failed to add client";
      setQuickAddError(message);
    } finally {
      setQuickAddSaving(false);
    }
  };

  const getFontLabel = (value: string) => FONT_OPTIONS.find((f) => f.value === value)?.label || value;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border/20">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-pink-500 hover:text-pink-400 transition">
              <ArrowLeft className="w-4 h-4" />
              <Layers className="w-6 h-6" />
              <span className="font-bold text-3xl"><span className="text-white">Social Media Sister's</span>{" "}<span className="text-pink-400">CyberSuite</span></span>
            </Link>
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">Client Presets</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="text-muted-foreground hover:text-white transition">Carousel</Link>
            <Link href="/single-image" className="text-muted-foreground hover:text-white transition">Single Image</Link>
            <Link href="/stories" className="text-muted-foreground hover:text-white transition">Stories</Link>
            <Link href="/captions" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><MessageSquareText className="w-4 h-4" />Captions</Link>
            <Link href="/calendar" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><CalendarDays className="w-4 h-4" />Calendar</Link>
            <Link href="/analytics" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><BarChart3 className="w-4 h-4" />Analytics</Link>
            <Link href="/approval" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><ShieldCheck className="w-4 h-4" />Approvals</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl font-semibold mb-2 tracking-tight">Client Brand Presets</h1>
            <p className="text-lg text-muted-foreground">Manage saved brand settings for all your clients. Use presets in any post creation mode to quickly apply a client's look.</p>
          </div>
          <Button
            onClick={() => { setShowQuickAdd(true); setQuickAddName(""); setQuickAddError(null); }}
            className="shrink-0 bg-pink-600 hover:bg-pink-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add New Client
          </Button>
        </div>

        {showQuickAdd && (
          <div className="mb-6 rounded-2xl border border-pink-500/30 bg-pink-950/20 p-5 flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs text-gray-400 mb-1 block">Client name</Label>
              <Input
                autoFocus
                placeholder="e.g. Glow Studio"
                value={quickAddName}
                onChange={(e) => { setQuickAddName(e.target.value); setQuickAddError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleQuickAdd(); if (e.key === "Escape") { setShowQuickAdd(false); setQuickAddError(null); } }}
                className={`bg-gray-900 border-gray-700 text-white ${quickAddError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {quickAddError && (
                <p className="text-xs text-red-400 mt-1.5">{quickAddError}</p>
              )}
            </div>
            <Button
              onClick={handleQuickAdd}
              disabled={!quickAddName.trim() || quickAddSaving}
              className="bg-pink-600 hover:bg-pink-700"
            >
              <Save className="w-4 h-4 mr-1" /> {quickAddSaving ? "Saving…" : "Save"}
            </Button>
            <Button variant="ghost" onClick={() => { setShowQuickAdd(false); setQuickAddError(null); }} className="text-gray-400">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading presets...</div>
        ) : presets.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/30 rounded-2xl">
            <Layers className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-lg text-muted-foreground mb-2">No presets yet</p>
            <p className="text-sm text-gray-500 mb-6">Create your first preset in Step 2 of any post creation mode</p>
            <Link href="/">
              <Button className="bg-pink-600 hover:bg-pink-700">Go to Carousel Mode</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="rounded-2xl border border-border/30 bg-card/50 p-6 transition hover:border-border/50"
              >
                {editingId === preset.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-400">Name</Label>
                        <Input
                          value={editData.name || ""}
                          onChange={(e) => { setEditData((d) => ({ ...d, name: e.target.value })); setEditNameError(null); }}
                          className={`bg-gray-900 border-gray-700 text-white${editNameError ? " border-red-500 focus-visible:ring-red-500" : ""}`}
                        />
                        {editNameError && (
                          <p className="text-xs text-red-400 mt-1">{editNameError}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Font</Label>
                        <Select value={editData.fontFamily || ""} onValueChange={(v) => setEditData((d) => ({ ...d, fontFamily: v }))}>
                          <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            {FONT_OPTIONS.map((f) => (
                              <SelectItem key={f.value} value={f.value} className="text-white">{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Page Colour</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={editData.pageColor || "#000000"} onChange={(e) => setEditData((d) => ({ ...d, pageColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" />
                          <Input value={editData.pageColor || ""} onChange={(e) => setEditData((d) => ({ ...d, pageColor: e.target.value }))} className="flex-1 bg-gray-900 border-gray-700 text-white" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Text Colour</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={editData.textColor || "#ffffff"} onChange={(e) => setEditData((d) => ({ ...d, textColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" />
                          <Input value={editData.textColor || ""} onChange={(e) => setEditData((d) => ({ ...d, textColor: e.target.value }))} className="flex-1 bg-gray-900 border-gray-700 text-white" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Accent Colour</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={editData.accentColor || "#d4af37"} onChange={(e) => setEditData((d) => ({ ...d, accentColor: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" />
                          <Input value={editData.accentColor || ""} onChange={(e) => setEditData((d) => ({ ...d, accentColor: e.target.value }))} className="flex-1 bg-gray-900 border-gray-700 text-white" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400">Font Size</Label>
                        <Input type="number" value={editData.fontSize || 52} onChange={(e) => setEditData((d) => ({ ...d, fontSize: Number(e.target.value) }))} className="bg-gray-900 border-gray-700 text-white" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Text Alignment</Label>
                      <div className="grid grid-cols-3 gap-1 mt-1">
                        {([{ value: "left" as TextAlign, label: "Left" }, { value: "center" as TextAlign, label: "Centre" }, { value: "right" as TextAlign, label: "Right" }] as const).map((opt) => (
                          <button key={opt.value} onClick={() => setEditData((d) => ({ ...d, textAlign: opt.value }))}
                            className={`px-2 py-2 rounded text-xs font-semibold transition-all ${(editData.textAlign || "left") === opt.value ? "bg-pink-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                          >{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs text-gray-400">Text Box Outline</Label>
                        <button
                          onClick={() => setEditData((d) => ({ ...d, textBoxOutline: !d.textBoxOutline }))}
                          className={`relative w-10 h-5 rounded-full transition-colors ${editData.textBoxOutline ? "bg-pink-500" : "bg-gray-600"}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${editData.textBoxOutline ? "translate-x-5" : ""}`} />
                        </button>
                      </div>
                      {editData.textBoxOutline && (
                        <div className="flex items-center gap-2">
                          <input type="color" value={editData.textBoxOutlineColor || "#ffffff"} onChange={(e) => setEditData((d) => ({ ...d, textBoxOutlineColor: e.target.value }))} className="w-8 h-8 rounded cursor-pointer" />
                          <Input value={editData.textBoxOutlineColor || "#ffffff"} onChange={(e) => setEditData((d) => ({ ...d, textBoxOutlineColor: e.target.value }))} className="flex-1 bg-gray-900 border-gray-700 text-white font-mono text-xs" />
                        </div>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Cloud Campaign Workspace</Label>
                      {ccWorkspacesLoading ? (
                        <p className="text-xs text-gray-500 mt-1">Loading workspaces…</p>
                      ) : ccWorkspacesError ? (
                        <div>
                          <p className="text-xs text-red-400 mt-1 mb-1">{ccWorkspacesError}</p>
                          <Input
                            placeholder="Paste workspace UUID manually"
                            value={editData.ccWorkspaceId || ""}
                            onChange={(e) => setEditData((d) => ({ ...d, ccWorkspaceId: e.target.value || null }))}
                            className="bg-gray-900 border-gray-700 text-white font-mono text-xs"
                          />
                        </div>
                      ) : (
                        <Select
                          value={editData.ccWorkspaceId || "__none__"}
                          onValueChange={(v) => setEditData((d) => ({ ...d, ccWorkspaceId: v === "__none__" ? null : v }))}
                        >
                          <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                            <SelectValue placeholder="Select a workspace…" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="bg-gray-800 border-gray-700 max-h-72 overflow-y-auto">
                            <SelectItem value="__none__" className="text-gray-400">None (unlink)</SelectItem>
                            {ccWorkspaces.map((ws) => (
                              <SelectItem key={ws.id} value={ws.id} className="text-white">{ws.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="border border-purple-500/20 rounded-xl p-4 bg-purple-950/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-purple-300">Direct Instagram & Facebook Posting</Label>
                        {editData.metaInstagramAccountId || editData.metaFacebookPageId ? (
                          <span className="text-xs bg-green-900/40 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">Connected</span>
                        ) : (
                          <span className="text-xs bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">Not connected</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Enter details from your Meta Developer App to post directly to this client's Instagram and Facebook without Cloud Campaign.</p>
                      <div>
                        <Label className="text-xs text-gray-400">Page Access Token</Label>
                        <Input
                          type="password"
                          placeholder="Long-lived Page Access Token"
                          value={editData.metaPageAccessToken || ""}
                          onChange={(e) => setEditData((d) => ({ ...d, metaPageAccessToken: e.target.value || null }))}
                          className="bg-gray-900 border-gray-700 text-white font-mono text-xs"
                          autoComplete="off"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-gray-400">Facebook Page ID</Label>
                          <Input
                            placeholder="e.g. 123456789"
                            value={editData.metaFacebookPageId || ""}
                            onChange={(e) => setEditData((d) => ({ ...d, metaFacebookPageId: e.target.value || null }))}
                            className="bg-gray-900 border-gray-700 text-white font-mono text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-400">Instagram Account ID</Label>
                          <Input
                            placeholder="e.g. 987654321"
                            value={editData.metaInstagramAccountId || ""}
                            onChange={(e) => setEditData((d) => ({ ...d, metaInstagramAccountId: e.target.value || null }))}
                            className="bg-gray-900 border-gray-700 text-white font-mono text-xs"
                          />
                        </div>
                      </div>
                      {editingId && (editData.metaPageAccessToken) && (
                        <TestMetaConnection presetId={editingId} />
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Caption Footnote (appended to AI-generated captions)</Label>
                      <textarea
                        placeholder="e.g. 📍 123 High Street, London | @clinicname"
                        value={editData.captionFootnote || ""}
                        onChange={(e) => setEditData((d) => ({ ...d, captionFootnote: e.target.value }))}
                        rows={2}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-gray-400">Cancel</Button>
                      <Button size="sm" onClick={handleSaveEdit} className="bg-pink-600 hover:bg-pink-700">
                        <Save className="w-3.5 h-3.5 mr-1" /> Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-2">{preset.name}</h3>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded border border-gray-600 inline-block" style={{ backgroundColor: preset.pageColor }} />
                          Page
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded border border-gray-600 inline-block" style={{ backgroundColor: preset.textColor }} />
                          Text
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded border border-gray-600 inline-block" style={{ backgroundColor: preset.accentColor }} />
                          Accent
                        </span>
                        <span style={{ fontFamily: preset.fontFamily }}>{getFontLabel(preset.fontFamily)}</span>
                        <span>{preset.fontSize}px</span>
                        {preset.cornerStyle !== "none" && <span>Corner: {preset.cornerStyle}</span>}
                        {preset.ccWorkspaceId && <span className="text-blue-400">CC linked</span>}
                        {preset.metaInstagramAccountId && <span className="text-purple-400">Meta connected</span>}
                        {preset.logoUrl && <span className="text-green-400">Has logo</span>}
                      </div>
                      {preset.captionFootnote && (
                        <p className="text-xs text-gray-500 mt-1 italic">Footnote: {preset.captionFootnote}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(preset)} className="text-gray-400 hover:text-white h-8 px-2">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(preset.id)} className="text-red-400 hover:text-red-300 h-8 px-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
