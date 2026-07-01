import React from "react";
import { Link } from "wouter";

const BG = "#000";
const WHITE = "#ffffff";
const RG = "#c4937f";

const H = { color: WHITE, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.08, margin: "56px 0 20px" } as const;

export default function AboutPublic() {
  return (
    <div style={{ background: BG, minHeight: "100vh", color: WHITE, fontFamily: "'League Spartan','Helvetica Neue',sans-serif", overflowX: "hidden" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "80px 32px 120px" }}>
        <Link href="/" style={{ color: RG, fontSize: "16px", fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em" }}>← Home</Link>

        <h1 style={{ ...H, fontSize: "clamp(40px,6vw,76px)", marginTop: "40px" }}>
          The CyberSuite: the toolkit I built to run aesthetic clinics better than anyone else can
        </h1>

        <div style={{ fontSize: "clamp(24px,3vw,34px)", lineHeight: 1.5, fontWeight: 500, color: WHITE }}>
          <p style={{ margin: "0 0 32px" }}>I did not go looking for an off the shelf answer, because there was not one good enough. So I built my own. The CyberSuite is the set of tools I use every single day to run content for aesthetic clinics, and I will say plainly what most people are too polite to say about their own work: it is exceptional, and it is the reason my clients get results other agencies quietly cannot match.</p>

          <p style={{ margin: "0 0 32px" }}>Twenty years in social media. Seven of them living and breathing aesthetics. Somewhere between 300 and 400 clinics through my hands. That is not a CV line, it is 27 years of pattern recognition, and every bit of it is baked into these tools. When you have seen what works across that many clinics, you stop guessing and you start building the exact thing the job actually needs. That is what The CyberSuite is.</p>

          <h2 style={{ ...H, fontSize: "clamp(30px,4vw,48px)" }}>What it lets me do</h2>
          <p style={{ margin: "0 0 32px" }}>I can generate on brand content and captions in a clinic's real voice, not generic filler. I can produce professional imagery through my AI Photo Studio, and turn before and afters and client quotes into polished, scroll stopping graphics without ever opening clunky design software. I can build a full carousel in minutes, schedule a whole month across Instagram and Facebook, and see every client's calendar at a glance so nothing ever slips. I collect real before and after stories straight from clinicians, run everything through proper approval so nothing goes out unchecked, and keep the whole operation compliant while it happens.</p>

          <p style={{ margin: "0 0 32px" }}>In plain terms, work that used to swallow entire weeks now takes an afternoon. Around 100 hours a week, given back. That is not a rounding trick, that is what happens when the tools are built by someone who has actually done the job at scale.</p>

          <h2 style={{ ...H, fontSize: "clamp(30px,4vw,48px)" }}>Why it works when other approaches do not</h2>
          <p style={{ margin: "0 0 32px" }}>Most clinics are not lazy, they are drowning. Trust in this industry is earned slowly and quietly, by showing up consistently and sounding like a real human being, and that is precisely the part that collapses when an owner is exhausted. People book the clinic they already feel they know. Familiarity does the selling long before anyone sees a price.</p>

          <p style={{ margin: "0 0 32px" }}>So I built everything around the two things the industry keeps getting wrong. Consistency, because showing up every week beats being brilliant once a month. And personality, because clinics are so frightened of saying the wrong thing that they end up saying nothing of themselves at all. My tools let a clinic sound unmistakably like itself, safely, inside a system that keeps it compliant. Compliance and character are not opposites. In my hands, they are the same move.</p>

          <h2 style={{ ...H, fontSize: "clamp(30px,4vw,48px)" }}>The honest bit</h2>
          <p style={{ margin: "0 0 32px" }}>This did not come out of a comfortable place. When my best mate walked out of the business and left me high and dry, I had to think fast. I was not just protecting a company, I was protecting relationships I had spent years building, and I was determined my clients would still get the very best of me while I did it. It has not been easy. There have been stretches where I was not happy with my content or my consistency, and I will not pretend otherwise. But I built my way out of it, and that whole problem is now solved. These tools are what I have to show for the hardest chapter of my working life.</p>

          <p style={{ margin: "0 0 32px" }}>I am ADHD, and I stopped apologising for it a long time ago. The way my brain refuses to accept the obvious, easy answer is the entire reason these tools exist. I looked at how clinics were being asked to work, decided it was not good enough, and rebuilt it from the ground up. That restlessness is my competitive advantage, and it is stamped on every feature.</p>

          <p style={{ margin: "0 0 32px" }}>I hold myself to a standard most people would find exhausting, because the clinics that trust me deserve nothing less. This is not a side hustle or a bandwagon. It is the sharpest set of tools in this industry, built by someone who has been in the room, seen it all, and refused to settle.</p>

          <p style={{ margin: "0 0 32px" }}>If it was not for my clients trusting me, letting me work away without hassle, and knowing I could and would pull it round, this business would have been ruined. I will never forget that.</p>

          <p style={{ margin: "0 0 32px" }}>Six months after this all kicked off, 100 hours a week, nearly £10,000 invested, and me teaching myself to code and building the thing from scratch, we FINALLY have lift off.</p>

          <p style={{ margin: "0 0 32px" }}>To my existing clients, you have become friends, and very valued ones. To my future clients, you will never fully know the passion, tenacity and gusto I immerse in my work, and at a ridiculously affordable rate. I know you are not millionaires. I know you work hard. I know you want to leave the NHS. No, I do not charge what my competitors charge, despite my expertise, and the reason is simple. I want us to build something together that is valued way beyond a financial figure. You need someone to hold your hand and do their absolute very best. Well, hello, I am here.</p>

          <p style={{ margin: "0 0 32px" }}>Apart from my feral teens and my adonis horny house husband, The CyberSuite in its entirety is without a doubt my proudest achievement. I honestly cannot believe I have built something this clever entirely out of my own brain.</p>

          <p style={{ margin: "0 0 8px", fontWeight: 800 }}>The best is yet to come. Stay with me.</p>
        </div>
      </div>
    </div>
  );
}
