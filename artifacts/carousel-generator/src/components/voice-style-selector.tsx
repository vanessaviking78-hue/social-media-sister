// There is one house voice now, so there is nothing to pick. The component stays so existing pages keep compiling.
interface VoiceStyleSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
  showLabel?: boolean;
}

export default function VoiceStyleSelector(_props: VoiceStyleSelectorProps) {
  return null;
}
