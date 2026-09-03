import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import type { SchedulePostPayload } from "@/components/schedule-modal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Preset = { id: number; name: string };

type Props = {
  presetId: number | null;
  postType: string;
  posts: SchedulePostPayload[];
  presets?: Preset[];
  sourceTool?: string;
  onClose: () => void;
  onSaved?: () => void;
};

// Parks content against a client with no date attached, using the same
// "draft" status the scheduler already supports for its waiting-room posts.
// Invisible in the client portal (which only ever reads pending/published
// rows) until it's pulled out of the Bank and either scheduled for real or
// sent off for approval.
export function AddToBankModal({ presetId, postType, posts, presets, sourceTool, onClose, onSaved }: Props) {
  const [activePresetId, setActivePresetId] = useState<number | null>(presetId);
  const [saving, setSaving] = useState(false);
  const showPresetSelector = (presets?.length ?? 0) > 0;

  async function handleSave() {
    if (activePresetId === null) { toast.error("Select a client first"); return; }
    setSaving(true);
    let saved = 0;
    try {
      for (const post of posts) {
        const content: Record<string, unknown> = { caption: post.caption || "", title: post.title || "" };
        if (postType === "reel" && post.videoUrl) content.videoUrl = post.videoUrl;
        if (postType !== "reel" && post.imageUrls) content.imageUrls = post.imageUrls;
        if (post.musicTrack) content.musicTrack = post.musicTrack;
        if (post.firstComment) content.firstComment = post.firstComment;
        if (post.platforms) content.platforms = post.platforms;
        if (sourceTool || post.sourceTool) content.sourceTool = sourceTool || post.sourceTool;
        const r = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presetId: activePresetId, postType, content, status: "draft" }),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: "Failed" }));
          throw new Error(err.error || "Failed to save to Client Bank");
        }
        saved++;
      }
      toast.success(saved === 1 ? "Saved to Client Bank" : `${saved} items saved to Client Bank`);
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to save to Client Bank");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
          <Archive className="w-5 h-5 text-pink-400 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-white">Add to Client Bank</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              Parks {posts.length === 1 ? "this" : `these ${posts.length}`} with no date. Invisible in the portal until you schedule it from the Bank.
            </p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {showPresetSelector && (
            <div>
              <Label className="text-zinc-300 text-sm mb-1.5 block">Client</Label>
              <Select value={activePresetId !== null ? String(activePresetId) : ""} onValueChange={(v) => setActivePresetId(Number(v))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Pick a client" />
                </SelectTrigger>
                <SelectContent>
                  {presets!.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="p-6 pt-0 flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-pink-600 hover:bg-pink-700 text-white">
            {saving ? "Saving..." : "Add to Bank"}
          </Button>
        </div>
      </div>
    </div>
  );
}
