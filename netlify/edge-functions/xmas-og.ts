// Link preview for the private Christmas shoot links (/izzyxmas, /vanessa2xmas): "Izzy's Xmas Shoot" with a picture that has the name on it.
// WhatsApp, Facebook and iMessage do not run the app, so the title and picture have to be in the page itself.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const res = await context.next();
  const url = new URL(request.url);
  const m = /^\/([a-z0-9]+xmas)\/?$/.exec(url.pathname);
  const type = res.headers.get("content-type") || "";
  if (!m || !type.includes("text/html")) return res;
  const slug = m[1];
  let first = "";
  try {
    const r = await fetch(`${url.origin}/api/xmasshoot/view/${slug}`);
    if (r.ok) first = (((await r.json()) as { name?: string }).name || "").trim().split(/\s+/)[0].replace(/[^\p{L}'’-]/gu, "");
  } catch { /* fall back to the link itself */ }
  if (!first) { const s = slug.replace(/xmas$/, "").replace(/\d+$/, ""); first = s ? s[0].toUpperCase() + s.slice(1) : "Your"; }
  const poss = first === "Your" ? "Your" : /s$/i.test(first) ? `${first}’` : `${first}’s`;
  const title = esc(`${poss} Xmas Shoot`);
  const desc = esc("Your ten Christmas images are ready. Tap to see and download them.");
  const img = `${url.origin}/api/xmasshoot/og/${slug}.jpg`;
  const tags = `<meta property="og:title" content="${title}" /><meta property="og:description" content="${desc}" /><meta property="og:type" content="website" /><meta property="og:url" content="${url.origin}${url.pathname}" /><meta property="og:image" content="${img}" /><meta property="og:image:type" content="image/jpeg" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${title}" /><meta name="twitter:description" content="${desc}" /><meta name="twitter:image" content="${img}" /><meta name="description" content="${desc}" />`;
  let html = await res.text();
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace(/<meta[^>]+(property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>/g, "").replace("</head>", `${tags}</head>`);
  return new Response(html, { status: res.status, headers: res.headers });
};
