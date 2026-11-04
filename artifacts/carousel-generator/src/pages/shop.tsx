import { useEffect } from "react";
import { SHOP, SHOP_GROUPS, type ShopItem } from "@/lib/shop-config";

const PINK = "#ff1f8e";
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@900&display=swap');
.sh { background:#000; color:#fff; min-height:100vh; font-family:'League Spartan',sans-serif; font-weight:900; }
.sh * { box-sizing:border-box; font-family:inherit; }
.sh-w { max-width: 1000px; margin:0 auto; padding: 48px 20px 90px; }
.sh-k { color:${PINK}; letter-spacing:.3em; font-size:12px; text-transform:uppercase; }
.sh-h1 { font-size: clamp(40px,9vw,84px); line-height:.95; text-transform:uppercase; margin:10px 0 18px; }
.sh-h1 span { color:${PINK}; }
.sh-p { font-size: 19px; line-height:1.4; max-width: 640px; font-weight:700; color:#ddd; }
.sh-h2 { font-size: 22px; letter-spacing:.14em; text-transform:uppercase; color:${PINK}; margin: 46px 0 14px; }
.sh-g { display:grid; grid-template-columns: repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
.sh-c { background:#111; border:1px solid #2a2a2a; padding:22px; display:flex; flex-direction:column; gap:10px; text-decoration:none; color:#fff; position:relative; }
.sh-c:hover { border-color:${PINK}; }
.sh-n { font-size:24px; line-height:1.05; text-transform:uppercase; }
.sh-pr { font-size:30px; color:${PINK}; }
.sh-l { font-size:16px; line-height:1.4; font-weight:700; color:#bbb; flex:1; }
.sh-t { position:absolute; top:-10px; right:14px; background:${PINK}; font-size:11px; letter-spacing:.14em; text-transform:uppercase; padding:4px 10px; }
.sh-b { background:${PINK}; text-align:center; padding:12px; font-size:14px; letter-spacing:.16em; text-transform:uppercase; }
`;

export default function Shop() {
  useEffect(() => { document.title = "Shop | Social Media Sister"; }, []);
  const groups = Object.keys(SHOP_GROUPS) as ShopItem["group"][];
  return (
    <div className="sh"><style>{CSS}</style>
      <div className="sh-w">
        <div className="sh-k">Social Media Sister</div>
        <h1 className="sh-h1">Everything I make, <span>in one place</span></h1>
        <p className="sh-p">Posts, photos and tools for clinics that would rather be treating than posting. Start free, or jump straight in.</p>
        {groups.map((g) => {
          const items = SHOP.filter((i) => i.group === g && i.url);
          if (!items.length) return null;
          return (
            <section key={g}>
              <h2 className="sh-h2">{SHOP_GROUPS[g]}</h2>
              <div className="sh-g">
                {items.map((i) => (
                  <a key={i.name} className="sh-c" href={i.url}>
                    {i.tag && <span className="sh-t">{i.tag}</span>}
                    <div className="sh-n">{i.name}</div>
                    <div className="sh-pr">{i.price}</div>
                    <div className="sh-l">{i.line}</div>
                    <div className="sh-b">{i.price === "Free" ? "Get it free" : "Have a look"}</div>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
