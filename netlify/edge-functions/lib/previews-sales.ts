// Link previews for the sales partner pages. Kept apart from previews.ts because that file is rewritten by scripts/make-link-previews.py.
// Pictures are in artifacts/carousel-generator/public/og/<id>.png (yellow for Hammered, blue for Freehouse Socials, pink for Social Media Sister).
export const SALES_PREVIEWS: { id: string; paths: string[]; title: string; desc: string }[] = [
  { id: "hammeredproposal", paths: ["/hammeredproposal"], title: "Hammered sales partner proposal", desc: "What you earn, how it works and what to say. Sell Hammered to the trade and get paid the same day I do." },
  { id: "hammeredproposal18", paths: ["/hammeredproposal18"], title: "Hammered sales partner: the plain English version", desc: "The short, simple version of the Hammered proposal. What you do, what you earn, and how to start." },
  { id: "hammeredsales", paths: ["/hammeredsales"], title: "Hammered sales dashboard", desc: "Partner login. Log your leads and track your commission." },
  { id: "freehouseproposal", paths: ["/freehouseproposal"], title: "Freehouse Socials sales partner proposal", desc: "What you earn, how it works and what to say. Sell Freehouse Socials to pubs and bars and get paid the same day I do." },
  { id: "freehouseproposal18", paths: ["/freehouseproposal18"], title: "Freehouse Socials sales partner: the plain English version", desc: "The short, simple version of the Freehouse Socials proposal. What you do, what you earn, and how to start." },
  { id: "freehousesales", paths: ["/freehousesales"], title: "Freehouse Socials sales dashboard", desc: "Partner login. Log your leads and track your commission." },
  { id: "salesproposal", paths: ["/salesproposal"], title: "Social Media Sister sales partner proposal", desc: "What you earn, how it works and what to say. Bring in new clinics and earn 25% of every package." },
  { id: "salesdashboard", paths: ["/salesdashboard"], title: "Social Media Sister sales dashboard", desc: "Partner login. Log your leads and track your commission." },
];
