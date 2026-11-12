// /salesproposal : the Social Media Sister sales partner proposal, public so it can be sent as a link.
const PINK = "#ff1f8e";

const deal: Array<[string, string]> = [
  ["Your role", "Sales Partner for Social Media Sister"],
  ["What you earn", "25% of the package value, paid once at sign up"],
  ["What you sell", "Black Friday packages: 6 months for the price of 4, or 12 months for the price of 6"],
  ["Your hours", "As many or as few as you like. You choose when you work"],
  ["Where you find people", "My Instagram, @social_media_sister, or people you know yourself: your own contacts, groups you are in, Facebook groups and so on"],
  ["Your trial tool", "A bundle of freebies made for each clinic, then a follow up"],
  ["Tracking", "One dashboard where I can see who brought in what"],
];

const earn = [
  ["6 months (price of 4)", "£2,000", "£500", "£1,400", "£350"],
  ["12 months (price of 6)", "£3,000", "£750", "£2,100", "£525"],
];

const steps = [
  { t: "Spot them.", d: "Look for clinic owners, injectors and practitioners who follow, like or comment on my Instagram, @social_media_sister, or who message me." },
  { t: "Get chatting.", d: "Send a friendly message that asks about them and their clinic. Questions first, selling later." },
  { t: "Send the freebies.", d: "Share the link to the freebies bundle, www.thecybersuite.com/premiumfreebies. They fill in a short form and receive a set of posts, stories and reel ideas made for their clinic. This is their trial, and it does the persuading for you." },
  { t: "Follow up.", d: "Two days later, ask what they thought and which post they liked best. When they are keen, introduce the Black Friday packages. If they would like to hear from me, they can book a free call at www.thecybersuite.com/freecall." },
  { t: "Sign up.", d: "They choose a package. I send the contract and payment details, you log it on the dashboard, and your 25% is earned." },
];

const say: Array<[string, string]> = [
  ["New follower or commenter", "Hi [name], thank you for following. Your clinic looks lovely. What is the trickiest part of social media for you right now?"],
  ["Offering the freebies", "I work with Vanessa at Social Media Sister. She makes clinics a free bundle of posts so you can see her style on your own page before deciding anything. Shall I send you the link? It takes two minutes."],
  ["Two days later", "Hi [name], did your freebies arrive? Which post was your favourite? I would love to know."],
  ["Introducing the packages", "Vanessa has a Black Friday deal on at the moment: 6 months for the price of 4, or 12 months for the price of 6. Would you like the details, or a quick chat with Vanessa first?"],
];

const golden = [
  "Ask before you tell. People love talking about their own clinic.",
  "Keep the first message short and warm.",
  "Mention prices only after they have seen their freebies.",
  "If someone says no thank you, say thank you back. They may well return in spring.",
];

const gives = [
  "Your freebies link, ready to send",
  "A one page guide to the Black Friday packages, with the exact prices",
  "The message examples above, plus answers to the questions clinics ask most (price, contracts, what they get)",
  "A free call with me for any warm lead who wants to hear it from the horse's mouth",
  "A 20 minute start up call with me, so you feel confident before your first chat",
  "Your own line on the sales dashboard",
];

const columns: Array<[string, string]> = [
  ["Partner", "Your name"],
  ["Lead", "Their name and clinic"],
  ["Date", "The day you first chatted"],
  ["Stage", "Chatting, Freebies sent, Followed up, Call booked, Signed"],
  ["Package", "6 month or 12 month"],
  ["Commission due", "25% of the package value"],
];

const rules = [
  "Be honest. Describe what I do as it is, and never promise results or follower numbers.",
  "Quote £500 a month to start with. You can come down as far as £350 a month to win the deal. Anything lower, check with me first.",
  "Be kind to everyone you speak to, including the people who say no.",
  "Keep any clinic details you learn private.",
];

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl font-black uppercase mt-12 mb-3" style={{ color: PINK }}>{children}</h2>
);
const Grid = ({ rows }: { rows: Array<[string, string]> }) => (
  <div className="border-2 border-black text-base">
    {rows.map(([k, v], i) => (
      <div key={k} className={`grid gap-2 p-3 ${i ? "border-t-2 border-black" : ""}`} style={{ gridTemplateColumns: "minmax(120px, 190px) 1fr" }}>
        <b>{k}</b><span>{v}</span>
      </div>
    ))}
  </div>
);

export default function SalesProposal() {
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-2xl mx-auto px-5 py-10 text-lg leading-relaxed">
        <div className="text-sm font-bold uppercase tracking-widest mb-2">Social Media Sister</div>
        <h1 className="text-4xl md:text-5xl font-black uppercase leading-tight">Sales partner <span style={{ color: PINK }}>proposal</span></h1>
        <p className="mt-5">I would love you to join me as a Sales Partner for Social Media Sister, bringing new clinics through the door and earning 25% of every package you sign.</p>

        <H2>Hello, and welcome</H2>
        <p className="mb-3">I am Vanessa. I have spent seven years in UK aesthetics social media, thirty years behind a camera, and I have worked with hundreds of clinics. My clients stay because I am honest, I keep them compliant, and I help them show their real personality online.</p>
        <p className="mb-5">I now need a few brilliant people who enjoy chatting to bring in new clinics. You do the talking, I do the delivering. This page tells you exactly how it works, so you can decide with no pressure at all.</p>
        <Grid rows={deal} />

        <H2>How you earn</H2>
        <p className="mb-5">You earn 25% of the value of every package a clinic signs, paid on the same day I am paid. My Black Friday packages are 6 months for the price of 4, or 12 months for the price of 6. I sell at £500 a month, and you can come down to £350 a month to win the deal. Your 25% is worked out on the price the clinic actually pays.</p>
        <div className="border-2 border-black overflow-x-auto">
          <table className="w-full text-base" style={{ minWidth: 520 }}>
            <thead><tr className="bg-black text-white text-left"><th className="p-3">Package</th><th className="p-3">At £500 a month</th><th className="p-3">Your 25%</th><th className="p-3">At £350 a month</th><th className="p-3">Your 25%</th></tr></thead>
            <tbody>
              {earn.map((r) => (
                <tr key={r[0]} className="border-t-2 border-black">
                  <td className="p-3">{r[0]}</td><td className="p-3">{r[1]}</td>
                  <td className="p-3 font-black" style={{ color: PINK }}>{r[2]}</td>
                  <td className="p-3">{r[3]}</td><td className="p-3 font-black" style={{ color: PINK }}>{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3">A 12 month sign up earns you the most, so it is worth gently mentioning both.</p>

        <H2>The journey from stranger to client</H2>
        <p className="mb-4">Every sign up follows the same five steps, and you are in charge of the first four.</p>
        <ol className="flex flex-col gap-4">
          {steps.map((s, i) => (
            <li key={s.t} className="flex gap-4">
              <span className="flex-none w-9 h-9 flex items-center justify-center font-black text-white" style={{ background: PINK }}>{i + 1}</span>
              <span><b>{s.t}</b> {s.d}</span>
            </li>
          ))}
        </ol>

        <H2>What to say</H2>
        <p className="mb-4">The best conversations start with curiosity. Use these as a starting point and put them in your own words, because people can spot a copy and paste from a mile off.</p>
        <div className="flex flex-col gap-4 mb-6">
          {say.map(([k, v]) => (
            <div key={k}>
              <div className="font-black mb-1">{k}</div>
              <div className="border-l-8 pl-4 py-2 bg-neutral-50" style={{ borderColor: PINK }}>{v}</div>
            </div>
          ))}
        </div>
        <p className="mb-2 font-bold">A few golden rules for chatting:</p>
        <ul className="list-disc pl-6 flex flex-col gap-2">{golden.map((g) => <li key={g}>{g}</li>)}</ul>

        <H2>What I give you</H2>
        <p className="mb-3">You will never be left guessing. When you say yes, I give you:</p>
        <ul className="list-disc pl-6 flex flex-col gap-2">{gives.map((g) => <li key={g}>{g}</li>)}</ul>

        <H2>The dashboard</H2>
        <p className="mb-4">I will see everything each partner brings in on one dashboard, and so will you. After each chat, you add a quick line for that person. Nothing is counted twice, and nobody wonders whether a sign up was theirs.</p>
        <Grid rows={columns} />
        <p className="mt-3">A lead belongs to whoever logged it first, so log them the moment you start chatting.</p>

        <H2>Getting paid, ground rules and next steps</H2>
        <p className="mb-3">Your commission is paid by bank transfer on the same day I receive the client's payment. Each payment comes with a short summary of what it covers.</p>
        <p className="mb-3">This is a self employed, commission only role. There is no minimum number of hours and no targets, and either of us can step away at any time.</p>
        <p className="mb-2 font-bold">The ground rules protect you, me and the clinics:</p>
        <ul className="list-disc pl-6 flex flex-col gap-2">{rules.map((r) => <li key={r}>{r}</li>)}</ul>

        <div className="mt-12 p-6 border-2 border-black">
          <div className="text-2xl font-black uppercase mb-2" style={{ color: PINK }}>Ready?</div>
          <p className="mb-3">To say yes, reply to me with "I am in". We will book your 20 minute start up call, I will send your freebies link and your guide to the packages, and you can start chatting whenever suits you.</p>
          <p>I cannot wait to work with you.</p>
          <p className="font-black mt-2">Vanessa</p>
        </div>
      </div>
    </div>
  );
}
