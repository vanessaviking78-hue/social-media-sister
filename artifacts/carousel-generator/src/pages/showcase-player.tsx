import { useEffect, useMemo, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const COVER_MS = 2200;
const SLIDE_MS = 1500;

type Showcase = {
  title?: string | null;
  carousels: string[][];
  closingLine?: string;
  clientName?: string;
};

type Frame = { url: string; carousel: number; slide: number; isCover: boolean };

export default function ShowcasePlayer({ token }: { token: string }) {
  const [data, setData] = useState<Showcase | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"loading" | "ready" | "playing" | "grid">("loading");
  const [frameIdx, setFrameIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/api/showcase/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("This showcase link is not available."))))
      .then((d) => {
        if (!alive) return;
        setData(d);
        setPhase("ready");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || "Could not load this showcase.");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  const frames: Frame[] = useMemo(() => {
    if (!data) return [];
    const out: Frame[] = [];
    data.carousels.forEach((c, ci) => {
      c.forEach((url, si) => out.push({ url, carousel: ci, slide: si, isCover: si === 0 }));
    });
    return out;
  }, [data]);

  const covers = useMemo(() => (data ? data.carousels.map((c) => c[0]).filter(Boolean) : []), [data]);

  // Preload every image up front so playback is smooth.
  useEffect(() => {
    frames.forEach((f) => {
      const img = new Image();
      img.src = f.url;
    });
  }, [frames]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (frameIdx >= frames.length) {
      setPhase("grid");
      return;
    }
    const f = frames[frameIdx];
    const ms = f.isCover ? COVER_MS : SLIDE_MS;
    timer.current = setTimeout(() => setFrameIdx((i) => i + 1), ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phase, frameIdx, frames]);

  function start() {
    setFrameIdx(0);
    setPhase("playing");
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] w-full bg-black text-white flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-pink-500 text-lg font-semibold mb-2">The CyberSuite</div>
          <p className="text-white/60">{error}</p>
        </div>
      </div>
    );
  }

  if (phase === "loading" || !data) {
    return (
      <div className="min-h-[100dvh] w-full bg-black text-white flex items-center justify-center">
        <div className="text-white/40 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  // Cover / start screen
  if (phase === "ready") {
    return (
      <div className="min-h-[100dvh] w-full bg-black text-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="text-pink-500 text-sm tracking-[0.2em] uppercase mb-4">The CyberSuite</div>
          <h1 className="text-3xl font-bold leading-tight mb-2">
            {data.clientName ? `A little something for ${data.clientName}` : "A little showcase for you"}
          </h1>
          <p className="text-white/50 mb-8">{data.title || "Press play and watch your feed come to life."}</p>
          <button
            onClick={start}
            className="px-8 py-4 rounded-full bg-pink-500 text-white text-lg font-semibold hover:bg-pink-400 transition-colors"
          >
            Play
          </button>
        </div>
      </div>
    );
  }

  // Grid finale
  if (phase === "grid") {
    return (
      <div className="min-h-[100dvh] w-full bg-black text-white flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="grid grid-cols-3 gap-1">
            {covers.map((url, i) => (
              <div key={i} className="aspect-square overflow-hidden bg-white/5">
                <img src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="text-center mt-7">
            <p className="text-xl sm:text-2xl font-semibold leading-snug">
              {data.closingLine || "This is how your work would look if I was looking after you"}
            </p>
            {data.clientName && <p className="text-white/40 mt-2">{data.clientName}</p>}
          </div>
          <div className="flex items-center justify-center gap-5 mt-8">
            <button
              onClick={start}
              className="px-6 py-3 rounded-full border border-white/25 text-white/80 hover:border-pink-500 hover:text-white transition-colors"
            >
              ↺ Replay
            </button>
          </div>
          <div className="text-center text-pink-500/70 text-xs tracking-[0.2em] uppercase mt-8">The CyberSuite</div>
        </div>
      </div>
    );
  }

  // Playing
  const f = frames[frameIdx] || frames[frames.length - 1];
  return (
    <div className="min-h-[100dvh] w-full bg-black text-white flex items-center justify-center relative overflow-hidden">
      <img
        key={frameIdx}
        src={f?.url}
        alt=""
        className="max-h-[100dvh] max-w-full object-contain animate-[fadein_0.35s_ease]"
      />
      {/* carousel progress dots */}
      <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-1.5">
        {data.carousels.map((_, ci) => (
          <span
            key={ci}
            className={`h-1.5 rounded-full transition-all ${
              ci === f?.carousel ? "w-6 bg-pink-500" : "w-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>
      <button
        onClick={() => setPhase("grid")}
        className="absolute top-4 right-4 text-white/40 text-xs hover:text-white"
      >
        Skip →
      </button>
      <style>{`@keyframes fadein{from{opacity:.25}to{opacity:1}}`}</style>
    </div>
  );
}
