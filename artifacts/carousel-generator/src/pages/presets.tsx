import React, { useState } from "react";
import { Link } from "wouter";
import { Trash2, Pencil, Save, X, Layers, ArrowLeft, ImageIcon, ArrowLeftRight, MessageSquareText, CalendarDays, BarChart3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usePresets, type ClientPreset, type PresetStyleFields } from "@/lib/use-presets";
import { FONT_OPTIONS } from "@/lib/slide-utils";

export default function PresetsPage() {
  const { presets, loading, savePreset, updatePreset, deletePreset } = usePresets();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<ClientPreset>>({});

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
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editData.name?.trim()) return;
    try {
      const styles: PresetStyleFields = {
        pageColor: editData.pageColor || "#000000",
        overlayColor: editData.overlayColor || "rgba(0,0,0,0.5)",
        fontFamily: editData.fontFamily || "Inter, sans-serif",
        fontSize: editData.fontSize || 52,
        textColor: editData.textColor || "#ffffff",
        lineSpacing: parseFloat(editData.lineSpacing || "0.9"),
        cornerStyle: editData.cornerStyle || "none",
        cornerColor: editData.cornerColor || "#d4af37",
        gradientEnabled: editData.gradientEnabled ?? true,
        gradientStyle: editData.gradientStyle || "solid",
        gradientColor: editData.gradientColor || "#000000",
        gradientPosition: editData.gradientPosition || "left",
        textPosition: editData.textPosition || "bottom-left",
        logoPosition: editData.logoPosition || "top-right",
        logoSize: editData.logoSize || 140,
        accentColor: editData.accentColor || "#d4af37",
      };
      await updatePreset(editingId, editData.name!.trim(), styles, editData.ccWorkspaceId || undefined, editData.logoUrl, editData.captionFootnote);
      toast.success("Preset updated");
      cancelEdit();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update");
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
            <Link href="/before-after" className="text-muted-foreground hover:text-white transition">Before & After</Link>
            <Link href="/captions" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><MessageSquareText className="w-4 h-4" />Captions</Link>
            <Link href="/calendar" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><CalendarDays className="w-4 h-4" />Calendar</Link>
            <Link href="/analytics" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><BarChart3 className="w-4 h-4" />Analytics</Link>
            <Link href="/approval" className="flex items-center gap-1 text-muted-foreground hover:text-white transition"><ShieldCheck className="w-4 h-4" />Approvals</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-serif text-4xl font-semibold mb-2 tracking-tight">Client Brand Presets</h1>
          <p className="text-lg text-muted-foreground">Manage saved brand settings for all your clients. Use presets in any post creation mode to quickly apply a client's look.</p>
        </div>

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
                          onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                          className="bg-gray-900 border-gray-700 text-white"
                        />
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
