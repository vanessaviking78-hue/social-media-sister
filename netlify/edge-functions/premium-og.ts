// Link previews (WhatsApp, Facebook, Instagram DMs, iMessage) do not run the app, so the share title and picture have to be in the page itself.
export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const res = await context.next();
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;
  const origin = new URL(request.url).origin;
  const title = "Premium social media for free";
  const desc = "Posts, stories and reel scripts made for your clinic, in the same designs my paying clients get.";
  const img = `${origin}/premium-og.png`;
  const tags = `<meta property="og:title" content="${title}" /><meta property="og:description" content="${desc}" /><meta property="og:type" content="website" /><meta property="og:url" content="${origin}/premiumfreebies" /><meta property="og:image" content="${img}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${title}" /><meta name="twitter:description" content="${desc}" /><meta name="twitter:image" content="${img}" /><meta name="description" content="${desc}" />`;
  let html = await res.text();
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace(/<meta[^>]+(property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>/g, "").replace("</head>", `${tags}</head>`);
  return new Response(html, { status: res.status, headers: res.headers });
};
