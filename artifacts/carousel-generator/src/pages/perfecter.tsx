const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Perfecter() {
  return (
    <iframe
      src={`${BASE}/perfecter.html`}
      title="Photo Perfecter"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
