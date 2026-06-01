interface FontSwitcherProps {
  headingFont: string;
  onHeadingChange: (value: string) => void;
  onBodyChange: (value: string) => void;
}

const FONT_PRESETS = [
  {
    id: "display",
    fontName: "Bebas Neue",
    role: "Display / hero",
    headingValue: "'Bebas Neue', sans-serif",
    bodyValue: "'Prata', serif",
    previewSize: "text-2xl",
    tracking: "tracking-wider",
  },
  {
    id: "heading",
    fontName: "DM Serif Display",
    role: "Headings",
    headingValue: "'DM Serif Display', serif",
    bodyValue: "'Prata', serif",
    previewSize: "text-xl",
    tracking: "",
  },
  {
    id: "body",
    fontName: "Prata",
    role: "Body / subtitles",
    headingValue: "'Prata', serif",
    bodyValue: "'DM Serif Display', serif",
    previewSize: "text-lg",
    tracking: "",
  },
] as const;

export function FontSwitcher({ headingFont, onHeadingChange, onBodyChange }: FontSwitcherProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Font style</p>
      <div className="space-y-1.5">
        {FONT_PRESETS.map((preset) => {
          const isActive = headingFont === preset.headingValue;
          return (
            <button
              key={preset.id}
              onClick={() => { onHeadingChange(preset.headingValue); onBodyChange(preset.bodyValue); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left ${
                isActive
                  ? "border-[#E91976]/60 bg-[#E91976]/10"
                  : "border-zinc-700/40 bg-zinc-800/40 hover:border-zinc-600/60 hover:bg-zinc-800/60"
              }`}
            >
              <div className="flex flex-col min-w-0">
                <span
                  className={`leading-tight font-normal truncate ${preset.previewSize} ${preset.tracking}`}
                  style={{ fontFamily: preset.headingValue, color: isActive ? "#E91976" : "#e4e4e7" }}
                >
                  {preset.fontName}
                </span>
                <span className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{preset.role}</span>
              </div>
              {isActive && (
                <span className="ml-2 shrink-0 w-1.5 h-1.5 rounded-full bg-[#E91976]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
