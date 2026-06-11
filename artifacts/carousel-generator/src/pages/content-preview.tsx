import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid, CalendarDays } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type PreviewPost = {
  id: number;
  scheduledAt: string;
  postType: string;
  thumbnailUrl: string | null;
  title: string;
  status: string;
};

type PreviewData = {
  clientName: string;
  logoUrl: string | null;
  posts: PreviewPost[];
};

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchPreview(clientSlug: string): Promise<PreviewData> {
  const res = await fetch(`${BASE}/api/content-preview/${clientSlug}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Failed to load preview" }));
    throw new Error(data.error || "Failed to load preview");
  }
  const data = await res.json();
  return data as PreviewData;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ContentPreview({ clientSlug }: { clientSlug: string }) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "calendar">("grid");
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPreview(clientSlug)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-7 h-7 border-2 border-zinc-200 border-t-zinc-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading content...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-zinc-700 font-medium text-lg">Nothing here yet</p>
          <p className="text-sm text-zinc-400 mt-1">{error ?? "Client not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-100 px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {data.logoUrl && (
              <img
                src={data.logoUrl}
                alt=""
                className="h-11 w-11 rounded-full object-cover flex-shrink-0 border border-zinc-100"
              />
            )}
            <div className="min-w-0">
              <h1 className="font-semibold text-lg leading-tight text-zinc-900 truncate">
                {data.clientName}
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                {data.posts.length} post{data.posts.length !== 1 ? "s" : ""} scheduled
              </p>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1 flex-shrink-0">
            <button
              onClick={() => setView("grid")}
              title="Grid view"
              className={`p-2 rounded-md transition-colors ${
                view === "grid"
                  ? "bg-white shadow-sm text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setView("calendar")}
              title="Calendar view"
              className={`p-2 rounded-md transition-colors ${
                view === "calendar"
                  ? "bg-white shadow-sm text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <CalendarDays size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {view === "grid" ? (
          <GridView posts={data.posts} />
        ) : (
          <CalendarView
            posts={data.posts}
            calMonth={calMonth}
            setCalMonth={setCalMonth}
          />
        )}
      </main>

      <footer className="text-center py-8 text-xs text-zinc-300">
        Social Media Sister · The CyberSuite
      </footer>
    </div>
  );
}

// ── Grid view ─────────────────────────────────────────────────────────────────

function GridView({ posts }: { posts: PreviewPost[] }) {
  if (!posts.length) {
    return (
      <div className="text-center py-24 text-zinc-400">
        <p>No posts scheduled yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-px bg-zinc-100 border border-zinc-100 rounded-lg overflow-hidden">
      {posts.map((post) => (
        <GridCell key={post.id} post={post} />
      ))}
    </div>
  );
}

function GridCell({ post }: { post: PreviewPost }) {
  const [hovered, setHovered] = useState(false);
  const d = new Date(post.scheduledAt);
  const dateStr = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="relative aspect-square bg-white overflow-hidden cursor-default select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {post.thumbnailUrl ? (
        <img
          src={post.thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
          <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
            {post.postType}
          </span>
        </div>
      )}

      {/* Hover overlay */}
      <div
        className={`absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1 transition-opacity duration-150 ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-white font-medium text-sm leading-tight">{dateStr}</p>
        <p className="text-white/65 text-xs">{timeStr}</p>
        {post.status === "published" && (
          <span className="mt-1.5 text-[9px] bg-emerald-500/80 text-white px-2 py-0.5 rounded-full font-medium tracking-wide uppercase">
            Posted
          </span>
        )}
      </div>
    </div>
  );
}

// ── Calendar view ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CalendarView({
  posts,
  calMonth,
  setCalMonth,
}: {
  posts: PreviewPost[];
  calMonth: { year: number; month: number };
  setCalMonth: (m: { year: number; month: number }) => void;
}) {
  const { year, month } = calMonth;

  // Group posts by local date key YYYY-MM-DD
  const byDate = new Map<string, PreviewPost[]>();
  for (const p of posts) {
    const d = new Date(p.scheduledAt);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(p);
  }

  // Build cells: nulls for padding, then day numbers
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isSameMonth =
    today.getFullYear() === year && today.getMonth() === month;

  const prevMonth = () =>
    setCalMonth(
      month === 0
        ? { year: year - 1, month: 11 }
        : { year, month: month - 1 }
    );
  const nextMonth = () =>
    setCalMonth(
      month === 11
        ? { year: year + 1, month: 0 }
        : { year, month: month + 1 }
    );

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors"
        >
          <ChevronLeft size={17} />
        </button>
        <h2 className="font-semibold text-zinc-900">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-medium text-zinc-400 py-1.5"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[70px]" />;

          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayPosts = byDate.get(dateKey) ?? [];
          const isToday = isSameMonth && today.getDate() === day;
          const hasPosts = dayPosts.length > 0;

          return (
            <div
              key={i}
              className={`rounded-lg p-1.5 min-h-[70px] border transition-colors ${
                isToday
                  ? "border-pink-200 bg-pink-50"
                  : hasPosts
                  ? "border-zinc-200 bg-white"
                  : "border-transparent bg-zinc-50/60"
              }`}
            >
              <p
                className={`text-[11px] font-semibold mb-1 leading-none ${
                  isToday
                    ? "text-pink-500"
                    : hasPosts
                    ? "text-zinc-800"
                    : "text-zinc-400"
                }`}
              >
                {day}
              </p>

              <div className="flex flex-col gap-0.5">
                {dayPosts.slice(0, 2).map((p) =>
                  p.thumbnailUrl ? (
                    <div
                      key={p.id}
                      className="aspect-square w-full rounded overflow-hidden"
                    >
                      <img
                        src={p.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div
                      key={p.id}
                      className="aspect-square w-full rounded bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center"
                    >
                      <span className="text-[7px] text-pink-500 font-medium uppercase">
                        {p.postType.slice(0, 1)}
                      </span>
                    </div>
                  )
                )}
                {dayPosts.length > 2 && (
                  <p className="text-[8px] text-zinc-400 text-center mt-0.5">
                    +{dayPosts.length - 2}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
