import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, FileText, Loader2, Heart, MessageCircle, Share2, Users, TrendingUp } from "lucide-react";
import { usePresets } from "@/lib/use-presets";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL ?? "/";

type TopPost = {
  id: number;
  postType: string;
  title: string | null;
  caption: string | null;
  permalink: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagementScore: number;
  postedAt: string | null;
  statsAvailable: boolean;
};

type ReportData = {
  preset: { id: number; name: string };
  month: string;
  totalPosts: number;
  topPosts: TopPost[];
  dmEnquiryCount: number;
  newFollowers: number | null;
  followerCountEnd: number | null;
  engagementRatePercent: number | null;
};

function currentMonthValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return y + "-" + m;
}

export default function Reports() {
  const { presets, loading: presetsLoading } = usePresets();
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [month, setMonth] = useState<string>(currentMonthValue());
  const [report, setReport] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!selectedPresetId) {
      toast.error("Pick a client first.");
      return;
    }
    setBusy(true);
    setReport(null);
    try {
      const url = BASE + "api/reports/monthly?presetId=" + selectedPresetId + "&month=" + month;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Could not build report" }));
        throw new Error(data.error || "Could not build report");
      }
      const data = await res.json();
      setReport(data);
    } catch (e: any) {
      toast.error(e?.message || "Could not build report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub">
          <button className="shrink-0 rounded-lg p-2 hover:bg-muted/50">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>
        <FileText className="h-5 w-5 text-emerald-400" />
        <div>
          <h1 className="font-semibold text-base leading-none">Monthly Report</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Top posts, Instagram enquiries, followers and engagement rate for a client's month</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-border/50 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-muted-foreground">Client</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedPresetId ?? ""}
                onChange={(e) => setSelectedPresetId(e.target.value ? parseInt(e.target.value, 10) : null)}
                disabled={presetsLoading}
              >
                <option value="">Select a client...</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={generate}
            disabled={busy || !selectedPresetId}
            className="rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-2.5 px-6 flex items-center justify-center gap-2 text-sm w-fit"
          >
            {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Building report...</>) : "Generate report"}
          </button>
        </div>

        {report && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border/50 p-4">
              <h2 className="font-semibold text-sm mb-3">{report.preset.name}, {report.month}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Posts published</div>
                  <div className="text-xl font-semibold">{report.totalPosts}</div>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Instagram enquiries</div>
                  <div className="text-xl font-semibold">{report.dmEnquiryCount}</div>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> New followers</div>
                  <div className="text-xl font-semibold">{report.newFollowers ?? "N/A"}</div>
                </div>
                <div className="rounded-xl bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Engagement rate</div>
                  <div className="text-xl font-semibold">{report.engagementRatePercent !== null ? report.engagementRatePercent + "%" : "N/A"}</div>
                </div>
              </div>
              {report.followerCountEnd !== null && (
                <p className="text-xs text-muted-foreground mt-3">Follower count at end of month: {report.followerCountEnd}. New followers is the net change over the month (follows minus unfollows), not gross follows.</p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Top performing posts</h3>
              {report.topPosts.length === 0 && (
                <p className="text-sm text-muted-foreground">No published posts found for this client in this month.</p>
              )}
              {report.topPosts.map((post, i) => (
                <div key={post.id} className="rounded-xl border border-border/40 p-3 flex items-start gap-3">
                  <div className="text-xs font-semibold text-muted-foreground w-5 shrink-0 pt-0.5">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{post.title || post.caption || "Untitled post"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likes ?? "N/A"}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comments ?? "N/A"}</span>
                      {post.shares !== null && (
                        <span className="flex items-center gap-1"><Share2 className="w-3 h-3" /> {post.shares}</span>
                      )}
                      {!post.statsAvailable && <span className="text-amber-500">Stats unavailable</span>}
                    </div>
                  </div>
                  {post.permalink && (
                    <a href={post.permalink} target="_blank" rel="noreferrer" className="text-xs text-pink-400 hover:text-pink-300 shrink-0">View</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
