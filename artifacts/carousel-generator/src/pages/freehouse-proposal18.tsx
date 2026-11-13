// /freehouseproposal18 : the plain English Freehouse Socials sales partner proposal, public so it can be sent as a link.
const YEL = "#1ad1c4";

const steps = [
  { t: "Find a pub or bar.", d: "Look on the Freehouse Socials Instagram page, ask people you know, or pop into your local and ask who does their posts. Any pub, bar, social club or brewery tap counts." },
  { t: "Say hello.", d: "Send a message, give them a ring or have a word with whoever is behind the bar. Ask about their best night and who does their social media." },
  { t: "Send them your link.", d: "I give you a personal link to a free 5 day trial. It has your name on it, so I know they came from you." },
  { t: "Check in after the trial.", d: "Once I have sent their free posts back, ask what they thought. A quick call works best." },
  { t: "Get a yes.", d: "Freehouse Socials is £49 a month. Tell me they are in and I do the rest, including the contract and taking the payment." },
];

const messages = [
  { t: "First message", m: "Hi Dave, I saw your Sunday roast on your page and it looks brilliant. Do you get time to post much, or is it all pulling pints and changing barrels?" },
  { t: "Sending the trial", m: "No pressure. There is a free 5 day trial that makes you some posts using your own real photos, no robot pints. Have a look and tell me what you think: [your link]" },
  { t: "Checking in", m: "Hi Dave, did you see your free posts? If you like them, I can get them going for you every week. Got 5 minutes for a quick call?" },
];

const rules = [
  "Be honest and friendly. You are speaking for me and for the pub trade.",
  "Do not promise anyone more jobs or leads. I make the posts. I cannot promise what happens next.",
  "Always quote £49 a month and ask me before you offer any other price.",
  "You work for yourself, so you are not an employee and there are no set hours.",
];

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-2xl font-black uppercase mt-12 mb-3"><span className="px-2 py-1" style={{ background: YEL }}>{children}</span></h2>
);

export default function FreehouseProposal18() {
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-2xl mx-auto px-5 py-10 text-lg leading-relaxed">
        <div className="text-sm font-bold uppercase tracking-widest mb-2">Freehouse Socials</div>
        <h1 className="text-4xl md:text-5xl font-black uppercase leading-tight">Sales partner: the plain English version</h1>

        <H2>The job in one minute</H2>
        <p className="mb-3">I run Freehouse Socials. It looks after social media for pubs, bars and social clubs, using their own real photos. Most of them are far too busy to post anything, so their pages sit empty.</p>
        <p className="mb-3">Your job is to find pubs and bars who want that sorted and introduce them to me. If they sign up, you get paid.</p>
        <p>You can work whenever you like and for as long as you like. You choose your own hours.</p>

        <H2>What you earn</H2>
        <p className="mb-3">You get 20% of the first 3 months of what the customer pays me.</p>
        <p className="mb-3">Freehouse Socials costs £49 a month. That is £147 over 3 months, so you earn <b>£29.40</b> for every pub you sign up.</p>
        <p className="mb-5">The price stays at £49 a month. If you ever want to offer something different, ask me first.</p>
        <div className="border-2 border-black overflow-hidden">
          <table className="w-full text-base">
            <thead><tr className="bg-black text-white text-left"><th className="p-3">Price you agree</th><th className="p-3">They pay in 3 months</th><th className="p-3">You earn</th></tr></thead>
            <tbody>
              <tr className="border-t-2 border-black"><td className="p-3">£49 a month</td><td className="p-3">£147</td><td className="p-3 font-black" style={{ background: YEL }}>£29.40</td></tr>
              <tr className="border-t-2 border-black"><td className="p-3">2 pubs</td><td className="p-3">£294</td><td className="p-3 font-black" style={{ background: YEL }}>£58.80</td></tr>
              <tr className="border-t-2 border-black"><td className="p-3">10 pubs</td><td className="p-3">£1,470</td><td className="p-3 font-black" style={{ background: YEL }}>£294</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3">Do not offer any other price without asking me first.</p>

        <H2>What you actually do</H2>
        <ol className="flex flex-col gap-4">
          {steps.map((s, i) => (
            <li key={s.t} className="flex gap-4">
              <span className="flex-none w-9 h-9 flex items-center justify-center font-black border-2 border-black" style={{ background: YEL }}>{i + 1}</span>
              <span><b>{s.t}</b> {s.d}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5">I will also put leads on your dashboard for you to contact, so you will have people to ring from day one.</p>

        <H2>Messages you can copy</H2>
        <p className="mb-4">Change the words so they sound like you. Short and friendly wins.</p>
        <div className="flex flex-col gap-4">
          {messages.map((m) => (
            <div key={m.t}>
              <div className="font-black mb-1">{m.t}</div>
              <div className="border-l-8 pl-4 py-2 bg-neutral-50" style={{ borderColor: YEL }}>{m.m}</div>
            </div>
          ))}
        </div>

        <H2>Getting paid</H2>
        <p className="mb-3">You get your money on the same day I get paid by the customer.</p>
        <p>There is a simple dashboard where you add every person you talk to and move them along as things happen: chatting, trial sent, followed up, call booked, signed. It shows what you have earned. Add people as soon as you speak to them. The first person to add a business keeps it.</p>

        <H2>The rules</H2>
        <ul className="list-disc pl-6 flex flex-col gap-2">{rules.map((r) => <li key={r}>{r}</li>)}</ul>

        <div className="mt-12 p-6 border-2 border-black" style={{ background: YEL }}>
          <div className="text-2xl font-black uppercase mb-1">Ready to start?</div>
          <p>Tell me the name you want on your link and I will send it over with your dashboard login.</p>
        </div>
      </div>
    </div>
  );
}
