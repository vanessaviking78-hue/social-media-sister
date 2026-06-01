import { Link } from "wouter";

export default function Terms() {
  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "'League Spartan', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/sms-logo.png" alt="Social Media Sister" style={{ height: 44, width: 44, borderRadius: "50%", objectFit: "cover" }} />
            <span style={{ fontFamily: "'League Spartan', sans-serif", fontSize: 22, color: "#ff2d78", letterSpacing: 1 }}>The CyberSuite</span>
          </div>
          <Link href="/" style={{ color: "#aaa", fontSize: 13, textDecoration: "none", borderBottom: "1px solid #333", paddingBottom: 1 }}>
            Back to The CyberSuite
          </Link>
        </div>

        <h1 style={{ fontFamily: "'League Spartan', sans-serif", fontSize: 52, color: "#ff2d78", letterSpacing: 2, marginBottom: 8, lineHeight: 1 }}>Terms of Service</h1>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>Last updated: 27 May 2026</p>

        <p style={{ lineHeight: 1.8, marginBottom: 24, color: "#ccc" }}>
          These Terms of Service ("Terms") govern your use of The CyberSuite platform at thecybersuite.com (the "Service"), operated by Social Media Sister Limited ("we", "us", "our").
        </p>
        <p style={{ lineHeight: 1.8, marginBottom: 48, color: "#ccc" }}>
          By creating an account or using the Service, you agree to these Terms.
        </p>

        <Section title="1. The Service">
          <p>The CyberSuite is a content creation and social media management platform built specifically for aesthetic clinics in the United Kingdom. The Service allows you to connect Facebook, Instagram, Google Business Profile and TikTok accounts, create, schedule and publish content across those platforms, use AI tools for content generation and AI portrait generation, manage client approvals via private content portals, and bulk import content via CSV or Google Form integration.</p>
        </Section>

        <Section title="2. Your account">
          <p>To use the Service, you must be at least 18 years old, provide accurate and complete account information, keep your login credentials confidential, and notify us immediately of any unauthorised use of your account. You are responsible for all activity on your account.</p>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree NOT to use the Service to post content that is unlawful, defamatory, harassing, obscene, or infringes any third party's rights; make false or misleading claims about medical treatments or outcomes; violate the advertising standards of the ASA, CAP, MHRA, JCCP or any other regulator; impersonate any person or entity; spam, scrape, or otherwise abuse the platform; reverse-engineer, decompile, or attempt to derive source code; resell or sublicense the Service without written permission.</p>
          <br />
          <p>You also agree to comply with the terms of service of any third-party platform you connect (Meta, Google, TikTok). Violations of those platforms' rules may result in your social accounts being suspended by those platforms; we are not responsible for such actions.</p>
        </Section>

        <Section title="4. Content ownership and licence">
          <p>You own your content. All images, videos, captions and other materials you upload remain your property.</p>
          <br />
          <p>By uploading content, you grant us a limited, non-exclusive licence to store, process, transmit and publish that content as needed to deliver the Service.</p>
          <br />
          <p>AI-generated content using our AI features (AI Portrait Studio, Content Machine) is owned by you, subject to the underlying licence terms of the AI providers (OpenAI, Google Gemini). You're free to use such content commercially.</p>
          <br />
          <p>The CyberSuite software, design, branding and underlying systems are our intellectual property. You may not copy, modify, distribute or commercialise the platform itself.</p>
        </Section>

        <Section title="5. Compliance with industry standards">
          <p>You are responsible for ensuring all content you publish via the Service complies with applicable laws and regulations, including but not limited to the ASA UK Code, CAP Code, MHRA rules, JCCP standards, and Save Face standards where applicable.</p>
          <br />
          <p>While we provide compliance-aware templates and tooling, the final responsibility for content compliance rests with you as the practitioner or business owner.</p>
        </Section>

        <Section title="6. Payment and subscriptions">
          <p>Some features of the Service are offered on a paid subscription basis. By subscribing, you agree to pay all fees when due, provide accurate billing information, authorise recurring payments, and notify us of any billing disputes within 30 days.</p>
          <br />
          <p>Free trials automatically convert to paid subscriptions unless cancelled before the trial ends. Subscription fees are non-refundable except as required by UK consumer protection law. You may cancel your subscription at any time via your account settings; cancellation takes effect at the end of the current billing period.</p>
        </Section>

        <Section title="7. Third-party services">
          <p>The Service integrates with third-party platforms (Meta, Google, TikTok, OpenAI, etc). Your use of those platforms is subject to their own terms. We are not responsible for changes to those platforms' APIs that may affect the Service, suspension or removal of your accounts by those platforms, or outages or service interruptions on those platforms.</p>
        </Section>

        <Section title="8. Disclaimers">
          <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, EXCEPT AS REQUIRED BY UK LAW. We do not warrant that the Service will be uninterrupted, secure or error-free, that content published via the Service will achieve any specific results, or that AI-generated content will be free of errors, biases or inaccuracies.</p>
        </Section>

        <Section title="9. Limitation of liability">
          <p>To the maximum extent permitted by UK law, our total liability to you for any claim arising out of or relating to the Service shall not exceed the amount you paid us in the 12 months preceding the claim. We are not liable for indirect, incidental, consequential, special or punitive damages.</p>
          <br />
          <p>Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be limited under UK law.</p>
        </Section>

        <Section title="10. Indemnification">
          <p>You agree to indemnify and hold us harmless from any claim, loss or expense arising from your use of the Service in violation of these Terms, content you upload or publish via the Service, your violation of any third-party rights, or your violation of any applicable law or regulation.</p>
        </Section>

        <Section title="11. Termination">
          <p>We may suspend or terminate your account if you materially breach these Terms, fail to pay subscription fees when due, use the Service in a way that violates third-party terms or applicable law, or engage in conduct that may harm other users or our reputation.</p>
          <br />
          <p>You may close your account at any time via the account settings or by emailing <a href="mailto:vanessa@thecybersuite.com" style={{ color: "#ff2d78" }}>vanessa@thecybersuite.com</a>.</p>
          <br />
          <p>On termination, your access to the Service ends immediately, your connected social account tokens are revoked, and your content is retained per our Privacy Policy retention schedule, then deleted.</p>
        </Section>

        <Section title="12. Changes to the Service or Terms">
          <p>We may update or modify the Service from time to time. Where changes materially affect your use, we'll notify you in advance.</p>
          <br />
          <p>We may update these Terms by posting the revised version on our website and updating the "Last updated" date. Material changes will be notified to you by email. Continued use of the Service after changes constitutes acceptance.</p>
        </Section>

        <Section title="13. Governing law and jurisdiction">
          <p>These Terms are governed by the laws of England and Wales. Any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          <br />
          <p>If you are a consumer, this does not affect any mandatory consumer protection laws in your country of residence.</p>
        </Section>

        <Section title="14. Contact">
          <p>For any questions about these Terms:</p>
          <br />
          <p>Vanessa Wormald<br />Social Media Sister Limited<br /><a href="mailto:vanessa@thecybersuite.com" style={{ color: "#ff2d78" }}>vanessa@thecybersuite.com</a><br />thecybersuite.com</p>
        </Section>

        <PageFooter />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontFamily: "'League Spartan', sans-serif", fontSize: 26, color: "#ff2d78", letterSpacing: 1.5, marginBottom: 16 }}>{title}</h2>
      <div style={{ lineHeight: 1.8, color: "#ccc", fontSize: 15 }}>{children}</div>
    </div>
  );
}

function PageFooter() {
  return (
    <div style={{ borderTop: "1px solid #222", paddingTop: 32, marginTop: 48, display: "flex", gap: 24, fontSize: 13, color: "#555" }}>
      <Link href="/privacy" style={{ color: "#555", textDecoration: "none" }}>Privacy</Link>
      <Link href="/terms" style={{ color: "#ff2d78", textDecoration: "none" }}>Terms</Link>
      <Link href="/data-deletion" style={{ color: "#555", textDecoration: "none" }}>Data Deletion</Link>
    </div>
  );
}
