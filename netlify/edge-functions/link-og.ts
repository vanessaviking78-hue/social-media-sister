import { PREVIEWS } from "./lib/previews.ts";
import { SALES_PREVIEWS } from "./lib/previews-sales.ts";

// Link previews (WhatsApp, Facebook, Instagram DMs, iMessage) do not run the app, so each link's own title and picture have to be in the page itself.
const match = (path: string, pattern: string) =>
  pattern.endsWith("/*") ? path.startsWith(pattern.slice(0, -1)) : path === pattern || path === pattern + "/";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const res = await context.next();
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;
  const url = new URL(request.url);
  const p = [...PREVIEWS, ...SALES_PREVIEWS].find((x) => x.paths.some((pat) => match(url.pathname, pat)));
  if (!p) return res;
  const title = esc(p.title);
  const desc = esc(p.desc);
  const img = `${url.origin}/og/${p.id}.png`;
  const tags = `<meta property="og:title" content="${title}" /><meta property="og:description" content="${desc}" /><meta property="og:type" content="website" /><meta property="og:url" content="${url.origin}${url.pathname}" /><meta property="og:image" content="${img}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${title}" /><meta name="twitter:description" content="${desc}" /><meta name="twitter:image" content="${img}" /><meta name="description" content="${desc}" />`;
  let html = await res.text();
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace(/<meta[^>]+(property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>/g, "").replace("</head>", `${tags}</head>`);
  return new Response(html, { status: res.status, headers: res.headers });
};
