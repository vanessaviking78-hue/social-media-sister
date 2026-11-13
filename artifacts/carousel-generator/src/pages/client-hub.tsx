import { lazy, Suspense, useEffect, useState } from "react";
import { ForcedClientContext, type ForcedClient } from "@/lib/forced-client";
import { U_TREATMENTS } from "@/lib/universal-treatments";
import { usePresets } from "@/lib/use-presets";
import { ClientInfoPanel } from "./client-extras";
import { clientSlug, readTitleStyle, saveTitleStyle } from "@/lib/suite-fonts";

// A CLIENT'S OWN PAGE, the same set of tools as Clare's page, every one opened on that client.
// Universal is limited to the treatments the client ticked on the treatments form.
const lazyTab = (load: () => Promise<{ default: React.ComponentType }>) => lazy(load);
const TABS: { id: string; label: string; Comp: React.ComponentType }[] = [
  { id: "new", label: "NEW", Comp: lazyTab(() => import("./new-covers")) },
  { id: "hooks", label: "My first hooks", Comp: lazyTab(() => import("./hooks-tab")) },
  { id: "posts", label: "Make 40 posts", Comp: lazyTab(() => import("./clare").then((m) => ({ default: m.ClareOwn }))) },
  { id: "universal", label: "Universal treatments", Comp: lazyTab(() => import("./universal")) },
  { id: "fillers", label: "Fillers", Comp: lazyTab(() => import("./client-extras").then((m) => ({ default: m.FillersTab }))) },
  { id: "treatments", label: "Treatment carousels", Comp: lazyTab(() => import("./treatments")) },
  { id: "about", label: "About me", Comp: lazyTab(() => import("./client-about")) },
  { id: "unique", label: "Unique", Comp: lazyTab(() => import("./unique")) },
  { id: "empower", label: "Empower", Comp: lazyTab(() => import("./empower")) },
  { id: "mens", label: "Men", Comp: lazyTab(() => import("./mens")) },
  { id: "november", label: "November", Comp: lazyTab(() => import("./november-posts")) },
  { id: "xmas", label: "Xmas", Comp: lazyTab(() => import("./xmas-tab")) },
  { id: "lux", label: "LUX", Comp: lazyTab(() => import("./lux")) },
  { id: "basic", label: "Basic posts", Comp: lazyTab(() => import("./basic-posts")) },
  { id: "halloween", label: "Halloween", Comp: lazyTab(() => import("./halloween-posts")) },
];

// Social Media Sister (Vanessa herself) has three tabs only: Xmas, Feral and Black Friday. No other client gets them.
const SMS_TABS: { id: string; label: string; Comp: React.ComponentType }[] = [
  { id: "xmas", label: "Xmas", Comp: lazyTab(() => import("./smxmas-tab")) },
  { id: "feral", label: "Feral", Comp: lazyTab(() => import("./feral-tab")) },
  { id: "blackfriday", label: "Black Friday", Comp: lazyTab(() => import("./bf-tab")) },
  { id: "performance", label: "Performance", Comp: lazyTab(() => import("./sms-performance-tab")) },
];

// Hammered (the construction business) has one tool only: the Hammered posts page. None of the clinic tabs belong there.
const HAMMERED_TABS: { id: string; label: string; Comp: React.ComponentType }[] = [
  { id: "hammered", label: "Hammered posts", Comp: lazyTab(() => import("./hammered")) },
];

// Smashed Socials (the pub and bar business) also has one tool only: the Smashed Socials posts page.
const SMASHED_TABS: { id: string; label: string; Comp: React.ComponentType }[] = [
  { id: "smashed", label: "Smashed Socials posts", Comp: lazyTab(() => import("./smashed")) },
];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function ClientHub({ label, pattern }: { label: string; pattern: RegExp }) {
  const [tab, setTab] = useState(/hammered/i.test(label) ? "hammered" : /smashed/i.test(label) ? "smashed" : "new");
  const [ids, setIds] = useState<string[] | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetch(`${BASE}/api/client-treatments`)
      .then((r) => r.json())
      .then((d: { clients?: { clientName: string; typedName: string; treatments: string[] }[] }) => {
        if (!live) return;
        const row = (d.clients ?? []).find((c) => pattern.test(c.clientName) || pattern.test(c.typedName));
        const known = new Set(U_TREATMENTS.map((x) => x.id));
        const mine = (row?.treatments ?? []).filter((t) => known.has(t));
        setIds(mine.length ? mine : undefined);
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [pattern]);
  // The font they chose on the Font Lab form becomes their look on this device, unless I have already applied that choice.
  useEffect(() => {
    let live = true;
    fetch(`${BASE}/api/client-fonts`).then((r) => r.json()).then((d: { clients?: { clientName: string; typedName: string; fontId: string; upper: boolean; updatedAt: string }[] }) => {
      if (!live) return;
      const row = (d.clients ?? []).find((c) => pattern.test(c.clientName) || pattern.test(c.typedName));
      if (!row) return;
      const slug = clientSlug(label);
      const mark = `suite-client-font-applied-${slug}`;
      try {
        if (localStorage.getItem(mark) === row.updatedAt) return;
        saveTitleStyle({ ...readTitleStyle(slug), fontId: row.fontId, upper: row.upper, swaps: {}, rate: "first", ligatures: true }, slug);
        localStorage.setItem(mark, row.updatedAt);
        window.dispatchEvent(new Event("suite-client-font"));
      } catch { /* ignore */ }
    }).catch(() => undefined);
    return () => { live = false; };
  }, [pattern, label]);
  const forced: ForcedClient = { pattern, treatmentIds: ids };
  const isSms = /social\s*media\s*sis|very\s*vanessa|vanessa|^sms$/i.test(label);
  const isHammered = /hammered/i.test(label);
  const isSmashed = /smashed/i.test(label);
  const tabs = isHammered ? HAMMERED_TABS : isSmashed ? SMASHED_TABS : isSms ? SMS_TABS : TABS;
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="sticky top-0 z-30 bg-[#161616]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 pt-2 text-xs text-white/50">{label}</div>
        <div className="max-w-6xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-sm border ${tab === t.id ? "bg-white text-black border-white" : "border-white/20 text-white/80 hover:bg-white/10"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      {!isSms && !isHammered && !isSmashed && <ClientInfoPanel clientName={label} treatmentIds={ids} />}
      <ForcedClientContext.Provider value={forced}>
        <div className="[&_a[href='/hub']]:hidden">
          <Suspense fallback={<div className="p-10 text-center text-white/60">Loading...</div>}>
            <current.Comp key={`${current.id}-${ids?.join(",") ?? "all"}`} />
          </Suspense>
        </div>
      </ForcedClientContext.Provider>
    </div>
  );
}

export const DrVPage = () => <ClientHub label="Dr V, Fresher Faces" pattern={/dr\.?\s*v\b|fresher/i} />;
export const PuraPage = () => <ClientHub label="Pura Aesthetics" pattern={/pura/i} />;
export const AnnorlundaPage = () => <ClientHub label="Annorlunda" pattern={/annorlunda/i} />;
export const TeviotPage = () => <ClientHub label="Teviot" pattern={/teviot/i} />;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// /client/<id>: the full tool set for ANY client, picked by their preset id.
export function ClientByIdPage({ params }: { params: { id: string } }) {
  const { presets, loading } = usePresets();
  const p = presets.find((x) => String(x.id) === params.id);
  if (!p) return <div className="min-h-screen bg-[#161616] text-white p-10 text-center">{loading ? "Loading..." : "I cannot find that client."}</div>;
  return <ClientHub key={p.id} label={p.name} pattern={new RegExp(`^${esc(p.name)}$`, "i")} />;
}

// /clients: one button per client, each opening their own page.
export function ClientsIndexPage() {
  const { presets } = usePresets();
  const [q, setQ] = useState("");
  const list = presets.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="min-h-screen bg-[#161616] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Client pages</h1>
        <p className="text-white/60 text-sm">Every client has their own page with the full set of tools, opened on them.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client" className="w-full rounded border border-white/20 bg-transparent px-3 py-2" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {list.map((p) => (
            <a key={p.id} href={`${BASE}/client/${p.id}`} className="rounded-lg border border-white/15 hover:bg-white/10 px-3 py-3 text-sm">{p.name}</a>
          ))}
        </div>
      </div>
    </div>
  );
}
