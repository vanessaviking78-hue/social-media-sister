// Link previews (WhatsApp, Instagram DMs, iMessage) do not run the app, so the share title and picture have to be in the page itself.
export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const res = await context.next();
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;
  const origin = new URL(request.url).origin;
  const title = "Your freebies are here";
  const desc = "Tap to open your 10 free posts, stories and reel hooks.";
  const tags = `<meta property="og:title" content="${title}" /><meta property="og:description" content="${desc}" /><meta property="og:type" content="website" /><meta property="og:image" content="${origin}/10free-og.png" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${title}" /><meta name="twitter:image" content="${origin}/10free-og.png" /><meta name="description" content="${desc}" />`;
  let html = await res.text();
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace("</head>", `${tags}</head>`);
  return new Response(html, { status: res.status, headers: res.headers });
};
