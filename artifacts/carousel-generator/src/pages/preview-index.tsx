import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, Copy, Check } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Preset = { id: number; name: string; logoUrl: string | null };

function safeSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500"
      title="Copy link"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export default function PreviewIndex() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/presets`)
      .then((r) => r.json())
      .then((d) => { const list = Array.isArray(d) ? d : (d.presets ?? []); setPresets([...list].sort((a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))); })
      .catch(() => setPresets([]))
      .finally(() => setLoading(false));
  }, []);

  const origin = window.location.origin;

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-white">
      <div className="border-b border-white/8 px-6 py-4 flex items-center gap-3">
        <Link href="/hub">
          <button className="p-1.5 rounded-lg hover:bg-white/8 text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <div>
          <h1 className="font-semibold text-base leading-none">Client Content Preview</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Share a preview link with each client so they can see their upcoming content.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
          </div>
        ) : presets.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-20">No clients found. Add a client in Presets first.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {presets.map((p) => {
              const slug = safeSlug(p.name);
              const fullUrl = `${origin}${BASE}/preview/${slug}`;
              return (
                <div
                  key={p.id}
                  className="border border-white/8 rounded-xl p-4 flex items-center gap-4"
                >
                  {p.logoUrl ? (
                    <img
                      src={p.logoUrl}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center flex-shrink-0 text-xs text-zinc-500 font-medium">
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-white">{p.name}</p>
                    <p className="text-xs text-zinc-600 truncate mt-0.5">{fullUrl}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <CopyButton text={fullUrl} />
                    <a
                      href={`${BASE}/preview/${slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-pink-400 transition-colors px-2.5 py-1.5 rounded-lg border border-zinc-700 hover:border-pink-500/40"
                    >
                      <ExternalLink size={12} />
                      Open
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
