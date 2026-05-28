import { useState } from "react";

const RAIL_W = 60;
const PANEL_W = 260;

type Tool = "templates" | "photos" | "text" | "shapes" | "stickers" | "layers";

const TOOLS: { id: Tool; label: string; icon: React.FC<{ active: boolean }> }[] = [
  {
    id: "templates",
    label: "Templates",
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "photos",
    label: "Photos",
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
  },
  {
    id: "shapes",
    label: "Shapes",
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" />
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    id: "stickers",
    label: "Stickers",
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
        <path d="M14.5 10.5a2.5 2.5 0 0 1-5 0" />
        <circle cx="9" cy="8.5" r="1" fill={active ? "#E91976" : "white"} stroke="none" />
        <circle cx="15" cy="8.5" r="1" fill={active ? "#E91976" : "white"} stroke="none" />
      </svg>
    ),
  },
  {
    id: "layers",
    label: "Layers",
    icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#E91976" : "white"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
];

const PANEL_CONTENT: Record<Tool, { heading: string; items: string[] }> = {
  templates: {
    heading: "Templates",
    items: ["Editorial Clean", "Bold & Dark", "Minimal White", "Vintage Film", "Neon Pop", "Soft Pastel", "Luxury Black", "Magazine Grid"],
  },
  photos: {
    heading: "Photos",
    items: ["Upload from device", "Use approved images", "Stock photos (soon)", "AI generate (soon)"],
  },
  text: {
    heading: "Text",
    items: ["Heading font", "Subheading font", "Body text", "Font size", "Letter spacing", "Line height", "Text colour", "Uppercase"],
  },
  shapes: {
    heading: "Shapes",
    items: ["None", "Triangle corner", "Arc corner", "Overlay gradient", "Solid block", "Border outline"],
  },
  stickers: {
    heading: "Stickers",
    items: ["Hearts", "Stars", "Arrows", "Sparkles", "Frames", "Badges", "Text callouts", "Icons"],
  },
  layers: {
    heading: "Layers",
    items: ["Slide 1 — Cover", "Slide 2", "Slide 3", "Slide 4", "Slide 5", "CTA slide"],
  },
};

function TemplatesPanel() {
  const items = PANEL_CONTENT.templates.items;
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Style packs</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((t) => (
          <div key={t} className="aspect-[4/5] rounded-lg bg-zinc-800 border border-zinc-700 hover:border-pink-500/60 cursor-pointer transition-colors flex items-end p-2 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900" />
            <span className="relative text-[10px] text-zinc-300 font-medium leading-tight group-hover:text-white transition-colors">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotosPanel() {
  return (
    <div className="p-4 space-y-4">
      <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-pink-500/50 cursor-pointer transition-colors group">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-pink-400 transition-colors">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-xs text-zinc-500 text-center group-hover:text-zinc-400 transition-colors">Drag photos here<br />or click to upload</p>
      </div>
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mt-2">Approved images</p>
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded bg-zinc-800 border border-zinc-700 hover:border-pink-500/60 cursor-pointer transition-colors" />
        ))}
      </div>
    </div>
  );
}

function TextPanel() {
  return (
    <div className="p-4 space-y-4">
      {["Heading font", "Subheading font"].map((label) => (
        <div key={label} className="space-y-1.5">
          <p className="text-xs text-zinc-500">{label}</p>
          <div className="h-9 rounded-lg border border-zinc-700 bg-zinc-800 px-3 flex items-center justify-between cursor-pointer hover:border-zinc-600 transition-colors">
            <span className="text-sm text-zinc-300">Cinzel</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3">
        {["Font size", "Letter spacing", "Line height", "Text colour"].map((label) => (
          <div key={label} className="space-y-1.5">
            <p className="text-xs text-zinc-500">{label}</p>
            <div className="h-9 rounded-lg border border-zinc-700 bg-zinc-800 px-3 flex items-center cursor-pointer hover:border-zinc-600 transition-colors">
              <span className="text-sm text-zinc-400">—</span>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-zinc-500">Text colour</p>
        <div className="flex gap-2">
          <div className="w-9 h-9 rounded-lg border border-zinc-700 bg-white cursor-pointer" />
          <div className="flex-1 h-9 rounded-lg border border-zinc-700 bg-zinc-800 px-3 flex items-center"><span className="text-sm text-zinc-400 font-mono">#ffffff</span></div>
        </div>
      </div>
    </div>
  );
}

function GenericPanel({ tool }: { tool: Tool }) {
  const { items } = PANEL_CONTENT[tool];
  return (
    <div className="p-4 space-y-1.5">
      {items.map((item) => (
        <div key={item} className="h-10 rounded-lg border border-zinc-800 bg-zinc-800/50 px-3 flex items-center cursor-pointer hover:border-zinc-600 hover:bg-zinc-800 transition-colors">
          <span className="text-sm text-zinc-300">{item}</span>
        </div>
      ))}
    </div>
  );
}

function PanelBody({ tool }: { tool: Tool }) {
  if (tool === "templates") return <TemplatesPanel />;
  if (tool === "photos") return <PhotosPanel />;
  if (tool === "text") return <TextPanel />;
  return <GenericPanel tool={tool} />;
}

export function CarouselToolbar() {
  const [active, setActive] = useState<Tool | null>("photos");

  const toggleTool = (id: Tool) => setActive((prev) => (prev === id ? null : id));

  return (
    <div className="flex h-screen w-full bg-zinc-950 overflow-hidden">

      {/* ── Left Rail (60px) ─────────────────────────── */}
      <div
        style={{ width: RAIL_W, minWidth: RAIL_W }}
        className="flex flex-col items-center py-4 gap-1 bg-[#0f0f0f] border-r border-zinc-800/60 z-10"
      >
        {TOOLS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => toggleTool(id)}
              className="flex flex-col items-center gap-1 py-3 px-2 w-full hover:bg-zinc-800/60 transition-colors rounded-none relative group"
              style={{ backgroundColor: isActive ? "rgba(233,25,118,0.08)" : undefined }}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-[#E91976]" />
              )}
              <Icon active={isActive} />
              <span
                className="text-[9px] font-medium tracking-wide uppercase"
                style={{ color: isActive ? "#E91976" : "#71717a" }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Slide-out Panel (260px) ──────────────────── */}
      <div
        style={{
          width: active ? PANEL_W : 0,
          minWidth: active ? PANEL_W : 0,
          overflow: "hidden",
          transition: "width 180ms cubic-bezier(0.4,0,0.2,1), min-width 180ms cubic-bezier(0.4,0,0.2,1)",
        }}
        className="bg-[#161616] border-r border-zinc-800/60 flex flex-col"
      >
        {active && (
          <>
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 shrink-0">
              <span className="text-sm font-semibold text-white">{PANEL_CONTENT[active].heading}</span>
              <button
                onClick={() => setActive(null)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-zinc-700/60 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            {/* Panel body */}
            <div className="flex-1 overflow-y-auto">
              <PanelBody tool={active} />
            </div>
          </>
        )}
      </div>

      {/* ── Preview / Canvas Area ────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        {/* Toolbar strip */}
        <div className="h-11 border-b border-zinc-800/60 flex items-center px-4 gap-3 bg-[#111111] shrink-0">
          <span className="text-xs text-zinc-500 font-medium">Carousel Creator</span>
          <span className="text-zinc-700 text-xs">·</span>
          <div className="flex gap-1">
            {["1. Images","2. Style","3. Content","4. Generate"].map((s, i) => (
              <button key={s} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${i === 1 ? "bg-[#E91976]/15 text-pink-400" : "text-zinc-500 hover:text-zinc-300"}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-colors">Download ZIP</button>
            <button className="px-3 py-1.5 rounded-lg bg-[#E91976] text-white text-xs font-bold hover:bg-pink-600 transition-colors">Generate →</button>
          </div>
        </div>

        {/* Canvas / preview zone */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
          <div className="flex flex-col items-center gap-6">
            <p className="text-xs text-zinc-600 uppercase tracking-widest font-semibold">Live Preview</p>
            <div className="flex gap-4 items-start">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex flex-col items-center gap-2">
                  <div
                    className="rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center relative overflow-hidden"
                    style={{ width: 180, height: 225 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950" />
                    <span className="relative text-zinc-700 text-xs font-mono">Slide {n}</span>
                  </div>
                  <span className="text-[10px] text-zinc-600">{n === 1 ? "Cover" : n === 2 ? "Slide 2" : "Slide 3"}</span>
                </div>
              ))}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="rounded-xl border border-dashed border-zinc-700/50 flex items-center justify-center cursor-pointer hover:border-zinc-600 transition-colors"
                  style={{ width: 180, height: 225 }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </div>
                <span className="text-[10px] text-zinc-700">Add slide</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
