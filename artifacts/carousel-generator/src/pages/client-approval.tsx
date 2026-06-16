import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Check, X, Star, Loader2, LockKeyhole, Send } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL;

interface LibraryItem {
  id: number;
  clientName: string;
  postType: string;
  caption: string;
  mediaUrl: string | null;
  mediaUrls: string[] | null;
  thumbnailUrl: string | null;
}

interface BundleItem {
  id: number;
  bundleId: number;
  libraryItemId: number;
  position: number;
}

interface BundleResponse {
  id: number;
  libraryItemId: number;
  status: string;
  feedback: string;
  bundleRating: number | null;
  overallComments: string;
  submittedAt: string | null;
}

interface BundlePublic {
  id: number;
  bundleName: string;
  clientName: string;
  expired: boolean;
  expiresAt: string;
  status: string;
}

interface PageData {
  bundle: BundlePublic;
  items: BundleItem[];
  libraryItems: LibraryItem[];
  responses: BundleResponse[];
}

interface ItemDecision {
  status: "approved" | "rejected" | "pending";
  feedback: string;
}

function SlideShow({ urls }: { urls: string[] }) {
  const [idx, setIdx] = useState(0);
  if (urls.length === 0) {
    return <div className="aspect-square bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-600 text-sm">No image</div>;
  }
  return (
    <div className="relative select-none">
      <div className="aspect-[4/5] bg-zinc-900 rounded-xl overflow-hidden">
        <img
          src={urls[idx]}
          alt={`Slide ${idx + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      {urls.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white disabled:opacity-30 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIdx(i => Math.min(urls.length - 1, i + 1))}
            disabled={idx === urls.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white disabled:opacity-30 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex justify-center gap-1.5 mt-2">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RatingPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
            value === n
              ? "bg-amber-500 text-black scale-110"
              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function ClientApproval({ token }: { token: string }) {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<number, ItemDecision>>({});
  const [bundleRating, setBundleRating] = useState<number | null>(null);
  const [overallComments, setOverallComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`${BASE}api/approval-bundles/public/${token}`)
      .then(r => r.json())
      .then((d: PageData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
        const init: Record<number, ItemDecision> = {};
        for (const r of d.responses) {
          init[r.libraryItemId] = {
            status: r.status as ItemDecision["status"],
            feedback: r.feedback ?? "",
          };
        }
        setDecisions(init);
        const overall = d.responses.find(r => r.bundleRating);
        if (overall?.bundleRating) setBundleRating(overall.bundleRating);
        if (overall?.overallComments) setOverallComments(overall.overallComments);
        if (d.responses.some(r => r.submittedAt)) setSubmitted(true);
      })
      .catch(() => setError("Failed to load approval page"))
      .finally(() => setLoading(false));
  }, [token]);

  const setDecision = useCallback((libraryItemId: number, status: "approved" | "rejected") => {
    setDecisions(prev => ({
      ...prev,
      [libraryItemId]: { ...prev[libraryItemId], status, feedback: prev[libraryItemId]?.feedback ?? "" },
    }));
  }, []);

  const setFeedback = useCallback((libraryItemId: number, feedback: string) => {
    setDecisions(prev => ({
      ...prev,
      [libraryItemId]: { ...prev[libraryItemId], feedback },
    }));
  }, []);

  const handleSubmit = useCallback(async (isUpdate = false) => {
    if (!data) return;
    const ordered = [...data.items].sort((a, b) => a.position - b.position);
    const missing = ordered.filter(item => !decisions[item.libraryItemId] || decisions[item.libraryItemId].status === "pending");
    if (missing.length > 0) {
      toast.error(`Please approve or reject all ${data.items.length} carousels before submitting`);
      return;
    }

    setSubmitting(true);
    try {
      const responses = ordered.map(item => ({
        libraryItemId: item.libraryItemId,
        status: decisions[item.libraryItemId].status,
        feedback: decisions[item.libraryItemId].feedback,
      }));

      const r = await fetch(`${BASE}api/approval-bundles/public/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, bundleRating, overallComments }),
      });
      const d = await r.json() as { success?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Submission failed");
      setSubmitted(true);
      if (isUpdate) toast.success("Responses updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Submission failed");
    } finally { setSubmitting(false); }
  }, [data, decisions, bundleRating, overallComments, token]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center text-center px-6">
        <LockKeyhole className="w-10 h-10 text-zinc-600 mb-4" />
        <p className="text-lg font-semibold text-white mb-2">Link not found</p>
        <p className="text-zinc-500 text-sm">{error}</p>
      </div>
    );
  }

  if (data?.bundle.expired) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center text-center px-6">
        <LockKeyhole className="w-10 h-10 text-zinc-600 mb-4" />
        <p className="text-lg font-semibold text-white mb-2">This approval window has closed</p>
        <p className="text-zinc-500 text-sm">The 7-day review period for this bundle has passed. If you have any questions, contact your Social Media Manager.</p>
      </div>
    );
  }

  if (submitted && !submitting) {
    const ordered = data ? [...data.items].sort((a, b) => a.position - b.position) : [];
    const approvedCount = ordered.filter(i => decisions[i.libraryItemId]?.status === "approved").length;
    const rejectedCount = ordered.filter(i => decisions[i.libraryItemId]?.status === "rejected").length;

    return (
      <div className="min-h-[100dvh] bg-zinc-950">
        <header className="border-b border-zinc-800 py-5 px-6 text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Content Approval</p>
          <h1 className="text-white font-bold text-xl">{data?.bundle.bundleName}</h1>
          {data?.bundle.clientName && <p className="text-zinc-400 text-sm mt-0.5">{data.bundle.clientName}</p>}
        </header>
        <div className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-white text-2xl font-bold mb-3">Responses received</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Thanks for taking the time to review. Your Social Media Manager will pick up from here.
          </p>
          <div className="flex justify-center gap-6 mb-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{approvedCount}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{rejectedCount}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Rejected</p>
            </div>
            {bundleRating && (
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400">{bundleRating}/10</p>
                <p className="text-xs text-zinc-500 mt-0.5">Overall rating</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSubmitted(false)}
            className="text-sm text-zinc-400 hover:text-white transition-colors underline underline-offset-2"
          >
            Update my responses
          </button>
        </div>
      </div>
    );
  }

  const ordered = data ? [...data.items].sort((a, b) => a.position - b.position) : [];
  const allDecided = ordered.every(item => decisions[item.libraryItemId]?.status !== "pending" && decisions[item.libraryItemId]);
  const daysLeft = data ? Math.ceil((new Date(data.bundle.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="min-h-[100dvh] bg-zinc-950">
      <header className="border-b border-zinc-800 py-5 px-6 text-center">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Content Approval</p>
        <h1 className="text-white font-bold text-xl">{data?.bundle.bundleName}</h1>
        {data?.bundle.clientName && <p className="text-zinc-400 text-sm mt-0.5">{data.bundle.clientName}</p>}
        {daysLeft > 0 && (
          <p className="text-xs text-zinc-600 mt-1">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left to respond</p>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <p className="text-zinc-400 text-sm text-center">
          Review each piece of content below. Click through the slides, then mark it approved or rejected.
          {submitted && " You can update your responses any time before the deadline."}
        </p>

        {ordered.map((item, n) => {
          const libItem = data?.libraryItems.find(l => l.id === item.libraryItemId);
          if (!libItem) return null;
          const urls = libItem.mediaUrls ?? (libItem.mediaUrl ? [libItem.mediaUrl] : []);
          const dec = decisions[item.libraryItemId];
          const isApproved = dec?.status === "approved";
          const isRejected = dec?.status === "rejected";

          return (
            <div key={item.id} className={`rounded-2xl border transition-colors overflow-hidden ${
              isApproved ? "border-green-500/40 bg-green-500/5" :
              isRejected ? "border-red-500/40 bg-red-500/5" :
              "border-zinc-800 bg-zinc-900/40"
            }`}>
              <div className="p-1 border-b border-zinc-800/50">
                <p className="text-xs text-zinc-500 text-center py-1.5">
                  {n + 1} of {ordered.length}{libItem.caption && ` — ${libItem.caption.slice(0, 60)}`}
                </p>
              </div>
              <div className="p-4">
                <SlideShow urls={urls} />

                {libItem.caption && (
                  <p className="text-zinc-400 text-sm mt-3 leading-relaxed line-clamp-3">{libItem.caption}</p>
                )}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setDecision(item.libraryItemId, "approved")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isApproved
                        ? "bg-green-500 text-white shadow-lg shadow-green-500/20 scale-[1.02]"
                        : "bg-zinc-800 hover:bg-green-500/20 hover:text-green-400 text-zinc-300"
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    {isApproved ? "Approved" : "Approve"}
                  </button>
                  <button
                    onClick={() => setDecision(item.libraryItemId, "rejected")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isRejected
                        ? "bg-red-500 text-white shadow-lg shadow-red-500/20 scale-[1.02]"
                        : "bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-300"
                    }`}
                  >
                    <X className="w-4 h-4" />
                    {isRejected ? "Rejected" : "Reject"}
                  </button>
                </div>

                {isRejected && (
                  <div className="mt-3">
                    <textarea
                      value={dec?.feedback ?? ""}
                      onChange={e => setFeedback(item.libraryItemId, e.target.value)}
                      placeholder="What would you like changed? (Optional)"
                      rows={3}
                      className="w-full rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-red-500/50"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5">
          <h3 className="text-white font-semibold">Overall feedback</h3>

          <div>
            <p className="text-sm text-zinc-400 mb-3">How would you rate this batch of content overall?</p>
            <RatingPicker value={bundleRating} onChange={setBundleRating} />
            {bundleRating && (
              <p className="text-xs text-zinc-600 mt-2">
                {bundleRating <= 3 ? "Not quite right" : bundleRating <= 6 ? "Getting there" : bundleRating <= 8 ? "Looking good" : "Brilliant!"}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm text-zinc-400 mb-2">Any other comments?</p>
            <textarea
              value={overallComments}
              onChange={e => setOverallComments(e.target.value)}
              placeholder="Anything else you would like to share..."
              rows={4}
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-600 px-3 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>
        </div>

        <button
          onClick={() => handleSubmit(submitted)}
          disabled={submitting || !allDecided}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold transition-all ${
            allDecided && !submitting
              ? "bg-white text-black hover:bg-zinc-200 active:scale-[0.98]"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
          ) : (
            <><Send className="w-4 h-4" /> {submitted ? "Update my responses" : "Submit responses"}</>
          )}
        </button>
        {!allDecided && (
          <p className="text-center text-xs text-zinc-600">
            Please approve or reject all {ordered.length} items before submitting.
          </p>
        )}
      </div>
    </div>
  );
}
