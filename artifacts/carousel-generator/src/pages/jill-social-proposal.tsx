// cybersuite.com/jillsocialproposal: Vanessa's proposal to Jill about selling a branded Cyber Suite to Yorkshire SMEs, three ways to work together.

const PINK = "#ff1f8e";
const INK = "#111";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;700;900&display=swap');
.jp, .jp * { font-family:'League Spartan',sans-serif; box-sizing:border-box; }
.jp { background:#fff; color:${INK}; min-height:100vh; }
.jp-w { max-width:820px; margin:0 auto; padding:0 22px 90px; }
.jp-top { display:flex; justify-content:space-between; gap:12px; padding:26px 0 8px; letter-spacing:.26em; font-size:12px; text-transform:uppercase; font-weight:900; }
.jp h1 { font-weight:900; text-transform:uppercase; font-size:clamp(46px,11vw,96px); line-height:.9; margin:26px 0 18px; letter-spacing:-.02em; }
.jp h1 span { color:${PINK}; display:block; }
.jp h2 { font-weight:900; text-transform:uppercase; font-size:clamp(24px,5vw,34px); line-height:1; margin:0 0 14px; }
.jp p, .jp li { font-size:18px; line-height:1.5; margin:0 0 14px; }
.jp-lead { font-size:clamp(19px,3.4vw,23px) !important; font-weight:700; max-width:640px; }
.jp-box { padding:30px 28px; margin:24px 0; }
.jp-ink { background:${INK}; color:${PINK}; }
.jp-ink p, .jp-ink li { color:${PINK}; }
.jp-pink { background:${PINK}; color:${INK}; }
.jp-big { font-weight:900; font-size:clamp(60px,14vw,120px) !important; line-height:.9 !important; margin:0 0 10px !important; }
.jp ul { padding-left:22px; margin:12px 0; }
.jp-h { border-top:3px solid ${INK}; padding-top:16px; margin-top:42px !important; }
.jp-tbl { width:100%; border-collapse:collapse; margin:16px 0; font-size:16px; }
.jp-tbl th, .jp-tbl td { border:3px solid ${INK}; padding:10px 12px; text-align:left; vertical-align:top; font-weight:700; }
.jp-tbl th { background:${INK}; color:${PINK}; font-weight:900; text-transform:uppercase; font-size:14px; letter-spacing:.06em; }
.jp-wrap { overflow-x:auto; }
.jp ol { list-style:none; counter-reset:q; padding:0; margin:12px 0; }
.jp ol li { counter-increment:q; padding:13px 0 13px 60px; position:relative; border-bottom:1px solid #e4e4e4; font-weight:700; }
.jp ol li::before { content:counter(q); position:absolute; left:0; top:6px; width:40px; height:40px; background:${INK}; color:${PINK}; font-weight:900; font-size:22px; display:flex; align-items:center; justify-content:center; }
.jp-foot { margin-top:46px; font-weight:900; font-size:13px; letter-spacing:.2em; text-transform:uppercase; }
`;

export default function JillSocialProposal() {
  return (
    <div className="jp">
      <style>{CSS}</style>
      <div className="jp-w">
        <div className="jp-top">
          <span>The Cyber Suite</span>
          <span>For Jill</span>
        </div>

        <h1>
          Three ways to work <span>with me</span>
        </h1>
        <p className="jp-lead">
          Jill, I have three ways to work with your clients, and every one of them ends with a business that has a social media presence it is proud of.
        </p>

        <h2 className="jp-h">Why I am offering this</h2>
        <p>
          I have spent seven years running social media for aesthetics clinics, I have been behind a camera for thirty, and I have worked with over 300 clinics across that time. You already hold the thing I cannot buy, which is the trust of hundreds of small and medium sized businesses. They know you, they take your calls, and many of them are quietly stuck on social media.
        </p>
        <p>
          I built a set of tools called The Cyber Suite so my own work never depends on anyone else. I can now build a branded version for a business, so Dale's Dairies would have Dale's Dairies, The Cyber Suite, with their name, their colours and their voice. I spend a day in their premises, I photograph the place and the people, and I set the whole thing up.
        </p>
        <p>
          What happens next depends on how much of the work the owner wants to hold. That is why there are three options below.
        </p>

        <div className="jp-box jp-ink">
          <h2>Option 1: Done For You</h2>
          <p className="jp-big">£12,000</p>
          <p><strong>for the year.</strong> The owner runs the business and I run the socials. I take the whole job off their desk for twelve months.</p>
          <ul>
            <li>A full day with me in the business, including a photo shoot of the premises, the team and the products</li>
            <li>Their own branded Cyber Suite, built and kept by me</li>
            <li>A year of posts, written in the owner's voice and scheduled in advance</li>
            <li>A refresh every quarter, so the content moves with the seasons and what is happening in their trade</li>
            <li>The first year's licence included</li>
          </ul>
          <p>This suits the owner who says "I know I should be doing it, I just never will." They sign off, I do the rest.</p>
        </div>

        <div className="jp-box jp-pink">
          <h2>Option 2: Own It</h2>
          <p className="jp-big">£5,000</p>
          <p><strong>then £2,400 a year.</strong> The business gets its own Cyber Suite and a member of staff who knows how to drive it.</p>
          <ul>
            <li>A full day with me in the business, building their branded suite</li>
            <li>A photo shoot of the premises, the team and the products, loaded into their library</li>
            <li>Training for one member of staff, with a written guide they can keep</li>
            <li>Thirty days of support after the day, so nobody is left stuck</li>
            <li>The first year's licence included, then £2,400 a year to keep the suite, updates and new templates</li>
          </ul>
          <p>This suits the owner with a keen member of staff who just needs the right tools and someone to show them how.</p>
        </div>

        <div className="jp-box jp-ink">
          <h2>Option 3: Half and Half</h2>
          <p className="jp-big">£8,500</p>
          <p><strong>for the year.</strong> I carry the load for the first six months while a member of their team learns alongside me, then I hand over the keys.</p>
          <ul>
            <li>A full day with me in the business, with the photo shoot and the branded suite</li>
            <li>Six months of posts written and scheduled by me</li>
            <li>Training for one member of staff, run in sessions across those six months so they are ready to take over</li>
            <li>A handover session at month six, with the content calendar and the suite in their hands</li>
            <li>The first year's licence included, then £2,400 a year</li>
          </ul>
          <p>This suits the owner who wants results now and independence later. It is the one I expect most of your clients to pick.</p>
        </div>

        <h2 className="jp-h">The three options side by side</h2>
        <div className="jp-wrap">
          <table className="jp-tbl">
            <thead>
              <tr>
                <th></th>
                <th>Done For You</th>
                <th>Own It</th>
                <th>Half and Half</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Investment</td><td>£12,000</td><td>£5,000</td><td>£8,500</td></tr>
              <tr><td>Year two licence</td><td>£2,400 a year</td><td>£2,400 a year</td><td>£2,400 a year</td></tr>
              <tr><td>Day in the business and photo shoot</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
              <tr><td>Branded Cyber Suite</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
              <tr><td>Content created by me</td><td>12 months</td><td>None</td><td>6 months</td></tr>
              <tr><td>Staff training</td><td>Not needed</td><td>Yes</td><td>Yes, during the six months</td></tr>
              <tr><td>Who runs it after the first year</td><td>Me</td><td>Their team</td><td>Their team</td></tr>
            </tbody>
          </table>
        </div>

        <div className="jp-box jp-pink">
          <h2>Your part and what happens next</h2>
          <p>
            You introduce the business, and I take it from there. You stay the person they trust, and I do the work. Your introduction fee on each sale is still to be agreed between us.
          </p>
          <ol>
            <li>You tell me which of your clients you would like to approach first</li>
            <li>We agree your introduction fee in writing</li>
            <li>You make the introduction and I speak to the owner about which option suits them</li>
            <li>I book my day in the business, and the suite is theirs by the end of it</li>
          </ol>
          <p>
            I am worth every penny of this, and so is their time. Tell me which clients you have in mind and I will get started.
          </p>
        </div>

        <div className="jp-foot">Social Media Sister, part of the Very Vanessa Media Group</div>
      </div>
    </div>
  );
}
