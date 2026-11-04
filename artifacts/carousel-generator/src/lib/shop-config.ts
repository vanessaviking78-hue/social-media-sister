// The shop at /shop. Anything with an empty link is left off the page until you paste its link in (Stan Store links go in `url`).
export type ShopItem = { name: string; price: string; line: string; url: string; tag?: string; group: "free" | "posts" | "photos" | "tools" | "help" };
export const SHOP: ShopItem[] = [
  { group: "free", name: "10 free posts", price: "Free", line: "Ten posts made with your own logo, colours and photo. One turn per clinic.", url: "/10freeposts", tag: "Start here" },
  { group: "free", name: "30 days of posts, planned", price: "Free", line: "A hook for every day, caption starters and a tick sheet.", url: "/landing" },
  { group: "free", name: "Book your brainstorm", price: "Free", line: "A friendly call with me to work out what your clinic should be posting.", url: "/freecall" },
  { group: "posts", name: "Women Over 50 bundle", price: "£24", line: "10 empowering posts in your clinic colours with your logo on, captions and hashtags ready. Download in minutes.", url: "/over50", tag: "Instant" },
  { group: "posts", name: "Starter: 6 posts a month", price: "£97", line: "6 designed posts with captions and hashtags, made for your clinic.", url: "/getmyposts" },
  { group: "posts", name: "Growth: 12 posts a month", price: "£167", line: "12 designed posts with captions and hashtags.", url: "/getmyposts", tag: "Popular" },
  { group: "posts", name: "Complete: 20 posts a month", price: "£247", line: "20 posts, 20 matching stories and 20 reel hooks to film.", url: "/getmyposts" },
  { group: "photos", name: "AI Photo Studio", price: "£149", line: "20 images of you: 10 in scrubs, 5 lifestyle, 5 seasonal. In my group? Use the code GROUP for £49 (first 20 only).", url: "/photoshoot", tag: "New" },
  { group: "tools", name: "The Daily Five", price: "£7 a month", line: "Five tiny social media jobs a day, a tick list, and confetti when you finish.", url: "/dailytasks" },
  // Stan Store items: paste each product link into `url` and it appears.
  { group: "tools", name: "The Clinic Content Hub", price: "£39", line: "", url: "" },
  { group: "tools", name: "100 Business Lessons", price: "£19", line: "", url: "" },
  { group: "help", name: "Instagram audit and competitor report", price: "£49", line: "", url: "" },
];
export const SHOP_GROUPS: Record<ShopItem["group"], string> = { free: "Start free", posts: "Posts, done for you", photos: "Photos", tools: "Tools and downloads", help: "Work with me" };
