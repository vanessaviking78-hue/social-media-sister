// Link previews for the sales partner pages. Kept apart from previews.ts because that file is rewritten by scripts/make-link-previews.py.
// Pictures are in artifacts/carousel-generator/public/og/<id>.png (yellow for Hammered, blue for Freehouse Socials, pink for Social Media Sister).
export const SALES_PREVIEWS: { id: string; paths: string[]; title: string; desc: string }[] = [
  { id: "hammeredproposal", paths: ["/hammeredproposal"], title: "Hammered sales partner proposal", desc: "What you earn, how it works and what to say. Sell Hammered to the trade and get paid the same day I do." },
  { id: "hammeredproposal18", paths: ["/hammeredproposal18"], title: "Hammered sales partner: the plain English version", desc: "The short, simple version of the Hammered proposal. What you do, what you earn, and how to start." },
  { id: "hammeredblackfriday", paths: ["/hammeredblackfriday", "/blackfridayhammered"], title: "Hammered Black Friday", desc: "Four ways to get your socials sorted for the trade, at Black Friday prices. Live until the end of Monday 30 November." },
  { id: "hammeredsales", paths: ["/hammeredsales"], title: "Hammered sales dashboard", desc: "Partner login. Log your leads and track your commission." },
  { id: "freehouseproposal", paths: ["/freehouseproposal"], title: "Freehouse Socials sales partner proposal", desc: "What you earn, how it works and what to say. Sell Freehouse Socials to pubs and bars and get paid the same day I do." },
  { id: "freehouseproposal18", paths: ["/freehouseproposal18"], title: "Freehouse Socials sales partner: the plain English version", desc: "The short, simple version of the Freehouse Socials proposal. What you do, what you earn, and how to start." },
  { id: "freehousesales", paths: ["/freehousesales"], title: "Freehouse Socials sales dashboard", desc: "Partner login. Log your leads and track your commission." },
  { id: "salesproposal", paths: ["/salesproposal"], title: "Social Media Sister sales partner proposal", desc: "What you earn, how it works and what to say. Bring in new clinics and earn 25% of every package." },
  { id: "kirstyproposal", paths: ["/kirstyproposal"], title: "The AestheticShift Community: the development rate", desc: "£222 a month for your clinics, fixed for a year, and £22 a month for you on every clinic that joins." },
  { id: "smskirsty", paths: ["/smskirsty"], title: "The development rate: apply with Social Media Sister", desc: "£222 a month for a whole year, fixed price. By application only. Four quick questions and we talk." },
  { id: "salesdashboard", paths: ["/salesdashboard"], title: "Social Media Sister sales dashboard", desc: "Partner login. Log your leads and track your commission." },
];
