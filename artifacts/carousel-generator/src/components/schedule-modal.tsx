import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type SchedulePostPayload = {
  title: string;
  caption: string;
  imageUrls?: string[];
  videoUrl?: string;
  musicTrack?: { trackId: number; name: string; artist: string; durationMs: number; url: string } | null;
  firstComment?: string;
};

type Props = {
  presetId: number | null;
  presetName?: string;
  postType: string;
  posts: SchedulePostPayload[];
  onClose: () => void;
  onSaved?: () => void;
};

function defaultScheduledAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(18, 45, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ScheduleModal({ presetId, presetName, postType, posts, onClose, onSaved }: Props) {
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt);
  const [notes, setNotes] = useState("");
  const [caption, setCaption] = useState(() => posts[0]?.caption || "");
  const [saving, setSaving] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [gapMinutes, setGapMinutes] = useState("60");

  const isBulk = posts.length > 1;
  const isReel = postType === "reel";

  async function handleSave() {
    if (!scheduledAt) { toast.error("Pick a date and time"); return; }
    if (!caption.trim()) { toast.error("Add a caption before scheduling"); return; }
    if (presetId === null) { toast.error("Select a client preset before scheduling"); return; }
    setSaving(true);
    const gap = Math.max(0, Number(gapMinutes) || 60);
    try {
      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const staggeredAt = new Date(new Date(scheduledAt).getTime() + i * gap * 60000).toISOString();
        const content: SchedulePostPayload = { caption: caption.trim(), title: post.title };
        if (isReel && post.videoUrl) content.videoUrl = post.videoUrl;
        if (!isReel && post.imageUrls) content.imageUrls = post.imageUrls;
        if (post.musicTrack) content.musicTrack = post.musicTrack;
        if (post.firstComment) content.firstComment = post.firstComment;
        const body: Record<string, unknown> = { postType, content, scheduledAt: staggeredAt, isTrial, notes, presetId };
        const r = await fetch(`${BASE}/api/scheduler/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const err = await r.json().catch(() => ({ error: "Failed" }));
          throw new Error(err.error || "Failed to schedule post");
        }
      }
      toast.success(posts.length === 1 ? "Post scheduled" : `${posts.length} posts scheduled`);
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to schedule");
    } finally {
      setSaving(false);
    }
  }

  const label = presetName ? `${presetName} · ` : "";
  const countLabel = posts.length === 1 ? "1 post" : `${posts.length} posts`;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
          <CalendarClock className="w-5 h-5 text-pink-400 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-white">Schedule for later</h2>
            <p className="text-sm text-zinc-400 mt-0.5">{label}{countLabel}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <Label className="text-zinc-300 text-sm mb-1.5 block">
              {isBulk ? "First post date and time" : "Date and time"}
            </Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white [color-scheme:dark]"
            />
          </div>

          {isBulk && (
            <div>
              <Label className="text-zinc-300 text-sm mb-1.5 block">Minutes between posts</Label>
              <Input
                type="number"
                min="0"
                step="15"
                value={gapMinutes}
                onChange={(e) => setGapMinutes(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              <p className="text-xs text-zinc-500 mt-1.5">
                Posts will be staggered — post 1 at the chosen time, post 2 {gapMinutes} min later, and so on.
              </p>
            </div>
          )}

          <div>
            <Label className="text-zinc-300 text-sm mb-1.5 block">Caption <span className="text-pink-400">*</span></Label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption here..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
          </div>

          <div>
            <Label className="text-zinc-300 text-sm mb-1.5 block">Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          {isReel && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isTrial}
                onChange={(e) => setIsTrial(e.target.checked)}
                className="w-4 h-4 rounded accent-pink-500"
              />
              <span className="text-sm text-zinc-300">Post as trial reel (private draft — graduate in Instagram when ready)</span>
            </label>
          )}
        </div>
        <div className="p-6 pt-0 flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-pink-600 hover:bg-pink-700 text-white">
            {saving ? "Scheduling..." : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
