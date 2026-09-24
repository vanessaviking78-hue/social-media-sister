// A little advent calendar: a 3 x 3 grid of doors with one swung open.
// Takes className like the lucide icons so it drops straight into the hub.
export function AdventCalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="2.5" />
      <rect x="4.6" y="4.6" width="4.2" height="4.2" rx="0.6" />
      <rect x="9.9" y="4.6" width="4.2" height="4.2" rx="0.6" />
      <rect x="15.2" y="4.6" width="4.2" height="4.2" rx="0.6" />
      <rect x="4.6" y="9.9" width="4.2" height="4.2" rx="0.6" />
      <path d="M15.2 9.9 L12.6 10.9 L12.6 14.6 L15.2 14.1 Z" fill="currentColor" fillOpacity="0.35" />
      <rect x="15.2" y="9.9" width="4.2" height="4.2" rx="0.6" strokeDasharray="0.1 2.2" />
      <rect x="4.6" y="15.2" width="4.2" height="4.2" rx="0.6" />
      <rect x="9.9" y="15.2" width="4.2" height="4.2" rx="0.6" />
      <rect x="15.2" y="15.2" width="4.2" height="4.2" rx="0.6" />
    </svg>
  );
}
