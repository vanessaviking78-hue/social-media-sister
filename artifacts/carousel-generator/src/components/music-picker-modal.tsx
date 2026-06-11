import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Music, Search, Play, Square, Check, X, Loader2, Plus } from "lucide-react";

export type MusicTrack = {
  trackId: number;
  name: string;
  durationMs: number;
  artist: string;
  url: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  selectedTrack: MusicTrack | null;
  onSelect: (track: MusicTrack | null) => void;
}

const GENRES = [
  { value: "all", label: "All genres" },
  { value: "pop", label: "Pop" },
  { value: "hip-hop", label: "Hip-Hop" },
  { value: "electronic", label: "Electronic" },
  { value: "jazz", label: "Jazz" },
  { value: "classical", label: "Classical" },
  { value: "r-b-soul", label: "R&B / Soul" },
  { value: "ambient", label: "Ambient" },
  { value: "rock", label: "Rock" },
  { value: "country", label: "Country" },
];

export function MusicPickerModal({ open, onClose, selectedTrack, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!open) return null;

  const fetchMusic = async (genreOverride?: string) => {
    setLoading(true);
    setTracks([]);
    try {
      const g = genreOverride ?? genre;
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (g && g !== "all") params.set("genre", g);
      const res = await fetch(`${import.meta.env.BASE_URL}api/music/search?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Music search failed" }));
        toast.error(data.error || "Music search failed");
        return;
      }
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      const list: MusicTrack[] = data.tracks || [];
      setTracks(list);
      if (list.length === 0) toast.info("No tracks found — try a different keyword or genre");
    } catch {
      toast.error("Music search failed");
    } finally {
      setLoading(false);
    }
  };

  const stopPreview = () => {
    audioRef.current?.pause();
    setPreviewingId(null);
  };

  const togglePreview = (track: MusicTrack) => {
    if (previewingId === track.trackId) {
      stopPreview();
    } else {
      stopPreview();
      audioRef.current = new Audio(track.url);
      audioRef.current.play();
      setPreviewingId(track.trackId);
      audioRef.current.onended = () => setPreviewingId(null);
    }
  };

  const handleSelect = (track: MusicTrack) => {
    stopPreview();
    if (selectedTrack?.trackId === track.trackId) {
      onSelect(null);
    } else {
      onSelect(track);
    }
  };

  const handleClose = () => {
    stopPreview();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={handleClose}>
      <div className="bg-card border border-border/40 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-pink-400" />
            <h2 className="font-semibold text-lg">Add music</h2>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {selectedTrack && (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
            <Check className="w-4 h-4 text-green-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-300 truncate">{selectedTrack.name}</p>
              <p className="text-xs text-muted-foreground truncate">{selectedTrack.artist}</p>
            </div>
            <button onClick={() => { onSelect(null); }} className="text-muted-foreground hover:text-red-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchMusic()}
            placeholder="Search tracks… (press Enter)"
            className="flex-1 bg-muted/40 border border-border/40 rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 outline-none focus:border-pink-500/50"
          />
          <Button onClick={() => fetchMusic()} disabled={loading} className="bg-pink-600 hover:bg-pink-500 text-white px-4">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        <Select value={genre} onValueChange={(v) => { setGenre(v); fetchMusic(v); }}>
          <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="All genres" /></SelectTrigger>
          <SelectContent>
            {GENRES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {tracks.length > 0 && (
          <div className="space-y-1 border border-border/30 rounded-xl p-2 bg-muted/20 max-h-72 overflow-y-auto">
            {tracks.map((track) => {
              const isSelected = selectedTrack?.trackId === track.trackId;
              const isPreviewing = previewingId === track.trackId;
              const durationSec = Math.floor(track.durationMs / 1000);
              return (
                <div
                  key={track.trackId}
                  onClick={() => handleSelect(track)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-green-500/20 ring-1 ring-green-500/40" : "hover:bg-muted/50"}`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePreview(track); }}
                    className={`shrink-0 p-1.5 rounded-lg transition-colors ${isPreviewing ? "text-pink-400 bg-pink-500/10" : "text-muted-foreground hover:text-pink-400"}`}
                  >
                    {isPreviewing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isSelected ? "text-green-300 font-semibold" : ""}`}>{track.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {track.artist} · {Math.floor(durationSec / 60)}:{String(durationSec % 60).padStart(2, "0")}
                    </p>
                  </div>
                  <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isSelected ? "bg-green-500 text-white" : "bg-muted/60 text-muted-foreground"}`}>
                    {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={handleClose}>Close</Button>
          {selectedTrack && (
            <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={handleClose}>
              <Check className="w-4 h-4 mr-1" /> Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MusicTrackBadge({ track, onRemove }: { track: MusicTrack; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-sm">
      <Music className="w-3.5 h-3.5 text-green-400 shrink-0" />
      <span className="text-green-300 font-medium truncate">{track.name}</span>
      <span className="text-muted-foreground truncate">by {track.artist}</span>
      <button onClick={onRemove} className="ml-auto text-muted-foreground hover:text-red-400 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
