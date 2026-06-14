import { Link } from "wouter";

export default function Privacy() {
  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "'League Spartan', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/sms-logo.png" alt="Social Media Sister" style={{ height: 32, width: "auto", objectFit: "contain" }} />
            <span style={{ fontFamily: "'League Spartan', sans-serif", fontSize: 22, color: "#ff2d78", letterSpacing: 1 }}>The CyberSuite</span>
          </div>
          <Link href="/" style={{ color: "#aaa", fontSize: 13, textDecoration: "none", borderBottom: "1px solid #333", paddingBottom: 1 }}>
            Back to The CyberSuite
          </Link>
        </div>

        <h1 style={{ fontFamily: "'League Spartan', sans-serif", fontSize: 52, color: "#ff2d78", letterSpacing: 2, marginBottom: 8, lineHeight: 1 }}>Privacy Policy</h1>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 48 }}>Last updated: 27 May 2026</p>

        <p style={{ lineHeight: 1.8, marginBottom: 24 }}>
          This privacy policy explains how Social Media Sister Limited ("we", "us", "our") collects, uses, stores and protects your personal data when you use The CyberSuite platform at thecybersuite.com.
        </p>
        <p style={{ lineHeight: 1.8, marginBottom: 48 }}>
          We are committed to handling your data lawfully, fairly and transparently in line with UK GDPR and the Data Protection Act 2018.
        </p>

        <Section title="1. Who we are">
          <p>The CyberSuite is owned and operated by:</p>
          <br />
          <p>Social Media Sister Limited<br />Owner and Data Controller: Vanessa Wormald<br />Contact: <a href="mailto:vanessa@thecybersuite.com" style={{ color: "#ff2d78" }}>vanessa@thecybersuite.com</a><br />Website: thecybersuite.com</p>
          <br />
          <p>If you have any questions about this policy or how your data is used, contact us at the email above.</p>
        </Section>

        <Section title="2. What data we collect">
          <p>We collect and process the following types of personal data:</p>
          <br />
          <p><strong style={{ color: "#fff" }}>Account information:</strong> Name, email address, business/clinic name, phone number (if provided), billing address (if subscribed to paid features).</p>
          <br />
          <p><strong style={{ color: "#fff" }}>Social media account data:</strong> When you connect your Facebook, Instagram, Google Business Profile, or TikTok account to The CyberSuite, we receive and store Page Access Tokens (encrypted), Page IDs and account IDs, profile information available via the platform's API, and audience insights (anonymised follower activity, demographic ranges).</p>
          <br />
          <p><strong style={{ color: "#fff" }}>Content data:</strong> Images, videos, and text you upload to the platform, captions, hashtags, post settings, scheduled post times and metadata, generated AI portrait outputs.</p>
          <br />
          <p><strong style={{ color: "#fff" }}>Usage data:</strong> Pages viewed, features used, login times, IP address, browser type, device type, cookies (see Cookies section below).</p>
          <br />
          <p><strong style={{ color: "#fff" }}>Communications:</strong> Messages you send us via email, DM or the platform, records of customer support interactions.</p>
        </Section>

        <Section title="3. How we use your data">
          <p>We use your data only for specific, lawful purposes: to deliver the service (schedule and publish content, generate AI portraits, store your content library, manage your client portal), to improve the service (analyse usage patterns, identify bugs, develop new features), to communicate with you (service-related updates, support responses, billing information), and to meet legal obligations.</p>
          <br />
          <p>We do NOT sell your data. We do NOT share it with advertisers. We do NOT use it for marketing other products to you without your explicit consent.</p>
        </Section>

        <Section title="4. Legal basis for processing (UK GDPR Article 6)">
          <p>We process your personal data under: contract performance (we need your data to deliver the service you've signed up for), legitimate interest (improving our platform, preventing fraud, debugging errors), consent (where you've explicitly opted in to marketing communications or optional features), and legal obligation (complying with tax, accounting and regulatory requirements).</p>
        </Section>

        <Section title="5. Who we share your data with">
          <p>We share your data only with the following third parties, and only as needed to deliver the service: Meta Platforms Inc. (Facebook, Instagram), Google LLC, TikTok Ltd, OpenAI, Google Cloud (via Gemini API), Cloudflare, Replit/Railway, Resend, Stripe. We have data processing agreements with each of these vendors confirming GDPR compliance.</p>
        </Section>

        <Section title="6. How long we keep your data">
          <p>Account data: while your account is active, plus 7 years after closure for tax and accounting purposes. Content data: while your account is active, deleted within 30 days of account closure unless you request earlier deletion. Tokens: revoked immediately on account closure or disconnect request. Usage logs: 12 months. Support communications: 3 years.</p>
        </Section>

        <Section title="7. Your rights under UK GDPR">
          <p>You have the right to access, rectify, erase ("right to be forgotten"), restrict, object to processing, port your data in a machine-readable format, and withdraw consent at any time.</p>
          <br />
          <p>To exercise any of these rights, email <a href="mailto:vanessa@thecybersuite.com" style={{ color: "#ff2d78" }}>vanessa@thecybersuite.com</a>. We will respond within one month. You also have the right to lodge a complaint with the UK Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: "#ff2d78" }}>ico.org.uk</a>.</p>
        </Section>

        <Section title="8. Cookies">
          <p>We use a small number of essential cookies to operate the platform: session cookies (keep you logged in), preference cookies (remember your settings), analytics cookies (anonymous, help us improve the platform). We do NOT use advertising cookies or third-party tracking cookies.</p>
        </Section>

        <Section title="9. International data transfers">
          <p>Some of our service providers (e.g. OpenAI, Google, Meta) are based in the United States or other regions outside the UK and EU. We rely on UK Adequacy Decisions where applicable, Standard Contractual Clauses (SCCs) where required, and vendor self-certification under recognised frameworks.</p>
        </Section>

        <Section title="10. Security">
          <p>All connections to The CyberSuite use HTTPS encryption. Access tokens stored using industry-standard encryption at rest. Strict access controls limiting who can view your data. Regular security reviews. No password is ever stored in plain text. If a data breach occurs that's likely to affect your rights, we will notify you within 72 hours as required by UK GDPR.</p>
        </Section>

        <Section title="11. Children's data">
          <p>The CyberSuite is not directed at, and does not knowingly collect data from, anyone under the age of 16.</p>
        </Section>

        <Section title="12. Changes to this policy">
          <p>We may update this policy from time to time. When we make material changes, we'll notify you by email and update the "Last updated" date at the top of this page.</p>
        </Section>

        <Section title="13. Contact us">
          <p>Vanessa Wormald<br /><a href="mailto:vanessa@thecybersuite.com" style={{ color: "#ff2d78" }}>vanessa@thecybersuite.com</a><br />thecybersuite.com</p>
          <br />
          <p>If we can't resolve your concern, you can also contact the UK Information Commissioner's Office: <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: "#ff2d78" }}>ico.org.uk</a>.</p>
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
      <Link href="/privacy" style={{ color: "#ff2d78", textDecoration: "none" }}>Privacy</Link>
      <Link href="/terms" style={{ color: "#555", textDecoration: "none" }}>Terms</Link>
      <Link href="/data-deletion" style={{ color: "#555", textDecoration: "none" }}>Data Deletion</Link>
    </div>
  );
}
