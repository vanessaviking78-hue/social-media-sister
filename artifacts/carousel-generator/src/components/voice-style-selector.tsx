import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic2 } from "lucide-react";

const VOICE_OPTIONS = [
  {
    value: "northern-grit",
    label: "Northern Grit",
    desc: "Blunt, witty, real. Properly Vanessa.",
  },
  {
    value: "whimsical",
    label: "Whimsical",
    desc: "Narrative, observational, soulful.",
  },
  {
    value: "professional-warmth",
    label: "Professional with Warmth",
    desc: "Expert but human. Credible, likable.",
  },
  {
    value: "girly-sweet",
    label: "Girly and Sweet",
    desc: "Warm, light, friendly, approachable.",
  },
];

interface VoiceStyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
  showLabel?: boolean;
}

export default function VoiceStyleSelector({
  value,
  onChange,
  size = "md",
  className = "",
  showLabel = true,
}: VoiceStyleSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Mic2 className={`${size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} text-primary`} />
          <span className={`${size === "sm" ? "text-xs" : "text-sm"} text-muted-foreground`}>Voice</span>
        </div>
      )}
      <Select value={value || "northern-grit"} onValueChange={onChange}>
        <SelectTrigger
          className={`${size === "sm" ? "h-8 text-xs" : "h-10 text-sm"} bg-accent/20 border-border/40 min-w-[190px]`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VOICE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <div className="flex flex-col py-0.5">
                <span className="font-medium">{opt.label}</span>
                <span className="text-muted-foreground text-xs">{opt.desc}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
