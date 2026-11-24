// cybersuite.com/kirstyproposal: Vanessa's proposal to Kirsty about the £222 a month development rate for Kirsty's clinics, with £22 a month to Kirsty for each one that joins.

const PINK = "#ff1f8e";
const INK = "#111";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;700;900&display=swap');
.kp, .kp * { font-family:'League Spartan',sans-serif; box-sizing:border-box; }
.kp { background:#fff; color:${INK}; min-height:100vh; }
.kp-w { max-width:820px; margin:0 auto; padding:0 22px 90px; }
.kp-top { display:flex; justify-content:space-between; gap:12px; padding:26px 0 8px; letter-spacing:.26em; font-size:12px; text-transform:uppercase; font-weight:900; }
.kp h1 { font-weight:900; text-transform:uppercase; font-size:clamp(52px,12vw,104px); line-height:.9; margin:26px 0 18px; letter-spacing:-.02em; }
.kp h1 span { color:${PINK}; display:block; }
.kp h2 { font-weight:900; text-transform:uppercase; font-size:clamp(24px,5vw,34px); line-height:1; margin:0 0 14px; }
.kp p, .kp li { font-size:18px; line-height:1.5; margin:0 0 14px; }
.kp-lead { font-size:clamp(19px,3.4vw,23px) !important; font-weight:700; max-width:640px; }
.kp-box { padding:30px 28px; margin:24px 0; }
.kp-ink { background:${INK}; color:${PINK}; }
.kp-ink p, .kp-ink li { color:${PINK}; }
.kp-pink { background:${PINK}; color:${INK}; }
.kp-big { font-weight:900; font-size:clamp(60px,14vw,120px) !important; line-height:.9 !important; margin:0 0 10px !important; }
.kp-sum { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; margin-top:16px; }
.kp-sum div { border:3px solid ${INK}; padding:14px 16px; font-weight:700; background:#fff; }
.kp-sum b { display:block; font-weight:900; font-size:40px; line-height:1; color:${PINK}; }
.kp-h { border-top:3px solid ${INK}; padding-top:16px; margin-top:42px !important; }
.kp ol { list-style:none; counter-reset:q; padding:0; margin:12px 0; }
.kp ol li { counter-increment:q; padding:13px 0 13px 60px; position:relative; border-bottom:1px solid #e4e4e4; font-weight:700; }
.kp ol li::before { content:counter(q); position:absolute; left:0; top:6px; width:40px; height:40px; background:${INK}; color:${PINK}; font-weight:900; font-size:22px; display:flex; align-items:center; justify-content:center; }
.kp-foot { margin-top:46px; font-weight:900; font-size:13px; letter-spacing:.2em; text-transform:uppercase; }
`;

export default function KirstyProposal() {
  return (
    <div className="kp">
      <style>{CSS}</style>
      <div className="kp-w">
        <div className="kp-top">
          <span>A proposal for Kirsty</span>
          <span>From Vanessa</span>
        </div>

        <h1>
          The development <span>rate</span>
        </h1>
        <p className="kp-lead">
          An invitation for your clinics to work with me for £222 a month, for a whole year, with the price fixed. You introduce them, I look after the social side, and you earn from every clinic that joins.
        </p>

        <div className="kp-box kp-ink">
          <h2>What I am offering your clinics</h2>
          <p>
            Any clinic you send my way can apply for my development rate: <strong>£222 a month for twelve months, price fixed.</strong> It will not creep up halfway through the year and there are no surprise extras.
          </p>
          <p>
            My full price is <strong>£650 a month</strong>, so the development rate saves a clinic £428 a month, which is £5,136 across the year.
          </p>
          <p>
            I am Vanessa, the aesthetic angel, digital demon and compliance queen. Seven years in UK aesthetics, around 400 clinics worked with, and a very large pile of knowledge about what gets a clinic noticed and what gets it into bother with the ASA.
          </p>
        </div>

        <div className="kp-box kp-pink">
          <h2>What I am offering you</h2>
          <p className="kp-big">£22</p>
          <p>
            <strong>a month for every clinic that joins,</strong> for as long as they stay. It comes out of my fee, so it costs your clinics nothing extra.
          </p>
          <div className="kp-sum">
            <div><b>5</b>clinics = £110 a month</div>
            <div><b>10</b>clinics = £220 a month</div>
            <div><b>20</b>clinics = £440 a month</div>
          </div>
        </div>

        <div className="kp-box kp-ink">
          <h2>A voucher for West Yorkshire clinics</h2>
          <p>
            Any clinic in West Yorkshire gets <strong>50% off one of my in-person content days.</strong> The full price is £1,500. For Kirsty's clinics it is <strong>£750</strong>, and it can be taken at any time during the 12 months.
          </p>
        </div>

        <h2 className="kp-h">Why there is an application</h2>
        <p>
          I would rather work with fewer clinics who show up than lots who vanish. The development rate is a partnership, so every clinic fills in a short form first and then we have a proper chat. The form asks four things:
        </p>
        <ol>
          <li>Are you willing to do 8 reels a month?</li>
          <li>Will you take selfies?</li>
          <li>Can you commit to a one hour conversation with me every month?</li>
          <li>I will not tell you how to inject, so will you promise not to tell me how to do social? You are the mum, I am the babysitter.</li>
        </ol>

        <div className="kp-box kp-ink">
          <h2>How it works</h2>
          <p>1. You share my application link with your clinics.</p>
          <p>2. They fill in the form and I get an email the moment it lands.</p>
          <p>3. I read every application, then we arrange a chat to see if we are a good fit.</p>
          <p>4. They start on £222 a month, fixed for a year, and I let you know so your £22 starts straight away.</p>
        </div>

        <div className="kp-box kp-pink">
          <h2>The wording you can use</h2>
          <p>
            If you would like to apply for the development rate of £222 a month with me, the aesthetic angel, digital demon and compliance queen, fill this form in and let's talk.
          </p>
        </div>

        <div className="kp-foot">Very Vanessa Media Group &middot; Social Media Sister</div>
      </div>
    </div>
  );
}
