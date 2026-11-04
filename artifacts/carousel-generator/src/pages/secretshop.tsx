import { useEffect } from "react";
import { BRAND } from "@/config/brand";
import { SECRET, SECRET_GROUPS, type SecretItem } from "@/lib/secretshop-config";

const PINK = "#ff1f8e";
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
.sh { background:#fff; color:#000; min-height:100vh; font-family:'League Spartan',sans-serif; font-weight:900; }
.sh * { box-sizing:border-box; font-family:inherit; }
.sh-w { max-width: 1000px; margin:0 auto; padding: 48px 20px 90px; }
.sh-k { color:${PINK}; letter-spacing:.3em; font-size:12px; text-transform:uppercase; }
.sh-h1 { font-size: clamp(40px,9vw,84px); line-height:.95; text-transform:uppercase; margin:10px 0 18px; }
.sh-h1 span { color:${PINK}; }
.sh-p { font-size: 19px; line-height:1.4; max-width: 640px; font-weight:700; color:#222; }
.sh-h2 { font-size: 22px; letter-spacing:.14em; text-transform:uppercase; color:${PINK}; margin: 46px 0 14px; }
.sh-g { display:grid; grid-template-columns: repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
.sh-c { background:#fff; border:2px solid #000; padding:22px; display:flex; flex-direction:column; gap:10px; color:#000; position:relative; }
.sh-c.sold { opacity:.45; }
.sh-n { font-size:24px; line-height:1.05; text-transform:uppercase; }
.sh-pr { font-size:30px; color:${PINK}; }
.sh-was { font-size:16px; color:#777; text-decoration:line-through; margin-left:10px; }
.sh-l { font-size:16px; line-height:1.4; font-weight:700; color:#333; flex:1; }
.sh-t { color:#fff; position:absolute; top:-10px; right:14px; background:${PINK}; font-size:11px; letter-spacing:.14em; text-transform:uppercase; padding:4px 10px; }
.sh-b { background:${PINK}; color:#fff; text-align:center; padding:12px; font-size:14px; letter-spacing:.16em; text-transform:uppercase; text-decoration:none; display:block; }
.sh-b.alt { background:transparent; border:2px solid ${PINK}; color:#000; }
.sh-img { width:100%; aspect-ratio:4/3; object-fit:cover; display:block; }
`;

export default function SecretShop() {
  useEffect(() => {
    document.title = "Secret shop";
    const m = document.createElement("meta");
    m.name = "robots"; m.content = "noindex,nofollow";
    document.head.appendChild(m);
    return () => { m.remove(); };
  }, []);
  const thanks = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("thanks");
  const groups = Object.keys(SECRET_GROUPS) as SecretItem["group"][];
  return (
    <div className="sh"><style>{CSS}</style>
      <div className="sh-w">
        <div className="sh-k">Shh. You found it</div>
        <h1 className="sh-h1">The secret shop, <span>one of each</span></h1>
        {thanks && <p className="sh-p" style={{ color: PINK }}>Thank you, that is yours. I will be in touch very soon with your contract and next steps.</p>}
        <p className="sh-p">These are my lowest prices and there is only one of each. Once someone has bought it, it is gone for good.</p>
        {groups.map((g) => {
          const items = SECRET.filter((i) => i.group === g);
          if (!items.length) return null;
          return (
            <section key={g}>
              <h2 className="sh-h2">{SECRET_GROUPS[g]}</h2>
              <div className="sh-g">
                {items.map((i) => (
                  <div key={i.name} className={`sh-c${i.sold ? " sold" : ""}`}>
                    <span className="sh-t">{i.sold ? "Sold" : i.tag || "Only 1"}</span>
                    {i.image && <img className="sh-img" src={i.image} alt={i.name} />}
                    <div className="sh-n">{i.name}</div>
                    <div><span className="sh-pr">{i.price}</span><span className="sh-was">{i.was}</span></div>
                    <div className="sh-l">{i.line}{i.bullets && <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>{i.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}</div>
                    {!i.sold && <a className="sh-b" href={i.url}>Grab it</a>}
                    {!i.sold && i.alt && <a className="sh-b alt" href={i.alt.url}>{i.alt.label}: {i.alt.price} <span className="sh-was">{i.alt.was}</span></a>}
                    {!i.sold && i.bank && <a className="sh-b alt" href={`mailto:${BRAND.supportEmail}?subject=${encodeURIComponent("Full management, bank transfer")}&body=${encodeURIComponent("Hello Vanessa, I would like the 12 months for the price of 6 and would like to pay £3,000 by bank transfer. Please send me an invoice. My name, clinic and best phone number are: ")}`}>Prefer a bank transfer? Ask me for an invoice</a>}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
