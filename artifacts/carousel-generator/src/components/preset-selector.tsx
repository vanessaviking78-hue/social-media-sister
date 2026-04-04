import React, { useState } from "react";
import { Save, Trash2, FolderOpen, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { ClientPreset, PresetStyleFields } from "@/lib/use-presets";

interface PresetSelectorProps {
  presets: ClientPreset[];
  loading: boolean;
  selectedPresetId: number | null;
  onSelectPreset: (preset: ClientPreset) => void;
  onSavePreset: (name: string, styles: PresetStyleFields) => Promise<void>;
  onUpdatePreset: (id: number, name: string, styles: PresetStyleFields) => Promise<void>;
  onDeletePreset: (id: number) => Promise<void>;
  getCurrentStyles: () => PresetStyleFields;
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
}: PresetSelectorProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

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
      await onSavePreset(saveName.trim(), styles);
      toast.success(`Preset "${saveName.trim()}" saved`);
      setSaveName("");
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
      await onUpdatePreset(selectedPresetId, preset.name, styles);
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
      });
      toast.success("Preset renamed");
      setEditingId(null);
      setEditName("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to rename");
    }
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
          onClick={() => { setShowSaveDialog(true); setSaveName(""); }}
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
                  <span className="flex-1 text-sm text-gray-200">{p.name}</span>
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
