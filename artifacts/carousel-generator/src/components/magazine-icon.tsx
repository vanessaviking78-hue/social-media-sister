// A little open magazine with a page mid turn.
// Takes className like the lucide icons so it drops straight into the hub.
export function MagazineIcon({ className }: { className?: string }) {
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
      <path d="M12 6.5 C9.5 5 6.5 4.6 3 5 V18.5 C6.5 18.1 9.5 18.5 12 20 C14.5 18.5 17.5 18.1 21 18.5 V5 C17.5 4.6 14.5 5 12 6.5 Z" />
      <path d="M12 6.5 V20" />
      <path d="M5.5 8.5 H9.5 M5.5 11 H9.5 M5.5 13.5 H8" />
      <path d="M14.5 9 C16.5 8.6 17.8 8.8 18.8 9.2" fill="currentColor" fillOpacity="0.35" />
      <path d="M14.5 12 H18.5" />
    </svg>
  );
}
