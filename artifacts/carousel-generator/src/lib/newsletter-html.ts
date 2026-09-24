import { isLight, parseHex, readableAccent, type NewsletterBrand, type NewsletterContent } from "./newsletter-pdf";

// Email-safe HTML: tables, inline styles, 600px wide, no scripts, no web
// fonts. Pastes straight into Mailchimp, Klaviyo, Flodesk or similar as a
// custom HTML block. Images must be hosted URLs, email clients block data URIs.

const esc = (s: string) =>
  (s || "")
    .replace(/[—–]/g, ", ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const hex = (rgb: [number, number, number]) => "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");

function paras(body: string, color: string, size = 15) {
  return (body || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px 0;font-family:Helvetica,Arial,sans-serif;font-size:${size}px;line-height:1.6;color:${color};">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function buildNewsletterHtml(
  content: NewsletterContent,
  brand: Omit<NewsletterBrand, "logoDataUrl" | "heroDataUrl" | "closing"> & {
    logoUrl: string | null;
    heroUrl: string | null;
    closing?: { thanks: string; name: string; photoUrl: string | null; signatureUrl: string | null } | null;
  },
  subject: string,
  preview: string,
) {
  const accentRaw = parseHex(brand.accent);
  const accent = hex(readableAccent(accentRaw));
  const accentFill = hex(accentRaw);
  const soft = hex(accentRaw.map((c) => Math.round(c + (255 - c) * (isLight(accentRaw) ? 0.5 : 0.88))) as [number, number, number]);
  const onAccent = isLight(accentRaw) ? "#1c1c1e" : "#ffffff";
  const btnFill = isLight(accentRaw) ? "#1c1c1e" : "#ffffff";
  const btnText = isLight(accentRaw) ? "#ffffff" : accent;
  const get = (s: string) => content.sections.find((x) => x.slot === s);
  const label = (t: string, c = accent) =>
    `<p style="margin:0 0 6px 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:${c};">${esc(t)}</p>`;
  const h = (t: string, size: number, c = "#1c1c1e") =>
    `<h2 style="margin:0 0 10px 0;font-family:Georgia,'Times New Roman',serif;font-size:${size}px;line-height:1.2;color:${c};font-weight:bold;">${esc(t)}</h2>`;

  const lead = get("lead"), ask = get("ask"), myth = get("myth"), bts = get("bts"), sell = get("sell");
  const cardBg = hex(accentRaw.map((c) => Math.round(c + (255 - c) * (isLight(accentRaw) ? 0.6 : 0.92))) as [number, number, number]);
  const ps = (content.signOff || "").trim().replace(/^p\.?s\.?\s*/i, "");

  function closingHtml() {
    const c = brand.closing;
    if (!c || !(c.thanks || c.photoUrl || c.signatureUrl || c.name)) {
      return content.signOff
        ? `<tr><td style="padding:18px 32px 26px 32px;"><p style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;color:#444;">${esc(content.signOff)}</p><p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:${accent};">${esc(brand.clinicName)}</p></td></tr>`
        : "";
    }
    const sig = c.signatureUrl
      ? `<img src="${esc(c.signatureUrl)}" alt="${esc(c.name)}" height="52" style="height:52px;width:auto;display:block;margin-left:-4px;">`
      : `<p style="margin:0;font-family:'Caveat','Segoe Script','Bradley Hand',cursive;font-size:34px;color:${accent};">${esc(c.name || brand.clinicName)}</p>`;
    return `<tr><td style="padding:18px 32px 6px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${cardBg};border-radius:8px;"><tr>
${c.photoUrl ? `<td width="130" valign="middle" style="padding:20px 0 20px 22px;"><img src="${esc(c.photoUrl)}" alt="${esc(c.name)}" width="110" height="110" style="width:110px;height:110px;border-radius:55px;display:block;border:3px solid #ffffff;"></td>` : ""}
<td valign="middle" style="padding:20px 22px;">
${c.thanks ? `<p style="margin:0 0 8px 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:21px;line-height:1.3;color:#1c1c1e;">${esc(c.thanks)}</p>` : ""}
<p style="margin:0 0 2px 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:14px;color:#666;">With love,</p>
${sig}
</td></tr></table></td></tr>
${ps ? `<tr><td style="padding:14px 32px 24px 32px;"><p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;line-height:1.5;color:#444;">P.S. ${esc(ps)}</p></td></tr>` : `<tr><td style="padding:0 0 18px 0;"></td></tr>`}`;
  }

  return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ee;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="padding:22px 32px 0 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="left" valign="middle">${brand.logoUrl ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.clinicName)}" style="max-width:130px;max-height:44px;height:auto;display:block;">` : `<span style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#777;">${esc(brand.clinicName)}</span>`}</td>
<td align="right" valign="middle"><span style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#777;">${esc(brand.monthLabel)}</span></td>
</tr></table></td></tr>
<tr><td align="center" style="padding:14px 24px 0 24px;"><h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:bold;font-size:46px;line-height:1.02;letter-spacing:-1px;color:${accent};">${esc(brand.newsletterName)}</h1></td></tr>
<tr><td style="padding:12px 32px 0 32px;"><div style="border-top:4px solid ${accentFill};"></div><div style="border-top:1px solid ${accentFill};margin-top:4px;"></div></td></tr>
<tr><td align="center" style="padding:10px 32px 0 32px;"><p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:15px;color:#666;">A letter from ${esc(brand.clinicName)}</p></td></tr>
${brand.heroUrl ? `<tr><td style="padding:22px 32px 0 32px;"><img src="${esc(brand.heroUrl)}" alt="" width="536" style="width:100%;height:auto;display:block;border-radius:6px;"></td></tr>` : ""}
${content.intro ? `<tr><td align="center" style="padding:22px 48px 4px 48px;"><p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:18px;line-height:1.5;color:#444;">${esc(content.intro)}</p></td></tr>` : ""}
${lead ? `<tr><td style="padding:24px 32px 4px 32px;">${label(lead.label)}${h(lead.heading, 28)}${paras(lead.body, "#464646")}</td></tr>` : ""}
${ask || myth ? `<tr><td style="padding:10px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${ask ? `<td valign="top" width="50%" style="padding:6px;"><div style="background:${soft};border-radius:6px;padding:18px;">${label(ask.label)}${h(ask.heading, 20)}${paras(ask.body, "#464646", 14)}</div></td>` : ""}
${myth ? `<td valign="top" width="50%" style="padding:6px;"><div style="background:${soft};border-radius:6px;padding:18px;">${label(myth.label)}${h(myth.heading, 20)}${paras(myth.body, "#464646", 14)}</div></td>` : ""}
</tr></table></td></tr>` : ""}
${bts ? `<tr><td style="padding:18px 32px 4px 32px;">${label(bts.label)}${h(bts.heading, 22)}${paras(bts.body, "#464646")}</td></tr>` : ""}
${sell ? `<tr><td style="padding:14px 32px 8px 32px;"><div style="background:${accentFill};border-radius:8px;padding:26px;">
${label(sell.label, onAccent)}${h(sell.heading, 22, onAccent)}${paras(sell.body, onAccent)}
${brand.bookingUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr><td style="background:${btnFill};border-radius:30px;"><a href="${esc(brand.bookingUrl)}" style="display:inline-block;padding:13px 28px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:${btnText};text-decoration:none;">${esc(content.ctaText || "Book your consultation")}</a></td></tr></table>` : ""}
</div></td></tr>` : ""}
${closingHtml()}
<tr><td style="padding:18px 32px 26px 32px;border-top:1px solid #eee;">
<p style="margin:0 0 6px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#999;">${esc([brand.clinicName, brand.address].filter(Boolean).join(" | "))}</p>
<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#999;">You're receiving this because you're a patient of ours and asked to hear from us. <a href="*|UNSUB|*" style="color:#999;">Unsubscribe</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}
