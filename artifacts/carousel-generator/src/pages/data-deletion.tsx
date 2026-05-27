import { Link } from "wouter";

export default function DataDeletion() {
  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/sms-logo.png" alt="Social Media Sister" style={{ height: 44, width: 44, borderRadius: "50%", objectFit: "cover" }} />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "#ff2d78", letterSpacing: 1 }}>The CyberSuite</span>
          </div>
          <Link href="/" style={{ color: "#aaa", fontSize: 13, textDecoration: "none", borderBottom: "1px solid #333", paddingBottom: 1 }}>
            Back to The CyberSuite
          </Link>
        </div>

        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: "#ff2d78", letterSpacing: 2, marginBottom: 40, lineHeight: 1 }}>Data Deletion</h1>

        <p style={{ lineHeight: 1.8, color: "#ccc", fontSize: 15, marginBottom: 32 }}>
          To delete your data from The CyberSuite, email <a href="mailto:vanessa@thecybersuite.com" style={{ color: "#ff2d78" }}>vanessa@thecybersuite.com</a> and we'll action your request within 30 days as required by UK GDPR.
        </p>

        <div style={{ borderTop: "1px solid #222", paddingTop: 32, marginTop: 48, display: "flex", gap: 24, fontSize: 13, color: "#555" }}>
          <Link href="/privacy" style={{ color: "#555", textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ color: "#555", textDecoration: "none" }}>Terms</Link>
          <Link href="/data-deletion" style={{ color: "#ff2d78", textDecoration: "none" }}>Data Deletion</Link>
        </div>
      </div>
    </div>
  );
}
