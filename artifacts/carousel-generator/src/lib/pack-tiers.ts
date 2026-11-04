import type { PackSize } from "./pack-plan";

// The three monthly packages on /getmyposts. The size is the number of designed posts, and Complete also gets stories and reel hooks.
export const PACK_TIERS: { size: PackSize; name: string; price: number; line: string; includes: string[]; extras: boolean }[] = [
  { size: 6, name: "Starter", price: 97, line: "A steady start", includes: ["6 designed posts", "Captions and hashtags written for you"], extras: false },
  { size: 12, name: "Growth", price: 167, line: "A fuller feed", includes: ["12 designed posts", "Captions and hashtags written for you"], extras: false },
  { size: 20, name: "Complete", price: 247, line: "The lot", includes: ["20 designed posts", "Captions and hashtags written for you", "20 matching stories", "20 reel hooks to film"], extras: true },
];

// Paste the checkout link for each package here (for example from Stan Store) and a Pay button appears once an order is sent.
// Left empty, the order comes to me to review and no payment is asked for.
export const PACK_CHECKOUT: Record<PackSize, string> = {
  6: "https://buy.stripe.com/5kQcN62zE8Ardhic603cc01",
  12: "https://buy.stripe.com/bJefZidei03V3GI3zu3cc02",
  20: "https://buy.stripe.com/dRmfZigqueYPa567PK3cc03",
};
