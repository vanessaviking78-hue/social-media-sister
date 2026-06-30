import React, { useEffect, useState } from "react";
import { Loader2, AlertTriangle, CalendarDays, ShieldCheck, Clock, CheckCircle2, XCircle, FileImage, Layers, Film, ImageIcon } from "lucide-react";

const BASE = import.meta.env.BASE_URL || "/";

type CalendarPost = {
  id: number;
  date: string;
  title: string;
  caption: string;
  postType: string;
  status: string;
  color: string;
  imageUrl: string | null;
};

type ApprovalBatch = {
  id: number;
  name: string;
  token: string;
  status: string;
  totalImages: number;
  pendingImages: number;
  approvedImages: number;
  rejectedImages: number;
  createdAt: string;
  expiresAt: string | null;
};

type PortalData = {
  clientName: string;
  logoUrl: string | null;
  upcomingPosts: CalendarPost[];
  approvalBatches: ApprovalBatch[];
};

const POST_TYPE_ICON: Record<string, React.ReactNode> = {
  carousel: <Layers className="w-3.5 h-3.5" />,
  "single-image": <ImageIcon className="w-3.5 h-3.5" />,
  story: <Film className="w-3.5 h-3.5" />,
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

function getDayOfWeek(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

export default function ClientPortal({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}api/portal/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "failed");
        setData(json);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (error === "not_found" || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h1 className="text-xl font-bold text-white mb-2">Portal Not Found</h1>
          <p className="text-zinc-400">This link doesn't exist or has been removed. Please contact your social media manager.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
          <p className="text-zinc-400">Please try again later or contact us.</p>
        </div>
      </div>
    );
  }

  const pendingBatches = data.approvalBatches.filter((b) => b.pendingImages > 0);
  const reviewedBatches = data.approvalBatches.filter((b) => b.pendingImages === 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="logo" className="h-9 w-auto object-contain rounded" />
            ) : (
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-pink-500" />
                <span className="font-bold text-sm text-pink-400">The CyberSuite™</span>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{data.clientName}</p>
            <p className="text-xs text-zinc-500">Content Portal</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">


        {/* Upcoming content */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <CalendarDays className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold">Upcoming Content</h2>
            {data.upcomingPosts.length > 0 && (
              <span className="ml-auto text-xs text-zinc-500">{data.upcomingPosts.length} post{data.upcomingPosts.length !== 1 ? "s" : ""} scheduled</span>
            )}
          </div>

          {data.upcomingPosts.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
              <CalendarDays className="w-8 h-8 mx-auto text-zinc-700 mb-3" />
              <p className="text-zinc-500">No upcoming content scheduled yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.upcomingPosts.map((post) => (
                <div key={post.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden flex">
                  {post.imageUrl ? (
                    <div className="w-20 shrink-0 bg-zinc-800">
                      <img src={post.imageUrl} alt="" className="w-full h-full object-cover" style={{ minHeight: 80 }} />
                    </div>
                  ) : (
                    <div className="w-20 shrink-0 flex items-center justify-center" style={{ backgroundColor: post.color + "22", borderRight: `2px solid ${post.color}44` }}>
                      <FileImage className="w-5 h-5 text-zinc-600" />
                    </div>
                  )}
                  <div className="flex-1 px-4 py-3 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <span className="font-semibold text-white">{getDayOfWeek(post.date)}</span>
                        <span>{formatDate(post.date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="flex items-center gap-1 text-xs text-zinc-500 capitalize">
                          {POST_TYPE_ICON[post.postType] || <FileImage className="w-3.5 h-3.5" />}
                          {post.postType.replace("-", " ")}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          post.status === "scheduled"
                            ? "bg-green-900/30 text-green-400 border-green-700/40"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}>
                          {post.status}
                        </span>
                      </div>
                    </div>
                    {post.title && <p className="font-medium text-white text-sm truncate">{post.title}</p>}
                    {post.caption && (
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{post.caption}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>


      </main>

      <footer className="border-t border-zinc-900 py-6 mt-10">
        <p className="text-center text-xs text-zinc-700">
          Powered by <span className="text-zinc-600">The CyberSuite™</span>
        </p>
      </footer>
    </div>
  );
}
