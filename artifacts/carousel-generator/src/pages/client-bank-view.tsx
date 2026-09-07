import { useState, useEffect } from "react";
import { Download, Loader2 } from "lucide-react";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

type BankItem = {
  id: number;
  postType: string;
  title: string;
  caption: string;
  imageUrls: string[];
  videoUrl: string | null;
  createdAt: string;
};

type BankData = {
  clientName: string;
  logoUrl: string | null;
  posts: BankItem[];
};

async function fetchBank(clientSlug: string): Promise<BankData> {
  const res = await fetch(`${BASE}/api/client-bank-view/${clientSlug}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Failed to load bank" }));
    throw new Error(data.error || "Failed to load bank");
  }
  return res.json();
}

async function downloadAllForItem(item: BankItem, clientName: string) {
  const { default: JSZip } = await import("jszip");
  const { saveAs } = await import("file-saver");
  const zip = new JSZip();

  const urls = [...item.imageUrls, ...(item.videoUrl ? [item.videoUrl] : [])];
  await Promise.all(
    urls.map(async (url, i) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const ext = item.videoUrl === url ? "mp4" : "jpg";
        zip.file(`slide-${i + 1}.${ext}`, blob);
      } catch {
        // skip files that fail to fetch
      }
    })
  );

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const safeName = clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  saveAs(zipBlob, `${safeName}-${item.id}.zip`);
}

function BankCard({ item, clientName }: { item: BankItem; clientName: string }) {
  const [downloading, setDownloading] = useState(false);
  const thumb = item.imageUrls[0] || null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAllForItem(item, clientName);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="border border-zinc-100 rounded-xl overflow-hidden bg-white">
      {thumb && (
        <img src={thumb} alt="" className="w-full aspect-square object-cover bg-zinc-50" />
      )}
      {item.videoUrl && !thumb && (
        <video src={item.videoUrl} className="w-full aspect-square object-cover bg-zinc-50" controls />
      )}
      <div className="p-4">
        {item.title && (
          <p className="font-medium text-sm text-zinc-900 truncate mb-1">{item.title}</p>
        )}
        {item.caption && (
          <p className="text-xs text-zinc-400 line-clamp-2 mb-3">{item.caption}</p>
        )}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-2 text-xs font-medium bg-zinc-900 text-white rounded-lg py-2 hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {downloading ? "Preparing..." : "Download"}
        </button>
      </div>
    </div>
  );
}

export default function ClientBankView({ clientSlug }: { clientSlug: string }) {
  const [data, setData] = useState<BankData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchBank(clientSlug)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clientSlug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-7 h-7 border-2 border-zinc-200 border-t-zinc-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading your bank...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-zinc-700 font-medium text-lg">Nothing here yet</p>
          <p className="text-sm text-zinc-400 mt-1">{error || "Client not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-100 px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {data.logoUrl && (
            <img
              src={data.logoUrl}
              alt=""
              className="h-11 w-11 rounded-full object-cover flex-shrink-0 border border-zinc-100"
            />
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-lg leading-tight text-zinc-900 truncate">
              {data.clientName}'s Bank
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              {data.posts.length} item{data.posts.length !== 1 ? "s" : ""} ready to download
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {data.posts.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-16">
            No content in the bank yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {data.posts.map((item) => (
              <BankCard key={item.id} item={item} clientName={data.clientName} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
