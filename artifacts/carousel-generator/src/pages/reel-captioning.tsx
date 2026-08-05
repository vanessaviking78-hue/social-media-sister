import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Loader2,
  RotateCcw,
  Captions,
  Wand2,
  Download,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "Content-Type": "application/json", "x-app-password": pw, Authorization: `Bearer ${pw}` };
}

type Chunk = { text: string; start: number; end: number };

type Submission = {
  id: number;
  clientName: string;
  videoUrl: string;
  status: string;
  transcript: Chunk[] | null;
  captionedVideoUrl: string | null;
  createdAt: string;
};

type FontOption = { key: string; label: string };

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting transcription",
  transcribed: "Ready to render",
  done: "Captioned",
};

export default function ReelCaptioning() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [fonts, setFonts] = useState<FontOption[]>([]);
  const [fontKey, setFontKey] = useState("montserrat-bold");
  const [boxColor, setBoxColor] = useState("#000000");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<"transcribe" | "render" | "delete" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftChunks, setDraftChunks] = useState<Chunk[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/reel-captions/submissions`, { headers: authHeaders() });
      const d = await r.json();
      setSubmissions(Array.isArray(d.submissions) ? d.submissions : []);
    } catch {
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFonts = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/reel-captions/fonts`, { headers: authHeaders() });
      const d = await r.json();
      setFonts(Array.isArray(d.fonts) ? d.fonts : []);
      if (d.defaultFontKey) setFontKey(d.defaultFontKey);
    } catch {
      setFonts([]);
    }
  }, []);

  useEffect(() => {
    load();
    loadFonts();
  }, [load, loadFonts]);

  const transcribe = async (id: number) => {
    setBusyId(id);
    setBusyAction("transcribe");
    try {
      const r = await fetch(`${BASE}/api/reel-captions/submissions/${id}/transcribe`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Transcription failed");
      await load();
    } catch (e: any) {
      alert(e?.message || "Transcription failed");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const openEditor = (sub: Submission) => {
    setEditingId(sub.id);
    setDraftChunks(sub.transcript ? sub.transcript.map((c) => ({ ...c })) : []);
  };

  const cancelEditor = () => {
    setEditingId(null);
    setDraftChunks([]);
  };

  const saveTranscript = async (id: number) => {
    setBusyId(id);
    setBusyAction("transcribe");
    try {
      const r = await fetch(`${BASE}/api/reel-captions/submissions/${id}/transcript`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ chunks: draftChunks }),
      });
      if (!r.ok) throw new Error("Failed to save changes");
      setEditingId(null);
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to save changes");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const render = async (id: number) => {
    setBusyId(id);
    setBusyAction("render");
    try {
      const r = await fetch(`${BASE}/api/reel-captions/submissions/${id}/render`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ fontKey, boxColor }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || "Render failed");
      await load();
    } catch (e: any) {
      alert(e?.message || "Render failed");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this submission? This can't be undone.")) return;
    setBusyId(id);
    setBusyAction("delete");
    try {
      await fetch(`${BASE}/api/reel-captions/submissions/${id}`, { method: "DELETE", headers: authHeaders() });
      await load();
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/30 px-6 py-4 flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <Link href="/hub">
          <ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg">Reel Captions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Loadingâ¦" : `${submissions.length} submission${submissions.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/50 hover:border-border"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="rounded-2xl border border-border/50 p-4 mb-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Caption font</label>
            <select
              value={fontKey}
              onChange={(e) => setFontKey(e.target.value)}
              className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-pink-600"
            >
              {fonts.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Box colour</label>
            <div className="flex items-center gap-2 rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5">
              <input
                type="color"
                value={boxColor}
                onChange={(e) => setBoxColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent"
              />
              <span className="text-xs text-muted-foreground font-mono">{boxColor}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex-1 min-w-[160px]">
            White text, box behind it, centred two-thirds down the frame.
          </p>
        </div>

        {loading && submissions.length === 0 && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading submissionsâ¦
          </div>
        )}

        {!loading && submissions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-16">
            No reels uploaded yet â clients can send them in from the Upload Reel tab on their portal.
          </p>
        )}

        <div className="space-y-4">
          {submissions.map((sub) => {
            const isBusy = busyId === sub.id;
            const isEditing = editingId === sub.id;
            return (
              <div key={sub.id} className="rounded-2xl border border-border/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Captions className="w-4 h-4 text-pink-400" />
                    <span className="font-semibold text-sm">{sub.clientName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-zinc-800 text-zinc-300">
                      {STATUS_LABEL[sub.status] || sub.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(sub.id)}
                      disabled={isBusy}
                      className="text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40"
                      title="Delete submission"
                    >
                      {isBusy && busyAction === "delete" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <video
                  src={`${BASE}${sub.videoUrl}`}
                  controls
                  className="w-full max-h-80 rounded-xl bg-black"
                />

                {sub.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => transcribe(sub.id)}
                    disabled={isBusy}
                    className="flex items-center gap-2 text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
                  >
                    {isBusy && busyAction === "transcribe" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    Transcribe
                  </button>
                )}

                {sub.status !== "pending" && !isEditing && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditor(sub)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit captions
                    </button>
                    <button
                      type="button"
                      onClick={() => render(sub.id)}
                      disabled={isBusy}
                      className="flex items-center gap-2 text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
                    >
                      {isBusy && busyAction === "render" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Captions className="w-3.5 h-3.5" />
                      )}
                      {sub.status === "done" ? "Re-render" : "Render captions"}
                    </button>
                    <button
                      type="button"
                      onClick={() => transcribe(sub.id)}
                      disabled={isBusy}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      Re-transcribe
                    </button>
                  </div>
                )}

                {isEditing && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 space-y-2">
                    {draftChunks.length === 0 && (
                      <p className="text-xs text-muted-foreground">No caption text yet.</p>
                    )}
                    {draftChunks.map((chunk, i) => (
                      <input
                        key={i}
                        value={chunk.text}
                        onChange={(e) => {
                          const next = [...draftChunks];
                          next[i] = { ...next[i], text: e.target.value };
                          setDraftChunks(next);
                        }}
                        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-pink-600"
                      />
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => saveTranscript(sub.id)}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white rounded-full px-4 py-2 disabled:opacity-50 transition-colors"
                      >
                        {isBusy && busyAction === "transcribe" ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Save changes
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditor}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {sub.status === "done" && sub.captionedVideoUrl && (
                  <div className="space-y-2 pt-1">
                    <video
                      src={`${BASE}${sub.captionedVideoUrl}`}
                      controls
                      className="w-full max-h-80 rounded-xl bg-black"
                    />
                    <a
                      href={`${BASE}${sub.captionedVideoUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-400 hover:text-pink-300 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download captioned video
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
