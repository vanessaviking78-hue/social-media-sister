// /hammeredproposal : the full Hammered sales partner proposal, public so it can be sent as a link.
const YEL = "#FFD600";

const steps = [
  { t: "Spot them.", d: "Find a tradesperson or firm through the Hammered Instagram page, your own contacts or a site you are on. Anyone who works in the trade and has a van, a phone and a reputation to protect is a lead." },
  { t: "Have a proper chat.", d: "Message them, or pick up the phone. Calling is welcome and often works best with tradespeople. Ask about their work and whether anyone is looking after their socials. Builders like being asked about the job they are proudest of." },
  { t: "Send the free trial.", d: "Send your own tracked link to the Hammered free trial page. They get a 5 day bundle of free posts. Your name is on the link, so the sign up is credited to you." },
  { t: "Follow up.", d: "After the 5 days I tweak their sample and send it back. That is your cue to ring or message them: \"Did you see what they did with your photos?\"" },
  { t: "Sign them up.", d: "Agree a price between £250 and £300 a month, tell me, and I take it from there. I handle the contract and take the payment. You log the lead on the dashboard at each stage." },
];

const messages = [
  { t: "The opener", m: "Hi Dave, I saw that loft conversion on your page and it looks cracking. Do you get time to post regularly, or is it a case of the van, the job and then bed?" },
  { t: "Sending the free trial", m: "No pressure at all. There is a free 5 day trial that gets you some ready made posts for your page, using your own photos. Have a look here and tell me what you think: [your tracked link]" },
  { t: "The follow up", m: "Hi Dave, did you get a look at the posts? Hammered does 4 posts and stories a week for £300 a month, so the page keeps working while you are up a roof. Fancy a quick call to talk it through?" },
];

const gives = [
  ["Your own tracked link.", "It is the free trial page with your name on the end, for example www.thecybersuite.com/hammeredfreebies?ref=yourname. Every sign up that comes through it is credited to you."],
  ["The free trial itself.", "A bundle of ready made posts they can look at before they spend a penny."],
  ["The Hammered page.", "Real posts you can point people to, so they can see what a month looks like."],
  ["Leads from me.", "I will load the dashboard with leads for you as well, so you have people to ring and message from day one. They are logged against your name."],
  ["Me.", "If a client has a question you cannot answer, send it to me and I will sort it. You do not need to know social media. You need to be good at chatting."],
];

const rules = [
  "Quote £300 a month. You can go down to £250 to win the deal. Anything lower needs me to say yes first.",
  "Be honest about what Hammered is. I do the posting and the results depend on the business, so please promise nothing about jobs or leads.",
  "Be kind and professional. You are representing me and the trade.",
  "You are self employed. Nothing here is a job offer, and there is no minimum number of hours.",
];

const deal: Array<[string, string]> = [
  ["What you sell", "Hammered, done for you social media for builders, plumbers, sparkies, roofers and every other trade"],
  ["Normal price", "£300 a month for 4 posts and stories a week"],
  ["Lowest price you can agree", "£250 a month, to win the deal"],
  ["Your commission", "20% of the first 3 months' fee, at the price you agreed"],
  ["When you are paid", "The same day I receive the client's payment"],
  ["Your hours", "As many or as few as you like. You are self employed and in charge of your own diary"],
  ["How I see your work", "Your own tracked link and the Hammered sales dashboard"],
];

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl font-black uppercase mt-12 mb-3"><span className="px-2 py-1" style={{ background: YEL }}>{children}</span></h2>
);

export default function HammeredProposal() {
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-2xl mx-auto px-5 py-10 text-lg leading-relaxed">
        <div className="text-sm font-bold uppercase tracking-widest mb-2">Hammered</div>
        <h1 className="text-4xl md:text-5xl font-black uppercase leading-tight">Sales partner proposal</h1>
        <p className="mt-5">I am inviting you to sell Hammered, the social media service I built for the construction trade. You bring me tradespeople and firms who need a steady, trustworthy presence online, and you earn 20% of what they sign up for, paid the same day I am paid.</p>

        <H2>The deal at a glance</H2>
        <div className="border-2 border-black text-base">
          {deal.map(([k, v], i) => (
            <div key={k} className={`grid gap-2 p-3 ${i ? "border-t-2 border-black" : ""}`} style={{ gridTemplateColumns: "minmax(120px, 190px) 1fr" }}>
              <b>{k}</b><span>{v}</span>
            </div>
          ))}
        </div>

        <H2>How you earn</H2>
        <p className="mb-3">Your commission is 20% of the first 3 months' fee, worked out at the price you agree with the client. If a client signs at £300 a month you earn £180. If you need to go down to £250 to win them, you earn £150.</p>
        <div className="border-2 border-black overflow-hidden mb-3">
          <table className="w-full text-base">
            <thead><tr className="bg-black text-white text-left"><th className="p-3">Monthly price</th><th className="p-3">First 3 months</th><th className="p-3">Your 20%</th></tr></thead>
            <tbody>
              {[["£300 (normal)", "£900", "£180"], ["£275", "£825", "£165"], ["£250 (lowest)", "£750", "£150"]].map((r) => (
                <tr key={r[0]} className="border-t-2 border-black"><td className="p-3">{r[0]}</td><td className="p-3">{r[1]}</td><td className="p-3 font-black" style={{ background: YEL }}>{r[2]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Anything under £250 a month needs my say so before you promise it.</p>

        <H2>From first hello to signed, in 5 steps</H2>
        <ol className="flex flex-col gap-4">
          {steps.map((s, i) => (
            <li key={s.t} className="flex gap-4">
              <span className="flex-none w-9 h-9 flex items-center justify-center font-black border-2 border-black" style={{ background: YEL }}>{i + 1}</span>
              <span><b>{s.t}</b> {s.d}</span>
            </li>
          ))}
        </ol>

        <H2>What to say</H2>
        <p className="mb-4">Keep it friendly and short. Tradespeople read messages on a ladder, so nobody wants an essay. Use these as a starting point and make them sound like you.</p>
        <div className="flex flex-col gap-4">
          {messages.map((m) => (
            <div key={m.t}>
              <div className="font-black mb-1">{m.t}</div>
              <div className="border-l-8 pl-4 py-2 bg-neutral-50" style={{ borderColor: YEL }}>{m.m}</div>
            </div>
          ))}
        </div>
        <p className="mt-4"><b>When they say it is too much.</b> Ask what monthly figure feels fair to them, and meet them somewhere between £300 and £250. Never go below £250 without asking me first.</p>

        <H2>What I give you</H2>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          {gives.map(([k, v]) => <li key={k}><b>{k}</b> {v}</li>)}
        </ul>

        <H2>The dashboard and getting paid</H2>
        <p className="mb-3">I keep a Hammered sales dashboard where every lead is logged against the person who brought it in. It shows each lead, where they are (chatting, trial sent, followed up, call booked, signed), the price agreed and the commission earned. Log your leads as you go. The first person to log a business keeps that lead, so log early.</p>
        <p>You are paid the same day I receive the client's payment. I tick the lead as paid on the dashboard so we can both see it.</p>

        <H2>Ground rules</H2>
        <ul className="list-disc pl-6 flex flex-col gap-2">{rules.map((r) => <li key={r}>{r}</li>)}</ul>

        <div className="mt-12 p-6 border-2 border-black" style={{ background: YEL }}>
          <div className="text-2xl font-black uppercase mb-1">To start</div>
          <p>Reply to say yes, tell me the name you want on your link, and I will send you your tracked link and your dashboard access.</p>
        </div>
      </div>
    </div>
  );
}
