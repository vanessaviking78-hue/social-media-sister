import { Newspaper, ExternalLink, Layers } from "lucide-react";
import newsData from "@/data/aesthetic-news.json";

type NewsItem = {
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatUpdatedDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

// Shared list, used by both the public /news page and the Aesthetic News tab
// inside the client portal. Refreshed every Monday.
export function NewsList() {
  const { items, updatedAt } = newsData as { items: NewsItem[]; updatedAt: string };
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-6">Last updated {formatUpdatedDate(updatedAt)} &middot; refreshed every Monday</p>
      <div className="space-y-4">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-pink-700/40 transition-colors overflow-hidden"
          >
            <div className="flex">
              {item.imageUrl ? (
                <div className="w-24 sm:w-32 shrink-0 bg-zinc-800">
                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" style={{ minHeight: 96 }} />
                </div>
              ) : (
                <div className="w-24 sm:w-32 shrink-0 flex items-center justify-center bg-gradient-to-br from-pink-950/40 to-zinc-900">
                  <Newspaper className="w-6 h-6 text-pink-500/60" />
                </div>
              )}
              <div className="flex-1 px-4 py-4 min-w-0">
                <p className="font-semibold text-white text-sm sm:text-base leading-snug group-hover:text-pink-300 transition-colors">{item.headline}</p>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">{item.summary}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-500">
                  {item.sourceName}
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// Public page at /news, no login required, for sharing with prospective clients.
export default function AestheticNews() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-pink-500" />
          <span className="font-bold text-sm text-pink-400">The CyberSuite&trade;</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper className="w-5 h-5 text-pink-400" />
          <h1 className="text-xl font-semibold">Aesthetic News</h1>
        </div>
        <p className="text-sm text-zinc-400 mb-8">
          What's happening across aesthetics and skincare, pulled together weekly so you don't have to go looking for it.
        </p>
        <NewsList />
      </main>
      <footer className="border-t border-zinc-900 py-6 mt-4">
        <p className="text-center text-xs text-zinc-700">Powered by <span className="text-zinc-600">The CyberSuite&trade;</span></p>
      </footer>
    </div>
  );
}
