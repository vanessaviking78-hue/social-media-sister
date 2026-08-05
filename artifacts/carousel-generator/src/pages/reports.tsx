import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, FileText, Loader2, Heart, MessageCircle, Share2, Users, TrendingUp, Trophy, PenLine } from "lucide-react";
import { usePresets } from "@/lib/use-presets";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL ?? "/";

function authHeaders(): Record<string, string> {
  const pw = localStorage.getItem("cybersuite-pw") || "";
  return { "x-app-password": pw, "Authorization": "Bearer " + pw, "Content-Type": "application/json" };
}

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

type TopContentPost = {
  id: number;
  presetId: number;
  clientName: string;
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

type TopContentReport = {
  month: string;
  generatedAt: string;
  totalPostsConsidered: number;
  topContent: TopContentPost[];
};

function currentMonthValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return y + "-" + m;
}

export default function Reports() {
  const { presets, loading: presetsLoading } = usePresets();
  const [mode, setMode] = useState<"client" | "topContent">("client");
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [month, setMonth] = useState<string>(currentMonthValue());
  const [report, setReport] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [topMonth, setTopMonth] = useState<string>(currentMonthValue());
  const [topContent, setTopContent] = useState<TopContentReport | null>(null);
  const [topBusy, setTopBusy] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeBusy, setNarrativeBusy] = useState(false);

  const generate = async () => {
    if (!selectedPresetId) {
      toast.error("Pick a client first.");
      return;
    }
    setBusy(true);
    setReport(null);
    setNarrative(null);
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

  const writeReport = async () => {
    if (!report) return;
    setNarrativeBusy(true);
    const tid = toast.loading("Writing your reportâ¦");
    try {
      const url = BASE + "api/reports/monthly/narrative";
      const res = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ report }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not write the report");
      setNarrative(data.narrative || "");
      toast.success("Report written.", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Could not write the report", { id: tid });
    } finally {
      setNarrativeBusy(false);
    }
  };

  const generateTopContent = async () => {
    setTopBusy(true);
    setTopContent(null);
    try {
      const url = BASE + "api/reports/top-content?month=" + topMonth + "&limit=25";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Could not build top content report" }));
        throw new Error(data.error || "Could not build top content report");
      }
      const data = await res.json();
      setTopContent(data);
    } catch (e: any) {
      toast.error(e?.message || "Could not build top content report");
    } finally {
      setTopBusy(false);
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
          <h1 className="font-semibold text-base leading-none">Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Client reports and cross-client top performing content</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex gap-2 rounded-full border border-border/50 p-1 w-fit">
          <button
            onClick={() => setMode("client")}
            className={"rounded-full px-4 py-1.5 text-sm font-semibold transition-colors " + (mode === "client" ? "bg-pink-600 text-white" : "text-muted-foreground hover:bg-muted/50")}
          >
            Client Report
          </button>
          <button
            onClick={() => setMode("topContent")}
            className={"rounded-full px-4 py-1.5 text-sm font-semibold transition-colors flex items-center gap-1.5 " + (mode === "topContent" ? "bg-pink-600 text-white" : "text-muted-foreground hover:bg-muted/50")}
          >
            <Trophy className="w-3.5 h-3.5" /> Top Content
          </button>
        </div>

        {mode === "client" && (
          <>
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

                <div className="rounded-2xl border border-border/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-sm flex items-center gap-1.5"><PenLine className="w-4 h-4 text-pink-400" /> Written report</h3>
                      <p className="text-xs text-muted-foreground mt-1">Three paragraphs on why it worked, what's next, and the ROI case for this client, in your voice.</p>
                    </div>
                    <button
                      onClick={writeReport}
                      disabled={narrativeBusy}
                      className="rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-2 px-5 flex items-center justify-center gap-2 text-sm shrink-0"
                    >
                      {narrativeBusy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Writing...</>) : "Write my report"}
                    </button>
                  </div>
                  {narrative && (
                    <div className="rounded-xl bg-muted/30 p-4 space-y-3">
                      {narrative.split(/\n+/).filter(Boolean).map((para, i) => (
                        <p key={i} className="text-sm leading-relaxed">{para}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {mode === "topContent" && (
          <>
            <div className="rounded-2xl border border-border/50 p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Ranks every published post across all clients for the month, highest engagement first. Engagement score weights likes x1, comments x2 and shares x3.</p>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Month</label>
                  <input
                    type="month"
                    value={topMonth}
                    onChange={(e) => setTopMonth(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={generateTopContent}
                  disabled={topBusy}
                  className="rounded-full bg-pink-600 hover:bg-pink-500 disabled:opacity-60 text-white font-semibold py-2.5 px-6 flex items-center justify-center gap-2 text-sm w-fit"
                >
                  {topBusy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Building report...</>) : "Generate top content report"}
                </button>
              </div>
            </div>

            {topContent && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Top performing content, all clients, {topContent.month}</h3>
                <p className="text-xs text-muted-foreground">{topContent.totalPostsConsidered} posts considered across all clients.</p>
                {topContent.topContent.length === 0 && (
                  <p className="text-sm text-muted-foreground">No published posts with stats found for this month.</p>
                )}
                {topContent.topContent.map((post, i) => (
                  <div key={post.id} className="rounded-xl border border-border/40 p-3 flex items-start gap-3">
                    <div className="text-xs font-semibold text-muted-foreground w-5 shrink-0 pt-0.5">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-pink-400">{post.clientName}</p>
                      <p className="text-sm truncate">{post.title || post.caption || "Untitled post"}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likes ?? "N/A"}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comments ?? "N/A"}</span>
                        {post.shares !== null && (
                          <span className="flex items-center gap-1"><Share2 className="w-3 h-3" /> {post.shares}</span>
                        )}
                        <span className="font-semibold">Score {post.engagementScore}</span>
                      </div>
                    </div>
                    {post.permalink && (
                      <a href={post.permalink} target="_blank" rel="noreferrer" className="text-xs text-pink-400 hover:text-pink-300 shrink-0">View</a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
