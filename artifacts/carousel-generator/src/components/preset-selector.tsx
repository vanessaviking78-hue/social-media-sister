import React, { useState, useEffect } from "react";
import { Save, Trash2, FolderOpen, Pencil, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { ClientPreset, PresetStyleFields } from "@/lib/use-presets";

interface CcWorkspace {
  id: string;
  name: string;
}

interface PresetSelectorProps {
  presets: ClientPreset[];
  loading: boolean;
  selectedPresetId: number | null;
  onSelectPreset: (preset: ClientPreset) => void;
  onSavePreset: (name: string, styles: PresetStyleFields, ccWorkspaceId?: string, logoUrl?: string | null) => Promise<void>;
  onUpdatePreset: (id: number, name: string, styles: PresetStyleFields, ccWorkspaceId?: string, logoUrl?: string | null) => Promise<void>;
  onDeletePreset: (id: number) => Promise<void>;
  getCurrentStyles: () => PresetStyleFields;
  logoFile?: File | null;
  uploadLogo?: (file: File) => Promise<string>;
  currentLogoUrl?: string | null;
}

export default function PresetSelector({
  presets,
  loading,
  selectedPresetId,
  onSelectPreset,
  onSavePreset,
  onUpdatePreset,
  onDeletePreset,
  getCurrentStyles,
  logoFile,
  uploadLogo,
  currentLogoUrl,
}: PresetSelectorProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveCcWorkspaceId, setSaveCcWorkspaceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [ccWorkspaces, setCcWorkspaces] = useState<CcWorkspace[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/cloud-campaign/workspaces`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.workspaces) setCcWorkspaces(d.workspaces); })
      .catch(() => {});
  }, []);

  const handleLoad = (value: string) => {
    if (value === "__none__") return;
    const preset = presets.find((p) => String(p.id) === value);
    if (preset) onSelectPreset(preset);
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      toast.error("Please enter a name for this preset");
      return;
    }
    setSaving(true);
    try {
      const styles = getCurrentStyles();
      let logoUrl: string | null = null;
      if (logoFile && uploadLogo) {
        toast.loading("Uploading logo...");
        logoUrl = await uploadLogo(logoFile);
      } else if (currentLogoUrl) {
        logoUrl = currentLogoUrl;
      }
      await onSavePreset(saveName.trim(), styles, saveCcWorkspaceId || undefined, logoUrl);
      toast.success(`Preset "${saveName.trim()}" saved`);
      setSaveName("");
      setSaveCcWorkspaceId("");
      setShowSaveDialog(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save preset");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedPresetId) {
      toast.error("No preset selected to update");
      return;
    }
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    setSaving(true);
    try {
      const styles = getCurrentStyles();
      let logoUrl: string | null = preset.logoUrl;
      if (logoFile && uploadLogo) {
        toast.loading("Uploading logo...");
        logoUrl = await uploadLogo(logoFile);
      } else if (currentLogoUrl) {
        logoUrl = currentLogoUrl;
      }
      await onUpdatePreset(selectedPresetId, preset.name, styles, preset.ccWorkspaceId || undefined, logoUrl);
      toast.success(`Preset "${preset.name}" updated`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update preset");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    try {
      await onDeletePreset(id);
      toast.success(`Preset "${preset.name}" deleted`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete preset");
    }
  };

  const handleRename = async (id: number) => {
    if (!editName.trim()) return;
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    try {
      await onUpdatePreset(id, editName.trim(), {
        pageColor: preset.pageColor,
        overlayColor: preset.overlayColor,
        fontFamily: preset.fontFamily,
        fontSize: preset.fontSize,
        textColor: preset.textColor,
        lineSpacing: parseFloat(preset.lineSpacing),
        cornerStyle: preset.cornerStyle,
        cornerColor: preset.cornerColor,
        gradientEnabled: preset.gradientEnabled,
        gradientStyle: preset.gradientStyle,
        gradientColor: preset.gradientColor,
        gradientPosition: preset.gradientPosition,
        textPosition: preset.textPosition,
        logoPosition: preset.logoPosition,
        logoSize: preset.logoSize,
        accentColor: preset.accentColor,
      }, preset.ccWorkspaceId || undefined, preset.logoUrl);
      toast.success("Preset renamed");
      setEditingId(null);
      setEditName("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to rename");
    }
  };

  const getWorkspaceName = (wsId: string | null) => {
    if (!wsId) return null;
    const ws = ccWorkspaces.find((w) => w.id === wsId);
    return ws?.name || wsId;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-gray-400 mb-1 block">Client Preset</Label>
          <Select
            value={selectedPresetId ? String(selectedPresetId) : "__none__"}
            onValueChange={handleLoad}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder={loading ? "Loading..." : "Select a client preset"} />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="__none__" className="text-gray-400">No preset</SelectItem>
              {presets.map((p) => (
                <SelectItem key={p.id} value={String(p.id)} className="text-white">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPresetId && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpdate}
            disabled={saving}
            className="mt-5 border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Update
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => { setShowSaveDialog(true); setSaveName(""); setSaveCcWorkspaceId(""); }}
          className="mt-5 border-pink-600 text-pink-400 hover:text-white hover:bg-pink-600"
        >
          <Save className="w-3.5 h-3.5 mr-1" />
          Save New
        </Button>

        {presets.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowManage(!showManage)}
            className="mt-5 border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <FolderOpen className="w-3.5 h-3.5 mr-1" />
            Manage
          </Button>
        )}
      </div>

      {showSaveDialog && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Save Current Settings as Preset</span>
            <button onClick={() => setShowSaveDialog(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Input
            placeholder="Client / Preset name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="bg-gray-900 border-gray-600 text-white"
            autoFocus
          />
          {ccWorkspaces.length > 0 && (
            <div>
              <Label className="text-xs text-gray-400 mb-1 block">Cloud Campaign Workspace (optional)</Label>
              <Select value={saveCcWorkspaceId || "__none__"} onValueChange={(v) => setSaveCcWorkspaceId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="bg-gray-900 border-gray-600 text-white">
                  <SelectValue placeholder="Link to workspace" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="__none__" className="text-gray-400">No workspace</SelectItem>
                  {ccWorkspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id} className="text-white">{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {logoFile && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Upload className="w-3 h-3" /> Logo will be saved with this preset
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(false)} className="text-gray-400">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !saveName.trim()} className="bg-pink-600 hover:bg-pink-700">
              {saving ? "Saving..." : "Save Preset"}
            </Button>
          </div>
        </div>
      )}

      {showManage && presets.length > 0 && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Manage Presets</span>
            <button onClick={() => setShowManage(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          {presets.map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-gray-700/50 last:border-0">
              {editingId === p.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(p.id)}
                    className="flex-1 bg-gray-900 border-gray-600 text-white h-8 text-sm"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={() => handleRename(p.id)} className="h-8 px-2 text-green-400">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 px-2 text-gray-400">Cancel</Button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <span className="text-sm text-gray-200">{p.name}</span>
                    {p.ccWorkspaceId && (
                      <span className="text-[10px] text-gray-500 ml-2">CC: {getWorkspaceName(p.ccWorkspaceId)}</span>
                    )}
                    {p.logoUrl && (
                      <span className="text-[10px] text-gray-500 ml-2">has logo</span>
                    )}
                  </div>
                  <button
                    onClick={() => { onSelectPreset(p); setShowManage(false); }}
                    className="text-xs text-blue-400 hover:text-blue-300 px-2"
                  >Load</button>
                  <button
                    onClick={() => { setEditingId(p.id); setEditName(p.name); }}
                    className="text-gray-400 hover:text-white p-1"
                  ><Pencil className="w-3.5 h-3.5" /></button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-400 hover:text-red-300 p-1"
                  ><Trash2 className="w-3.5 h-3.5" /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
