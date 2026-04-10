import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layers, BarChart3, Users, Download, Send, Image, Sparkles, Clock, PieChart, AlertCircle, BookOpen } from "lucide-react";
import { useAnalytics } from "@/lib/use-analytics";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, Legend,
} from "recharts";

const POST_TYPE_LABELS: Record<string, string> = {
  carousel: "Carousel",
  "single-image": "Single Image",
  story: "Story",
};

const ACTION_LABELS: Record<string, string> = {
  generated: "Generated",
  downloaded: "Downloaded",
  pushed: "Pushed to CC",
};

const PIE_COLORS = ["#ec4899", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatPeriod(period: string, group: string) {
  const d = new Date(period);
  if (group === "week") return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export default function Analytics() {
  const { summary, clients, overTime, byType, recent, loading, fetchAll, fetchOverTime } = useAnalytics();
  const [timeGroup, setTimeGroup] = useState<"week" | "month">("month");

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchOverTime(timeGroup); }, [timeGroup, fetchOverTime]);

  const pieData = byType.map((t) => ({
    name: POST_TYPE_LABELS[t.postType] || t.postType,
    value: t.posts,
  }));

  const barData = overTime.map((d) => ({
    period: formatPeriod(d.period, timeGroup),
    actions: d.total,
    posts: d.posts,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-pink-500 hover:text-pink-400 transition">
              <Layers className="w-6 h-6" />
              <span className="font-bold text-3xl"><span className="text-white">Social Media Sister's</span>{" "}<span className="text-pink-400">CyberSuite</span></span>
            </Link>
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">Analytics</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition">Carousel</Link>
            <Link href="/single-image" className="text-muted-foreground hover:text-foreground transition">Single Image</Link>
            <Link href="/stories" className="text-muted-foreground hover:text-foreground transition">Stories</Link>
            <Link href="/presets" className="text-muted-foreground hover:text-foreground transition">Presets</Link>
            <Link href="/captions" className="text-muted-foreground hover:text-foreground transition">Captions</Link>
            <Link href="/calendar" className="text-muted-foreground hover:text-foreground transition">Calendar</Link>
            <Link href="/approval" className="text-muted-foreground hover:text-foreground transition">Approvals</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your content creation activity across all tools.</p>
        </div>

        {loading && !summary ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <StatCard icon={<Sparkles className="w-5 h-5 text-pink-400" />} label="Total Posts Created" value={summary?.totalPosts ?? 0} />
              <StatCard icon={<BarChart3 className="w-5 h-5 text-purple-400" />} label="Carousels" value={summary?.totalCarousels ?? 0} />
              <StatCard icon={<Image className="w-5 h-5 text-cyan-400" />} label="Single Images" value={summary?.totalSingleImages ?? 0} />
              <StatCard icon={<BookOpen className="w-5 h-5 text-emerald-400" />} label="Stories" value={summary?.totalStories ?? 0} />
              <StatCard icon={<Download className="w-5 h-5 text-amber-400" />} label="Downloads This Month" value={summary?.monthDownloads ?? 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-card border border-border/40 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-pink-400" />
                    Content Volume Over Time
                  </h2>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setTimeGroup("week")}
                      className={`px-3 py-1 text-xs rounded-full transition ${timeGroup === "week" ? "bg-pink-500/20 text-pink-400" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setTimeGroup("month")}
                      className={`px-3 py-1 text-xs rounded-full transition ${timeGroup === "month" ? "bg-pink-500/20 text-pink-400" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="period" stroke="#888" fontSize={11} />
                      <YAxis stroke="#888" fontSize={11} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Bar dataKey="posts" name="Posts" fill="#ec4899" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actions" name="Actions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                    No data yet. Start creating content to see your analytics.
                  </div>
                )}
              </div>

              <div className="bg-card border border-border/40 rounded-xl p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <PieChart className="w-5 h-5 text-purple-400" />
                  Post Type Distribution
                </h2>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <RPieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: number, name: string) => [`${value} actions`, name]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "12px" }}
                        formatter={(value) => <span style={{ color: "#ccc" }}>{value}</span>}
                      />
                    </RPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                    No data yet. Generate some content to see your distribution.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-card border border-border/40 rounded-xl p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-cyan-400" />
                  Content by Client
                </h2>
                {clients.length > 0 ? (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto">
                    {clients.map((client) => (
                      <div key={client.clientName} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/20">
                        <div>
                          <span className="font-medium text-sm">{client.clientName}</span>
                          <div className="flex gap-3 mt-1">
                            <span className="text-[11px] text-muted-foreground">{client.posts} posts</span>
                            <span className="text-[11px] text-muted-foreground">{client.generated} generated</span>
                            <span className="text-[11px] text-muted-foreground">{client.downloaded} downloaded</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-pink-400">{client.total}</span>
                          <div className="text-[10px] text-muted-foreground">actions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    No client data yet. Content generation will track client names.
                  </div>
                )}
              </div>

              <div className="bg-card border border-border/40 rounded-xl p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Recent Activity
                </h2>
                {recent.length > 0 ? (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {recent.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/20">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${item.action === "generated" ? "bg-pink-400" : item.action === "downloaded" ? "bg-amber-400" : "bg-green-400"}`} />
                          <div>
                            <span className="text-sm font-medium">{ACTION_LABELS[item.action] || item.action}</span>
                            <span className="text-xs text-muted-foreground ml-2">{POST_TYPE_LABELS[item.postType] || item.postType}</span>
                            {item.clientName && <span className="text-xs text-muted-foreground ml-2">- {item.clientName}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground">{item.postCount} posts</span>
                          <div className="text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    No activity logged yet. Start creating content to see your history.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border border-border/40 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Social Media Performance</h2>
                  <p className="text-sm text-muted-foreground">Engagement metrics from Cloud Campaign</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-foreground/80">
                    Social media engagement metrics (likes, comments, reach, impressions) will be available here once Cloud Campaign API workspace access is enabled.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This section will show post performance, engagement rates, best performing content, and optimal posting times once connected.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border/40 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
      <div className="text-3xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
