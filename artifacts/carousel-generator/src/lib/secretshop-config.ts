// The secret shop at /secretshop. Same as /shop at secret prices, each one available to ONE buyer only.
// Every link below is a Stripe Payment Link limited to 1 payment, so once someone buys it Stripe closes it.
// When an item has sold, set sold: true so the page shows SOLD. Add a graphic with image: "/secret/name.jpg" (file in public/secret).
export type SecretItem = { name: string; was: string; price: string; line: string; url: string; group: "posts" | "photos"; alt?: { label: string; price: string; was: string; url: string }; sold?: boolean; image?: string; tag?: string };
export const SECRET: SecretItem[] = [
  { group: "posts", name: "Women Over 50 bundle", was: "£24", price: "£15", line: "10 empowering posts in your clinic colours with your logo on, captions and hashtags ready.", url: "https://buy.stripe.com/6oU5kE2zE17Zdhiee83cc09" },
  { group: "posts", name: "Starter: 6 posts a month", was: "£97 a month", price: "£67 a month", line: "6 designed posts with captions and hashtags, made for your clinic.", url: "https://buy.stripe.com/9B6dRagqu17Z1yA1rm3cc0b", alt: { label: "Or pay once", price: "£79", was: "£127", url: "https://buy.stripe.com/28E3cw8Y2bMD912da43cc0c" } },
  { group: "posts", name: "Growth: 12 posts a month", was: "£167 a month", price: "£127 a month", line: "12 designed posts with captions and hashtags.", url: "https://buy.stripe.com/4gM28s0rw2c35OQ3zu3cc0d", alt: { label: "Or pay once", price: "£159", was: "£217", url: "https://buy.stripe.com/dRm4gAcae03Va566LG3cc0e" } },
  { group: "posts", name: "Complete: 20 posts a month", was: "£247 a month", price: "£185 a month", line: "20 posts, 20 matching stories and 20 reel hooks to film.", url: "https://buy.stripe.com/cNi4gA2zE03Vfpqgmg3cc0f", alt: { label: "Or pay once", price: "£200", was: "£317", url: "https://buy.stripe.com/eVqfZi5LQ8Arcde9XS3cc0g" } },
  { group: "photos", name: "AI Photo Studio", was: "£149", price: "£30", line: "20 images of you: 10 in scrubs, 5 lifestyle, 5 seasonal.", url: "https://buy.stripe.com/dRm28s7TY17Zfpq3zu3cc0a" },
];
export const SECRET_GROUPS = { posts: "Posts, done for you", photos: "Photos" } as const;
