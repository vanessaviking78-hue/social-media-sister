// Link previews (WhatsApp, Facebook, Instagram DMs, iMessage) do not run the app, so the share title and description have to be in the page itself.
// No share picture yet: add og:image here once the Smashed Socials logo and artwork are supplied.
export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const res = await context.next();
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;
  const origin = new URL(request.url).origin;
  const title = "Smashed Socials: free social media posts for pubs and bars";
  const desc = "Try 5 days of posts, stories and reel scripts made from your own pub and real photos. Show people why your place is the best seat in town.";
  const tags = `<meta property="og:title" content="${title}" /><meta property="og:description" content="${desc}" /><meta property="og:type" content="website" /><meta property="og:url" content="${origin}/smashedfreebies" /><meta name="twitter:card" content="summary" /><meta name="twitter:title" content="${title}" /><meta name="twitter:description" content="${desc}" /><meta name="description" content="${desc}" />`;
  let html = await res.text();
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace(/<meta[^>]+(property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>/g, "").replace("</head>", `${tags}</head>`);
  return new Response(html, { status: res.status, headers: res.headers });
};
