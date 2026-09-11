import { useEffect } from "react";

const WHEEL_URL = "https://cybersuite-spinningwheel.netlify.app/";

export default function Prizes() {
  useEffect(() => {
    document.title = "Prizes · The CyberSuite";
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <iframe
        src={WHEEL_URL}
        title="The Cybersuite Launch Prizes"
        style={{ width: "100%", height: "100%", border: "none" }}
        allow="fullscreen"
      />
    </div>
  );
}
