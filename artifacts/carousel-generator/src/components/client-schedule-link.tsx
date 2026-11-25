import { CalendarClock } from "lucide-react";
import { usePresets } from "@/lib/use-presets";

const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

// The Schedule icon on every client's own page. It opens the scheduler on that client, with their Client Bank panel open.
// The client is matched to their preset by the same pattern the page already uses, so it works on every client page.
export function ClientScheduleLink({ pattern, label }: { pattern: RegExp; label?: string }) {
  const { presets } = usePresets();
  const exact = label ? presets.find((p) => p.name.toLowerCase() === label.toLowerCase()) : undefined;
  const preset = exact ?? presets.find((p) => pattern.test(p.name));
  if (!preset) return null;
  return (
    <a
      href={`${BASE}/scheduler?client=${encodeURIComponent(preset.name)}`}
      title={`${preset.name}: Client Bank and scheduler`}
      className="shrink-0 ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-pink-500/60 text-pink-300 hover:bg-pink-500/15"
    >
      <CalendarClock size={15} /> Schedule
    </a>
  );
}
