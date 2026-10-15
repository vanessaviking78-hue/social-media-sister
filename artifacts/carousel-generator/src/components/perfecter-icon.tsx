// A photo frame with a sparkle, for Photo Perfecter.
export function PerfecterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4.5" width="15" height="14" rx="2.5" />
      <path d="M3.5 15.5 8 11l3.5 3.5 2-2 4 4" />
      <circle cx="7.5" cy="8.5" r="1.1" fill="currentColor" fillOpacity="0.35" />
      <path d="M19.5 2.5v4M17.5 4.5h4" />
      <path d="M20 11v2.5M18.75 12.25h2.5" />
    </svg>
  );
}
