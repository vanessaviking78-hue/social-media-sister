import { Link } from "wouter";
import { Beer } from "lucide-react";
import { usePresets } from "@/lib/use-presets";

// cybersuite.com/smashed : the home of Smashed Socials, her social media business for pubs and bars. Black and electric blue.
// Tools get added to TILES as they are built. Live today: the free sample page for new pubs and bars.

const BLUE = "#00b4ff";

const TILES: { href: string; name: string; description: string; live: boolean }[] = [
  {
    href: "/smashedposts",
    name: "Make posts",
    description: "3 slide carousels on a full bleed real photo: the hook, the body and a cheeky closing line. 30 pub hooks ready to go.",
    live: true,
  },
  {
    href: "/smashedlinks",
    name: "Links",
    description: "A tracking link each for Rob, Isaac and Vanessa. See who has opened, started and finished the free sample form.",
    live: true,
  },
  {
    href: "/smashedperformance",
    name: "What is working",
    description: "Every published post with its likes, comments, saves, shares and reach. The best performers are flagged so you know what to make more of.",
    live: true,
  },
  {
    href: "/smashedfreebies",
    name: "Free sample",
    description: "The page a pub or bar fills in for their free 5 day trial: logo, colours, fonts, what's on each week.",
    live: true,
  },
];

export default function SmashedHome() {
  // The Smashed icon opens the client page for the preset named Smashed (same page every client preset gets).
  const { presets, loading } = usePresets();
  const preset = presets.find((p) => /smashed/i.test(p.name));
  return (
    <div className="hm">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
        .hm, .hm * { box-sizing: border-box; font-family: 'League Spartan', 'Impact', 'Arial Black', sans-serif; font-weight: 900; }
        .hm { position: fixed; inset: 0; overflow-y: auto; background: #000; color: #fff; padding: 4vh 5vw 6vh; }
        .hm .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4vh; }
        .hm .top a { color: #000; background: ${BLUE}; text-decoration: none; text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; padding: 9px 16px; }
        .hm .top a:hover { background: #fff; }
        .hm h1 { margin: 0; text-transform: uppercase; letter-spacing: -0.03em; line-height: 0.8; font-size: min(11vw, 24vh); color: ${BLUE}; }
        .hm .stripe { height: min(2vw, 2.4vh); margin: 3vh 0; background: repeating-linear-gradient(-45deg, ${BLUE} 0 28px, #000 28px 56px); border: 3px solid ${BLUE}; }
        .hm .tag { font-size: clamp(16px, 2.2vw, 28px); letter-spacing: 0.06em; text-transform: uppercase; max-width: 780px; line-height: 1.15; }
        .hm .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 5vh; }
        .hm .tile { display: block; text-decoration: none; color: #000; background: ${BLUE}; padding: 28px; transition: transform 150ms; }
        .hm .tile:hover { transform: translateY(-3px); background: #fff; }
        .hm .tile h3 { margin: 0 0 10px; font-size: 30px; text-transform: uppercase; letter-spacing: -0.01em; }
        .hm .tile p { margin: 0; font-size: 16px; line-height: 1.3; }
        .hm .tile.icon { display: flex; flex-direction: column; align-items: flex-start; }
        .hm .ico { display: flex; align-items: center; justify-content: center; width: 84px; height: 84px; background: #000; color: ${BLUE}; margin-bottom: 18px; }
        .hm .tile.icon:hover .ico { background: ${BLUE}; color: #000; }
        .hm .soon { border: 3px dashed ${BLUE}; color: ${BLUE}; padding: 28px; text-transform: uppercase; letter-spacing: 0.14em; font-size: 14px; display: flex; align-items: center; }
      `}</style>
      <div className="top">
        <Link href="/choose">Switch business</Link>
        <Link href="/hub">Social Media Sister hub</Link>
      </div>
      <h1>Smashed Socials</h1>
      <div className="stripe" />
      <div className="tag">Real pubs, real photos, posting like they mean it.</div>
      <div className="grid">
        {preset ? (
          <Link href={`/client/${preset.id}`} className="tile icon">
            <span className="ico"><Beer size={46} strokeWidth={2.6} /></span>
            <h3>Smashed Socials</h3>
            <p>Open the Smashed Socials tools and posts.</p>
          </Link>
        ) : (
          <div className="soon">{loading ? "Loading Smashed Socials..." : "I cannot find a preset called Smashed Socials"}</div>
        )}
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className="tile">
            <h3>{t.name}</h3>
            <p>{t.description}</p>
          </Link>
        ))}
        <div className="soon">More Smashed Socials tools land here</div>
      </div>
    </div>
  );
}
